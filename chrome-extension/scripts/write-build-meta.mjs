import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function gitValue(command) {
  try {
    return execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
}

const pkg = readJson('package.json');
const manifest = readJson('public/manifest.json');
const meta = {
  generatedAt: new Date().toISOString(),
  packageVersion: pkg.version,
  manifestVersion: manifest.version,
  gitCommit: gitValue('git rev-parse --short HEAD'),
  gitBranch: gitValue('git rev-parse --abbrev-ref HEAD'),
};

const output = `${JSON.stringify(meta, null, 2)}\n`;
for (const target of ['public/build-meta.json', 'src/constants/buildMeta.generated.json']) {
  mkdirSync(dirname(join(root, target)), { recursive: true });
  writeFileSync(join(root, target), output);
}
