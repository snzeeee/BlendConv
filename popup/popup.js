/**
 * BlendConv — Popup controller
 * Shows all captured conversations, allows selection, merge, and export.
 * No tabs, no sidebar — capture happens via the in-page panel.
 */

(function () {
  'use strict';

  const selectedIds = new Set();
  let conversations = [];
  let mergedText = '';

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
  const quotaWarning = document.getElementById('quota-warning');

  // ─── Relative dates ───

  function formatRelativeDate(timestamp) {
    const diff = Date.now() - timestamp;
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

  // ─── Render ───

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
          <div class="conv-title" title="${escapeAttr(conv.title)}">${escapeHtml(conv.title)}</div>
          <div class="conv-meta">
            <span>${conv.messageCount} msg${conv.messageCount !== 1 ? 's' : ''}</span>
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

      item.addEventListener('click', (e) => {
        if (e.target.closest('.conv-delete')) return;
        if (selectedIds.has(conv.id)) {
          selectedIds.delete(conv.id);
        } else {
          selectedIds.add(conv.id);
        }
        render();
      });

      item.querySelector('.conv-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conv.id);
      });

      listEl.appendChild(item);
    });

    const count = selectedIds.size;
    selectedCountEl.textContent = `${count} selected`;
    mergeBtn.disabled = count < 2;
  }

  // ─── Actions ───

  async function deleteConversation(id) {
    selectedIds.delete(id);
    conversations = conversations.filter((c) => c.id !== id);
    try {
      await chrome.storage.local.set({ blendconv_conversations: conversations });
    } catch (error) {
      console.error('[BlendConv] Delete error:', error);
    }
    render();
  }

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

  function performMerge() {
    const selected = conversations.filter((c) => selectedIds.has(c.id));
    if (selected.length < 2) return;
    mergedText = window.Merger.merge(selected);
    mergeOutput.textContent = mergedText;
    mergeOverlay.style.display = 'flex';
  }

  async function copyMergedText() {
    try {
      await navigator.clipboard.writeText(mergedText);
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

  function openAndPaste(url, platform) {
    chrome.runtime.sendMessage({
      type: 'open_and_paste',
      url,
      text: mergedText,
      platform
    });
  }

  // ─── Utilities ───

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── Init ───

  async function init() {
    try {
      const result = await chrome.storage.local.get('blendconv_conversations');
      conversations = result.blendconv_conversations || [];
    } catch (error) {
      conversations = [];
    }
    render();

    // Quota check
    try {
      const bytes = await chrome.storage.local.getBytesInUse(null);
      const total = chrome.storage.local.QUOTA_BYTES || 10485760;
      if (bytes / total >= 0.8) quotaWarning.style.display = 'block';
    } catch {}

    chrome.runtime.connect({ name: 'popup' });
  }

  // ─── Events ───

  mergeBtn.addEventListener('click', performMerge);
  copyBtn.addEventListener('click', copyMergedText);
  closeMergeBtn.addEventListener('click', () => { mergeOverlay.style.display = 'none'; });
  clearAllBtn.addEventListener('click', clearAll);
  openChatGPTBtn.addEventListener('click', () => openAndPaste('https://chatgpt.com/', 'chatgpt'));
  openClaudeBtn.addEventListener('click', () => openAndPaste('https://claude.ai/new', 'claude'));

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'conversation_captured' || msg.type === 'conversations_captured') init();
  });

  init();
})();
