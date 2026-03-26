/**
 * BlendConv — Claude content script
 * Injects the floating capture button on claude.ai and handles conversation extraction.
 */

(function () {
  'use strict';

  // Prevent double injection
  if (document.getElementById('blendconv-capture-btn')) return;

  /**
   * Wait for conversation content to be loaded in the DOM.
   */
  function waitForContent() {
    return new Promise((resolve) => {
      const selectors = [
        '[data-testid="user-message"]',
        '[data-testid="ai-message"]',
        '[data-testid^="human-turn"]',
        '[data-testid^="ai-turn"]',
        '.font-user-message',
        '.font-claude-message'
      ];

      for (const sel of selectors) {
        if (document.querySelector(sel)) {
          resolve();
          return;
        }
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

      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 10000);
    });
  }

  /** Show a toast notification. */
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

    setTimeout(() => {
      toast.classList.remove('visible');
    }, 2000);
  }

  /** Capture the current conversation. */
  async function captureConversation() {
    const btn = document.getElementById('blendconv-capture-btn');
    if (btn) btn.classList.add('capturing');

    try {
      // Check that utils are loaded
      if (!window.Extractor) {
        showToast('Extension error: reload page', true);
        console.error('[BlendConv] window.Extractor is undefined');
        return;
      }
      if (!window.StorageManager) {
        showToast('Extension error: reload page', true);
        console.error('[BlendConv] window.StorageManager is undefined');
        return;
      }

      await waitForContent();

      const messages = window.Extractor.extractClaude();
      console.log(`[BlendConv] Extracted ${messages.length} messages from Claude`);

      if (messages.length === 0) {
        showToast('No messages found', true);
        return;
      }

      const conversation = {
        id: `claude_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        platform: 'claude',
        title: window.Extractor.extractTitle('claude'),
        url: window.location.href,
        messages,
        messageCount: messages.length,
        capturedAt: Date.now()
      };

      console.log('[BlendConv] Saving conversation:', conversation.id, conversation.title);
      const result = await window.StorageManager.save(conversation);
      console.log('[BlendConv] Save result:', result);

      if (result.ok) {
        showToast('\u2713 Captured');
        chrome.runtime.sendMessage({ type: 'conversation_captured' }).catch(() => {});

        if (result.quotaWarning) {
          setTimeout(() => showToast('Storage almost full', true), 2500);
        }
      } else if (result.reason === 'duplicate') {
        showToast('Already captured', true);
      } else {
        showToast('Save failed: ' + (result.reason || 'unknown'), true);
        console.error('[BlendConv] Save failed:', result.reason);
      }
    } catch (error) {
      console.error('[BlendConv] Capture error:', error);
      showToast('Capture failed: ' + error.message, true);
    } finally {
      if (btn) btn.classList.remove('capturing');
    }
  }

  /** Inject the floating button into the page. */
  function injectButton() {
    const btn = document.createElement('button');
    btn.id = 'blendconv-capture-btn';
    btn.title = 'Capture conversation — BlendConv';
    btn.innerHTML = `
      <svg class="blendconv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <line x1="12" y1="8" x2="12" y2="14"/>
        <line x1="9" y1="11" x2="15" y2="11"/>
      </svg>
    `;
    btn.addEventListener('click', captureConversation);
    document.body.appendChild(btn);
  }

  /** Listen for messages from the popup. */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'get_sidebar') {
      try {
        const items = window.Extractor.extractClaudeSidebar();
        sendResponse({ success: true, items });
      } catch (error) {
        console.error('[BlendConv] Sidebar extraction error:', error);
        sendResponse({ success: false, items: [] });
      }
      return true;
    }

    if (message.type === 'capture_current') {
      captureConversation().then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    if (message.type === 'paste_text') {
      try {
        const textarea =
          document.querySelector('[contenteditable="true"].ProseMirror') ||
          document.querySelector('[contenteditable="true"][data-placeholder]') ||
          document.querySelector('fieldset [contenteditable="true"]') ||
          document.querySelector('[contenteditable="true"]');

        if (textarea) {
          textarea.focus();
          textarea.textContent = '';
          document.execCommand('insertText', false, message.text);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, reason: 'Input field not found' });
        }
      } catch (error) {
        sendResponse({ success: false, reason: error.message });
      }
      return true;
    }
  });

  // Initialize
  console.log('[BlendConv] Claude content script loaded');
  injectButton();
})();
