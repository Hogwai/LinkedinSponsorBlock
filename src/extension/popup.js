import api from './browser-api.js';

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

// Translations
const translations = {
    en: {
        'blockedPromotedPosts': 'blocked promoted posts',
        'blockedSuggestedPosts': 'blocked suggested posts',
        'filterOptions': 'Filter options',
        'blockPromotedPosts': 'Block promoted posts',
        'blockSuggestedPosts': 'Block suggested posts',
        'scanNow': 'Scan now',
        'extensionEnabled': 'Extension enabled',
        'extensionDisabled': 'Extension disabled',
        'extensionDisabledBanner': 'Extension is disabled',
        'notOnLinkedIn': 'You are not on LinkedIn',
        'scanning': 'Scanning...',
        'error': 'Error',
        'noPostsFound': 'No posts found',
        'countersReset': 'Counters have been reset',
        'language': 'Language',
        'settingsTitle': 'Settings',
        'extensionSettings': 'Extension',
        'enableExtension': 'Enable extension',
        'languageSettings': 'Language Settings',
        'counterSettings': 'Counter Settings',
        'resetCountersDescription': 'Reset all counters to zero. This action cannot be undone.',
        'resetCounters': 'Reset Counters',
        'confirmReset': 'Reset counters?',
        'yes': 'Yes',
        'no': 'No'
    },
    fr: {
        'blockedPromotedPosts': 'posts promotionnels bloqués',
        'blockedSuggestedPosts': 'posts suggérés bloqués',
        'filterOptions': 'Options de filtrage',
        'blockPromotedPosts': 'Bloquer les posts sponsorisés',
        'blockSuggestedPosts': 'Bloquer les posts suggérés',
        'scanNow': 'Analyser maintenant',
        'extensionEnabled': 'Extension activée',
        'extensionDisabled': 'Extension désactivée',
        'extensionDisabledBanner': 'L\'extension est désactivée',
        'notOnLinkedIn': 'Vous n\'êtes pas sur LinkedIn',
        'scanning': 'Analyse en cours...',
        'error': 'Erreur',
        'noPostsFound': 'Aucun post trouvé',
        'countersReset': 'Les compteurs ont été réinitialisés',
        'language': 'Langue',
        'settingsTitle': 'Paramètres',
        'extensionSettings': 'Extension',
        'enableExtension': 'Activer l\'extension',
        'languageSettings': 'Paramètres de langue',
        'counterSettings': 'Paramètres des compteurs',
        'resetCountersDescription': 'Réinitialiser tous les compteurs à zéro. Cette action est irréversible.',
        'resetCounters': 'Réinitialiser les compteurs',
        'confirmReset': 'Réinitialiser ?',
        'yes': 'Oui',
        'no': 'Non'
    }
};

// Default settings
const defaultSettings = {
    enabled: true,
    filterPromoted: true,
    filterSuggested: true,
    totalPromotedBlocked: 0,
    totalSuggestedBlocked: 0,
    language: 'en'
};

// Get translation for a key
function t(key) {
    const currentLang = getCurrentLanguage();
    return translations[currentLang][key] || key;
}

// Get current language
function getCurrentLanguage() {
    return languageSelect.value || 'en';
}

// Update UI with current language
function updateUILanguage() {
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (key) {
            element.textContent = t(key);
        }
    });

    const btnText = scanBtn.querySelector('.btn-text');
    if (btnText) {
        btnText.textContent = t('scanNow');
    }
}

// Load settings from storage
async function loadSettings() {
    const result = await api.storage.local.get(defaultSettings);

    extensionToggle.checked = result.enabled;
    filterPromoted.checked = result.filterPromoted;
    filterSuggested.checked = result.filterSuggested;
    promotedCountEl.textContent = result.totalPromotedBlocked;
    suggestedCountEl.textContent = result.totalSuggestedBlocked;

    languageSelect.value = result.language || 'en';

    updateDisabledState(result.enabled);
    updateUILanguage();
}

// Update counters from background
async function updateCounters() {
    const result = await api.storage.local.get({
        totalPromotedBlocked: 0,
        totalSuggestedBlocked: 0
    });
    promotedCountEl.textContent = result.totalPromotedBlocked;
    suggestedCountEl.textContent = result.totalSuggestedBlocked;
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
        totalPromotedBlocked: 0,
        totalSuggestedBlocked: 0
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

// Initialize
loadSettings();
updateCounters();
