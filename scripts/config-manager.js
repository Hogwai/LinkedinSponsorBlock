#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REMOTE_PATH = join(ROOT, 'remote-config.json');
const CONFIG_PATH = join(ROOT, 'src', 'shared', 'config.js');

// ==================== I/O ====================

function load() {
    return JSON.parse(readFileSync(REMOTE_PATH, 'utf8'));
}

function save(config) {
    writeFileSync(REMOTE_PATH, JSON.stringify(config, null, 2) + '\n');
    generateConfigJS(config);
    console.log('\n  ✓ remote-config.json updated');
    console.log('  ✓ src/shared/config.js updated');
}

// ==================== CONFIG.JS GENERATION ====================

function q(s) {
    // Escape for single-quoted JS string
    return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function generateConfigJS(rc) {
    const pad = n => ' '.repeat(n);

    function fmtArray(arr, indent) {
        if (arr.length === 0) return '[]';
        return '[\n' + arr.map(s => pad(indent) + q(s)).join(',\n') + '\n' + pad(indent - 4) + ']';
    }

    function fmtInlineArray(arr) {
        if (arr.length === 0) return '[]';
        return '[' + arr.map(q).join(', ') + ']';
    }

    function fmtKeywordSet(keywords, indent) {
        return 'new Set([\n'
            + keywords.map(k => pad(indent) + q(k)).join(',\n') + '\n'
            + pad(indent - 4) + '].map(t => t.toLowerCase()))';
    }

    function fmtDetection(name, data) {
        const base = 8;
        return `${pad(base)}${name}: {
${pad(base + 4)}keywordMatch: {
${pad(base + 8)}selector: ${q(data.keywordMatch.selector)},
${pad(base + 8)}keywords: ${fmtKeywordSet(data.keywordMatch.keywords, base + 12)}
${pad(base + 4)}},
${pad(base + 4)}childSelectors: ${fmtInlineArray(data.childSelectors)}
${pad(base)}}`;
    }

    const content = `export const CONFIG = {
    ATTRIBUTES: {
        SCANNED: 'data-sponsor-scanned'
    },
    DELAYS: {
        OBSERVER_RETRY: 200,
        MAX_OBSERVER_RETRIES: 15,
        NOTIFICATION: 300
    },
    SELECTORS: {
        POST_CONTAINERS: ${fmtArray(rc.selectors.postContainers, 12)},
        FEED_WRAPPER: {
            mobile: ${q(rc.selectors.feedWrapper.mobile)},
            desktop: ${q(rc.selectors.feedWrapper.desktop)},
            newFeed: ${q(rc.selectors.feedWrapper.newFeed)}
        }
    },
    DETECTION: {
${fmtDetection('SPONSORED', rc.detection.sponsored)},
${fmtDetection('SUGGESTED', rc.detection.suggested)},
${fmtDetection('RECOMMENDED', rc.detection.recommended)}
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
`;

    writeFileSync(CONFIG_PATH, content);
}

// ==================== INTERACTIVE MENU ====================

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(resolve => rl.question(q, resolve));

function printList(items, label) {
    console.log(`\n  ${label} (${items.length}):`);
    items.forEach((item, i) => console.log(`    ${String(i + 1).padStart(3)}. ${item}`));
}

async function manageKeywords(config, category) {
    const keywords = config.detection[category].keywordMatch.keywords;

    while (true) {
        printList(keywords, `${category} keywords`);
        console.log('\n  [a] Add  [r] Remove  [b] Back');
        const choice = (await ask('  > ')).trim().toLowerCase();

        if (choice === 'b' || choice === '') return;

        if (choice === 'a') {
            const input = (await ask('  Keyword: ')).trim();
            if (!input) continue;
            const lower = input.toLowerCase();
            if (keywords.includes(lower)) {
                console.log('  ⚠ Already exists');
            } else {
                keywords.push(lower);
                save(config);
            }
        } else if (choice === 'r') {
            const num = (await ask('  Number: ')).trim();
            const idx = parseInt(num) - 1;
            if (idx >= 0 && idx < keywords.length) {
                const removed = keywords.splice(idx, 1)[0];
                save(config);
                console.log(`  Removed "${removed}"`);
            } else {
                console.log('  ⚠ Invalid number');
            }
        }
    }
}

async function manageSelectors(config) {
    while (true) {
        const sel = config.selectors;
        console.log('\n  Selectors:');
        console.log('  [1] Post containers');
        console.log('  [2] Feed wrapper (mobile)  → ' + sel.feedWrapper.mobile);
        console.log('  [3] Feed wrapper (desktop) → ' + sel.feedWrapper.desktop);
        console.log('  [4] Feed wrapper (newFeed) → ' + sel.feedWrapper.newFeed);
        console.log('  [5] Child selectors (sponsored)');
        console.log('  [6] Child selectors (suggested)');
        console.log('  [7] Child selectors (recommended)');
        console.log('  [8] Keyword selector (sponsored)  → ' + config.detection.sponsored.keywordMatch.selector);
        console.log('  [9] Keyword selector (suggested)   → ' + config.detection.suggested.keywordMatch.selector);
        console.log('  [10] Keyword selector (recommended) → ' + config.detection.recommended.keywordMatch.selector);
        console.log('  [b] Back');
        const choice = (await ask('  > ')).trim().toLowerCase();

        if (choice === 'b' || choice === '') return;

        if (choice === '1') {
            await manageArray(config, sel.postContainers, 'Post containers');
        } else if (['5', '6', '7'].includes(choice)) {
            const cats = { '5': 'sponsored', '6': 'suggested', '7': 'recommended' };
            const cat = cats[choice];
            await manageArray(config, config.detection[cat].childSelectors, `${cat} child selectors`);
        } else if (['2', '3', '4'].includes(choice)) {
            const keys = { '2': 'mobile', '3': 'desktop', '4': 'newFeed' };
            const key = keys[choice];
            const value = (await ask(`  New value (current: ${sel.feedWrapper[key]}): `)).trim();
            if (value) {
                sel.feedWrapper[key] = value;
                save(config);
            }
        } else if (['8', '9', '10'].includes(choice)) {
            const cats = { '8': 'sponsored', '9': 'suggested', '10': 'recommended' };
            const cat = cats[choice];
            const current = config.detection[cat].keywordMatch.selector;
            const value = (await ask(`  New value (current: ${current}): `)).trim();
            if (value) {
                config.detection[cat].keywordMatch.selector = value;
                save(config);
            }
        }
    }
}

async function manageArray(config, arr, label) {
    while (true) {
        printList(arr, label);
        console.log('\n  [a] Add  [r] Remove  [b] Back');
        const choice = (await ask('  > ')).trim().toLowerCase();

        if (choice === 'b' || choice === '') return;

        if (choice === 'a') {
            const value = (await ask('  Value: ')).trim();
            if (value) {
                arr.push(value);
                save(config);
            }
        } else if (choice === 'r') {
            const num = (await ask('  Number: ')).trim();
            const idx = parseInt(num) - 1;
            if (idx >= 0 && idx < arr.length) {
                const removed = arr.splice(idx, 1)[0];
                save(config);
                console.log(`  Removed "${removed}"`);
            }
        }
    }
}

// ==================== MAIN ====================

async function main() {
    const config = load();

    console.log('\n  === LinkedIn Sponsor Block — Config Manager ===');

    while (true) {
        console.log('\n  [1] Sponsored keywords');
        console.log('  [2] Suggested keywords');
        console.log('  [3] Recommended keywords');
        console.log('  [4] Selectors');
        console.log('  [q] Quit');
        const choice = (await ask('  > ')).trim().toLowerCase();

        if (choice === 'q' || choice === '') break;

        const categories = { '1': 'sponsored', '2': 'suggested', '3': 'recommended' };
        if (categories[choice]) {
            await manageKeywords(config, categories[choice]);
        } else if (choice === '4') {
            await manageSelectors(config);
        }
    }

    rl.close();
    console.log('  Bye!\n');
}

main();
