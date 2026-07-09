// Resolves version/commit for build metadata. Commit uses git when available;
// in Docker/CI without .git, set GIT_COMMIT_SHA, VERCEL_GIT_COMMIT_SHA, or RENDER_GIT_COMMIT.
const { execSync } = require('child_process');
const fs = require('fs');

function safeGit(cmd, fallback) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
}

function getBuildInfo(pkgJsonPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const commit =
    (process.env.GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || '').slice(0, 7) ||
    safeGit('git rev-parse --short HEAD', 'unknown');
  const branch = process.env.GIT_BRANCH || safeGit('git rev-parse --abbrev-ref HEAD', 'unknown');
  return { version: pkg.version, commit, branch, buildDate: new Date().toISOString() };
}

module.exports = { getBuildInfo };
