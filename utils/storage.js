/**
 * BlendConv — Storage utility
 * Handles all chrome.storage operations for captured conversations.
 */

window.StorageManager = (function () {
  'use strict';

  const STORAGE_KEY = 'blendconv_conversations';
  const QUOTA_WARN_THRESHOLD = 0.8;
  const DUPLICATE_WINDOW_MS = 30000;

  // Simple async mutex: queue of pending operations
  let pending = Promise.resolve();

  function enqueue(fn) {
    pending = pending.catch(() => {}).then(fn);
    return pending;
  }

  return {
    /**
     * Retrieve all stored conversations.
     * @returns {Promise<Array>}
     */
    async getAll() {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        return result[STORAGE_KEY] || [];
      } catch (error) {
        console.error('[BlendConv] Storage read error:', error);
        return [];
      }
    },

    /**
     * Check current storage usage against quota.
     * @returns {Promise<{percent: number, warning: boolean}>}
     */
    async checkQuota() {
      try {
        const bytes = await chrome.storage.local.getBytesInUse(null);
        const total = chrome.storage.local.QUOTA_BYTES || 10485760;
        const percent = bytes / total;
        return { percent, warning: percent >= QUOTA_WARN_THRESHOLD };
      } catch {
        return { percent: 0, warning: false };
      }
    },

    /**
     * Save a new conversation to storage.
     * Returns a result object with status and reason for failures.
     *
     * @param {Object} conversation
     * @returns {Promise<{ok: boolean, reason?: string, quotaWarning?: boolean}>}
     */
    save(conversation) {
      return enqueue(async () => {
        // 1. Read current data
        let conversations;
        try {
          const result = await chrome.storage.local.get(STORAGE_KEY);
          conversations = result[STORAGE_KEY] || [];
        } catch (readErr) {
          console.error('[BlendConv] Read failed:', readErr);
          return { ok: false, reason: 'storage_read_error' };
        }

        // 2. Check for duplicates (same URL within 30s window)
        const isDuplicate = conversations.some(
          (c) =>
            c.url === conversation.url &&
            Math.abs(c.capturedAt - conversation.capturedAt) < DUPLICATE_WINDOW_MS
        );
        if (isDuplicate) {
          return { ok: false, reason: 'duplicate' };
        }

        // 3. Write
        conversations.unshift(conversation);
        try {
          await chrome.storage.local.set({ [STORAGE_KEY]: conversations });
        } catch (writeErr) {
          console.error('[BlendConv] Write failed:', writeErr);
          return { ok: false, reason: 'storage_write_error' };
        }

        // 4. Quota check (non-blocking)
        let quotaWarning = false;
        try {
          const q = await this.checkQuota();
          quotaWarning = q.warning;
          if (quotaWarning) {
            console.warn(`[BlendConv] Storage at ${Math.round(q.percent * 100)}%`);
          }
        } catch {
          // ignore
        }

        console.log(`[BlendConv] Saved conversation: ${conversation.id} (${conversation.messageCount} msgs)`);
        return { ok: true, quotaWarning };
      });
    },

    /**
     * Delete a conversation by its ID.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    delete(id) {
      return enqueue(async () => {
        try {
          const result = await chrome.storage.local.get(STORAGE_KEY);
          const conversations = (result[STORAGE_KEY] || []).filter((c) => c.id !== id);
          await chrome.storage.local.set({ [STORAGE_KEY]: conversations });
          return true;
        } catch (error) {
          console.error('[BlendConv] Delete error:', error);
          return false;
        }
      });
    },

    /**
     * Clear all stored conversations.
     * @returns {Promise<boolean>}
     */
    async clearAll() {
      try {
        await chrome.storage.local.remove(STORAGE_KEY);
        return true;
      } catch (error) {
        console.error('[BlendConv] Clear error:', error);
        return false;
      }
    }
  };
})();
