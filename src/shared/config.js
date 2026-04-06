import { logger } from './logger.js';

const SHARED_KEYWORDS = {
    sponsored: new Set([
        'Post sponsorisé',       // FRENCH
        'Sponsorisé',            // FRENCH
        'Sponsorisé par',        // FRENCH
        'Sponsorisé • Partenariat avec', // FRENCH
        'En partenariat avec',   // FRENCH
        'Promu(e) par',          // FRENCH
        'Promues',               // FRENCH
        'Promoted',              // ENGLISH
        'Anzeige',               // GERMAN
        'Gesponsert',            // GERMAN
        'Promocionado',          // SPANISH
        'Promovida',             // PORTUGUESE
        'الترويج',               // ARABIC
        'Post sponsorizzato',    // ITALIAN
        'Promosso da',           // ITALIAN
        'Promosso',              // ITALIAN
        'প্রমোটেড',              // BANGLA
        'Propagováno',           // CZECH
        'Propagace',             // CZECH
        'Promoveret',            // DANISH
        'Προωθημένη',            // GREEK
        'تبلیغ‌شده',             // PERSIAN
        'Mainostettu',           // FINNISH
        'प्रमोट किया गया',       // HINDI
        'Kiemelt',               // HUNGARIAN
        'Dipromosikan',          // INDONESIAN / MALAYSIAN
        'ממומן',                 // HEBREW
        'プロモーション',          // JAPANESE
        '광고',                  // KOREAN
        '주최:',                 // KOREAN
        'प्रमोट केले',           // MARATHI
        'Gepromoot',             // DUTCH
        'Promotert',             // NORWEGIAN
        'ਪ੍ਰੋਮੋਟ ਕੀਤਾ ਗਿਆ',     // PUNJABI
        'ਪ੍ਰੋਮੋਟ ਕੀਤਾ',          // PUNJABI
        'Treść promowana',       // POLISH
        'Promowane',             // POLISH
        'Promovido',             // PORTUGUESE
        'Promovat',              // ROMANIAN
        'Продвигается',          // RUSSIAN
        'Marknadsfört',          // SWEDISH
        'ప్రమోట్ చేయబడింది',     // TELUGU
        'ได้รับการโปรโมท',        // THAI
        'Nai-promote',           // TAGALOG
        'Öne çıkarılan içerik',  // TURKISH
        'Tanıtılan içerik',      // TURKISH
        'Просувається',          // UKRAINIAN
        'Được quảng bá',         // VIETNAMESE
        '广告',                  // CHINESE (SIMPLIFIED)
        '推广',                  // CHINESE (SIMPLIFIED)
        '促銷內容',              // CHINESE (TRADITIONAL)
        '贊助',                  // CHINESE (TRADITIONAL)
    ].map(t => t.toLowerCase())),
    suggested: new Set([
        'Suggestions', // FRENCH
        'Suggested',  // ENGLISH
        'Vorgeschlagen',  // GERMAN
        'Sugerencias', // SPANISH
        'Sugestões' // PORTUGUESE
    ].map(t => t.toLowerCase())),
    recommended: new Set([
        'Recommended for you',      // ENGLISH
        'Recommandé pour vous',     // FRENCH
        'Te recomendamos',          // SPANISH
        'Recomendações para você',  // PORTUGUESE
        'Für Sie empfohlen',        // GERMAN
        'Consigliato per te',       // ITALIAN
        'आपके लिए सुझाव',           // HINDI
        'مقترح لك',                // ARABIC
        '为您推荐',                 // CHINESE (SIMPLIFIED)
        '精選內容',                 // CHINESE (TRADITIONAL)
        'おすすめのコース',          // JAPANESE
        'Рекомендуем для вас',      // RUSSIAN
        'Polecane dla Ciebie',      // POLISH
        '맞춤 추천',                 // KOREAN
        '추천됨',                   // KOREAN
        'Рекомендовані для вас',    // UKRAINIAN
        'Aanbevolen voor u',        // DUTCH
        'Doporučeno pro vás',       // CZECH
        'Sizin için önerilenler',    // TURKISH
        'আপনার জন্য সুপারিশকৃত',       // BENGALI
        'Anbefalet til dig',         // DANISH
        'Προτεινόμενα για εσάς',     // GREEK
        'توصیه‌شده برای شما',        // PERSIAN
        'Suositellut sinulle',       // FINNISH
        'Önnek javasolt',            // HUNGARIAN
        'Rekomendasi untuk Anda',    // INDONESIAN
        'מומלצים עבורך',             // HEBREW
        'तुमच्यासाठी शिफारस केलेले',    // MARATHI
        'Dicadangkan untuk anda',    // MALAY
        'Anbefalt for deg',          // NORWEGIAN
        'ਤੁਹਾਡੇ ਲਈ ਸਿਫ਼ਾਰਸ਼ੀ',        // PUNJABI
        'Recomandat pentru dvs.',     // ROMANIAN
        'Rekommenderat för dig',      // SWEDISH
        'మీ కోసం సిఫార్సు చేయబడినవి',  // TELUGU
        'แนะนำสำหรับคุณ',              // THAI
        'Inirerekomenda para sa iyo', // TAGALOG
        'Đề xuất cho bạn',           // VIETNAMESE
    ].map(t => t.toLowerCase()))
};

export const CONFIG = {
    DELAYS: {
        OBSERVER_RETRY: 32,
        MAX_OBSERVER_RETRIES: 15,
        NOTIFICATION: 300
    },
    SELECTORS: {
        POST_CONTAINERS: [
            'div[data-display-contents="true"]',
            '.ember-view.occludable-update',
            '[class*="ember-view"][class*="occludable-update"]',
            'div[class*="feed-shared-update-v2"][id*="ember"]',
            'article[data-id="main-feed-card"]',
            'div[data-view-tracking-scope*=\'transporterKeys":["sponsored"]\']',
            'div[data-view-tracking-scope*=\'transporterKeys":["default"]\']',
            'li.feed-item'
        ],
        FEED_WRAPPER: {
            mobile: 'ol.feed-container',
            desktop: '[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]',
            newFeed: '[data-testid="mainFeed"]'
        }
    },
    DETECTION: {
        SPONSORED: {
            keywordMatch: {
                selectors: ['p[componentkey]'],
                keywords: SHARED_KEYWORDS.sponsored
            },
            childSelectors: ['article[data-sponsored-tracking-url]']
        },
        SUGGESTED: {
            // Desktop: keywords matched against text content of child elements
            keywordMatch: {
                selectors: ['p[componentkey]'],
                keywords: SHARED_KEYWORDS.suggested
            },
            // Mobile: child element selectors indicating suggested content
            childSelectors: ['p[data-test-id="main-feed-card__header"]']
        },
        RECOMMENDED: {
            // Desktop: keywords matched against text content of child elements
            keywordMatch: {
                selectors: ['p[componentkey]'],
                keywords: SHARED_KEYWORDS.recommended
            },
            childSelectors: []
        }
    },
    REVIEW_URLS: {
        chrome: 'https://chromewebstore.google.com/detail/linkedin-sponsor-block/dmgglmnbmokkdocpamjkcgjfjceoocbh/reviews',
        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/linkedin-sponsor-block/reviews/',
        userscript: 'https://greasyfork.org/fr/scripts/546877-linkedin-sponsor-block/feedback'
    },
    GITHUB_URL: 'https://github.com/Hogwai/LinkedinSponsorBlock',
    FEEDBACK_URL: 'https://tally.so/r/QKrO28',
    REVIEW_THRESHOLD_DAYS: 7
};

export const PROFILES = {
    modern: {
        feedWrapper: {
            newFeed: '[data-testid="mainFeed"]',
            desktop: '[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]',
            mobile: 'ol.feed-container'
        },
        postContainers: [
            'div[data-display-contents="true"]',
            '.ember-view.occludable-update',
            '[class*="ember-view"][class*="occludable-update"]',
            'div[class*="feed-shared-update-v2"][id*="ember"]',
            'article[data-id="main-feed-card"]',
            'div[data-view-tracking-scope*=\'transporterKeys":["sponsored"]\']',
            'div[data-view-tracking-scope*=\'transporterKeys":["default"]\']',
            'li.feed-item'
        ],
        detection: {
            sponsored: {
                keywordSelectors: ['p[componentkey]'],
                childSelectors: ['article[data-sponsored-tracking-url]']
            },
            suggested: {
                keywordSelectors: ['p[componentkey]'],
                childSelectors: ['p[data-test-id="main-feed-card__header"]']
            },
            recommended: {
                keywordSelectors: ['p[componentkey]'],
                childSelectors: []
            }
        }
    },
    legacy: {
        feedWrapper: {
            newFeed: '[data-testid="mainFeed"]',
            desktop: '[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]',
            mobile: 'ol.feed-container'
        },
        postContainers: [
            'div[data-display-contents="true"]',
            '.ember-view.occludable-update',
            '[class*="ember-view"][class*="occludable-update"]',
            'div[class*="feed-shared-update-v2"][id*="ember"]',
            'article[data-id="main-feed-card"]',
            'div[data-view-tracking-scope*=\'transporterKeys":["sponsored"]\']',
            'div[data-view-tracking-scope*=\'transporterKeys":["default"]\']',
            'li.feed-item'
        ],
        detection: {
            sponsored: {
                keywordSelectors: [
                    'span[aria-hidden="true"]:not([class]):not([id])',
                    'span.text-color-text-low-emphasis'
                ],
                childSelectors: []
            },
            suggested: {
                keywordSelectors: ['span.update-components-header__text-view'],
                childSelectors: []
            },
            recommended: {
                keywordSelectors: ['span.update-components-header__text-view'],
                childSelectors: []
            }
        }
    }
};

export function applyLayout(profileName) {
    const profile = PROFILES[profileName];
    if (!profile) {
        console.warn(`[LinkedinSponsorBlock] Unknown layout profile: ${profileName}`);
        return false;
    }

    CONFIG.SELECTORS.POST_CONTAINERS = profile.postContainers;
    CONFIG.SELECTORS.FEED_WRAPPER = profile.feedWrapper;

    for (const cat of ['sponsored', 'suggested', 'recommended']) {
        const src = profile.detection[cat];
        const dest = CONFIG.DETECTION[cat.toUpperCase()];
        dest.keywordMatch.selectors = src.keywordSelectors;
        dest.keywordMatch.keywords = SHARED_KEYWORDS[cat];
        dest.childSelectors = src.childSelectors;
    }

    logger.info(`Layout profile applied: ${profileName}`);
    return true;
}
