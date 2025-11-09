// Emit on URL change
browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
  browser.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});

browser.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  browser.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});

// Update counter on extension logo
let blockedCount = 0;
const color = '#363232ff';
browser.action.setBadgeBackgroundColor({ color });
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'BLOCKED' && sender.tab?.id) {
    blockedCount = message.count;
    const text = blockedCount > 0 ? blockedCount.toString() : '';
    browser.action.setBadgeText({ text, tabId: sender.tab.id });
  }
});