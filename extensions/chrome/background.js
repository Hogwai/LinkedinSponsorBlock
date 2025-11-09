// Emit on URL change
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  chrome.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  chrome.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});

// Update counter on extension logo
let blockedCount = 0;
const color = '#363232ff';
chrome.action.setBadgeBackgroundColor({ color });
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'BLOCKED' && sender.tab?.id) {
    blockedCount = message.count;
    const text = blockedCount > 0 ? blockedCount.toString() : '';
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
  }
});