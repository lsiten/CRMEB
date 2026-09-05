import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const outputRoot = new URL('../dist/', import.meta.url);
const limits = { totalJavaScript: 2 * 1024 * 1024, largestChunk: 1.5 * 1024 * 1024 };

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory);
    if (entry.isDirectory()) files.push(...await collectJavaScript(path));
    else if (entry.name.endsWith('.js')) files.push({ path, size: (await stat(path)).size });
  }
  return files;
}

const files = await collectJavaScript(outputRoot);
const total = files.reduce((sum, file) => sum + file.size, 0);
const largest = files.reduce((current, file) => Math.max(current, file.size), 0);
if (total > limits.totalJavaScript || largest > limits.largestChunk) {
  console.error(`包体预算超限：JS 总计 ${total} bytes，最大 chunk ${largest} bytes`);
  process.exitCode = 1;
} else {
  console.log(`包体预算通过：JS 总计 ${total} bytes，最大 chunk ${largest} bytes`);
}
