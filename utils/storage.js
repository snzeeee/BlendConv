/**
 * BlendConv — Storage proxy for content scripts
 * Routes all storage operations through the service worker via chrome.runtime.sendMessage.
 * This avoids chrome.storage.local being undefined in content script contexts.
 */

window.StorageManager = (function () {
  'use strict';

  /**
   * Send a message to the service worker and wait for a response.
   */
  function send(action, data) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { type: 'storage', action, ...data },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[BlendConv] Message error:', chrome.runtime.lastError.message);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response);
          }
        );
      } catch (err) {
        console.error('[BlendConv] sendMessage failed:', err);
        reject(err);
      }
    });
  }

  return {
    /**
     * Retrieve all stored conversations.
     * @returns {Promise<Array>}
     */
    async getAll() {
      try {
        const res = await send('getAll');
        return res?.data || [];
      } catch {
        return [];
      }
    },

    /**
     * Save a new conversation.
     * @param {Object} conversation
     * @returns {Promise<{ok: boolean, reason?: string, quotaWarning?: boolean}>}
     */
    async save(conversation) {
      try {
        const res = await send('save', { conversation });
        return res || { ok: false, reason: 'no_response' };
      } catch (err) {
        return { ok: false, reason: err.message || 'send_failed' };
      }
    },

    /**
     * Delete a conversation by ID.
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
      try {
        const res = await send('delete', { id });
        return res?.ok || false;
      } catch {
        return false;
      }
    },

    /**
     * Clear all stored conversations.
     * @returns {Promise<boolean>}
     */
    async clearAll() {
      try {
        const res = await send('clearAll');
        return res?.ok || false;
      } catch {
        return false;
      }
    }
  };
})();
