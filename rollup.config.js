import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import copy from 'rollup-plugin-copy';

const target = process.env.BUILD_TARGET; // 'chrome', 'firefox', 'userscript', or undefined (all)
const version = process.env.VERSION;

if (!version) {
    console.error('VERSION is required. Use build.js or set VERSION env var.');
    process.exit(1);
}

// ==================== Userscript banner ====================
const userscriptBanner = `// ==UserScript==
// @name            Linkedin Sponsor Block
// @namespace       https://github.com/Hogwai/LinkedinSponsorBlock/
// @version         ${version}
// @description:en  Remove sponsored posts, suggestions, and partner content on linkedin.com
// @description:fr  Supprime les publications sponsorisées, les suggestions et le contenu en partenariat sur linkedin.com
// @author          Hogwai
// @include         *://*.linkedin.*
// @include         *://*.linkedin.*/feed/*
// @grant           none
// @license         MIT
// @description Remove sponsored posts, suggestions, and partner content on linkedin.com
// @downloadURL https://update.greasyfork.org/scripts/546877/Linkedin%20Sponsor%20Block.user.js
// @updateURL https://update.greasyfork.org/scripts/546877/Linkedin%20Sponsor%20Block.meta.js
// ==/UserScript==
`;

// ==================== Plugins ====================
function manifestWithVersion(src, dest) {
    return {
        name: `manifest-version(${dest})`,
        writeBundle() {
            const manifest = JSON.parse(readFileSync(src, 'utf8'));
            manifest.version = version;
            mkdirSync(dest, { recursive: true });
            writeFileSync(`${dest}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
        }
    };
}

function copySharedAssets(dest) {
    return copy({
        targets: [
            { src: 'static/shared/popup.html', dest },
            { src: 'static/shared/popup.css', dest },
            { src: 'static/shared/icons/*', dest },
            { src: 'LICENSE', dest },
        ],
        hook: 'writeBundle',
    });
}

// ==================== Bundle definitions ====================
const chromeBundles = [
    {
        input: 'src/extension/content.js',
        output: { file: 'dist/chrome/LinkedinSponsorBlock.user.js', format: 'iife' },
    },
    {
        input: 'src/extension/background.js',
        output: { file: 'dist/chrome/background.js', format: 'iife' },
    },
    {
        input: 'src/extension/popup.js',
        output: { file: 'dist/chrome/popup.js', format: 'iife' },
        plugins: [
            copySharedAssets('dist/chrome'),
            manifestWithVersion('static/chrome/manifest.json', 'dist/chrome'),
        ],
    },
];

const firefoxBundles = [
    {
        input: 'src/extension/content.js',
        output: { file: 'dist/firefox/LinkedinSponsorBlock.user.js', format: 'iife' },
    },
    {
        input: 'src/extension/background.js',
        output: { file: 'dist/firefox/background.js', format: 'iife' },
    },
    {
        input: 'src/extension/popup.js',
        output: { file: 'dist/firefox/popup.js', format: 'iife' },
        plugins: [
            copySharedAssets('dist/firefox'),
            manifestWithVersion('static/firefox/manifest.json', 'dist/firefox'),
        ],
    },
];

const userscriptBundles = [
    {
        input: 'src/userscript/content.js',
        output: { file: 'dist/LinkedinSponsorBlock.user.js', format: 'iife', banner: userscriptBanner },
    },
];

// ==================== Target selection ====================
const targets = {
    chrome: chromeBundles,
    firefox: firefoxBundles,
    userscript: userscriptBundles,
};

if (target && !targets[target]) {
    console.error(`Unknown BUILD_TARGET="${target}". Expected: chrome, firefox, userscript`);
    process.exit(1);
}

export default target ? targets[target] : [...chromeBundles, ...firefoxBundles, ...userscriptBundles];
