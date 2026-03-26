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

  // ═══════════════════════════════════════════════════════════════
  //  Fetch MESSAGES for a single conversation via API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch full messages for a Claude conversation via API.
   * @param {string} conversationUrl - e.g. "https://claude.ai/chat/abc-123"
   * @returns {Promise<{title: string, messages: Array<{role: string, content: string}>}>}
   */
  async fetchClaudeMessages(conversationUrl) {
    const convId = conversationUrl.split('/chat/')[1]?.split('?')[0];
    if (!convId) throw new Error('Cannot parse conversation ID from URL: ' + conversationUrl);

    console.log(`[BlendConv] Fetching Claude conversation ${convId}...`);

    const orgId = await this._getClaudeOrgId();

    // Try with orgId first, then without
    const endpoints = orgId
      ? [
          `https://claude.ai/api/organizations/${orgId}/chat_conversations/${convId}`,
          `https://claude.ai/api/chat_conversations/${convId}`
        ]
      : [`https://claude.ai/api/chat_conversations/${convId}`];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, { credentials: 'include' });
        if (!res.ok) {
          console.warn(`[BlendConv] Claude API ${res.status} for ${endpoint}`);
          continue;
        }

        const data = await res.json();
        console.log(`[BlendConv] Claude API response keys:`, Object.keys(data));

        const title = data.name || data.title || 'Untitled';
        const messages = [];

        // Claude API returns chat_messages array
        const rawMessages = data.chat_messages || data.messages || [];
        for (const msg of rawMessages) {
          const role = msg.sender === 'human' || msg.role === 'user' ? 'user' : 'assistant';

          // Content can be a string, an array of content blocks, or nested
          let content = '';
          if (typeof msg.text === 'string') {
            content = msg.text;
          } else if (typeof msg.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            content = msg.content
              .map((block) => {
                if (typeof block === 'string') return block;
                if (block.type === 'text') return block.text || '';
                return '';
              })
              .join('\n')
              .trim();
          }

          if (content.length > 0) {
            messages.push({ role, content });
          }
        }

        console.log(`[BlendConv] Parsed ${messages.length} messages for "${title}"`);
        return { title, messages };
      } catch (err) {
        console.warn(`[BlendConv] Claude fetch error for ${endpoint}:`, err);
      }
    }

    throw new Error('All Claude API endpoints failed for conversation ' + convId);
  },

  /**
   * Get ChatGPT access token from the session.
   * Tries multiple sources: page cookies, session API, embedded data.
   */
  async _getChatGPTAccessToken() {
    // Strategy 1: session endpoint (most reliable)
    try {
      const res = await fetch('https://chatgpt.com/api/auth/session', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accessToken) {
          console.log('[BlendConv] Got ChatGPT access token from /api/auth/session');
          return data.accessToken;
        }
      }
    } catch (err) {
      console.warn('[BlendConv] Failed to get token from session endpoint:', err);
    }

    // Strategy 2: look in page script data / __NEXT_DATA__
    try {
      const nextData = document.getElementById('__NEXT_DATA__');
      if (nextData) {
        const parsed = JSON.parse(nextData.textContent);
        const token = parsed?.props?.pageProps?.accessToken;
        if (token) {
          console.log('[BlendConv] Got ChatGPT access token from __NEXT_DATA__');
          return token;
        }
      }
    } catch {}

    // Strategy 3: scan cookies
    try {
      const match = document.cookie.match(/(?:^|;\s*)__Secure-next-auth\.session-token=([^;]+)/);
      if (match) {
        console.log('[BlendConv] Found session cookie (will rely on credentials: include)');
      }
    } catch {}

    console.warn('[BlendConv] No ChatGPT access token found, will try without Authorization header');
    return null;
  },

  /**
   * Fetch full messages for a ChatGPT conversation via API.
   * @param {string} conversationUrl - e.g. "https://chatgpt.com/c/abc-123"
   * @returns {Promise<{title: string, messages: Array<{role: string, content: string}>}>}
   */
  async fetchChatGPTMessages(conversationUrl) {
    const convId = conversationUrl.split('/c/')[1]?.split('?')[0];
    if (!convId) throw new Error('Cannot parse conversation ID from URL: ' + conversationUrl);

    const apiUrl = `https://chatgpt.com/backend-api/conversation/${convId}`;
    console.log(`[BlendConv] Fetching ChatGPT conversation: ${apiUrl}`);

    // Get access token for Authorization header
    const token = await this._getChatGPTAccessToken();

    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(apiUrl, {
      credentials: 'include',
      headers
    });

    console.log(`[BlendConv] ChatGPT API response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      console.error(`[BlendConv] ChatGPT API error body:`, errorBody.substring(0, 500));
      throw new Error(`ChatGPT API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const topKeys = Object.keys(data);
    console.log(`[BlendConv] ChatGPT response top-level keys:`, topKeys);
    console.log(`[BlendConv] title: "${data.title}", mapping nodes: ${Object.keys(data.mapping || {}).length}`);

    const title = data.title || 'Untitled';
    const messages = [];

    // ChatGPT returns a "mapping" object: { nodeId: { message, parent, children } }
    const mapping = data.mapping || {};
    const mappingEntries = Object.entries(mapping);
    console.log(`[BlendConv] Mapping has ${mappingEntries.length} nodes`);

    if (mappingEntries.length === 0) {
      console.warn('[BlendConv] Empty mapping, trying alternate response formats...');
      // Some responses may have messages directly
      if (Array.isArray(data.messages)) {
        for (const msg of data.messages) {
          const role = msg.role || msg.author?.role;
          if (role !== 'user' && role !== 'assistant') continue;
          const content = msg.content || msg.text || '';
          if (content.length > 0) messages.push({ role, content });
        }
        return { title, messages };
      }
      return { title, messages: [] };
    }

    // Traverse the tree from root to build ordered message list
    const ordered = [];

    function traverse(nodeId) {
      const node = mapping[nodeId];
      if (!node) return;
      if (node.message) ordered.push(node.message);
      if (node.children && node.children.length > 0) {
        for (const childId of node.children) {
          traverse(childId);
        }
      }
    }

    // Find root: the node with parent === null or parent === undefined
    let rootFound = false;
    for (const [id, node] of mappingEntries) {
      if (node.parent === null || node.parent === undefined) {
        console.log(`[BlendConv] Root node: ${id}`);
        traverse(id);
        rootFound = true;
        break;
      }
    }

    // Fallback: if no root found, try all nodes with parent not in mapping
    if (!rootFound) {
      console.warn('[BlendConv] No root node found, trying orphan detection...');
      const nodeIds = new Set(mappingEntries.map(([id]) => id));
      for (const [id, node] of mappingEntries) {
        if (!node.parent || !nodeIds.has(node.parent)) {
          traverse(id);
          break;
        }
      }
    }

    console.log(`[BlendConv] Ordered messages from tree: ${ordered.length}`);

    // Log first few messages for debugging
    ordered.slice(0, 3).forEach((msg, i) => {
      console.log(`[BlendConv] msg[${i}]: role=${msg.author?.role}, content_type=${msg.content?.content_type}, parts=${msg.content?.parts?.length || 0}`);
    });

    for (const msg of ordered) {
      const role = msg.author?.role;
      if (role !== 'user' && role !== 'assistant') continue;

      // Extract text from content.parts (most common format)
      let content = '';
      const parts = msg.content?.parts;
      if (Array.isArray(parts)) {
        content = parts
          .map((p) => {
            if (typeof p === 'string') return p;
            if (p && typeof p === 'object' && p.text) return p.text;
            return '';
          })
          .join('\n')
          .trim();
      } else if (typeof msg.content?.text === 'string') {
        content = msg.content.text.trim();
      } else if (typeof msg.content === 'string') {
        content = msg.content.trim();
      }

      if (content.length > 0) {
        messages.push({ role, content });
      }
    }

    console.log(`[BlendConv] Final parsed messages: ${messages.length} for "${title}"`);
    if (messages.length > 0) {
      console.log(`[BlendConv] First message: role=${messages[0].role}, length=${messages[0].content.length}`);
    }

    return { title, messages };
  },

  // ═══════════════════════════════════════════════════════════════
  //  Fetch conversation LIST from sidebar/API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch conversation list from Claude's internal API.
   * Falls back to DOM scraping if the API is inaccessible.
   * @returns {Promise<Array<{title: string, url: string}>>}
   */
  async fetchClaudeConversations() {
    // Strategy 1: Claude internal API
    try {
      // Try to get the organization ID from the page
      const orgId = await this._getClaudeOrgId();
      if (orgId) {
        const res = await fetch(
          `https://claude.ai/api/organizations/${orgId}/chat_conversations?limit=100`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          const items = (Array.isArray(data) ? data : data?.conversations || data?.items || [])
            .filter((c) => c.uuid || c.id)
            .map((c) => ({
              title: c.name || c.title || 'Untitled',
              url: `https://claude.ai/chat/${c.uuid || c.id}`
            }));
          if (items.length > 0) {
            console.log(`[BlendConv] Claude API returned ${items.length} conversations`);
            return items;
          }
        }
      }
    } catch (err) {
      console.warn('[BlendConv] Claude API fetch failed:', err);
    }

    // Strategy 2: Try alternate API paths
    try {
      const res = await fetch('https://claude.ai/api/chat_conversations?limit=100', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const items = (Array.isArray(data) ? data : data?.conversations || [])
          .filter((c) => c.uuid || c.id)
          .map((c) => ({
            title: c.name || c.title || 'Untitled',
            url: `https://claude.ai/chat/${c.uuid || c.id}`
          }));
        if (items.length > 0) {
          console.log(`[BlendConv] Claude API (alt) returned ${items.length} conversations`);
          return items;
        }
      }
    } catch (err) {
      console.warn('[BlendConv] Claude alt API failed:', err);
    }

    // Strategy 3: Fall back to DOM scraping
    console.log('[BlendConv] Falling back to DOM scraping for Claude sidebar');
    return this._scrapeClaudeSidebar();
  },

  /**
   * Get Claude organization ID from page state or API.
   */
  async _getClaudeOrgId() {
    // Try to find it in the page's script data or meta tags
    try {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const text = s.textContent || '';
        const match = text.match(/"orgId"\s*:\s*"([a-f0-9-]+)"/);
        if (match) return match[1];
      }
    } catch {}

    // Try the bootstrap endpoint
    try {
      const res = await fetch('https://claude.ai/api/organizations', {
        credentials: 'include'
      });
      if (res.ok) {
        const orgs = await res.json();
        if (Array.isArray(orgs) && orgs.length > 0) {
          return orgs[0].uuid || orgs[0].id;
        }
      }
    } catch {}

    return null;
  },

  /**
   * Scrape Claude sidebar from DOM (fallback).
   */
  _scrapeClaudeSidebar() {
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
            if (!items.some((i) => i.url === url)) {
              items.push({ title, url });
            }
          }
        } catch {}
      });

      if (items.length > 0) break;
    }

    return items;
  },

  /**
   * Fetch conversation list from ChatGPT's internal API.
   * Falls back to DOM scraping if the API is inaccessible.
   * @returns {Promise<Array<{title: string, url: string}>>}
   */
  async fetchChatGPTConversations() {
    // Strategy 1: ChatGPT backend API with auth token
    try {
      const token = await this._getChatGPTAccessToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const apiUrl = 'https://chatgpt.com/backend-api/conversations?offset=0&limit=100&order=updated';
      console.log(`[BlendConv] Fetching ChatGPT conversation list: ${apiUrl}`);

      const res = await fetch(apiUrl, { credentials: 'include', headers });
      console.log(`[BlendConv] ChatGPT conversations API: ${res.status}`);

      if (res.ok) {
        const data = await res.json();
        console.log(`[BlendConv] ChatGPT conversations response keys:`, Object.keys(data));
        const items = (data?.items || [])
          .filter((c) => c.id && c.title)
          .map((c) => ({
            title: c.title,
            url: `https://chatgpt.com/c/${c.id}`
          }));
        if (items.length > 0) {
          console.log(`[BlendConv] ChatGPT API returned ${items.length} conversations`);
          return items;
        }
      }
    } catch (err) {
      console.warn('[BlendConv] ChatGPT API fetch failed:', err);
    }

    // Strategy 2: Fall back to DOM scraping
    console.log('[BlendConv] Falling back to DOM scraping for ChatGPT sidebar');
    return this._scrapeChatGPTSidebar();
  },

  /**
   * Scrape ChatGPT sidebar from DOM (fallback).
   */
  _scrapeChatGPTSidebar() {
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
            if (!items.some((i) => i.url === url)) {
              items.push({ title, url });
            }
          }
        } catch {}
      });

      if (items.length > 0) break;
    }

    return items;
  }
};
