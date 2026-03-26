/**
 * BlendConv — DOM Extractor
 * Extracts conversation messages from ChatGPT and Claude interfaces.
 * Uses multiple fallback selectors for resilience against UI changes.
 * Updated for 2026 DOM structures.
 */

window.Extractor = {
  /**
   * Extract messages from ChatGPT's DOM.
   * Captures both user messages and assistant responses.
   * @returns {Array<{role: string, content: string}>}
   */
  extractChatGPT() {
    const messages = [];

    // Strategy 1: conversation turn articles (most reliable in 2025-2026 UI)
    const turnArticles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
    if (turnArticles.length > 0) {
      turnArticles.forEach((article) => {
        try {
          // Each turn contains a data-message-author-role element
          const roleEl = article.querySelector('[data-message-author-role]');
          const role = roleEl?.getAttribute('data-message-author-role') || 'user';

          // Extract content from the markdown container or text wrapper
          const contentEl =
            article.querySelector('[data-message-id] .markdown') ||
            article.querySelector('[data-message-id] [class*="markdown"]') ||
            article.querySelector('[data-message-id] .whitespace-pre-wrap') ||
            article.querySelector('[data-message-id]') ||
            article.querySelector('.markdown') ||
            article.querySelector('.whitespace-pre-wrap');

          const content = contentEl?.innerText?.trim();
          if (content && content.length > 0) {
            messages.push({
              role: role === 'assistant' ? 'assistant' : 'user',
              content
            });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing ChatGPT turn:', err);
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: data-message-author-role attribute (direct message targeting)
    const roleEls = document.querySelectorAll('[data-message-author-role]');
    if (roleEls.length > 0) {
      roleEls.forEach((el) => {
        try {
          const role = el.getAttribute('data-message-author-role');
          const contentEl =
            el.querySelector('.markdown') ||
            el.querySelector('[class*="markdown"]') ||
            el.querySelector('.whitespace-pre-wrap') ||
            el;
          const content = contentEl?.innerText?.trim();
          if (content && content.length > 0) {
            messages.push({
              role: role === 'assistant' ? 'assistant' : 'user',
              content
            });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing ChatGPT message:', err);
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 3: thread container with grouped messages (newer layout)
    const threadContainer =
      document.querySelector('[class*="thread"]') ||
      document.querySelector('main [role="presentation"]');
    if (threadContainer) {
      const groups = threadContainer.querySelectorAll('[data-message-id]');
      groups.forEach((group) => {
        try {
          const roleAttr = group.closest('[data-message-author-role]');
          const role = roleAttr?.getAttribute('data-message-author-role') || 'user';
          const contentEl =
            group.querySelector('.markdown') ||
            group.querySelector('.whitespace-pre-wrap') ||
            group;
          const content = contentEl?.innerText?.trim();
          if (content && content.length > 0) {
            messages.push({
              role: role === 'assistant' ? 'assistant' : 'user',
              content
            });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing ChatGPT group:', err);
        }
      });
    }

    return messages;
  },

  /**
   * Extract messages from Claude's DOM.
   * Captures both user messages and assistant responses.
   * @returns {Array<{role: string, content: string}>}
   */
  extractClaude() {
    const messages = [];

    // Strategy 1: data-testid based selectors (most reliable)
    const testIdEls = document.querySelectorAll(
      '[data-testid="user-message"], [data-testid="ai-message"]'
    );
    if (testIdEls.length > 0) {
      testIdEls.forEach((el) => {
        try {
          const testId = el.getAttribute('data-testid') || '';
          const role = testId.includes('user') ? 'user' : 'assistant';
          const content = el.innerText?.trim();
          if (content && content.length > 0) {
            messages.push({ role, content });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing Claude message:', err);
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: conversation turn containers (2025-2026 layout)
    const humanTurns = document.querySelectorAll('[data-testid^="human-turn"], [data-testid^="ai-turn"]');
    if (humanTurns.length > 0) {
      humanTurns.forEach((el) => {
        try {
          const testId = el.getAttribute('data-testid') || '';
          const role = testId.startsWith('human') ? 'user' : 'assistant';
          // Get the message content, skip UI chrome (buttons, avatars)
          const contentEl =
            el.querySelector('[data-testid="user-message"], [data-testid="ai-message"]') ||
            el.querySelector('.font-user-message, .font-claude-message') ||
            el.querySelector('[class*="message-content"]') ||
            el;
          const content = contentEl?.innerText?.trim();
          if (content && content.length > 0) {
            messages.push({ role, content });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing Claude turn:', err);
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 3: font-based class selectors
    const fontEls = document.querySelectorAll(
      '.font-user-message, .font-claude-message'
    );
    if (fontEls.length > 0) {
      fontEls.forEach((el) => {
        try {
          const role = el.classList.contains('font-user-message') ? 'user' : 'assistant';
          const content = el.innerText?.trim();
          if (content && content.length > 0) {
            messages.push({ role, content });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing Claude font message:', err);
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 4: broad class-based fallback
    const broadEls = document.querySelectorAll(
      '[class*="human-turn"], [class*="ai-turn"], [class*="MessageContent"], [class*="message-content"]'
    );
    broadEls.forEach((el) => {
      try {
        const classes = el.className || '';
        const role = classes.includes('human') || classes.includes('user') ? 'user' : 'assistant';
        const content = el.innerText?.trim();
        if (content && content.length > 0) {
          messages.push({ role, content });
        }
      } catch (err) {
        console.warn('[BlendConv] Error parsing Claude fallback:', err);
      }
    });

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
        ? [
            'h1',
            'nav [class*="active"] .truncate',
            'nav .bg-token-sidebar-surface-secondary .truncate',
            '[class*="Title"]',
            'title'
          ]
        : [
            'button[data-testid="chat-title"]',
            'h1',
            '[class*="ConversationTitle"]',
            'title'
          ];

    for (const selector of titleSelectors) {
      try {
        const el = document.querySelector(selector);
        const text = el?.innerText?.trim() || el?.textContent?.trim();
        if (text && text.length > 0 && text.length < 200) {
          return text.replace(/\n/g, ' ').substring(0, 100);
        }
      } catch {
        continue;
      }
    }

    return `${platform === 'chatgpt' ? 'ChatGPT' : 'Claude'} conversation`;
  },

  /**
   * Extract sidebar conversation list from ChatGPT.
   * @returns {Array<{title: string, url: string}>}
   */
  extractChatGPTSidebar() {
    const items = [];
    const selectors = [
      'nav a[href^="/c/"]',
      'nav ol li a[href^="/c/"]',
      'nav [class*="conversation"] a'
    ];

    for (const selector of selectors) {
      const links = document.querySelectorAll(selector);
      if (links.length === 0) continue;

      links.forEach((link) => {
        try {
          const title = link.innerText?.trim();
          const href = link.getAttribute('href');
          if (title && href && title.length > 0) {
            const url = href.startsWith('http') ? href : `https://chatgpt.com${href}`;
            items.push({ title, url });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing ChatGPT sidebar item:', err);
        }
      });

      if (items.length > 0) break;
    }

    return items;
  },

  /**
   * Extract sidebar conversation list from Claude.
   * @returns {Array<{title: string, url: string}>}
   */
  extractClaudeSidebar() {
    const items = [];
    const selectors = [
      'nav a[href^="/chat/"]',
      'a[href^="/chat/"][class*="conversation"]',
      '[data-testid*="conversation-list"] a',
      'aside a[href^="/chat/"]'
    ];

    for (const selector of selectors) {
      const links = document.querySelectorAll(selector);
      if (links.length === 0) continue;

      links.forEach((link) => {
        try {
          const title = link.innerText?.trim();
          const href = link.getAttribute('href');
          if (title && href && title.length > 0) {
            const url = href.startsWith('http') ? href : `https://claude.ai${href}`;
            items.push({ title, url });
          }
        } catch (err) {
          console.warn('[BlendConv] Error parsing Claude sidebar item:', err);
        }
      });

      if (items.length > 0) break;
    }

    return items;
  }
};
