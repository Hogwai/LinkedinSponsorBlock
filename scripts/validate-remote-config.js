import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CONFIG_PATH = path.resolve('remote-config.json');
const SUPPORTED_VERSION = 2;
const REQUIRED_PROFILES = ['modern', 'legacy'];
const REQUIRED_CATEGORIES = ['sponsored', 'suggested', 'recommended'];
const REQUIRED_FEED_WRAPPERS = ['mobile', 'desktop', 'newFeed'];

const errors = [];

function addError(message) {
    errors.push(message);
}

function label(pathParts) {
    return pathParts.join('.');
}

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function validateStringArray(value, pathParts, { allowEmpty = false } = {}) {
    const name = label(pathParts);
    if (!Array.isArray(value)) {
        addError(`${name} must be an array`);
        return;
    }
    if (!allowEmpty && value.length === 0) {
        addError(`${name} must not be empty`);
    }
    value.forEach((item, index) => {
        if (!isNonEmptyString(item)) {
            addError(`${name}[${index}] must be a non-empty string`);
        }
    });
}

function hasBalancedDelimiters(selector) {
    const pairs = new Map([
        [')', '('],
        [']', '[']
    ]);
    const stack = [];
    let quote = null;
    let escaped = false;

    for (const char of selector) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '(' || char === '[') {
            stack.push(char);
            continue;
        }
        if (pairs.has(char) && stack.pop() !== pairs.get(char)) {
            return false;
        }
    }

    return stack.length === 0 && quote === null && !escaped;
}

function isPlausibleSelector(selector) {
    if (!isNonEmptyString(selector)) return false;
    if (/[,>+~]$/.test(selector.trim())) return false;
    if (!hasBalancedDelimiters(selector)) return false;
    return true;
}

function validateSelectors(selectors, pathParts, { allowEmpty = false } = {}) {
    validateStringArray(selectors, pathParts, { allowEmpty });
    if (!Array.isArray(selectors)) return;

    selectors.forEach((selector, index) => {
        if (typeof selector === 'string' && !isPlausibleSelector(selector)) {
            addError(`${label(pathParts)}[${index}] is not a valid-looking CSS selector: ${selector}`);
        }
    });
}

function validateFeedWrapper(feedWrapper, pathParts) {
    if (!isObject(feedWrapper)) {
        addError(`${label(pathParts)} must be an object`);
        return;
    }

    for (const key of REQUIRED_FEED_WRAPPERS) {
        const value = feedWrapper[key];
        const valuePath = [...pathParts, key];
        if (value !== null && !isNonEmptyString(value)) {
            addError(`${label(valuePath)} must be null or a non-empty string`);
        }
        if (typeof value === 'string' && !isPlausibleSelector(value)) {
            addError(`${label(valuePath)} is not a valid-looking CSS selector: ${value}`);
        }
    }
}

function validateDetectionEntry(entry, pathParts) {
    if (!isObject(entry)) {
        addError(`${label(pathParts)} must be an object`);
        return;
    }

    validateSelectors(entry.keywordSelectors, [...pathParts, 'keywordSelectors']);
    validateSelectors(entry.childSelectors, [...pathParts, 'childSelectors'], { allowEmpty: true });
    validateStringArray(entry.keywords, [...pathParts, 'keywords']);
}

function validateProfile(profile, pathParts) {
    if (!isObject(profile)) {
        addError(`${label(pathParts)} must be an object`);
        return;
    }

    validateFeedWrapper(profile.feedWrapper, [...pathParts, 'feedWrapper']);
    validateSelectors(profile.postContainers, [...pathParts, 'postContainers']);

    if (!isObject(profile.detection)) {
        addError(`${label([...pathParts, 'detection'])} must be an object`);
        return;
    }

    for (const category of REQUIRED_CATEGORIES) {
        validateDetectionEntry(profile.detection[category], [...pathParts, 'detection', category]);
    }
}

function validateConfig(config) {
    if (!isObject(config)) {
        addError('remote-config.json must contain a JSON object');
        return;
    }

    if (config.version !== SUPPORTED_VERSION) {
        addError(`version must be ${SUPPORTED_VERSION}`);
    }

    if (!isObject(config.profiles)) {
        addError('profiles must be an object');
        return;
    }

    for (const profileName of REQUIRED_PROFILES) {
        if (!config.profiles[profileName]) {
            addError(`profiles.${profileName} is required`);
            continue;
        }
        validateProfile(config.profiles[profileName], ['profiles', profileName]);
    }
}

let config;
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
    console.error(`Failed to read ${CONFIG_PATH}:`, err.message);
    process.exit(1);
}

validateConfig(config);

if (errors.length > 0) {
    console.error(`remote-config.json validation failed with ${errors.length} error(s):`);
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

console.log('remote-config.json is valid.');
