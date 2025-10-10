#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Use process.cwd() to match the main script behavior
const PROJECT_ROOT = process.cwd();
const progressFile = path.resolve(PROJECT_ROOT, 'progress.json');
const distProgressFile = path.resolve(PROJECT_ROOT, 'dist', 'progress.json');

console.log('🏠 Project root:', PROJECT_ROOT);
console.log('💾 Progress file path:', progressFile);

let deleted = false;

// Delete progress file in project root
if (fs.existsSync(progressFile)) {
  fs.unlinkSync(progressFile);
  console.log('✅ Progress file deleted from project root.');
  deleted = true;
}

// Delete progress file in dist directory (in case it exists there)
if (fs.existsSync(distProgressFile)) {
  fs.unlinkSync(distProgressFile);
  console.log('✅ Progress file deleted from dist directory.');
  deleted = true;
}

if (deleted) {
  console.log('🎆 Starting fresh on next run.');
} else {
  console.log('ℹ️  No progress file found.');
}
