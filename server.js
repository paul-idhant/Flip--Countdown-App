/* ============================================================
   server.js — zero-dependency static server for FLIP
   Run with:  npm run dev     (or: node server.js)
   No `npm install` needed — uses Node core modules only.
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(String(req.url || '/').split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found: ' + urlPath);
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log('\n  Port ' + PORT + ' is already in use — FLIP may already be running.');
    console.log('  Just open http://localhost:' + PORT + '/ in your browser.');
    console.log('  (Or stop the other server first, or use another port: set PORT=8080)\n');
    process.exit(1);
  }
  console.log('  Server error: ' + (err && err.message));
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  FLIP — Cinematic Countdown');
  console.log('  Running at:  http://localhost:' + PORT + '/');
  console.log('  (Tip: use this exact URL as the Spotify Redirect URI, with trailing /)');
  console.log('\n  Press Ctrl+C to stop.\n');
});
