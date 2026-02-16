import api from './browser-api.js';
import { createTranslator } from '../shared/translations.js';
import { SETTINGS_KEYS, DEFAULT_SETTINGS, detectLanguage } from '../shared/settings.js';
import { CONFIG } from '../shared/config.js';

const statusEl = document.getElementById('status');
const scanBtn = document.getElementById('manualScan');
const extensionToggle = document.getElementById('extensionToggle');
const filterPromoted = document.getElementById('filterPromoted');
const filterSuggested = document.getElementById('filterSuggested');
const languageSelect = document.getElementById('languageSelect');
const promotedCountEl = document.getElementById('promotedCount');
const suggestedCountEl = document.getElementById('suggestedCount');
const container = document.querySelector('.container');
const openSettingsBtn = document.getElementById('openSettings');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const resetCountersBtn = document.getElementById('resetCounters');
const resetConfirm = document.getElementById('resetConfirm');
const confirmResetBtn = document.getElementById('confirmReset');
const cancelResetBtn = document.getElementById('cancelReset');
const supportToggle = document.getElementById('supportToggle');
const supportContent = document.getElementById('supportContent');
const reviewLink = document.getElementById('reviewLink');
const reviewBanner = document.getElementById('reviewBanner');
const reviewBannerLink = document.getElementById('reviewBannerLink');
const dismissBannerBtn = document.getElementById('dismissBanner');

let t = createTranslator('en');

// Get current language
function getCurrentLanguage() {
    return languageSelect.value || 'en';
}

// Update UI with current language
let isFirstLoad = true;

function updateUILanguage() {
    const lang = getCurrentLanguage();
    t = createTranslator(lang);

    // Set lang class on body for per-language font overrides (prevents FOIT)
    document.body.className = document.body.className.replace(/\blang-\w+\b/g, '').trim();
    document.body.classList.add(`lang-${lang}`);
    document.documentElement.lang = lang;

    const elements = [...document.querySelectorAll('[data-translate]')];
    const btnText = scanBtn.querySelector('.btn-text');
    if (btnText) elements.push(btnText);

    if (isFirstLoad) {
        // No animation on initial popup open
        elements.forEach(el => {
            const key = el.getAttribute('data-translate') || 'scanNow';
            el.textContent = t(key);
        });
        isFirstLoad = false;
        return;
    }

    // Show skeleton placeholders, then reveal translations one by one
    elements.forEach(el => el.classList.add('skeleton'));

    let i = 0;
    function updateNext() {
        if (i >= elements.length) return;
        const el = elements[i++];
        const key = el.getAttribute('data-translate') || 'scanNow';
        el.classList.remove('skeleton');
        el.classList.add('skeleton-reveal');
        el.textContent = t(key);
        requestAnimationFrame(() => {
            el.classList.remove('skeleton-reveal');
        });
        setTimeout(updateNext, 50);
    }
    setTimeout(updateNext, 150);
}

// Load settings from storage
async function loadSettings() {
    const result = await api.storage.local.get(DEFAULT_SETTINGS);

    extensionToggle.checked = result.enabled;
    filterPromoted.checked = result.filterPromoted;
    filterSuggested.checked = result.filterSuggested;
    promotedCountEl.textContent = result.totalPromotedBlocked;
    suggestedCountEl.textContent = result.totalSuggestedBlocked;

    languageSelect.value = result.language || detectLanguage();

    updateDisabledState(result.enabled);
    updateUILanguage();
}

// Update counters from background
async function updateCounters() {
    const result = await api.storage.local.get({
        [SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED]: 0,
        [SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED]: 0
    });
    promotedCountEl.textContent = result[SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED];
    suggestedCountEl.textContent = result[SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED];
}

// Save settings to storage
async function saveSettings(settings) {
    await api.storage.local.set(settings);
}

// Update UI disabled state
function updateDisabledState(enabled) {
    if (enabled) {
        container.classList.remove('disabled');
    } else {
        container.classList.add('disabled');
    }
}

// Toggle extension on/off
extensionToggle.addEventListener('change', async () => {
    const enabled = extensionToggle.checked;
    await saveSettings({ enabled });
    updateDisabledState(enabled);

    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('linkedin.com')) {
        api.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED', enabled });
    }
    api.runtime.sendMessage({ type: 'SETTINGS_CHANGED', enabled });

    setStatus(enabled ? t('extensionEnabled') : t('extensionDisabled'), 'success');
    setTimeout(() => setStatus(''), 2000);
});

// Filter promoted toggle
filterPromoted.addEventListener('change', async () => {
    await saveSettings({ filterPromoted: filterPromoted.checked });
    notifyContentScript({ type: 'SETTINGS_CHANGED', filterPromoted: filterPromoted.checked });
});

// Filter suggested toggle
filterSuggested.addEventListener('change', async () => {
    await saveSettings({ filterSuggested: filterSuggested.checked });
    notifyContentScript({ type: 'SETTINGS_CHANGED', filterSuggested: filterSuggested.checked });
});

// Language selector change
languageSelect.addEventListener('change', async () => {
    const language = languageSelect.value;
    await saveSettings({ language });
    updateUILanguage();
});

// Open settings modal
openSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('active');
    languageSelect.value = getCurrentLanguage();
});

// Close settings modal
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

// Show reset confirmation
resetCountersBtn.addEventListener('click', () => {
    resetCountersBtn.classList.add('hidden');
    resetConfirm.classList.remove('hidden');
});

// Cancel reset
cancelResetBtn.addEventListener('click', () => {
    resetConfirm.classList.add('hidden');
    resetCountersBtn.classList.remove('hidden');
});

// Confirm reset
confirmResetBtn.addEventListener('click', async () => {
    await saveSettings({
        [SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED]: 0,
        [SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED]: 0
    });

    promotedCountEl.textContent = '0';
    suggestedCountEl.textContent = '0';

    api.runtime.sendMessage({ type: 'RESET_COUNTERS' });

    resetConfirm.classList.add('hidden');
    resetCountersBtn.classList.remove('hidden');

    settingsModal.classList.remove('active');

    setStatus(t('countersReset'), 'success');
    setTimeout(() => setStatus(''), 3000);
});

// Notify content script of settings changes
async function notifyContentScript(message) {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('linkedin.com')) {
        api.tabs.sendMessage(tab.id, message);
    }
}

// Manual scan button
scanBtn.addEventListener('click', async () => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com')) {
        setStatus(t('notOnLinkedIn'), 'error');
        return;
    }

    setStatus(t('scanning'), 'pending');
    scanBtn.disabled = true;

    api.tabs.sendMessage(tab.id, { type: 'MANUAL_SCAN' }, (response) => {
        if (api.runtime.lastError) {
            setStatus(t('error'), 'error');
        } else if (response) {
            const msg = [];
            if (response.promoted > 0) msg.push(`${response.promoted} promoted`);
            if (response.suggested > 0) msg.push(`${response.suggested} suggested`);
            if (msg.length > 0) {
                setStatus(`${msg.join(', ')} hidden`, 'success');
            } else {
                setStatus(t('noPostsFound'), 'success');
            }
        } else {
            setStatus(t('noPostsFound'), 'success');
        }
        scanBtn.disabled = false;
        setTimeout(() => setStatus(''), 3000);
    });
});

// Listen for counter updates from background
api.runtime.onMessage.addListener((message) => {
    if (message.type === 'COUNTER_UPDATE') {
        promotedCountEl.textContent = message.promoted;
        suggestedCountEl.textContent = message.suggested;
    }
});

// Update counters when popup opens
api.runtime.onConnect.addListener((port) => {
    if (port.name === 'counterUpdate') {
        port.onMessage.addListener((msg) => {
            if (msg.type === 'COUNTER_UPDATE') {
                promotedCountEl.textContent = msg.promoted;
                suggestedCountEl.textContent = msg.suggested;
            }
        });
    }
});

function setStatus(text, type = '') {
    statusEl.textContent = text;
    statusEl.className = type;
}

// Support section collapsible toggle
supportToggle.addEventListener('click', () => {
    supportToggle.classList.toggle('open');
    supportContent.classList.toggle('open');
});

// Set review link based on platform
const isFirefox = typeof browser !== 'undefined' && browser.runtime?.getURL;
const reviewUrl = isFirefox ? CONFIG.REVIEW_URLS.firefox : CONFIG.REVIEW_URLS.chrome;
reviewLink.href = reviewUrl;
reviewBannerLink.href = reviewUrl;

// Review banner (time-based, dismissable)
async function checkReviewBanner() {
    const result = await api.storage.local.get({
        [SETTINGS_KEYS.INSTALL_DATE]: 0,
        [SETTINGS_KEYS.REVIEW_BANNER_DISMISSED]: false
    });
    if (result[SETTINGS_KEYS.REVIEW_BANNER_DISMISSED]) return;

    const installDate = result[SETTINGS_KEYS.INSTALL_DATE];
    if (!installDate) return;

    const daysSinceInstall = (Date.now() - installDate) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall >= CONFIG.REVIEW_THRESHOLD_DAYS) {
        reviewBanner.style.display = '';
    }
}

dismissBannerBtn.addEventListener('click', async () => {
    reviewBanner.style.display = 'none';
    await api.storage.local.set({ [SETTINGS_KEYS.REVIEW_BANNER_DISMISSED]: true });
});

// Initialize
loadSettings();
updateCounters();
checkReviewBanner();
