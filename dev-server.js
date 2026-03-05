#!/usr/bin/env node
// dev-server.js — CORS 프록시 포함 개발 서버
// Usage: node dev-server.js [port] [llm-url]

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2]) || 3000;
const LLM_URL = process.argv[3] || 'http://100.66.68.140:1234';
const STATIC_ROOT = path.join(__dirname, 'src');

const MIME = {
  '.html': 'text/html',         '.js':   'text/javascript',
  '.css':  'text/css',          '.json': 'application/json',
  '.png':  'image/png',         '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',     '.ogg':  'audio/ogg',
  '.mp3':  'audio/mpeg',        '.woff2':'font/woff2',
  '.webp': 'image/webp',        '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  // ── LLM 프록시 ──────────────────────────────────────────
  if (req.url.startsWith('/llm-proxy/')) {
    const target = LLM_URL + req.url.replace('/llm-proxy', '');
    try {
      const body = await readBody(req);
      const proxyRes = await fetch(target, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: req.method === 'POST' ? body : undefined,
      });
      res.writeHead(proxyRes.status, { 'Content-Type': 'application/json' });
      const data = await proxyRes.text();
      res.end(data);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── 정적 파일 ──────────────────────────────────────────
  let filePath = path.join(STATIC_ROOT, req.url === '/' ? 'index.html' : req.url);
  filePath = decodeURIComponent(filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[dev-server] http://localhost:${PORT}`);
  console.log(`[dev-server] LLM proxy: /llm-proxy/* -> ${LLM_URL}/*`);
});
