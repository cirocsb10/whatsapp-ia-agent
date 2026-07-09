#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const APPS = {
  api: 'apps/api/package.json',
  web: 'apps/web/package.json',
  'channel-service': 'apps/channel-service/package.json',
};

const BUMPS = new Set(['patch', 'minor', 'major']);

function usage() {
  console.error('Usage: node scripts/bump-version.js <api|web|channel-service> <patch|minor|major|x.y.z> [--dry-run]');
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Invalid semver "${version}". Use x.y.z, patch, minor, or major.`);
  }
  return match.slice(1).map(Number);
}

function bumpVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) {
    return bump;
  }

  if (!BUMPS.has(bump)) {
    throw new Error(`Invalid bump "${bump}". Use patch, minor, major, or x.y.z.`);
  }

  const [major, minor, patch] = parseSemver(current);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const [, , appName, bump, ...flags] = process.argv;
  const dryRun = flags.includes('--dry-run');

  if (!appName || !bump || !APPS[appName]) {
    usage();
    process.exit(1);
  }

  const pkgPath = path.resolve(__dirname, '..', APPS[appName]);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  const nextVersion = bumpVersion(currentVersion, bump);

  if (currentVersion === nextVersion) {
    console.log(`[version] ${appName} already at ${nextVersion}`);
    return;
  }

  if (!dryRun) {
    pkg.version = nextVersion;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  const action = dryRun ? 'would bump' : 'bumped';
  console.log(`[version] ${action} ${appName}: ${currentVersion} -> ${nextVersion}`);
}

try {
  main();
} catch (err) {
  console.error(`[version] ${err.message}`);
  process.exit(1);
}
