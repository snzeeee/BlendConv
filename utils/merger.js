/**
 * BlendConv — Conversation Merger
 * Generates a structured Markdown prompt from multiple conversations.
 */

const Merger = {
  /**
   * Merge multiple conversations into a single Markdown prompt.
   * @param {Array<Object>} conversations - Array of conversation objects
   * @returns {string} Formatted Markdown string
   */
  merge(conversations) {
    if (!conversations || conversations.length === 0) {
      return '';
    }

    const parts = [];

    // Header
    parts.push('# Merged Conversation Context');
    parts.push('');
    parts.push(
      `> This context was assembled from **${conversations.length} conversation${conversations.length > 1 ? 's' : ''}** ` +
      `using [BlendConv](https://github.com/snzeeee/BlendConv).`
    );
    parts.push('');
    parts.push('---');
    parts.push('');

    // Table of contents
    parts.push('## Sources');
    parts.push('');
    conversations.forEach((conv, i) => {
      const platformLabel = conv.platform === 'chatgpt' ? 'ChatGPT' : 'Claude';
      const date = new Date(conv.capturedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      parts.push(
        `${i + 1}. **${platformLabel}** — ${conv.title} (${conv.messages.length} messages, ${date})`
      );
    });
    parts.push('');
    parts.push('---');
    parts.push('');

    // Conversation contents
    conversations.forEach((conv, i) => {
      const platformLabel = conv.platform === 'chatgpt' ? 'ChatGPT' : 'Claude';

      parts.push(`## Conversation ${i + 1}: ${conv.title}`);
      parts.push(`*Source: ${platformLabel} — ${new Date(conv.capturedAt).toLocaleString()}*`);
      parts.push('');

      conv.messages.forEach((msg) => {
        const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
        parts.push(`**${roleLabel}:**`);
        parts.push(msg.content);
        parts.push('');
      });

      // Separator between conversations
      if (i < conversations.length - 1) {
        parts.push('---');
        parts.push('');
      }
    });

    // Footer instruction
    parts.push('---');
    parts.push('');
    parts.push(
      '**Instructions:** The above is the combined context from multiple AI conversations. ' +
      'Please use this context to continue assisting the user, maintaining awareness of all ' +
      'prior discussions and decisions made across these conversations.'
    );

    return parts.join('\n');
  }
};
