/**
 * BlendConv — Popup controller
 * Manages tabs, conversation list, sidebar browsing, selection, merge, and export.
 */

(function () {
  'use strict';

  // State
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
  const sidebarListEl = document.getElementById('sidebar-list');
  const sidebarEmptyEl = document.getElementById('sidebar-empty');
  const sidebarLoadingEl = document.getElementById('sidebar-loading');

  // ─── Tabs ───

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      target.classList.add('active');

      if (tab.dataset.tab === 'browse') {
        loadSidebar();
      }
    });
  });

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

  // ─── Render captured conversations ───

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
          <div class="conv-title" title="${escapeAttr(conv.title)}">${escapeHtml(conv.title)}</div>
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

      item.addEventListener('click', (e) => {
        if (e.target.closest('.conv-delete')) return;
        toggleSelection(conv.id);
      });

      item.querySelector('.conv-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conv.id);
      });

      listEl.appendChild(item);
    });

    updateActionBar();
  }

  // ─── Sidebar browsing ───

  async function loadSidebar() {
    sidebarListEl.innerHTML = '';
    sidebarEmptyEl.style.display = 'none';
    sidebarLoadingEl.style.display = 'flex';

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab?.url) {
        showSidebarEmpty();
        return;
      }

      const isChatGPT = tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com');
      const isClaude = tab.url.includes('claude.ai');

      if (!isChatGPT && !isClaude) {
        showSidebarEmpty();
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'get_sidebar' });

      sidebarLoadingEl.style.display = 'none';

      if (!response?.success || !response.items || response.items.length === 0) {
        showSidebarEmpty();
        return;
      }

      const platform = isChatGPT ? 'chatgpt' : 'claude';
      renderSidebarItems(response.items, platform, tab.id);
    } catch (error) {
      console.error('[BlendConv] Sidebar load error:', error);
      showSidebarEmpty();
    }
  }

  function showSidebarEmpty() {
    sidebarLoadingEl.style.display = 'none';
    sidebarEmptyEl.style.display = 'flex';
  }

  function renderSidebarItems(items, platform, tabId) {
    sidebarListEl.innerHTML = '';

    const platformInitial = platform === 'chatgpt' ? 'G' : 'C';
    const platformClass = platform === 'chatgpt' ? 'chatgpt' : 'claude';

    // Check which URLs are already captured
    const capturedUrls = new Set(conversations.map((c) => c.url));

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'conversation-item';

      const alreadyCaptured = capturedUrls.has(item.url);

      row.innerHTML = `
        <div class="platform-badge ${platformClass}">${platformInitial}</div>
        <div class="conv-info">
          <div class="conv-title" title="${escapeAttr(item.title)}">${escapeHtml(item.title)}</div>
          <div class="conv-meta">
            <span>${platform === 'chatgpt' ? 'ChatGPT' : 'Claude'}</span>
          </div>
        </div>
        <button class="conv-capture-btn ${alreadyCaptured ? 'captured' : ''}">
          ${alreadyCaptured ? '\u2713' : 'Capture'}
        </button>
      `;

      const captureBtn = row.querySelector('.conv-capture-btn');
      if (!alreadyCaptured) {
        captureBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          captureBtn.textContent = '...';
          captureBtn.disabled = true;

          try {
            // Navigate the tab to this conversation, capture, then return
            await chrome.tabs.update(tabId, { url: item.url });

            // Wait for the page to load
            await new Promise((resolve) => {
              const listener = (id, changeInfo) => {
                if (id === tabId && changeInfo.status === 'complete') {
                  chrome.tabs.onUpdated.removeListener(listener);
                  resolve();
                }
              };
              chrome.tabs.onUpdated.addListener(listener);
            });

            // Give the SPA time to render
            await new Promise((r) => setTimeout(r, 2000));

            // Ask the content script to capture
            await chrome.tabs.sendMessage(tabId, { type: 'capture_current' });

            captureBtn.textContent = '\u2713';
            captureBtn.classList.add('captured');

            // Refresh captured list
            await loadConversations();
          } catch (err) {
            console.error('[BlendConv] Sidebar capture error:', err);
            captureBtn.textContent = 'Error';
            setTimeout(() => {
              captureBtn.textContent = 'Retry';
              captureBtn.disabled = false;
            }, 2000);
          }
        });
      }

      sidebarListEl.appendChild(row);
    });
  }

  // ─── Selection & actions ───

  function toggleSelection(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    render();
  }

  function updateActionBar() {
    const count = selectedIds.size;
    selectedCountEl.textContent = `${count} selected`;
    mergeBtn.disabled = count < 2;
  }

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

  // ─── Merge & export ───

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
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── Init ───

  async function loadConversations() {
    try {
      const result = await chrome.storage.local.get('blendconv_conversations');
      conversations = result.blendconv_conversations || [];
    } catch (error) {
      console.error('[BlendConv] Init error:', error);
      conversations = [];
    }

    render();
  }

  async function checkQuota() {
    try {
      const bytes = await chrome.storage.local.getBytesInUse(null);
      const total = chrome.storage.local.QUOTA_BYTES || 10485760;
      if (bytes / total >= 0.8) {
        quotaWarning.style.display = 'block';
      }
    } catch {
      // Ignore quota check errors
    }
  }

  async function init() {
    await loadConversations();
    checkQuota();

    // Connect to background to clear badge
    chrome.runtime.connect({ name: 'popup' });
  }

  // ─── Event listeners ───

  mergeBtn.addEventListener('click', performMerge);
  copyBtn.addEventListener('click', copyMergedText);
  closeMergeBtn.addEventListener('click', () => {
    mergeOverlay.style.display = 'none';
  });
  clearAllBtn.addEventListener('click', clearAll);

  openChatGPTBtn.addEventListener('click', () => {
    openAndPaste('https://chatgpt.com/', 'chatgpt');
  });

  openClaudeBtn.addEventListener('click', () => {
    openAndPaste('https://claude.ai/new', 'claude');
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'conversation_captured') {
      loadConversations();
    }
  });

  init();
})();
