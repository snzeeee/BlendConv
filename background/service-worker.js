/**
 * BlendConv — Background service worker
 * Handles messaging between content scripts and popup.
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'conversation_captured') {
    // Update badge to indicate new capture
    chrome.action.setBadgeBackgroundColor({ color: '#6c5ce7' });
    chrome.action.setBadgeText({ text: '!' });

    // Clear badge after 3 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
  }

  return false;
});

// Clear badge when popup is opened
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    chrome.action.setBadgeText({ text: '' });
  }
});
