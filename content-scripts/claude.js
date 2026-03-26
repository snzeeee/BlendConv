/**
 * BlendConv — Claude content script
 * Injects the floating button that opens the selection panel.
 * Handles paste_text messages from the popup/background.
 */

(function () {
  'use strict';

  if (document.getElementById('blendconv-capture-btn')) return;

  /** Inject the floating button (bottom-left). */
  function injectButton() {
    const btn = document.createElement('button');
    btn.id = 'blendconv-capture-btn';
    btn.title = 'BlendConv — Select conversations to capture';
    btn.innerHTML = `
      <svg class="blendconv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <line x1="12" y1="8" x2="12" y2="14"/>
        <line x1="9" y1="11" x2="15" y2="11"/>
      </svg>
    `;
    btn.addEventListener('click', () => {
      window.BlendConvPanel.open('claude');
    });
    document.body.appendChild(btn);
  }

  /** Listen for messages from popup/background. */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'get_sidebar') {
      try {
        const items = window.Extractor.extractClaudeSidebar();
        sendResponse({ success: true, items });
      } catch (error) {
        sendResponse({ success: false, items: [] });
      }
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

  // Update badge on load
  setTimeout(() => window.BlendConvPanel.updateBadge(), 1000);
})();
