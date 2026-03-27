import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseArgs,
  fetchWithRetry,
  getManifestFromZip,
  readVersionsJson,
  zipDirectory,
} from './utils.js';
import { publishToChrome } from './chrome.js';
import { publishToFirefox } from './firefox.js';

// ---------------------------------------------------------------------------
// resolveLocalZip
// ---------------------------------------------------------------------------

/**
 * Build a zip from `dist/{target}/` and validate its manifest version.
 *
 * @param {'chrome' | 'firefox'} target
 * @returns {Promise<string>} Absolute path to the zip file
 */
async function resolveLocalZip(target) {
  const versions = readVersionsJson();
  const version = versions[target];
  if (!version) {
    throw new Error(`versions.json has no entry for target "${target}"`);
  }

  const distDir = `dist/${target}`;
  if (!existsSync(distDir)) {
    throw new Error(
      `dist/${target}/ not found — run npm run build:${target} first`
    );
  }

  const zipPath = resolve(`LinkedinSponsorBlock-${target}-${version}.zip`);
  zipDirectory(distDir, zipPath);

  const manifest = getManifestFromZip(zipPath);
  if (!manifest) {
    throw new Error(`Failed to extract manifest.json from zip: ${zipPath}`);
  }
  if (manifest.version !== version) {
    throw new Error(
      `Manifest version mismatch for ${target}: ` +
        `manifest.json has "${manifest.version}" but versions.json has "${version}"`
    );
  }

  return zipPath;
}

// ---------------------------------------------------------------------------
// resolveReleaseZip
// ---------------------------------------------------------------------------

/**
 * Download the latest GitHub release zip for the given target and validate it.
 *
 * @param {'chrome' | 'firefox'} target
 * @param {boolean} verbose
 * @returns {Promise<string>} Absolute path to the downloaded zip file
 */
async function resolveReleaseZip(target, verbose) {
  const githubToken = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'LinkedinSponsorBlock-publish',
  };
  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  if (verbose) console.log(`Fetching GitHub releases for target "${target}"...`);

  const releasesUrl =
    'https://api.github.com/repos/Hogwai/LinkedinSponsorBlock/releases?per_page=20';
  const releasesRes = await fetchWithRetry(releasesUrl, { headers }, { retries: 3, verbose });

  if (!releasesRes.ok) {
    const body = await releasesRes.text();
    throw new Error(
      `GitHub API error fetching releases (${releasesRes.status}): ${body}`
    );
  }

  const releases = await releasesRes.json();

  // Find first release whose tag starts with "{target}-v"
  const prefix = `${target}-v`;
  const release = releases.find((r) => r.tag_name && r.tag_name.startsWith(prefix));
  if (!release) {
    throw new Error(
      `No GitHub release found with tag starting with "${prefix}"`
    );
  }

  if (verbose) console.log(`Found release: ${release.tag_name}`);

  // Extract version from tag, e.g. "chrome-v1.1.10" → "1.1.10"
  const tagVersion = release.tag_name.slice(prefix.length);

  // Find zip asset
  const zipAsset = (release.assets ?? []).find((a) => a.name.endsWith('.zip'));
  if (!zipAsset) {
    throw new Error(
      `Release "${release.tag_name}" has no .zip asset`
    );
  }

  if (verbose) console.log(`Downloading asset: ${zipAsset.name} from ${zipAsset.url}`);

  // Download the asset (use Accept: application/octet-stream for binary download)
  const downloadHeaders = {
    Accept: 'application/octet-stream',
    'User-Agent': 'LinkedinSponsorBlock-publish',
  };
  if (githubToken) {
    downloadHeaders['Authorization'] = `Bearer ${githubToken}`;
  }

  const downloadRes = await fetchWithRetry(
    zipAsset.url,
    { headers: downloadHeaders },
    { retries: 3, verbose }
  );

  if (!downloadRes.ok) {
    const body = await downloadRes.text();
    throw new Error(
      `Failed to download asset "${zipAsset.name}" (${downloadRes.status}): ${body}`
    );
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  const zipPath = resolve(zipAsset.name);
  writeFileSync(zipPath, Buffer.from(arrayBuffer));

  if (verbose) console.log(`Saved to: ${zipPath}`);

  // Validate manifest version matches tag version
  const manifest = getManifestFromZip(zipPath);
  if (!manifest) {
    throw new Error(`Failed to extract manifest.json from downloaded zip: ${zipPath}`);
  }
  if (manifest.version !== tagVersion) {
    throw new Error(
      `Manifest version mismatch for ${target}: ` +
        `manifest.json has "${manifest.version}" but release tag implies "${tagVersion}"`
    );
  }

  return zipPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Flag validation
  if (args.ci) {
    console.error(
      'Error: --ci is not supported in publish.js. ' +
        'Use chrome.js or firefox.js directly with --ci --zip.'
    );
    process.exit(1);
  }

  if (args['from-release'] && args.zip) {
    console.error('Error: --from-release and --zip are incompatible. Use one or the other.');
    process.exit(1);
  }

  const chromeOnly = Boolean(args['chrome-only']);
  const firefoxOnly = Boolean(args['firefox-only']);
  const fromRelease = Boolean(args['from-release']);
  const dryRun = Boolean(args['dry-run']);
  const verbose = Boolean(args.verbose);

  // Determine targets
  let targets;
  if (chromeOnly && firefoxOnly) {
    console.error('Error: --chrome-only and --firefox-only are mutually exclusive.');
    process.exit(1);
  } else if (chromeOnly) {
    targets = ['chrome'];
  } else if (firefoxOnly) {
    targets = ['firefox'];
  } else {
    targets = ['chrome', 'firefox'];
  }

  // Process each target independently
  const results = [];

  for (const target of targets) {
    let zipPath;
    let result;
    let error;

    // Resolve zip
    try {
      if (fromRelease) {
        zipPath = await resolveReleaseZip(target, verbose);
      } else {
        zipPath = await resolveLocalZip(target);
      }
    } catch (err) {
      results.push({ target, status: 'FAILED', error: err.message });
      continue;
    }

    // Publish
    try {
      if (target === 'chrome') {
        result = await publishToChrome(zipPath, { ci: dryRun, dryRun, verbose });
      } else {
        result = await publishToFirefox(zipPath, { ci: dryRun, dryRun, verbose });
      }

      if (result.status === 'dry-run') {
        results.push({ target, status: 'DRY-RUN', version: result.version });
      } else {
        results.push({ target, status: 'OK', version: result.version });
      }
    } catch (err) {
      results.push({ target, status: 'FAILED', error: err.message });
    }
  }

  // Print summary
  console.log('\n--- Publish Summary ---');
  let anyFailed = false;
  for (const r of results) {
    if (r.status === 'OK') {
      console.log(`  ${r.target.padEnd(8)} OK       v${r.version}`);
    } else if (r.status === 'DRY-RUN') {
      console.log(`  ${r.target.padEnd(8)} DRY-RUN  v${r.version}`);
    } else {
      console.log(`  ${r.target.padEnd(8)} FAILED   ${r.error}`);
      anyFailed = true;
    }
  }
  console.log('-----------------------');

  if (anyFailed) {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
