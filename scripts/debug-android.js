import { execSync } from 'child_process';
import { resolve } from 'path';

const deviceId = process.argv[2];

if (!deviceId) {
    console.error('Usage: npm run debug:android -- <device-id>');
    process.exit(1);
}

const distFirefox = resolve('dist/firefox');

execSync(
    `web-ext run -t firefox-android --adb-device ${deviceId} --firefox-apk org.mozilla.firefox`,
    { stdio: 'inherit', cwd: distFirefox }
);
