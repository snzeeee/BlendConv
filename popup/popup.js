/**
 * BlendConv — Popup controller
 * Manages the conversation list, selection, merge, and export actions.
 */

(function () {
  'use strict';

  // State
  const selectedIds = new Set();
  let conversations = [];

  // DOM references
  const listEl = document.getElementById('conversation-list');
  const emptyEl = document.getElementById('empty-state');
  const actionBar = document.getElementById('action-bar');
  const selectedCountEl = document.getElementById('selected-count');
  const mergeBtn = document.getElementById('merge-btn');
  const mergeOverlay = document.getElementById('merge-overlay');
  const mergeOutput = document.getElementById('merge-output');
  const copyBtn = document.getElementById('copy-btn');
  const closeMergeBtn = document.getElementById('close-merge');
  const openChatGPTBtn = document.getElementById('open-chatgpt-btn');
  const openClaudeBtn = document.getElementById('open-claude-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');

  /** Format a timestamp to a relative date string. */
  function formatRelativeDate(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  /** Render the conversation list. */
  function render() {
    listEl.innerHTML = '';

    if (conversations.length === 0) {
      emptyEl.style.display = 'flex';
      actionBar.style.display = 'none';
      listEl.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display = 'flex';
    actionBar.style.display = 'flex';

    conversations.forEach((conv) => {
      const isSelected = selectedIds.has(conv.id);
      const item = document.createElement('div');
      item.className = `conversation-item${isSelected ? ' selected' : ''}`;
      item.dataset.id = conv.id;

      const platformInitial = conv.platform === 'chatgpt' ? 'G' : 'C';
      const platformClass = conv.platform === 'chatgpt' ? 'chatgpt' : 'claude';

      item.innerHTML = `
        <div class="conv-checkbox">
          <svg class="conv-checkbox-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="platform-badge ${platformClass}">${platformInitial}</div>
        <div class="conv-info">
          <div class="conv-title" title="${conv.title}">${escapeHtml(conv.title)}</div>
          <div class="conv-meta">
            <span>${conv.messageCount} message${conv.messageCount !== 1 ? 's' : ''}</span>
            <span>${formatRelativeDate(conv.capturedAt)}</span>
          </div>
        </div>
        <button class="conv-delete" title="Delete">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      // Toggle selection on click
      item.addEventListener('click', (e) => {
        if (e.target.closest('.conv-delete')) return;
        toggleSelection(conv.id);
      });

      // Delete button
      item.querySelector('.conv-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conv.id);
      });

      listEl.appendChild(item);
    });

    updateActionBar();
  }

  /** Toggle conversation selection. */
  function toggleSelection(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    render();
  }

  /** Update the action bar state. */
  function updateActionBar() {
    const count = selectedIds.size;
    selectedCountEl.textContent = `${count} selected`;
    mergeBtn.disabled = count < 2;
  }

  /** Delete a conversation. */
  async function deleteConversation(id) {
    selectedIds.delete(id);
    conversations = conversations.filter((c) => c.id !== id);

    try {
      const STORAGE_KEY = 'blendconv_conversations';
      await chrome.storage.local.set({ [STORAGE_KEY]: conversations });
    } catch (error) {
      console.error('[BlendConv] Delete error:', error);
    }

    render();
  }

  /** Clear all conversations. */
  async function clearAll() {
    if (conversations.length === 0) return;

    selectedIds.clear();
    conversations = [];

    try {
      await chrome.storage.local.remove('blendconv_conversations');
    } catch (error) {
      console.error('[BlendConv] Clear error:', error);
    }

    render();
  }

  /** Perform the merge operation. */
  function performMerge() {
    const selected = conversations.filter((c) => selectedIds.has(c.id));

    if (selected.length < 2) return;

    const result = Merger.merge(selected);
    mergeOutput.textContent = result;
    mergeOverlay.style.display = 'flex';
  }

  /** Copy merged text to clipboard. */
  async function copyMergedText() {
    try {
      await navigator.clipboard.writeText(mergeOutput.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        `;
      }, 1500);
    } catch (error) {
      console.error('[BlendConv] Copy error:', error);
    }
  }

  /** Escape HTML to prevent XSS. */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Load conversations from storage and render. */
  async function init() {
    try {
      const result = await chrome.storage.local.get('blendconv_conversations');
      conversations = result.blendconv_conversations || [];
    } catch (error) {
      console.error('[BlendConv] Init error:', error);
      conversations = [];
    }

    render();

    // Connect to background to clear badge
    chrome.runtime.connect({ name: 'popup' });
  }

  // Event listeners
  mergeBtn.addEventListener('click', performMerge);
  copyBtn.addEventListener('click', copyMergedText);
  closeMergeBtn.addEventListener('click', () => {
    mergeOverlay.style.display = 'none';
  });
  clearAllBtn.addEventListener('click', clearAll);

  openChatGPTBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://chatgpt.com/' });
  });

  openClaudeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://claude.ai/new' });
  });

  // Listen for new captures while popup is open
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'conversation_captured') {
      init();
    }
  });

  // Initialize
  init();
})();
