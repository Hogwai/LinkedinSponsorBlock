browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
  browser.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});

browser.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  browser.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});