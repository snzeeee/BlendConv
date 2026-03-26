/**
 * BlendConv — Storage utility
 * Handles all chrome.storage operations for captured conversations.
 */

const StorageManager = {
  STORAGE_KEY: 'blendconv_conversations',

  /**
   * Retrieve all stored conversations.
   * @returns {Promise<Array>} Array of conversation objects
   */
  async getAll() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('[BlendConv] Storage read error:', error);
      return [];
    }
  },

  /**
   * Save a new conversation to storage.
   * @param {Object} conversation - The conversation object to save
   * @returns {Promise<boolean>} Success status
   */
  async save(conversation) {
    try {
      const conversations = await this.getAll();

      // Prevent duplicates based on URL + timestamp proximity (5s window)
      const isDuplicate = conversations.some(
        (c) =>
          c.url === conversation.url &&
          Math.abs(c.capturedAt - conversation.capturedAt) < 5000
      );

      if (isDuplicate) {
        console.warn('[BlendConv] Duplicate conversation, skipping save.');
        return false;
      }

      conversations.unshift(conversation);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: conversations });
      return true;
    } catch (error) {
      console.error('[BlendConv] Storage write error:', error);
      return false;
    }
  },

  /**
   * Delete a conversation by its ID.
   * @param {string} id - Conversation ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    try {
      const conversations = await this.getAll();
      const filtered = conversations.filter((c) => c.id !== id);
      await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });
      return true;
    } catch (error) {
      console.error('[BlendConv] Storage delete error:', error);
      return false;
    }
  },

  /**
   * Clear all stored conversations.
   * @returns {Promise<boolean>} Success status
   */
  async clearAll() {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('[BlendConv] Storage clear error:', error);
      return false;
    }
  }
};
