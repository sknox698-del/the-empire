import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(projectRoot, 'www');
const webFiles = ['index.html', 'style.css', 'data.js', 'engine.js', 'ui.js'];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of webFiles) {
  await cp(join(projectRoot, file), join(outputDir, file));
}

console.log(`Built ${webFiles.length} web files in ${outputDir}`);
