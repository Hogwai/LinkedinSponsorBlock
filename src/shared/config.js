export const CONFIG = {
    ATTRIBUTES: {
        SCANNED: 'data-sponsor-scanned'
    },
    DELAYS: {
        OBSERVER_RETRY: 200,
        NOTIFICATION: 300
    },
    SELECTORS: {
        POST_CONTAINERS: [
            '.ember-view.occludable-update',
            '[class*="ember-view"][class*="occludable-update"]',
            'div[class*="feed-shared-update-v2"][id*="ember"]',
            'article[data-id="main-feed-card"]',
            'div[data-view-tracking-scope*=\'transporterKeys":["sponsored"]\']',
            'div[data-view-tracking-scope*=\'transporterKeys":["default"]\']'
        ],
        FEED_WRAPPER: {
            mobile: 'ol.feed-container',
            desktop: '[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]',
            newFeed: '[data-testid="mainFeed"]'
        }
    },
    SPONSORED_PATTERNS: [
        'sponsored',
        'SponsoredUpdateServed',
        'SPONSORED_UPDATE_SERVED',
        '["sponsored"]'
    ],
    SUGGESTION_KEYWORDS: new Set([
        'Suggestions', // FRENCH
        'Suggested',  // ENGLISH
        'Vorgeschlagen',  // GERMAN
        'Sugerencias', // SPANISH
    ].map(t => t.toLowerCase())),
    REVIEW_URLS: {
        chrome: 'https://chromewebstore.google.com/detail/linkedin-sponsor-block/dmgglmnbmokkdocpamjkcgjfjceoocbh/reviews',
        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/linkedin-sponsor-block/reviews/',
        userscript: 'https://greasyfork.org/fr/scripts/546877-linkedin-sponsor-block/feedback'
    },
    GITHUB_URL: 'https://github.com/Hogwai/LinkedinSponsorBlock',
    REVIEW_THRESHOLD_DAYS: 7
};
