import api from './browser-api.js';

// Global counters
let totalPromotedBlocked = 0;
let totalSuggestedBlocked = 0;
let currentSessionPromoted = 0;
let currentSessionSuggested = 0;
let isEnabled = true;

// Update badge based on enabled state
function updateBadge(enabled) {
    if (enabled) {
        api.action.setBadgeText({ text: '' });
    } else {
        api.action.setBadgeBackgroundColor({ color: '#d72828' });
    }
}

// Load counters from storage on startup
async function loadCounters() {
    const result = await api.storage.local.get({
        totalPromotedBlocked: 0,
        totalSuggestedBlocked: 0,
        enabled: true
    });
    totalPromotedBlocked = result.totalPromotedBlocked;
    totalSuggestedBlocked = result.totalSuggestedBlocked;
    isEnabled = result.enabled;
    updateBadge(isEnabled);
}

// Save counters to storage
async function saveCounters() {
    await api.storage.local.set({
        totalPromotedBlocked,
        totalSuggestedBlocked
    });
}

// Reset session counters when navigating to a new LinkedIn page
function resetSessionCounters() {
    currentSessionPromoted = 0;
    currentSessionSuggested = 0;
    saveCounters();
}

// Emit on URL change
api.webNavigation.onHistoryStateUpdated.addListener((details) => {
    api.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
    resetSessionCounters();
});

api.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
    api.tabs.sendMessage(details.tabId, { type: 'URL_CHANGED', url: details.url });
    resetSessionCounters();
});

// Handle messages from content script and popup
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle blocked posts from content script
    if (message.type === 'BLOCKED' && sender.tab?.id) {
        const sessionPromoted = message.promoted || 0;
        const sessionSuggested = message.suggested || 0;

        // Update global counters
        totalPromotedBlocked += sessionPromoted;
        totalSuggestedBlocked += sessionSuggested;

        // Save and notify popup
        saveCounters();
        api.runtime.sendMessage({
            type: 'COUNTER_UPDATE',
            promoted: totalPromotedBlocked,
            suggested: totalSuggestedBlocked
        }).catch(() => { }); // Popup may not be open
    }

    // Handle request for current counters from popup
    if (message.type === 'GET_COUNTERS') {
        sendResponse({
            promoted: totalPromotedBlocked,
            suggested: totalSuggestedBlocked
        });
    }

    // Handle reset counters
    if (message.type === 'RESET_COUNTERS') {
        totalPromotedBlocked = 0;
        totalSuggestedBlocked = 0;
        currentSessionPromoted = 0;
        currentSessionSuggested = 0;
        saveCounters();
        api.runtime.sendMessage({
            type: 'COUNTER_UPDATE',
            promoted: 0,
            suggested: 0
        }).catch(() => { });
    }

    // Handle settings change (enable/disable extension)
    if (message.type === 'SETTINGS_CHANGED' && message.enabled !== undefined) {
        isEnabled = message.enabled;
        updateBadge(isEnabled);
    }
});

// Initialize counters on startup
loadCounters();
