#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { getBuildInfo } = require('./build-info');

const [, , pkgPath, outPath] = process.argv;
if (!pkgPath || !outPath) {
  console.error('Usage: node gen-build-info.js <pkg.json path> <output .json path>');
  process.exit(1);
}

const info = getBuildInfo(path.resolve(pkgPath));
fs.writeFileSync(path.resolve(outPath), JSON.stringify(info, null, 2) + '\n');
console.log(`[build-info] wrote ${outPath}: v${info.version} @ ${info.commit}`);
