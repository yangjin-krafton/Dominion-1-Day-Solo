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

const MEMORY_DIR = path.join(__dirname, 'src', 'llm', 'memory');
const RECORDS_DIR  = path.join(__dirname, 'records');
const RANKING_DIR  = path.join(__dirname, 'sim-results');
// 디렉토리 자동 생성
fs.mkdirSync(MEMORY_DIR, { recursive: true });
fs.mkdirSync(RECORDS_DIR, { recursive: true });
fs.mkdirSync(RANKING_DIR, { recursive: true });

// ── 날짜별 랭킹 헬퍼 ──────────────────────────────────────
function _todayRankingPath() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(RANKING_DIR, `ranking_${date}.json`);
}

function _loadRankingFile(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return []; }
}

/** 모든 날짜별 랭킹 파일을 통합하여 점수 내림차순 반환 */
function _mergeAllRankings(limit = 200) {
  const files = fs.readdirSync(RANKING_DIR)
    .filter(f => f.startsWith('ranking_') && f.endsWith('.json'));
  let all = [];
  for (const f of files) {
    const records = _loadRankingFile(path.join(RANKING_DIR, f));
    all.push(...records);
  }
  // 중복 제거 (같은 id)
  const seen = new Set();
  all = all.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  all.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return all.slice(0, limit);
}

const server = http.createServer(async (req, res) => {

  // ── 게임 기록 저장 API ───────────────────────────────────
  if (req.url === '/game-records' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const record = JSON.parse(body);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `game_${ts}.json`;
      const filePath = path.join(RECORDS_DIR, filename);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');

      // records/all.json 에 누적 (최대 500건)
      const allPath = path.join(RECORDS_DIR, 'all.json');
      let all = [];
      try { all = JSON.parse(fs.readFileSync(allPath, 'utf8')); } catch {}
      all.push(record);
      if (all.length > 500) all = all.slice(-500);
      fs.writeFileSync(allPath, JSON.stringify(all, null, 2), 'utf8');

      // sim-results/ranking_YYYY-MM-DD.json 에 날짜별 누적
      const dailyPath = _todayRankingPath();
      let daily = _loadRankingFile(dailyPath);
      daily.push(record);
      daily.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      fs.writeFileSync(dailyPath, JSON.stringify(daily, null, 2), 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, file: filename }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── 통합 랭킹 API (모든 날짜 파일 병합) ─────────────────
  if (req.url === '/ranking' && req.method === 'GET') {
    const merged = _mergeAllRankings();
    // ranking.json 자동 갱신 (공개 서버용)
    fs.writeFileSync(path.join(RANKING_DIR, 'ranking.json'), JSON.stringify(merged, null, 2), 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(merged));
    return;
  }

  if (req.url === '/game-records' && req.method === 'GET') {
    const allPath = path.join(RECORDS_DIR, 'all.json');
    try {
      const data = fs.readFileSync(allPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // ── LLM 메모리 파일 API ───────────────────────────────────
  if (req.url.startsWith('/llm-memory/')) {
    const filename = decodeURIComponent(req.url.replace('/llm-memory/', ''));
    // 파일명 안전 검사 (.. 방지)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.writeHead(400); res.end('Bad filename'); return;
    }
    const filePath = path.join(MEMORY_DIR, filename);

    if (req.method === 'GET') {
      // 파일 읽기
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) { res.writeHead(404); res.end(''); return; }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      // 파일 쓰기
      const body = await readBody(req);
      fs.writeFile(filePath, body, 'utf8', (err) => {
        if (err) { res.writeHead(500); res.end(err.message); return; }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      });
      return;
    }

    if (req.method === 'DELETE') {
      fs.unlink(filePath, () => { res.writeHead(200); res.end('ok'); });
      return;
    }
  }

  // ── LLM 메모리 목록 ────────────────────────────────────────
  if (req.url === '/llm-memory' && req.method === 'GET') {
    fs.readdir(MEMORY_DIR, (err, files) => {
      if (err) { res.writeHead(500); res.end('[]'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files.filter(f => f.endsWith('.md') || f.endsWith('.json'))));
    });
    return;
  }

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
  const urlPath = req.url.split('?')[0];   // 쿼리스트링 제거
  let filePath = path.join(STATIC_ROOT, urlPath === '/' ? 'index.html' : urlPath);
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
