/**
 * BlendConv — Background service worker
 * Handles messaging between content scripts and popup.
 * Orchestrates paste-after-open flow for new tabs.
 */

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'conversation_captured') {
    chrome.action.setBadgeBackgroundColor({ color: '#6c5ce7' });
    chrome.action.setBadgeText({ text: '!' });

    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
  }

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

/**
 * Open a new tab and attempt to paste text into the input field.
 * Falls back to clipboard copy if paste injection fails.
 */
async function openAndPaste(url, text, platform) {
  try {
    const tab = await chrome.tabs.create({ url });

    // Wait for the page to fully load before injecting
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId !== tab.id || changeInfo.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);

      // Give the SPA a moment to render
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'paste_text',
            text
          });
        } catch {
          // Content script might not be loaded yet on a brand new tab.
          // Inject text via scripting API as fallback.
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: injectTextIntoPage,
              args: [text, platform]
            });
          } catch (err) {
            console.warn('[BlendConv] Paste fallback failed, copying to clipboard:', err);
            // Final fallback: copy to clipboard
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: copyToClipboardFallback,
              args: [text]
            });
          }
        }
      }, 2000);
    });
  } catch (error) {
    console.error('[BlendConv] open_and_paste error:', error);
  }
}

/**
 * Injected into the target page to paste text into the input field.
 */
function injectTextIntoPage(text, platform) {
  const selectors =
    platform === 'chatgpt'
      ? [
          '#prompt-textarea',
          'textarea[data-id="root"]',
          '[contenteditable="true"][data-placeholder]',
          'textarea',
          '[contenteditable="true"]'
        ]
      : [
          '[contenteditable="true"].ProseMirror',
          '[contenteditable="true"][data-placeholder]',
          'fieldset [contenteditable="true"]',
          '[contenteditable="true"]'
        ];

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

  // No input found, fallback to clipboard
  copyToClipboardFallback(text);
}

/**
 * Copy text to clipboard and show a notification.
 */
function copyToClipboardFallback(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.createElement('div');
    toast.textContent = 'BlendConv: Text copied to clipboard — paste it here';
    toast.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:999999;' +
      'background:#1a1a2e;color:#e0e0e0;border:1px solid rgba(108,92,231,0.3);' +
      'border-radius:12px;padding:12px 20px;font-family:system-ui;font-size:14px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.4);transition:opacity 0.3s;';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  });
}
