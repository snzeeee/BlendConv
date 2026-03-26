/**
 * BlendConv — In-page selection panel
 * Shared logic for the sidebar-scanning overlay on ChatGPT and Claude.
 */

window.BlendConvPanel = (function () {
  'use strict';

  let panelEl = null;
  let backdropEl = null;
  let selectedUrls = new Set();
  let sidebarItems = [];
  let platform = null;

  // ─── Toast ───

  function showToast(message, isError = false) {
    let toast = document.getElementById('blendconv-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'blendconv-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = isError ? 'error' : '';
    void toast.offsetWidth;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }

  // ─── Badge ───

  function updateBadge() {
    const btn = document.getElementById('blendconv-capture-btn');
    if (!btn) return;

    let badge = btn.querySelector('.blendconv-badge');
    window.StorageManager.getAll().then((convs) => {
      const count = convs.length;
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'blendconv-badge';
          btn.appendChild(badge);
        }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
    }).catch(() => {
      setTimeout(updateBadge, 2000);
    });
  }

  // ─── Escape HTML ───

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Build panel DOM ───

  function buildPanel() {
    backdropEl = document.createElement('div');
    backdropEl.id = 'blendconv-panel-backdrop';
    backdropEl.addEventListener('click', closePanel);

    panelEl = document.createElement('div');
    panelEl.id = 'blendconv-panel';

    panelEl.innerHTML = `
      <div class="blendconv-panel-header">
        <h2>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          BlendConv
        </h2>
        <button class="blendconv-panel-close" title="Close">&times;</button>
      </div>
      <div class="blendconv-panel-progress" style="display:none;">
        <div class="blendconv-panel-progress-bar"></div>
      </div>
      <div class="blendconv-panel-body">
        <div class="blendconv-panel-loading">
          <div class="blendconv-panel-spinner"></div>
          <p>Scanning conversations...</p>
        </div>
      </div>
      <div class="blendconv-panel-footer">
        <span class="blendconv-panel-count">0 selected</span>
        <button class="blendconv-panel-validate" disabled>Validate</button>
      </div>
    `;

    // Event listeners on header close and footer validate
    panelEl.querySelector('.blendconv-panel-close').addEventListener('click', closePanel);
    panelEl.querySelector('.blendconv-panel-validate').addEventListener('click', validateSelection);

    document.body.appendChild(backdropEl);
    document.body.appendChild(panelEl);
  }

  // ─── Open / Close ───

  function openPanel(plt) {
    platform = plt;
    selectedUrls.clear();

    if (!panelEl) buildPanel();

    // Show
    backdropEl.style.display = 'block';
    panelEl.style.display = 'flex';

    // Force reflow then animate
    void panelEl.offsetWidth;
    backdropEl.classList.add('visible');
    panelEl.classList.add('visible');

    // Reset body to loading
    const body = panelEl.querySelector('.blendconv-panel-body');
    body.innerHTML = `
      <div class="blendconv-panel-loading">
        <div class="blendconv-panel-spinner"></div>
        <p>Scanning conversations...</p>
      </div>
    `;
    panelEl.querySelector('.blendconv-panel-progress').style.display = 'none';
    updateFooter();

    // Scan (async)
    scanSidebar();
  }

  function closePanel() {
    if (!panelEl) return;
    backdropEl.classList.remove('visible');
    panelEl.classList.remove('visible');
    setTimeout(() => {
      if (backdropEl) backdropEl.style.display = 'none';
      if (panelEl) panelEl.style.display = 'none';
    }, 250);
  }

  // ─── Scan sidebar (uses fetch API first, falls back to DOM) ───

  async function scanSidebar() {
    try {
      sidebarItems =
        platform === 'chatgpt'
          ? await window.Extractor.fetchChatGPTConversations()
          : await window.Extractor.fetchClaudeConversations();

      console.log(`[BlendConv] Found ${sidebarItems.length} conversations`);

      if (sidebarItems.length === 0) {
        showEmptyState();
        return;
      }

      await renderItems();
    } catch (err) {
      console.error('[BlendConv] Sidebar scan error:', err);
      showEmptyState();
    }
  }

  function showEmptyState() {
    const body = panelEl.querySelector('.blendconv-panel-body');
    body.innerHTML = `
      <div class="blendconv-panel-empty">
        <p>No conversations found.</p>
        <p style="color:#555;font-size:11px;">Make sure you are logged in and have conversations.</p>
      </div>
    `;
  }

  // ─── Render items ───

  async function renderItems() {
    const body = panelEl.querySelector('.blendconv-panel-body');
    const listEl = document.createElement('div');
    listEl.className = 'blendconv-panel-list';

    // Get already-captured URLs
    const stored = await window.StorageManager.getAll();
    const capturedUrls = new Set(stored.map((c) => c.url));

    sidebarItems.forEach((item) => {
      const alreadyCaptured = capturedUrls.has(item.url);
      const row = document.createElement('div');
      row.className = 'blendconv-panel-item';
      if (alreadyCaptured) row.classList.add('captured');
      row.dataset.url = item.url;

      row.innerHTML = `
        <div class="blendconv-panel-check">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="blendconv-panel-info">
          <div class="blendconv-panel-title">${esc(item.title)}</div>
          <div class="blendconv-panel-meta">${alreadyCaptured ? 'Already captured' : platform === 'chatgpt' ? 'ChatGPT' : 'Claude'}</div>
        </div>
      `;

      if (!alreadyCaptured) {
        row.addEventListener('click', () => {
          if (selectedUrls.has(item.url)) {
            selectedUrls.delete(item.url);
            row.classList.remove('selected');
          } else {
            selectedUrls.add(item.url);
            row.classList.add('selected');
          }
          updateFooter();
        });
      }

      listEl.appendChild(row);
    });

    body.innerHTML = '';
    body.appendChild(listEl);
  }

  // ─── Footer ───

  function updateFooter() {
    if (!panelEl) return;
    const count = selectedUrls.size;
    const validateBtn = panelEl.querySelector('.blendconv-panel-validate');
    const countEl = panelEl.querySelector('.blendconv-panel-count');

    countEl.textContent = count === 0 ? '0 selected' : `${count} selected`;
    validateBtn.disabled = count === 0;
    validateBtn.textContent = count === 0 ? 'Validate' : `Validate (${count})`;
  }

  // ─── Validate: navigate & capture each selected conversation ───

  async function validateSelection() {
    const urls = [...selectedUrls];
    if (urls.length === 0) return;

    const validateBtn = panelEl.querySelector('.blendconv-panel-validate');
    validateBtn.textContent = 'Capturing...';
    validateBtn.classList.add('processing');
    validateBtn.disabled = true;

    const progressContainer = panelEl.querySelector('.blendconv-panel-progress');
    const progressBar = panelEl.querySelector('.blendconv-panel-progress-bar');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    const originalUrl = window.location.href;
    let captured = 0;
    let failed = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      progressBar.style.width = `${(i / urls.length) * 100}%`;

      try {
        // SPA navigation
        window.location.href = url;
        await waitForNavigation(url);
        await sleep(1500);
        await waitForMessages();

        const messages =
          platform === 'chatgpt'
            ? window.Extractor.extractChatGPT()
            : window.Extractor.extractClaude();

        if (messages.length === 0) {
          console.warn(`[BlendConv] No messages at ${url}`);
          failed++;
          continue;
        }

        const title = window.Extractor.extractTitle(platform);
        const conversation = {
          id: `${platform}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          platform,
          title,
          url: window.location.href,
          messages,
          messageCount: messages.length,
          capturedAt: Date.now()
        };

        const result = await window.StorageManager.save(conversation);
        if (result.ok) {
          captured++;
          console.log(`[BlendConv] Captured: ${title} (${messages.length} msgs)`);
        } else if (result.reason !== 'duplicate') {
          failed++;
        }
      } catch (err) {
        console.error(`[BlendConv] Failed to capture ${url}:`, err);
        failed++;
      }

      progressBar.style.width = `${((i + 1) / urls.length) * 100}%`;
    }

    // Navigate back
    window.location.href = originalUrl;
    await waitForNavigation(originalUrl);
    await sleep(500);

    closePanel();
    updateBadge();

    if (captured > 0) {
      showToast(`${captured} conversation${captured > 1 ? 's' : ''} captured`);
    }
    if (failed > 0) {
      setTimeout(() => showToast(`${failed} failed`, true), 2200);
    }

    try {
      chrome.runtime.sendMessage({ type: 'conversations_captured', count: captured });
    } catch {}
  }

  // ─── Helpers ───

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForNavigation(targetUrl) {
    return new Promise((resolve) => {
      const slug = targetUrl.split('?')[0].split('#')[0].slice(-20);
      const check = () => {
        if (window.location.href.includes(slug)) { resolve(); return; }
        setTimeout(check, 200);
      };

      const onReady = () => {
        window.removeEventListener('popstate', onReady);
        resolve();
      };
      window.addEventListener('popstate', onReady);

      setTimeout(check, 300);
      setTimeout(resolve, 8000);
    });
  }

  function waitForMessages() {
    return new Promise((resolve) => {
      const selectors =
        platform === 'chatgpt'
          ? ['article[data-testid^="conversation-turn-"]', '[data-message-author-role]', '[data-message-id]']
          : ['[data-testid="user-message"]', '[data-testid="ai-message"]', '[data-testid^="human-turn"]', '.font-user-message'];

      for (const sel of selectors) {
        if (document.querySelector(sel)) { resolve(); return; }
      }

      const observer = new MutationObserver((_, obs) => {
        for (const sel of selectors) {
          if (document.querySelector(sel)) {
            obs.disconnect();
            resolve();
            return;
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(); }, 8000);
    });
  }

  // ─── Public API ───

  return {
    open: openPanel,
    close: closePanel,
    updateBadge,
    showToast
  };
})();
