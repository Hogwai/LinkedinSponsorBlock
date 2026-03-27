import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

/**
 * Parse CLI args supporting:
 *   --flag            → { flag: true }
 *   --key=value       → { key: 'value' }
 *   --key value       → { key: 'value' }  (space-separated, e.g. --zip /path/to.zip)
 *
 * @param {string[]} args - Usually process.argv.slice(2)
 * @returns {Record<string, string | boolean>}
 */
export function parseArgs(args) {
  const result = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        // --key=value
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        result[key] = value;
      } else {
        const key = arg.slice(2);
        // Peek at the next arg: if it exists and is not another flag, treat as value
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          result[key] = args[i + 1];
          i++;
        } else {
          result[key] = true;
        }
      }
    }
    i++;
  }
  return result;
}

// ---------------------------------------------------------------------------
// verifyEnvSafety (internal)
// ---------------------------------------------------------------------------

/**
 * Triple-check that .env is safe before reading it.
 * Prints a SECURITY ERROR and calls exit(1) if any check fails.
 */
function verifyEnvSafety() {
  const errors = [];

  // 1. .env or /.env must be in .gitignore
  let gitignoreContent = '';
  try {
    gitignoreContent = readFileSync('.gitignore', 'utf8');
  } catch {
    errors.push('.gitignore not found or unreadable');
  }
  if (gitignoreContent) {
    const lines = gitignoreContent.split('\n').map((l) => l.trim());
    const covered = lines.some((l) => l === '.env' || l === '/.env');
    if (!covered) {
      errors.push('.env is NOT listed in .gitignore (checked for ".env" or "/.env")');
    }
  }

  // 2. .env must NOT be tracked by git
  try {
    execSync('git ls-files --error-unmatch .env', { stdio: 'pipe' });
    // If this succeeds, .env IS tracked — that is an error
    errors.push('.env is tracked by git (git ls-files --error-unmatch .env succeeded)');
  } catch {
    // Expected: non-zero exit means .env is not tracked — safe
  }

  // 3. .env must NOT be staged
  try {
    const staged = execSync('git diff --cached --name-only', { stdio: 'pipe' }).toString();
    if (staged.split('\n').map((l) => l.trim()).includes('.env')) {
      errors.push('.env is currently staged for commit');
    }
  } catch {
    // git not available or similar; treat as error
    errors.push('Could not run git diff --cached to verify staging status');
  }

  if (errors.length > 0) {
    console.error('\nSECURITY ERROR: .env safety checks failed:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    console.error('Aborting to prevent credential exposure.\n');
    exit(1);
  }
}

// ---------------------------------------------------------------------------
// loadCredentials
// ---------------------------------------------------------------------------

/**
 * Load credentials for the given key names.
 * Checks process.env first; falls back to a .env file in CWD.
 * Runs verifyEnvSafety() before touching .env.
 * Exits with an error if any required key is missing.
 *
 * @param {string[]} required - Array of env-var key names
 * @returns {Record<string, string>}
 */
export function loadCredentials(required) {
  const found = {};

  // First pass: collect what is already in environment
  for (const key of required) {
    if (process.env[key]) {
      found[key] = process.env[key];
    }
  }

  const missing = required.filter((k) => !found[k]);

  // If anything is still missing, try .env
  if (missing.length > 0 && existsSync('.env')) {
    verifyEnvSafety();

    let envContent;
    try {
      envContent = readFileSync('.env', 'utf8');
    } catch (err) {
      throw new Error(`Failed to read .env: ${err.message}`);
    }

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (missing.includes(key) && !found[key]) {
        found[key] = value;
      }
    }
  }

  const stillMissing = required.filter((k) => !found[k]);
  if (stillMissing.length > 0) {
    throw new Error(`Missing required credentials: ${stillMissing.join(', ')}. Set them as environment variables or add them to a .env file.`);
  }

  return found;
}

// ---------------------------------------------------------------------------
// fetchWithRetry
// ---------------------------------------------------------------------------

/**
 * Fetch with exponential backoff retry.
 * Retries on 5xx responses and network errors. Does NOT retry 4xx.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {{ retries?: number, verbose?: boolean }} opts
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, { retries = 3, verbose = false } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      if (verbose) console.log(`Retry ${attempt}/${retries} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      // Network-level error — retry
      lastError = err;
      if (verbose) console.log(`Network error on attempt ${attempt}: ${err.message}`);
      if (attempt === retries) throw err;
      continue;
    }

    if (verbose) {
      const bodyText = await response.clone().text();
      console.log(`Response status: ${response.status}`);
      console.log(`Response body: ${bodyText}`);
    }

    // Don't retry 4xx
    if (response.status >= 400 && response.status < 500) {
      return response;
    }

    // Retry 5xx
    if (response.status >= 500) {
      lastError = new Error(`Server error: ${response.status}`);
      if (attempt === retries) return response;
      continue;
    }

    // Success
    return response;
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// getManifestFromZip
// ---------------------------------------------------------------------------

/**
 * Extract and parse manifest.json from a zip file using `unzip -p`.
 *
 * @param {string} zipPath - Path to the zip file
 * @returns {object | null} Parsed manifest JSON, or null on failure
 */
export function getManifestFromZip(zipPath) {
  try {
    const output = execSync(`unzip -p "${zipPath}" manifest.json`, { stdio: 'pipe' }).toString();
    return JSON.parse(output);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// readVersionsJson
// ---------------------------------------------------------------------------

/**
 * Read and parse versions.json from the current working directory.
 * Exits with an error if the file is missing or unparseable.
 *
 * @returns {{ chrome: string, firefox: string, userscript: string }}
 */
export function readVersionsJson() {
  const path = 'versions.json';
  if (!existsSync(path)) {
    throw new Error('versions.json not found in current working directory');
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse versions.json: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// confirm
// ---------------------------------------------------------------------------

/**
 * Print a summary and prompt the user to confirm.
 * Exits with code 0 if the user does not type "yes".
 *
 * @param {string} summary - Human-readable description of what will happen
 */
export async function confirm(summary) {
  console.log('\n' + summary);
  const rl = createInterface({ input: stdin, output: stdout });
  let answer;
  try {
    answer = await rl.question('\nType "yes" to continue: ');
  } finally {
    rl.close();
  }
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted.');
    exit(0);
  }
}

// ---------------------------------------------------------------------------
// createAmoJwt
// ---------------------------------------------------------------------------

/**
 * Generate an HS256 JWT for the AMO (addons.mozilla.org) API.
 * Returns a string in the form "JWT <token>".
 *
 * @param {string} apiKey    - AMO API key (becomes `iss` claim)
 * @param {string} apiSecret - AMO API secret (HMAC signing key)
 * @returns {string}  "JWT <header.payload.signature>"
 */
export function createAmoJwt(apiKey, apiSecret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: apiKey,
      jti: randomBytes(16).toString('hex'),
      iat: now,
      exp: now + 300,
    })
  ).toString('base64url');

  const signingInput = `${header}.${payload}`;
  const signature = createHmac('sha256', apiSecret)
    .update(signingInput)
    .digest('base64url');

  return `JWT ${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// zipDirectory
// ---------------------------------------------------------------------------

/**
 * Create a zip archive of a directory.
 *
 * IMPORTANT: outputPath must be an absolute path. If a relative path is given,
 * the zip file would be created relative to dirPath (after `cd`), not the
 * caller's CWD, producing a confusing result.
 *
 * @param {string} dirPath    - Directory to zip (all contents, not the dir itself)
 * @param {string} outputPath - Absolute path where the .zip file will be written
 */
export function zipDirectory(dirPath, outputPath) {
  execSync(`cd "${dirPath}" && zip -r "${outputPath}" .`, { stdio: 'inherit' });
}
