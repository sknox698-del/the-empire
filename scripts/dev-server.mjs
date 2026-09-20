import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createServer } from 'node:http';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const relativePath = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
    const filePath = resolve(projectRoot, `.${relativePath}`);

    if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not a file');

    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`The Empire is running at http://127.0.0.1:${port}`);
  console.log('Press Ctrl+C to stop.');
});
