import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline/promises';
import { parseArgs } from 'util';

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const TARGETS = ['chrome', 'firefox', 'userscript'];

const { values } = parseArgs({
    options: { target: { type: 'string' } },
    strict: false,
});

const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
const rl = createInterface({ input: process.stdin, output: process.stdout });

// Handle EOF on piped stdin
let closed = false;
const onClose = new Promise(r => rl.on('close', () => { closed = true; r(''); }));

async function ask(prompt) {
    if (closed) return '';
    return Promise.race([rl.question(prompt), onClose]);
}

async function askVersion(target) {
    const current = versions[target];
    while (true) {
        const answer = await ask(`  ${target} version (current: ${current}): `);
        const v = answer.trim() || current;
        if (SEMVER_RE.test(v)) return v;
        console.log(`  Invalid format "${v}". Expected: x.y.z`);
    }
}

async function askTargets() {
    console.log('\nAvailable targets:');
    TARGETS.forEach((t, i) => console.log(`  ${i + 1}) ${t}`));
    console.log(`  4) all`);

    while (true) {
        const answer = await ask('\nTargets to build (e.g. 1,3 or "all"): ');
        const input = answer.trim().toLowerCase();

        if (input === '4' || input === 'all') return [...TARGETS];

        const indices = input.split(',').map(s => parseInt(s.trim(), 10));
        const selected = indices
            .filter(i => i >= 1 && i <= TARGETS.length)
            .map(i => TARGETS[i - 1]);

        if (selected.length > 0) return [...new Set(selected)];
        console.log('  Invalid selection.');
    }
}

async function main() {
    const targets = values.target ? [values.target] : await askTargets();

    console.log('\nVersions (press Enter to keep current):');
    const newVersions = {};
    for (const t of targets) {
        newVersions[t] = await askVersion(t);
    }

    // Confirmation
    console.log('\nBuild plan:');
    for (const t of targets) {
        const changed = newVersions[t] !== versions[t];
        console.log(`  ${t}: ${newVersions[t]}${changed ? ` (was ${versions[t]})` : ''}`);
    }

    const confirm = await ask('\nProceed? (Y/n): ');
    if (confirm.trim().toLowerCase() === 'n') {
        console.log('Aborted.');
        if (!closed) rl.close();
        process.exit(0);
    }

    if (!closed) rl.close();

    // Update versions.json with new values
    for (const t of targets) {
        versions[t] = newVersions[t];
    }
    writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');

    // Build each target
    for (const t of targets) {
        console.log(`\nBuilding ${t}...`);
        execSync('rollup -c', {
            env: { ...process.env, BUILD_TARGET: t, VERSION: newVersions[t] },
            stdio: 'inherit',
        });
    }

    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
