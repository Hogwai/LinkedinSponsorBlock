(function () {
  'use strict';

  if (window.__LSB_ACTIVE) {
    console.warn('[LSB-POC] Already active. Call __LSB_RESTORE() first.');
    return;
  }

  const PREFIX = '[LSB-POC]';
  const URL_FILTERS = ['/voyager/api/', '/api/feed/', '/graphql'];
  const SPONSOR_KEYWORDS = [
    'sponsored', 'promoted', 'ad', 'tracking',
    'transporterkeys', 'issponsored', 'sponsoredtype',
    'adcontent', 'promotedcontent'
  ];

  let currentMode = 'DISCOVER';
  window.__LSB_RESULTS = [];
  window.__LSB_ACTIVE = true;

  function stripHijackPrefix(text) {
    const prefixes = ['for (;;);', ")]}'\n", ')]}\n', 'while(1);'];
    for (const p of prefixes) {
      if (text.startsWith(p)) {
        return text.slice(p.length);
      }
    }
    return text;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function deepSearch(obj, keywords, maxDepth = 15) {
    const hits = [];
    function walk(node, path, depth) {
      if (depth > maxDepth || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const lower = node.toLowerCase();
        for (const kw of keywords) {
          if (lower.includes(kw)) {
            hits.push({ path, value: node, keyword: kw });
          }
        }
        return;
      }
      if (typeof node === 'object') {
        const entries = Array.isArray(node)
          ? node.map((v, i) => [i, v])
          : Object.entries(node);
        for (const [key, val] of entries) {
          const keyStr = String(key).toLowerCase();
          for (const kw of keywords) {
            if (keyStr.includes(kw)) {
              hits.push({ path: `${path}.${key}`, value: val, keyword: kw });
            }
          }
          walk(val, `${path}.${key}`, depth + 1);
        }
      }
    }
    walk(obj, '$', 0);
    return hits;
  }

  function analyzeResponse(url, data, rawSize) {
    if (currentMode === 'DISCOVER') {
      discover(url, data, rawSize);
    } else if (currentMode === 'ANALYZE') {
      analyze(url, data, rawSize);
    } else if (currentMode === 'CORRELATE') {
      correlate(url, data, rawSize);
    }
  }

  function discover(url, data, rawSize) {
    const keys = Array.isArray(data) ? `[Array: ${data.length} items]` : Object.keys(data).join(', ');
    console.group(`${PREFIX} 📡 ${url.split('?')[0]}`);
    console.log('Size:', formatSize(rawSize));
    console.log('Keys:', keys);
    console.log('Full URL:', url);
    console.groupEnd();
    window.__LSB_RESULTS.push({
      mode: 'DISCOVER',
      url: url.split('?')[0],
      size: rawSize,
      keys: Array.isArray(data) ? ['[Array]'] : Object.keys(data),
      timestamp: Date.now()
    });
  }

  function analyze(url, data, rawSize) {
    const hits = deepSearch(data, SPONSOR_KEYWORDS);
    if (hits.length === 0) return;
    console.group(`${PREFIX} 🔍 ${url.split('?')[0]} — ${hits.length} marker(s) found`);
    console.log('Size:', formatSize(rawSize));
    const grouped = {};
    for (const hit of hits) {
      if (!grouped[hit.keyword]) grouped[hit.keyword] = [];
      grouped[hit.keyword].push(hit);
    }
    for (const [keyword, kwHits] of Object.entries(grouped)) {
      console.group(`Keyword: "${keyword}" (${kwHits.length} hits)`);
      for (const h of kwHits.slice(0, 5)) {
        const val = typeof h.value === 'string' ? h.value : JSON.stringify(h.value).slice(0, 200);
        console.log(`  ${h.path} → ${val}`);
      }
      if (kwHits.length > 5) {
        console.log(`  ... and ${kwHits.length - 5} more`);
      }
      console.groupEnd();
    }
    console.groupEnd();
    window.__LSB_RESULTS.push({
      mode: 'ANALYZE',
      url: url.split('?')[0],
      hits: hits.map(h => ({ path: h.path, keyword: h.keyword, value: typeof h.value === 'string' ? h.value : '[object]' })),
      timestamp: Date.now()
    });
  }

  function correlate(url, data, rawSize) {
    const hits = deepSearch(data, SPONSOR_KEYWORDS);
    if (hits.length === 0) return;
    const idHits = deepSearch(data, ['urn', 'trackingid', 'updateurn', 'activityurn', 'entityurn']);
    console.group(`${PREFIX} 🔗 ${url.split('?')[0]} — Correlating ${idHits.length} ID(s)`);
    let correlated = 0;
    for (const idHit of idHits.slice(0, 10)) {
      if (typeof idHit.value !== 'string') continue;
      const escaped = CSS.escape(idHit.value);
      const domMatch =
        document.querySelector(`[data-urn="${escaped}"]`) ||
        document.querySelector(`[data-id="${escaped}"]`) ||
        document.querySelector(`[data-view-tracking-scope*="${idHit.value}"]`);
      if (domMatch) {
        correlated++;
        console.log(`✅ ${idHit.path} → ${idHit.value}`);
        console.log('   DOM element:', domMatch);
        window.__LSB_RESULTS.push({
          mode: 'CORRELATE',
          id: idHit.value,
          path: idHit.path,
          domElement: domMatch.tagName + (domMatch.id ? '#' + domMatch.id : ''),
          sponsorHits: hits.length,
          timestamp: Date.now()
        });
      }
    }
    if (correlated === 0) {
      console.log('No DOM matches found for extracted IDs.');
      console.log('IDs tried:', idHits.slice(0, 10).map(h => h.value));
    }
    console.groupEnd();
  }

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = (typeof args[0] === 'string') ? args[0] : args[0]?.url || '';
      if (!URL_FILTERS.some(pattern => url.includes(pattern))) {
        return response;
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        return response;
      }
      const clone = response.clone();
      clone.text().then(text => {
        try {
          const cleaned = stripHijackPrefix(text);
          const data = JSON.parse(cleaned);
          analyzeResponse(url, data, text.length);
        } catch (e) {
          // Unparseable — skip silently
        }
      });
    } catch (e) {
      // Don't break LinkedIn if our interception fails
    }
    return response;
  };

  window.__LSB_MODE = function (mode) {
    const valid = ['DISCOVER', 'ANALYZE', 'CORRELATE'];
    if (!valid.includes(mode)) {
      console.warn(`${PREFIX} Invalid mode. Use: ${valid.join(', ')}`);
      return;
    }
    currentMode = mode;
    console.log(`${PREFIX} Switched to ${mode} mode.`);
  };

  window.__LSB_RESTORE = function () {
    window.fetch = originalFetch;
    window.__LSB_ACTIVE = false;
    console.log(`${PREFIX} Fetch restored. Interceptor disabled.`);
    console.log(`${PREFIX} ${window.__LSB_RESULTS.length} results captured. See __LSB_RESULTS`);
  };

  console.log(`${PREFIX} Interceptor active in ${currentMode} mode.`);
  console.log(`${PREFIX} Commands: __LSB_MODE('ANALYZE'), __LSB_RESTORE(), __LSB_RESULTS`);
})();
