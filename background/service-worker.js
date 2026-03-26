/**
 * BlendConv — Background service worker
 * Handles ALL chrome.storage operations (proxied from content scripts),
 * messaging, badge updates, and paste-after-open flow.
 */

const STORAGE_KEY = 'blendconv_conversations';
const DUPLICATE_WINDOW_MS = 30000;
const QUOTA_WARN_THRESHOLD = 0.8;

// Simple async mutex for storage writes
let pending = Promise.resolve();
function enqueue(fn) {
  pending = pending.catch(() => {}).then(fn);
  return pending;
}

// ─── Storage operations (called by content scripts via messages) ───

async function storageGetAll() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return { data: result[STORAGE_KEY] || [] };
  } catch (error) {
    console.error('[BlendConv] Storage read error:', error);
    return { data: [] };
  }
}

function storageSave(conversation) {
  return enqueue(async () => {
    // Read
    let conversations;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      conversations = result[STORAGE_KEY] || [];
    } catch (err) {
      console.error('[BlendConv] Read failed:', err);
      return { ok: false, reason: 'storage_read_error' };
    }

    // Duplicate check
    const isDuplicate = conversations.some(
      (c) =>
        c.url === conversation.url &&
        Math.abs(c.capturedAt - conversation.capturedAt) < DUPLICATE_WINDOW_MS
    );
    if (isDuplicate) {
      return { ok: false, reason: 'duplicate' };
    }

    // Write
    conversations.unshift(conversation);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: conversations });
    } catch (err) {
      console.error('[BlendConv] Write failed:', err);
      return { ok: false, reason: 'storage_write_error' };
    }

    // Quota check
    let quotaWarning = false;
    try {
      const bytes = await chrome.storage.local.getBytesInUse(null);
      const total = chrome.storage.local.QUOTA_BYTES || 10485760;
      quotaWarning = bytes / total >= QUOTA_WARN_THRESHOLD;
    } catch {}

    console.log(`[BlendConv] Saved: ${conversation.id} (${conversation.messageCount} msgs)`);
    return { ok: true, quotaWarning };
  });
}

function storageDelete(id) {
  return enqueue(async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const conversations = (result[STORAGE_KEY] || []).filter((c) => c.id !== id);
      await chrome.storage.local.set({ [STORAGE_KEY]: conversations });
      return { ok: true };
    } catch (error) {
      console.error('[BlendConv] Delete error:', error);
      return { ok: false };
    }
  });
}

async function storageClearAll() {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    console.error('[BlendConv] Clear error:', error);
    return { ok: false };
  }
}

// ─── Message listener ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Storage proxy — content scripts route storage calls here
  if (message.type === 'storage') {
    const { action } = message;

    if (action === 'getAll') {
      storageGetAll().then(sendResponse);
      return true; // keep channel open for async
    }
    if (action === 'save') {
      storageSave(message.conversation).then(sendResponse);
      return true;
    }
    if (action === 'delete') {
      storageDelete(message.id).then(sendResponse);
      return true;
    }
    if (action === 'clearAll') {
      storageClearAll().then(sendResponse);
      return true;
    }
  }

  // Badge notifications
  if (message.type === 'conversation_captured' || message.type === 'conversations_captured') {
    const count = message.count || 1;
    chrome.action.setBadgeBackgroundColor({ color: '#6c5ce7' });
    chrome.action.setBadgeText({ text: count > 1 ? String(count) : '!' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }

  // Open tab and paste merged text
  if (message.type === 'open_and_paste') {
    openAndPaste(message.url, message.text, message.platform);
    sendResponse({ success: true });
  }

  return false;
});

// Clear badge when popup is opened
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    chrome.action.setBadgeText({ text: '' });
  }
});

// ─── Open and paste ───

async function openAndPaste(url, text, platform) {
  try {
    const tab = await chrome.tabs.create({ url });

    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId !== tab.id || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);

      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'paste_text', text });
        } catch {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: injectTextIntoPage,
              args: [text, platform]
            });
          } catch (err) {
            console.warn('[BlendConv] Paste fallback failed:', err);
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: copyToClipboardFallback,
              args: [text]
            }).catch(() => {});
          }
        }
      }, 2000);
    });
  } catch (error) {
    console.error('[BlendConv] open_and_paste error:', error);
  }
}

function injectTextIntoPage(text, platform) {
  const selectors =
    platform === 'chatgpt'
      ? ['#prompt-textarea', 'textarea[data-id="root"]', '[contenteditable="true"][data-placeholder]', 'textarea', '[contenteditable="true"]']
      : ['[contenteditable="true"].ProseMirror', '[contenteditable="true"][data-placeholder]', 'fieldset [contenteditable="true"]', '[contenteditable="true"]'];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (el.tagName === 'TEXTAREA') {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.focus();
      el.textContent = '';
      document.execCommand('insertText', false, text);
    }
    return;
  }
  copyToClipboardFallback(text);
}

function copyToClipboardFallback(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.createElement('div');
    toast.textContent = 'BlendConv: Text copied — paste it here';
    toast.style.cssText =
      'position:fixed;bottom:24px;left:24px;z-index:999999;' +
      'background:#1a1a2e;color:#e0e0e0;border:1px solid rgba(108,92,231,0.3);' +
      'border-radius:12px;padding:12px 20px;font-family:system-ui;font-size:14px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.4);transition:opacity 0.3s;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
  });
}
