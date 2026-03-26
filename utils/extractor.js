/**
 * BlendConv — DOM Extractor
 * Extracts conversation messages from ChatGPT and Claude interfaces.
 * Uses multiple fallback selectors for resilience against UI changes.
 */

const Extractor = {
  /**
   * Extract messages from ChatGPT's DOM.
   * @returns {Array<{role: string, content: string}>}
   */
  extractChatGPT() {
    const messages = [];

    // Multiple selector strategies for ChatGPT (ordered by reliability)
    const selectors = [
      '[data-message-author-role]',
      'div.agent-turn, div.user-turn',
      '[class*="message"][class*="row"]',
      'article[data-testid^="conversation-turn"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) continue;

      elements.forEach((el) => {
        try {
          let role, content;

          if (selector === '[data-message-author-role]') {
            role = el.getAttribute('data-message-author-role');
            const contentEl =
              el.querySelector('.markdown') ||
              el.querySelector('[class*="markdown"]') ||
              el.querySelector('.whitespace-pre-wrap') ||
              el;
            content = contentEl?.innerText?.trim();
          } else if (selector.includes('agent-turn')) {
            role = el.classList.contains('agent-turn') ? 'assistant' : 'user';
            const contentEl = el.querySelector('.markdown') || el;
            content = contentEl?.innerText?.trim();
          } else {
            // Generic fallback
            const text = el.innerText?.trim();
            if (!text) return;
            role = el.querySelector('[data-message-author-role="assistant"]')
              ? 'assistant'
              : 'user';
            content = text;
          }

          if (content && content.length > 0) {
            messages.push({ role: role || 'user', content });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing ChatGPT message:', err);
        }
      });

      // If we found messages with this selector, stop trying others
      if (messages.length > 0) break;
    }

    return messages;
  },

  /**
   * Extract messages from Claude's DOM.
   * @returns {Array<{role: string, content: string}>}
   */
  extractClaude() {
    const messages = [];

    // Multiple selector strategies for Claude (ordered by reliability)
    const selectors = [
      '[data-testid="user-message"], [data-testid="ai-message"]',
      '.font-user-message, .font-claude-message',
      '[class*="human-turn"], [class*="ai-turn"]',
      '[class*="MessageContent"], [class*="message-content"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) continue;

      elements.forEach((el) => {
        try {
          let role, content;

          if (selector.includes('data-testid')) {
            const testId = el.getAttribute('data-testid') || '';
            role = testId.includes('user') ? 'user' : 'assistant';
            content = el.innerText?.trim();
          } else if (selector.includes('font-')) {
            role = el.classList.contains('font-user-message')
              ? 'user'
              : 'assistant';
            content = el.innerText?.trim();
          } else {
            const classes = el.className || '';
            role = classes.includes('human') ? 'user' : 'assistant';
            content = el.innerText?.trim();
          }

          if (content && content.length > 0) {
            messages.push({ role, content });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing Claude message:', err);
        }
      });

      if (messages.length > 0) break;
    }

    return messages;
  },

  /**
   * Extract the conversation title from the page.
   * @param {string} platform - 'chatgpt' or 'claude'
   * @returns {string}
   */
  extractTitle(platform) {
    const titleSelectors =
      platform === 'chatgpt'
        ? ['h1', 'title', '[class*="Title"]', 'nav .bg-token-sidebar-surface-secondary .truncate']
        : ['h1', 'title', '[class*="ConversationTitle"]', 'button[data-testid="chat-title"]'];

    for (const selector of titleSelectors) {
      try {
        const el = document.querySelector(selector);
        const text = el?.innerText?.trim() || el?.textContent?.trim();
        if (text && text.length > 0 && text.length < 200) {
          // Clean up the title
          return text.replace(/\n/g, ' ').substring(0, 100);
        }
      } catch {
        continue;
      }
    }

    return `${platform === 'chatgpt' ? 'ChatGPT' : 'Claude'} conversation`;
  }
};
