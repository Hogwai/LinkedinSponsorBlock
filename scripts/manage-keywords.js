#!/usr/bin/env node

/**
 * Manage keywords in keywords/*.json and sync to remote-config.json.
 * src/shared/keywords.js imports JSON directly
 *
 * Usage:
 *   node scripts/manage-keywords.js sync              # sync keywords/*.json -> remote-config.json
 *   node scripts/manage-keywords.js check <keyword>   # check if keyword exists
 *   node scripts/manage-keywords.js check <keyword> --category sponsored  # check in specific category
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const KEYWORDS_DIR = join(ROOT, 'keywords');
const REMOTE_CONFIG_PATH = join(ROOT, 'remote-config.json');

const CATEGORIES = ['sponsored', 'suggested', 'recommended'];

/**
 * Read keywords/*.json and return { sponsored: [...], suggested: [...], recommended: [...] }
 * Supports both grouped object { LANG: [...] } and flat array [...] for flexibility.
 */
function readAllKeywords() {
    const result = {};
    for (const cat of CATEGORIES) {
        const data = JSON.parse(readFileSync(join(KEYWORDS_DIR, `${cat}.json`), 'utf-8'));
        if (Array.isArray(data)) {
            result[cat] = data;
        } else if (data && typeof data === 'object') {
            // Flatten grouped object: { FRENCH: [...], ENGLISH: [...] } -> [...]
            result[cat] = Object.values(data).flat();
        } else {
            console.error(`keywords/${cat}.json must be a JSON array or grouped object`);
            process.exit(1);
        }
    }
    return result;
}

/**
 * Update remote-config.json keywords sections (both modern and legacy profiles)
 */
function updateRemoteConfig(allKeywords) {
    const config = JSON.parse(readFileSync(REMOTE_CONFIG_PATH, 'utf-8'));

    for (const profile of ['modern', 'legacy']) {
        for (const cat of CATEGORIES) {
            config.profiles[profile].detection[cat].keywords = allKeywords[cat].map((k) => k.toLowerCase().normalize('NFC'));
        }
    }

    writeFileSync(REMOTE_CONFIG_PATH, JSON.stringify(config, null, 4) + '\n');
    console.log(`✓ Updated remote-config.json`);
}

function normalizeKeyword(text) {
    return text
        .toLowerCase()
        .normalize('NFC')
        .replace(/[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]+/g, '');
}

/**
 * Check if a keyword exists in keyword files (normalized comparison)
 */
function checkKeyword(keyword, category) {
    const allKeywords = readAllKeywords();
    const categories = category ? [category] : CATEGORIES;
    const normalized = normalizeKeyword(keyword);

    let found = false;
    for (const cat of categories) {
        if (!allKeywords[cat]) {
            console.error(`Unknown category: ${cat}`);
            process.exit(1);
        }
        const match = allKeywords[cat].find((k) => normalizeKeyword(k) === normalized);
        if (match) {
            console.log(`✓ Found in ${cat}: "${match}"`);
            found = true;
        }
    }

    if (!found) {
        console.log(`✗ Not found${category ? ` in ${category}` : ' in any category'}: "${keyword}"`);
        process.exit(1);
    }
}

// --- Main ---

const args = process.argv.slice(2);
const command = args[0];

if (command === 'sync') {
    const allKeywords = readAllKeywords();
    updateRemoteConfig(allKeywords);
    console.log('Done!');
} else if (command === 'check') {
    const keyword = args[1];
    if (!keyword) {
        console.error('Usage: node scripts/manage-keywords.js check <keyword> [--category <category>]');
        process.exit(1);
    }
    const catIdx = args.indexOf('--category');
    const category = catIdx !== -1 ? args[catIdx + 1] : null;
    checkKeyword(keyword, category);
} else {
    console.error('Usage:');
    console.error('  node scripts/manage-keywords.js sync              # sync keywords/*.json -> remote-config.json');
    console.error('  node scripts/manage-keywords.js check <keyword>   # check if keyword exists');
    console.error('  node scripts/manage-keywords.js check <keyword> --category sponsored');
    process.exit(1);
}
