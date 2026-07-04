import { logger } from './logger.js';
import { SHARED_KEYWORDS } from './keywords.js';

function createDetection(keywordCategory, keywordSelectors, childSelectors = []) {
    return {
        keywordSelectors,
        keywords: SHARED_KEYWORDS[keywordCategory],
        childSelectors,
    };
}

function createProfile({ feedWrapper, postContainers, detection }) {
    return {
        feedWrapper: { ...feedWrapper },
        postContainers: [...postContainers],
        detection,
    };
}

const DEFAULT_FEED_WRAPPER = {
    newFeed: '[data-testid="mainFeed"]',
    desktop: '[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]',
    mobile: 'ol.feed-container',
};

const DEFAULT_POST_CONTAINERS = [
    'div[data-lazy-mount-id]',
    'div[data-display-contents="true"]',
    '.ember-view.occludable-update',
    '[class*="ember-view"][class*="occludable-update"]',
    'div[class*="feed-shared-update-v2"][id*="ember"]',
    'article[data-id="main-feed-card"]',
    'div[data-view-tracking-scope*=\'transporterKeys":["sponsored"]\']',
    'div[data-view-tracking-scope*=\'transporterKeys":["default"]\']',
    'li.feed-item',
];

export const CONFIG = {
    activeProfile: 'modern',
    profiles: {
        modern: createProfile({
            feedWrapper: DEFAULT_FEED_WRAPPER,
            postContainers: DEFAULT_POST_CONTAINERS,
            detection: {
                sponsored: createDetection(
                    'sponsored',
                    ['p[componentkey]', 'p[componentkey] > span', 'p[class]', 'p[class] > span'],
                    ['article[data-sponsored-tracking-url]'],
                ),
                suggested: createDetection(
                    'suggested',
                    ['p[componentkey]', 'p[componentkey] > span'],
                    ['p[data-test-id="main-feed-card__header"]'],
                ),
                recommended: createDetection('recommended', ['p[componentkey]']),
            },
        }),
        legacy: createProfile({
            feedWrapper: DEFAULT_FEED_WRAPPER,
            postContainers: DEFAULT_POST_CONTAINERS,
            detection: {
                sponsored: createDetection('sponsored', [
                    'span[aria-hidden="true"]:not([class]):not([id])',
                    'span.text-color-text-low-emphasis',
                ]),
                suggested: createDetection('suggested', [
                    'span.update-components-header__text-view',
                ]),
                recommended: createDetection('recommended', [
                    'span.update-components-header__text-view',
                ]),
            },
        }),
    },
    DELAYS: {
        OBSERVER_RETRY: 32,
        MAX_OBSERVER_RETRIES: 15,
        NOTIFICATION: 300,
    },
    REVIEW_URLS: {
        chrome: 'https://chromewebstore.google.com/detail/linkedin-sponsor-block/dmgglmnbmokkdocpamjkcgjfjceoocbh/reviews',
        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/linkedin-sponsor-block/reviews/',
        userscript: 'https://greasyfork.org/fr/scripts/546877-linkedin-sponsor-block/feedback',
    },
    GITHUB_URL: 'https://github.com/Hogwai/LinkedinSponsorBlock',
    FEEDBACK_URL: 'https://tally.so/r/QKrO28',
    REVIEW_THRESHOLD_DAYS: 7,
};

export function getActiveProfile() {
    return CONFIG.profiles[CONFIG.activeProfile] || CONFIG.profiles.modern;
}

export function applyLayout(profileName) {
    const profile = CONFIG.profiles[profileName];
    if (!profile) {
        console.warn(`[LinkedinSponsorBlock] Unknown layout profile: ${profileName}`);
        return false;
    }

    CONFIG.activeProfile = profileName;
    logger.info(`Layout profile applied: ${profileName}`);
    return true;
}
