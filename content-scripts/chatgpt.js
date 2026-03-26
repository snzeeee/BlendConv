/**
 * BlendConv — ChatGPT content script
 * Injects the floating capture button on chatgpt.com and handles conversation extraction.
 */

(function () {
  'use strict';

  // Prevent double injection
  if (document.getElementById('blendconv-capture-btn')) return;

  /**
   * Wait for conversation content to be loaded in the DOM.
   * Uses MutationObserver for dynamically rendered content.
   */
  function waitForContent() {
    return new Promise((resolve) => {
      const selectors = [
        '[data-message-author-role]',
        'div.agent-turn',
        'article[data-testid^="conversation-turn"]'
      ];

      // Check if content already exists
      for (const sel of selectors) {
        if (document.querySelector(sel)) {
          resolve();
          return;
        }
      }

      // Observe DOM for dynamic content loading
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

      // Timeout after 10 seconds
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

    // Trigger reflow for animation
    void toast.offsetWidth;
    toast.classList.add('visible');

    setTimeout(() => {
      toast.classList.remove('visible');
    }, 2000);
  }

  /** Capture the current conversation. */
  async function captureConversation() {
    const btn = document.getElementById('blendconv-capture-btn');
    btn.classList.add('capturing');

    try {
      await waitForContent();

      const messages = Extractor.extractChatGPT();

      if (messages.length === 0) {
        showToast('No messages found', true);
        return;
      }

      const conversation = {
        id: `chatgpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        platform: 'chatgpt',
        title: Extractor.extractTitle('chatgpt'),
        url: window.location.href,
        messages,
        messageCount: messages.length,
        capturedAt: Date.now()
      };

      const saved = await StorageManager.save(conversation);

      if (saved) {
        showToast('\u2713 Captured');
        // Notify the popup if open
        chrome.runtime.sendMessage({ type: 'conversation_captured' }).catch(() => {});
      } else {
        showToast('Already captured', true);
      }
    } catch (error) {
      console.error('[BlendConv] Capture error:', error);
      showToast('Capture failed', true);
    } finally {
      btn.classList.remove('capturing');
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

  // Initialize
  injectButton();
})();
