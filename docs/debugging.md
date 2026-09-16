# Debugging detection

This page explains how to find out why a post is hidden, or why a post is not hidden, and how to lock the answer with a test.

There are two symptoms:

- a post is hidden while it should stay visible (false positive);
- a post stays visible while it should be hidden (missed detection).

Everything starts from a single function: `matchReason(post, detection)` in `src/shared/detection.js`.
That function both classifies a post and explains its decision, so the logs can never disagree with the code.

## 1. Turn on simple logging

Open the popup and enable **Enable simple logging**, then open the browser console on the LinkedIn tab.

Logs are collected in a collapsed group, so they do not flood the console:

```text
[LinkedinSponsorBlock] 12 hidden
Suggested post hidden: "Post du fil d'actualite..."
```

At this level you only learn that a post was hidden, and which category decided it (`Suggested`, `Promoted` or `Recommended`). You do not know yet what triggered the decision.

## 2. Turn on detailed logging

Still in the popup, enable **Enable detailed logging**. Then reload the LinkedIn page.

The two toggles are independent, so either one produces logs. Simple logging tells you which post was hidden, detailed logging tells you why and also lists the posts that were kept. With both enabled you get the detailed output.

Every decision now carries the reason that triggered it, and the posts that were kept are printed too:

```text
[LinkedinSponsorBlock] 12 log(s)
Suggested post hidden [keyword-exact kw="post sponsorise" el="Post sponsorise"]: "..."
Suggested post hidden [keyword-substring kw="suivi par" el="Suivi par Alice Martin"]: "..."
Suggested post hidden [child-selector div[data-lazy-mount-id]:not(:has(hr[role="presentation"])) h2 + div :is(...)]: "..."
Content post kept [no-match]: "..."
```

The reason has three parts:

- `kind`, the rule that matched;
- `kw="..."`, the keyword that matched, when the rule is a keyword rule;
- `el="..."`, the text of the element that matched, truncated. This is the field to read first, because it shows the real content the extension saw.

## 3. Read the reason

There are five possible kinds.

### keyword-exact

The whole text of a scanned element is exactly a keyword listed in `keywords/*.json`.
Example: an element whose text is `Post sponsorise`.
The label is literally there, so the detection is correct.

### keyword-text-node

No element text matched, but one direct text node of the element equals a keyword. This handles labels that are split by links.
Example: a text node containing `Suivi par`, followed by a link holding the person's name.
The detection is correct as well.

### keyword-substring

The element text contains the keyword somewhere. This is the loosest rule, and the one that produces almost every false positive you will see.
Example: `Followed by 2,415 people you may know` contains `followed by`, which is enough to hide the post.
If you see this kind on a long text, the real problem is that a prose container is being scanned. See section 5.

### child-selector

No keyword matched. A structural selector matched instead. In practice this means the post carries a marker of a suggestion, for example an author row with a `Suivre` or `Se connecter` button, and no context header.
The full selector is printed, so you can copy it straight into `remote-config.json` or `src/shared/config.js`.

### no-match

Nothing matched, which is why the post is kept. This kind only appears in verbose mode, and it answers the question "why is this post still visible?".

## 4. Maintainer shortcut, without touching the UI

If you prefer not to change the popup settings, set a flag once in the LinkedIn page console:

```js
localStorage.setItem('lsb_debug', '1'); // verbose on, then reload the page
localStorage.removeItem('lsb_debug');   // verbose off, then reload the page
```

The flag forces verbose mode on even when the popup toggle is off. It is deliberately not exposed in the UI.

## 5. Two traps to know before digging

### The remote config overrides the local one

At runtime the extension downloads `remote-config.json` from GitHub `main`, then replaces `keywordSelectors`, `keywords` and `childSelectors` with the remote values.
As a consequence, editing `src/shared/config.js` locally changes nothing until the remote file is published.

To test locally, build with the bypass, which ignores the remote config entirely:

```bash
npm run build:test
```

### Prose must stay out of keyword scanning

The substring rule matches keywords inside any element selected by `keywordSelectors`. If prose is scanned, a post that merely mentions "suggestions" or "sponsorise" gets hidden even though it has no LinkedIn label.

`PROSE_EXCLUSION` in `src/shared/config.js` is what keeps prose out. It currently excludes:

- `componentkey^="feed-commentary"` and `componentkey^="comment-commentary"`, the older prose markers;
- `[data-testid="expandable-text-box"]`, the container used by the current SDUI feed.

If LinkedIn introduces a new prose container, false positives will come back. In that case the log line tells you where to look: the `el="..."` field shows the exact text that matched.

### The extension runs in an isolated world

You cannot call extension internals from the page console. There is no `window.__lsbDebug()` helper. Use the logs described above, or reproduce the case offline with a fixture.

## 6. Copy a post as a fixture

Do not copy HTML by hand, it is error prone. Run this in the LinkedIn page console instead:

```js
copy(
  [...document.querySelectorAll('div[data-lazy-mount-id]')]
    .find((p) => p.textContent.includes('UNIQUE_POST_TEXT'))
    .outerHTML,
);
```

Replace `UNIQUE_POST_TEXT` with a word that appears only in that post. The element is copied to the clipboard, ready to paste into `tests/fixtures/`. Clean up names and remote URLs, keep the structure.

A hidden post is still present in the DOM, so the same snippet works for a false positive.

## 7. Inspect the markers of every post

To see at once which posts carry which marker:

```js
copy(JSON.stringify([...document.querySelectorAll('div[data-lazy-mount-id]')].map(p => {
  const SEL = ':is(button[componentkey^="auto-component-"], [componentkey^="ConnectButtonstate:"])';
  const btn = p.querySelector(SEL);
  if (!btn) return null;
  return {
    preview: p.textContent.replace(/\s+/g, ' ').slice(0, 55),
    aria: btn.getAttribute('aria-label'),
    h2count: p.querySelectorAll('h2').length,
    noHr: !p.querySelector('hr[role="presentation"]'),
    inAuthorRow: !!btn.closest('h2 + div')
  };
}).filter(Boolean), null, 1))
```

How to read the fields:

- `preview` is the beginning of the post, useful to identify it;
- `aria` is the label of the follow or connect button, which tells you which person it targets;
- `noHr` is `true` when the post has no context header, meaning it is a plain suggestion and not a "liked by" or "commented" post;
- `inAuthorRow` is `true` when the button belongs to the post author. When it is `false`, the button targets somebody else, and the post must be kept.

## 8. Lock the case with a test

- Add the post HTML to a fixture such as `tests/fixtures/feed-real-follow-button.html`, or build a small DOM inline in `tests/detection.test.js`.
- Assert the classification, and the reason when it matters:

```js
expect(detection.matchReason(post, modern('suggested'))).toMatchObject({
    kind: 'keyword-substring',
    keyword: 'suivi par',
});
```

- Run the checks:

```bash
npm test
npm run validate:remote-config
npm run build:test
```

The build with the bypass is the one to load when you want to test a detection change in the browser without publishing the remote config.
