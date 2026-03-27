import { execSync, spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline/promises';
import { parseArgs } from 'util';

const FIREFOX_APK = 'org.mozilla.firefox';
const DIST_FIREFOX = resolve('dist/firefox');

const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

const { values: flags } = parseArgs({
    options: { 'no-watch': { type: 'boolean', default: false } },
    strict: false,
});

// ── ADB helpers ──────────────────────────────────────────────

function checkAdb() {
    try {
        execSync('adb --version', { stdio: 'ignore' });
    } catch {
        console.error('Error: adb not found. Install it with:\n  sudo apt install adb');
        process.exit(1);
    }
}

function getDevices() {
    const output = execSync('adb devices', { encoding: 'utf8' });
    return output
        .split('\n')
        .slice(1) // skip header
        .map(line => line.split('\t'))
        .filter(([id, status]) => id && status?.trim() === 'device')
        .map(([id]) => id);
}

async function selectDevice(devices) {
    if (devices.length === 0) {
        console.error('No ADB devices found. Please verify the checklist above and try again.');
        process.exit(1);
    }

    if (devices.length === 1) {
        console.log(`Using device: ${devices[0]}`);
        return devices[0];
    }

    console.log('\nConnected devices:');
    devices.forEach((d, i) => console.log(`  ${i + 1}) ${d}`));

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        while (true) {
            const answer = await rl.question('\nSelect device: ');
            const idx = parseInt(answer.trim(), 10) - 1;
            if (idx >= 0 && idx < devices.length) return devices[idx];
            console.log('Invalid selection.');
        }
    } finally {
        rl.close();
    }
}

// ── Build ────────────────────────────────────────────────────

function buildFirefox(version) {
    console.log(`\nBuilding Firefox extension v${version}...\n`);
    try {
        execSync('npx rollup -c', {
            env: { ...process.env, BUILD_TARGET: 'firefox', VERSION: version },
            stdio: 'inherit',
        });
    } catch {
        console.error('\nBuild failed.');
        process.exit(1);
    }
}

// ── Watch + Deploy ───────────────────────────────────────────

function prefixStream(stream, tag) {
    let buffer = '';
    stream.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
            if (line.trim()) console.log(`${tag} ${line}`);
        }
    });
}

function startWatchAndDeploy(version, deviceId) {
    return new Promise((resolvePromise, reject) => {
        let cleaning = false;
        const children = [];

        function cleanup() {
            if (cleaning) return;
            cleaning = true;
            for (const child of children) {
                try { child.kill('SIGTERM'); } catch { /* already dead */ }
            }
            setTimeout(() => {
                for (const child of children) {
                    try { child.kill('SIGKILL'); } catch { /* already dead */ }
                }
                process.exit(0);
            }, 3000);
        }

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Start rollup watch
        const rollup = spawn('npx', ['rollup', '-c', '--watch'], {
            env: { ...process.env, BUILD_TARGET: 'firefox', VERSION: version },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        children.push(rollup);

        const rollupTag = `${CYAN}[rollup]${RESET}`;
        const webextTag = `${MAGENTA}[web-ext]${RESET}`;

        prefixStream(rollup.stdout, rollupTag);
        prefixStream(rollup.stderr, rollupTag);

        // Wait for first build, then start web-ext
        let webextStarted = false;
        rollup.stdout.on('data', chunk => {
            const text = chunk.toString();
            if (!webextStarted && (text.includes('created') || text.includes('waiting for changes'))) {
                webextStarted = true;
                console.log(`\n${webextTag} Starting web-ext on device ${deviceId}...\n`);

                const webext = spawn('npx', [
                    'web-ext', 'run',
                    '-t', 'firefox-android',
                    '--adb-device', deviceId,
                    '--firefox-apk', FIREFOX_APK,
                ], {
                    cwd: DIST_FIREFOX,
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                children.push(webext);

                prefixStream(webext.stdout, webextTag);
                prefixStream(webext.stderr, webextTag);

                webext.on('close', code => {
                    if (!cleaning) {
                        console.log(`\n${webextTag} exited (code ${code})`);
                        cleanup();
                    }
                });
            }
        });

        rollup.on('close', code => {
            if (!cleaning) {
                console.log(`\n${rollupTag} exited (code ${code})`);
                cleanup();
            }
        });
    });
}

// ── Setup checklist ──────────────────────────────────────────

async function showChecklist() {
    console.log(`
Before connecting, make sure you have:

  1. Enabled Developer Mode on your Android device
  2. Enabled USB Debugging in Android Developer settings
  3. Enabled file transfer (not charge-only mode)
  4. Enabled USB Debugging in Firefox on the Android device
     (Settings > Advanced > Remote debugging via USB)
  5. Connected the device to your computer via USB
  6. Accepted the USB debugging prompt on the device
`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('Press Enter when ready...');
    rl.close();
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
    const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
    const version = versions.firefox;

    checkAdb();
    await showChecklist();
    const devices = getDevices();
    const deviceId = await selectDevice(devices);

    if (flags['no-watch']) {
        buildFirefox(version);
        console.log('\nStarting web-ext (one-shot mode)...\n');
        execSync(
            `npx web-ext run -t firefox-android --adb-device ${deviceId} --firefox-apk ${FIREFOX_APK}`,
            { stdio: 'inherit', cwd: DIST_FIREFOX }
        );
    } else {
        console.log('\nStarting watch mode (rollup + web-ext)...\n');
        console.log('Edit source files and they will auto-reload on device.');
        console.log('Press Ctrl+C to stop.\n');
        await startWatchAndDeploy(version, deviceId);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
