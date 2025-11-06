chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  chrome.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});

chrome.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
  chrome.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
});