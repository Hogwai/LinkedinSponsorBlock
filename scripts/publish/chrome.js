import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs, loadCredentials, fetchWithRetry, getManifestFromZip, confirm } from './utils.js';

const REQUIRED_CREDENTIALS = [
  'CWS_CLIENT_ID',
  'CWS_CLIENT_SECRET',
  'CWS_REFRESH_TOKEN',
  'CWS_EXTENSION_ID',
];

// ---------------------------------------------------------------------------
// publishToChrome
// ---------------------------------------------------------------------------

/**
 * Publish a Chrome extension zip to the Chrome Web Store.
 *
 * @param {string} zipPath - Absolute or relative path to the .zip file
 * @param {{ ci?: boolean, dryRun?: boolean, verbose?: boolean }} options
 * @returns {Promise<{ store: 'chrome', version: string, status: 'dry-run' | 'success' }>}
 */
export async function publishToChrome(zipPath, options = {}) {
  const { ci = false, dryRun = false, verbose = false } = options;

  // 1. Load credentials
  const creds = loadCredentials(REQUIRED_CREDENTIALS);
  const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_EXTENSION_ID } = creds;

  // 2. Extract and validate manifest from zip
  const manifest = getManifestFromZip(zipPath);
  if (!manifest) {
    throw new Error(`Failed to extract manifest.json from zip: ${zipPath}`);
  }
  const version = manifest.version;
  if (!version) {
    throw new Error('manifest.json does not contain a version field');
  }

  // 3. Confirm (interactive mode only)
  if (!ci) {
    const summary =
      `Publishing to Chrome Web Store\n` +
      `  Extension ID : ${CWS_EXTENSION_ID}\n` +
      `  Version      : ${version}\n` +
      `  Zip          : ${zipPath}`;
    await confirm(summary);
  }

  // 4. Dry-run short-circuit
  if (dryRun) {
    console.log(`[dry-run] Would publish Chrome extension v${version} (${zipPath})`);
    return { store: 'chrome', version, status: 'dry-run' };
  }

  // 5. Get OAuth2 access token
  if (verbose) console.log('Fetching OAuth2 access token...');
  const tokenResponse = await fetch('https://accounts.google.com/o/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CWS_CLIENT_ID,
      client_secret: CWS_CLIENT_SECRET,
      refresh_token: CWS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`Failed to obtain OAuth2 access token (${tokenResponse.status}): ${body}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error('OAuth2 token response did not include access_token');
  }
  if (verbose) console.log('Access token obtained.');

  // 6. Upload zip
  if (verbose) console.log(`Uploading zip to Chrome Web Store (extension: ${CWS_EXTENSION_ID})...`);
  const zipBuffer = readFileSync(zipPath);

  const uploadResponse = await fetchWithRetry(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
      },
      body: zipBuffer,
    },
    { retries: 3, verbose }
  );

  const uploadData = await uploadResponse.json();
  if (verbose) console.log('Upload response:', JSON.stringify(uploadData, null, 2));

  if (uploadData.uploadState !== 'SUCCESS') {
    const detail = uploadData.itemError
      ? JSON.stringify(uploadData.itemError)
      : JSON.stringify(uploadData);
    throw new Error(`Upload failed (uploadState: ${uploadData.uploadState}): ${detail}`);
  }
  console.log(`Upload successful (v${version}).`);

  // 7. Publish
  if (verbose) console.log('Publishing extension...');
  const publishResponse = await fetchWithRetry(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${CWS_EXTENSION_ID}/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Length': '0',
      },
    },
    { retries: 3, verbose }
  );

  const publishData = await publishResponse.json();
  if (verbose) console.log('Publish response:', JSON.stringify(publishData, null, 2));

  const statusList = publishData.status ?? [];
  if (!statusList.some((s) => s.includes('OK'))) {
    throw new Error(`Publish did not return OK status: ${JSON.stringify(statusList)}`);
  }
  console.log(`Published successfully (v${version}).`);

  return { store: 'chrome', version, status: 'success' };
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

  publishToChrome(String(zipPath), options).then(
    (result) => {
      console.log(`Done: ${result.store} v${result.version} [${result.status}]`);
      process.exit(0);
    },
    (err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  );
}
