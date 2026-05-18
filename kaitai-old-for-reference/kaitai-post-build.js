import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Recursively processes files in a directory.
 * Converts Kaitai-generated JS into ESM-safe CJS modules.
 * @param {string} dir
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      processDirectory(fullPath);
      continue;
    }

    if (!entry.name.endsWith('.js')) {
      continue;
    }

    let content = fs.readFileSync(fullPath, 'utf8');

    // 1. Replace direct KaitaiStream usage with global reference.
    // This avoids import issues in ESM environments.
    content = content.replace(
      /KaitaiStream\.bytesToStr/g,
      'globalThis[\'KaitaiStream\'][\'bytesToStr\']'
    );

    // 2. Rename file extension to .cjs (safe in ESM package).
    const newPath = fullPath.replace(/\.js$/, '.cjs');

    fs.writeFileSync(newPath, content, 'utf8');
    fs.unlinkSync(fullPath);
  }
}

// Entry point directory.
const targetDir = process.argv[2];

if (!targetDir) {
  console.error('Pass the directory as the first positional arg.');
  process.exit(1);
}

processDirectory(targetDir);
console.log('Kaitai post-processing complete.');
