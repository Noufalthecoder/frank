// Makes sure better-sqlite3 is the ELECTRON build (not the plain-Node build) before packaging.
// Uses prebuilt binaries, so no Visual Studio / C++ compiler is needed.
// Run automatically by `npm run build`; can also be run alone: node scripts/prepare-native.mjs
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

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

// Ensure app-builder-lib NsisTarget has retry logic on Windows to avoid AV file-lock "spawn UNKNOWN"
try {
  const nsisTargetFile = path.resolve('node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js');
  if (fs.existsSync(nsisTargetFile)) {
    let content = fs.readFileSync(nsisTargetFile, 'utf8');
    const target = 'await (0, wine_1.execWine)(installerPath, null, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });';
    if (content.includes(target)) {
      const replacement = `let lastErr;
            for (let attempt = 0; attempt < 10; attempt++) {
                try {
                    await (0, wine_1.execWine)(installerPath, null, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });
                    lastErr = null;
                    break;
                }
                catch (error) {
                    lastErr = error;
                    builder_util_1.log.warn(\`execWine attempt \${attempt + 1} failed (\${error.message}), waiting before retry...\`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            if (lastErr) throw lastErr;`;
      content = content.replace(target, replacement);
      fs.writeFileSync(nsisTargetFile, content, 'utf8');
      console.log('[prepare-native] Patched app-builder-lib NsisTarget Windows retry logic');
    }
  }
} catch (e) {
  // Non-fatal
}

console.log('[prepare-native] done');
