/**
 * BlendConv — Storage utility
 * Handles all chrome.storage operations for captured conversations.
 * Uses a mutex lock to prevent race conditions on concurrent writes.
 */

window.StorageManager = {
  STORAGE_KEY: 'blendconv_conversations',
  QUOTA_WARN_THRESHOLD: 0.8,
  _lockQueue: Promise.resolve(),

  /**
   * Acquire a lock before performing a read-modify-write operation.
   * Queues operations sequentially to prevent lost updates.
   */
  _withLock(fn) {
    this._lockQueue = this._lockQueue
      .catch(() => {})
      .then(() => fn());
    return this._lockQueue;
  },

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
   * Check current storage usage against quota.
   * @returns {Promise<{used: number, total: number, percent: number, warning: boolean}>}
   */
  async checkQuota() {
    try {
      const bytes = await chrome.storage.local.getBytesInUse(null);
      const total = chrome.storage.local.QUOTA_BYTES || 10485760; // 10 MB default
      const percent = bytes / total;
      return {
        used: bytes,
        total,
        percent,
        warning: percent >= this.QUOTA_WARN_THRESHOLD
      };
    } catch (error) {
      console.error('[BlendConv] Quota check error:', error);
      return { used: 0, total: 10485760, percent: 0, warning: false };
    }
  },

  /**
   * Save a new conversation to storage.
   * Uses a lock to prevent race conditions from concurrent saves.
   * @param {Object} conversation - The conversation object to save
   * @returns {Promise<{saved: boolean, quotaWarning: boolean}>}
   */
  save(conversation) {
    return this._withLock(async () => {
      try {
        const conversations = await this.getAll();

        // Prevent duplicates (30-second window based on URL)
        const isDuplicate = conversations.some(
          (c) =>
            c.url === conversation.url &&
            Math.abs(c.capturedAt - conversation.capturedAt) < 30000
        );

        if (isDuplicate) {
          console.warn('[BlendConv] Duplicate conversation, skipping save.');
          return { saved: false, quotaWarning: false };
        }

        conversations.unshift(conversation);
        await chrome.storage.local.set({ [this.STORAGE_KEY]: conversations });

        // Check quota after save
        const quota = await this.checkQuota();
        if (quota.warning) {
          console.warn(
            `[BlendConv] Storage at ${Math.round(quota.percent * 100)}% capacity ` +
            `(${(quota.used / 1048576).toFixed(1)} MB / ${(quota.total / 1048576).toFixed(1)} MB)`
          );
        }

        return { saved: true, quotaWarning: quota.warning };
      } catch (error) {
        console.error('[BlendConv] Storage write error:', error);
        return { saved: false, quotaWarning: false };
      }
    });
  },

  /**
   * Delete a conversation by its ID.
   * @param {string} id - Conversation ID
   * @returns {Promise<boolean>} Success status
   */
  delete(id) {
    return this._withLock(async () => {
      try {
        const conversations = await this.getAll();
        const filtered = conversations.filter((c) => c.id !== id);
        await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });
        return true;
      } catch (error) {
        console.error('[BlendConv] Storage delete error:', error);
        return false;
      }
    });
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
