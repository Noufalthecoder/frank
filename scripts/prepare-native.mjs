// Makes sure better-sqlite3 is the ELECTRON build (not the plain-Node build) before packaging.
// Uses prebuilt binaries, so no Visual Studio / C++ compiler is needed.
// Run automatically by `npm run build`; can also be run alone: node scripts/prepare-native.mjs
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronVersion = require('electron/package.json').version;
const dir = path.dirname(require.resolve('better-sqlite3/package.json'));
const prebuildBin = require.resolve('prebuild-install/bin.js');

console.log(`[prepare-native] better-sqlite3 -> Electron ${electronVersion} (win32-x64)`);
const res = spawnSync(
  process.execPath,
  [prebuildBin, '--runtime=electron', `--target=${electronVersion}`, '--arch=x64', '--platform=win32', '--force'],
  { cwd: dir, stdio: 'inherit' }
);
if (res.status !== 0) {
  console.error('[prepare-native] FAILED to fetch the prebuilt Electron binary for better-sqlite3.');
  process.exit(res.status || 1);
}
console.log('[prepare-native] done');
