import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadFixtureDOM } from './helpers.js';

let detection;
let config;

beforeEach(async () => {
    vi.resetModules();
    // Re-import to get a fresh scannedPosts WeakSet
    detection = await import('../src/shared/detection.js');
    config = await import('../src/shared/config.js');
    // Ensure modern profile is active
    config.applyLayout('modern');
});

describe('getUnscannedPosts: feed-real-mixed', () => {
    let feed;

    beforeEach(() => {
        feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);
    });

    it('returns 2 sponsored posts', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(2);
    });

    it('returns 2 suggested posts', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.suggested).toHaveLength(2);
    });

    it('returns 1 recommended post', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.recommended).toHaveLength(1);
    });

    it('returns 4 content (organic) posts', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.content).toHaveLength(4);
    });

    it('total posts = 9', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const total =
            groups.sponsored.length +
            groups.suggested.length +
            groups.recommended.length +
            groups.content.length;
        expect(total).toBe(9);
    });

    it('sponsored post via text keyword "Post sponsorisé" is detected', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const textContents = groups.sponsored.map((p) => p.textContent);
        expect(textContents.some((t) => t.includes('Post sponsorisé'))).toBe(true);
    });

    it('suggested posts contain both "Suivi par" and "Suggestions"', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const textContents = groups.suggested.map((p) => p.textContent);
        expect(textContents.some((t) => t.includes('Suivi par'))).toBe(true);
        expect(textContents.some((t) => t.includes('Suggestions'))).toBe(true);
    });

    it('recommended post is detected (p[componentkey]="Recommandé pour vous")', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const textContents = groups.recommended.map((p) => p.textContent);
        expect(textContents.some((t) => t.includes('Recommandé pour vous'))).toBe(true);
    });

    it('organic posts are not in sponsored/suggested/recommended groups', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const organicTexts = groups.content.map((p) => p.textContent);

        expect(organicTexts.some((t) => t.includes('Content de partager'))).toBe(true);
        expect(organicTexts.some((t) => t.includes('Nouveau projet'))).toBe(true);
        expect(organicTexts.some((t) => t.includes('Premier jour'))).toBe(true);
        expect(organicTexts.some((t) => t.includes('meilleurs ETFs'))).toBe(true);
    });
});

describe('getUnscannedPosts: feed-real-ads', () => {
    it('returns all posts as sponsored', () => {
        const feed = loadFixtureDOM('feed-real-ads.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        // One via p[componentkey] "Post sponsorisé", one via child selector
        expect(groups.sponsored).toHaveLength(2);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.recommended).toHaveLength(0);
        expect(groups.content).toHaveLength(0);
    });
});

describe('getUnscannedPosts: feed-real-organic', () => {
    it('returns all posts as content', () => {
        const feed = loadFixtureDOM('feed-real-organic.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(0);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.recommended).toHaveLength(0);
        expect(groups.content).toHaveLength(4);
    });
});

describe('getUnscannedPosts: feed-empty', () => {
    it('returns empty groups', () => {
        const feed = loadFixtureDOM('feed-empty.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(0);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.recommended).toHaveLength(0);
        expect(groups.content).toHaveLength(0);
    });

    it('handles root being a post container element (matches path)', () => {
        // Create an element matching a modern post container selector
        const post = document.createElement('div');
        post.className = 'feed-shared-update-v2';
        post.id = 'ember1234';
        post.textContent = 'Some organic content';
        document.body.innerHTML = '';
        document.body.appendChild(post);

        // Pass the post element itself as root (triggers root.matches? path)
        const groups = detection.getUnscannedPosts(post);
        expect(groups.content).toHaveLength(1);
        expect(groups.sponsored).toHaveLength(0);
    });
});



describe('Unicode normalization', () => {
    // LinkedIn may serve Gurmukhi/Punjabi in precomposed Unicode form (U+0A5E, U+0A36)
    // while the keyword source uses decomposed form (U+0A2B+U+0A3C, U+0A38+U+0A3C).
    // NFC normalization must reconcile both.
    it('detects Punjabi "recommended" with precomposed Unicode (like LinkedIn serves)', () => {
        // LinkedIn uses precomposed Gurmukhi (U+0A5E ਫ਼, U+0A36 ਸ਼) while the
        // keyword source uses decomposed forms (U+0A2B+U+0A3C, U+0A38+U+0A3C).
        // NFC normalization must reconcile them.
        const post = document.createElement('div');
        post.className = 'feed-shared-update-v2';
        post.id = 'ember-punjabi';

        const label = document.createElement('p');
        label.setAttribute('componentkey', 'test');
        // Precomposed form: 17 code points
        label.textContent = String.fromCodePoint(
            0x0A24, 0x0A41, 0x0A39, 0x0A3E, 0x0A21, 0x0A47, // ਤੁਹਾਡੇ
            0x0020, // space
            0x0A32, 0x0A08, // ਲਈ
            0x0020, // space
            0x0A38, 0x0A3F, // ਸਿ
            0x0A5E, 0x0A3E, 0x0A30, // ਫ਼ਾਰ (precomposed)
            0x0A36, 0x0A40, // ਸ਼ੀ (precomposed)
        );
        post.appendChild(label);

        document.body.innerHTML = '';
        document.body.appendChild(post);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.recommended).toHaveLength(1);
        expect(groups.sponsored).toHaveLength(0);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.content).toHaveLength(0);
    });

    it('detects Arabic "تم الترويج" as sponsored', () => {
        const post = document.createElement('div');
        post.className = 'feed-shared-update-v2';
        post.id = 'ember-arabic';

        const label = document.createElement('p');
        label.setAttribute('componentkey', 'test');
        label.textContent = 'تم الترويج';
        post.appendChild(label);

        document.body.innerHTML = '';
        document.body.appendChild(post);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(1);
        expect(groups.content).toHaveLength(0);
    });

    it('strips invisible Unicode formatting chars (RLM, LRM, ZWJ) from Arabic text', () => {
        // LinkedIn may insert invisible formatting characters (U+200F RLM, U+200E LRM,
        // U+200D ZWJ) into RTL text. The keyword matcher must strip them before comparison.
        const post = document.createElement('div');
        post.setAttribute('data-lazy-mount-id', 'test-mount');
        post.style.display = 'contents';

        const label = document.createElement('p');
        label.setAttribute('componentkey', 'test');

        // Simulate text with surrounding invisible characters like LinkedIn serves
        const rlm = '\u200F';
        const lrm = '\u200E';
        label.textContent = `${rlm}${lrm}تم الترويج${rlm}${lrm}`;
        post.appendChild(label);

        document.body.innerHTML = '';
        document.body.appendChild(post);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(1);
        expect(groups.content).toHaveLength(0);
    });

    it('strips Arabic letter mark (U+061C) from Arabic text', () => {
        // U+061C Arabic Letter Mark is another invisible formatting character
        const post = document.createElement('div');
        post.setAttribute('data-lazy-mount-id', 'test-alm');
        post.style.display = 'contents';

        const label = document.createElement('p');
        label.setAttribute('componentkey', 'test');
        const alm = '\u061C';
        label.textContent = `${alm}تم الترويج${alm}`;
        post.appendChild(label);

        document.body.innerHTML = '';
        document.body.appendChild(post);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(1);
        expect(groups.content).toHaveLength(0);
    });

    it('detects Traditional Chinese "宣傳單位：" as sponsored via direct text node', () => {
        // Simulates LinkedIn zh-TW post with structure from user's report:
        // <p componentkey="..."><span>宣傳單位：<a><strong>Company</strong></a></span></p>
        // The span's direct text node "宣傳單位：" matches the keyword.
        const post = document.createElement('div');
        post.className = 'feed-shared-update-v2';
        post.id = 'ember-zh-tw';

        const span = document.createElement('span');
        span.appendChild(document.createTextNode('宣傳單位：'));
        const link = document.createElement('a');
        link.href = '#';
        const strong = document.createElement('strong');
        strong.textContent = 'Société';
        link.appendChild(strong);
        span.appendChild(link);

        const label = document.createElement('p');
        label.setAttribute('componentkey', 'test');
        label.appendChild(span);

        post.appendChild(label);

        document.body.innerHTML = '';
        document.body.appendChild(post);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(1);
        expect(groups.content).toHaveLength(0);
    });
});

describe('legacy profile detection', () => {
    it('works with legacy selectors', async () => {
        config.applyLayout('legacy');

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        // Legacy uses different selectors: may not match the same posts
        // Just verify it runs without error and returns expected structure
        expect(groups).toHaveProperty('sponsored');
        expect(groups).toHaveProperty('suggested');
        expect(groups).toHaveProperty('recommended');
        expect(groups).toHaveProperty('content');
    });
});
