import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseArgs,
  loadCredentials,
  fetchWithRetry,
  getManifestFromZip,
  confirm,
  createAmoJwt,
} from './utils.js';

// ---------------------------------------------------------------------------
// publishToFirefox
// ---------------------------------------------------------------------------

/**
 * Publish a Firefox extension zip to addons.mozilla.org (AMO).
 *
 * @param {string} zipPath - Absolute or relative path to the .zip file
 * @param {{ ci?: boolean, dryRun?: boolean, verbose?: boolean }} options
 * @returns {Promise<{ store: 'firefox', version: string, status: 'dry-run' | 'success' }>}
 */
export async function publishToFirefox(zipPath, options = {}) {
  const { ci = false, dryRun = false, verbose = false } = options;

  // 1. Load credentials
  const creds = loadCredentials(['AMO_API_KEY', 'AMO_API_SECRET', 'AMO_ADDON_ID']);
  const { AMO_API_KEY, AMO_API_SECRET, AMO_ADDON_ID } = creds;

  // 2. Extract and validate manifest from zip
  const manifest = getManifestFromZip(zipPath);
  if (!manifest) {
    throw new Error(`Failed to extract manifest.json from zip: ${zipPath}`);
  }
  const version = manifest.version;
  if (!version) {
    throw new Error('manifest.json does not contain a version field');
  }

  // 3. Confirm if not running in CI
  if (!ci) {
    const summary =
      `Firefox publish summary:\n` +
      `  Addon ID : ${AMO_ADDON_ID}\n` +
      `  Version  : ${version}\n` +
      `  Zip      : ${zipPath}\n` +
      `  Dry run  : ${dryRun}`;
    await confirm(summary);
  }

  // 4. Dry-run short-circuit
  if (dryRun) {
    console.log('[dry-run] Skipping AMO upload.');
    return { store: 'firefox', version, status: 'dry-run' };
  }

  // 5. Generate JWT
  const jwt = createAmoJwt(AMO_API_KEY, AMO_API_SECRET);

  // 6. Build FormData payload
  const zipData = readFileSync(zipPath);
  const formData = new FormData();
  formData.append('channel', 'listed');
  formData.append('upload', new File([zipData], basename(zipPath)));

  // 7. Upload via PUT
  const uploadUrl = `https://addons.mozilla.org/api/v5/addons/${AMO_ADDON_ID}/versions/${version}/`;
  if (verbose) {
    console.log(`PUT ${uploadUrl}`);
  }

  const uploadResponse = await fetchWithRetry(
    uploadUrl,
    {
      method: 'PUT',
      headers: { Authorization: jwt },
      body: formData,
    },
    { retries: 3, verbose }
  );

  // 8. Check for failure
  if (!uploadResponse.ok) {
    const body = await uploadResponse.text();
    throw new Error(
      `AMO upload failed with status ${uploadResponse.status}: ${body}`
    );
  }

  // 9. Warn if unexpected success status
  if (uploadResponse.status !== 202) {
    console.warn(
      `Warning: expected HTTP 202 from AMO but got ${uploadResponse.status}. ` +
        'The upload may still have succeeded.'
    );
  }

  console.log(`Firefox: upload accepted, enters Mozilla review queue (version ${version})`);
  return { store: 'firefox', version, status: 'success' };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));

  const zipPath = args.zip;
  if (!zipPath || zipPath === true) {
    console.error('Error: --zip <path> is required');
    process.exit(1);
  }

  const options = {
    ci: Boolean(args.ci),
    dryRun: Boolean(args['dry-run']),
    verbose: Boolean(args.verbose),
  };

  publishToFirefox(/** @type {string} */ (zipPath), options)
    .then((result) => {
      console.log(`Done: ${JSON.stringify(result)}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
}
