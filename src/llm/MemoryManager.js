// ============================================================
// llm/MemoryManager.js — LLM 장기 메모리 관리
//
// 게임 종료 후:
//   1. LLM에게 게임 리뷰 요청 → 게임별 로그 파일 저장
//   2. LLM에게 전략 업데이트 요청 → strategy.md 갱신
//
// 저장소: src/llm/memory/ (dev-server /llm-memory/ API)
//   - strategy.md          : 장기 전략 문서 (LLM이 매 게임 후 갱신)
//   - logs.json            : 게임별 로그 배열
//   - game_YYYY-MM-DD_HH-MM.md : 개별 게임 로그
// ============================================================

const MAX_LOGS = 20;

// ── 파일 API 헬퍼 ────────────────────────────────────────────

async function _readFile(filename) {
  try {
    const res = await fetch(`/llm-memory/${encodeURIComponent(filename)}`);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

async function _writeFile(filename, content) {
  try {
    await fetch(`/llm-memory/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: content,
    });
  } catch (e) {
    console.warn(`[Memory] 파일 저장 실패 (${filename}):`, e.message);
  }
}

// ── 기본 전략 텍스트 (최초 로드용) ──────────────────────────

let _strategyCache = '';
let _logsCache = [];
let _initialized = false;

async function _ensureInit() {
  if (_initialized) return;
  _initialized = true;

  // 전략 로드 (파일 → localStorage 폴백)
  const fileStrategy = await _readFile('strategy.md');
  if (fileStrategy) {
    _strategyCache = fileStrategy;
  } else {
    // 파일 없으면 기본 strategy.md에서 복사
    try {
      const defaultRes = await fetch(new URL('./strategy.md', import.meta.url));
      _strategyCache = await defaultRes.text();
      await _writeFile('strategy.md', _strategyCache);
    } catch {
      _strategyCache = localStorage.getItem('dominion_llm_strategy') || '';
    }
  }

  // 로그 로드
  const fileLogsText = await _readFile('logs.json');
  if (fileLogsText) {
    try { _logsCache = JSON.parse(fileLogsText); } catch { _logsCache = []; }
  } else {
    // localStorage에서 마이그레이션
    try {
      _logsCache = JSON.parse(localStorage.getItem('dominion_llm_logs') || '[]');
      if (_logsCache.length > 0) await _writeFile('logs.json', JSON.stringify(_logsCache));
    } catch { _logsCache = []; }
  }

  console.log(`[Memory] 초기화 완료 — 전략 ${_strategyCache.length}자, 로그 ${_logsCache.length}건`);
}

// 모듈 로드 시 비동기 초기화
_ensureInit();

// ── 공개 API ────────────────────────────────────────────────

export function getStrategy() {
  return _strategyCache || localStorage.getItem('dominion_llm_strategy') || '';
}

export async function setStrategy(text) {
  _strategyCache = text;
  localStorage.setItem('dominion_llm_strategy', text); // 폴백
  await _writeFile('strategy.md', text);
}

export function getLogs() {
  return _logsCache;
}

export function getRecentLogs(n = 3) {
  return _logsCache.slice(-n);
}

export async function addLog(log) {
  _logsCache.push(log);
  while (_logsCache.length > MAX_LOGS) _logsCache.shift();
  localStorage.setItem('dominion_llm_logs', JSON.stringify(_logsCache)); // 폴백
  await _writeFile('logs.json', JSON.stringify(_logsCache, null, 2));
}

// ── 게임 종료 후 LLM 리뷰 요청 ─────────────────────────────

export async function reviewGame({ gs, record, won, baseURL, model, actionLog }) {
  await _ensureInit();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // ── 1. 게임 요약 생성 ──────────────────────────────────
  const summary = buildGameSummary({ gs, record, won, actionLog, timestamp });

  // ── 2. 개별 게임 로그 파일 저장 ────────────────────────
  const logFilename = `game_${timestamp}.md`;
  await _writeFile(logFilename, summary);

  // ── 3. 로그 배열에 추가 ────────────────────────────────
  const log = { timestamp, won, turns: record.turns, vp: record.vp,
                vpTarget: record.vpTarget, kingdom: record.kingdom, logFile: logFilename };
  await addLog(log);

  // ── 4. LLM에게 리뷰 요청 ──────────────────────────────
  try {
    const review = await requestReview({ baseURL, model, summary });
    log.review = review;
    // 로그 업데이트 (리뷰 추가)
    _logsCache[_logsCache.length - 1] = log;
    await _writeFile('logs.json', JSON.stringify(_logsCache, null, 2));

    // ── 5. 전략 문서 업데이트 ────────────────────────────
    const updatedStrategy = await requestStrategyUpdate({
      baseURL, model, review, currentStrategy: getStrategy(),
    });
    if (updatedStrategy) await setStrategy(updatedStrategy);

    console.log('%c[LLM Memory] 게임 리뷰 + 전략 업데이트 완료', 'color:#88ff88');
    console.log(`  로그: memory/${logFilename}`);
  } catch (e) {
    console.warn('[LLM Memory] 리뷰 요청 실패:', e.message);
  }
}

// ── 게임 요약 빌더 ──────────────────────────────────────────

function buildGameSummary({ gs, record, won, actionLog, timestamp }) {
  const allCards = [...gs.deck, ...gs.hand, ...gs.play, ...gs.discard];
  const deckComposition = {};
  for (const c of allCards) {
    deckComposition[c.def.id] = (deckComposition[c.def.id] ?? 0) + 1;
  }

  const lines = [
    `# Game Log — ${timestamp}`,
    ``,
    `## Result`,
    `- ${won ? 'WIN' : 'LOSS'}`,
    `- Turns: ${record.turns}`,
    `- VP: ${record.vp} / Target: ${record.vpTarget}`,
    `- Duration: ${record.durationSec ?? '?'}s`,
    ``,
    `## Kingdom Cards Available`,
    (record.kingdom ?? []).map(id => `- ${id}`).join('\n'),
    ``,
    `## Final Deck Composition (${allCards.length} cards)`,
    ...Object.entries(deckComposition)
      .sort(([,a],[,b]) => b - a)
      .map(([id, cnt]) => `- ${id}: ${cnt}`),
    ``,
    `## Turn-by-Turn Actions`,
    ...(actionLog ?? []).map(entry =>
      `Turn ${entry.turn}: ${entry.action} ${entry.card ?? ''} ${entry.reason ? '(' + entry.reason + ')' : ''}`
    ),
  ];
  return lines.join('\n');
}

// ── LLM API 호출 ────────────────────────────────────────────

async function callLLM(baseURL, model, system, user) {
  const res = await fetch(`${baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer local' },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function requestReview({ baseURL, model, summary }) {
  const system = `/no_think
You are a Dominion card game analyst. Review the completed game and provide insights.
Write in Korean. Be concise but insightful.
Focus on: what went well, what went wrong, key turning points, card choices.
Output plain text (not JSON).`;

  return callLLM(baseURL, model, system, summary);
}

async function requestStrategyUpdate({ baseURL, model, review, currentStrategy }) {
  const system = `/no_think
You are a Dominion strategy document maintainer.
You receive the current strategy document and a game review.
Update the strategy document by incorporating new lessons learned.

Rules:
- Keep the document structured with markdown headers
- Update stats (total games +1, wins if applicable)
- Add NEW insights only — don't repeat existing ones
- Keep total length under 3000 chars
- Remove outdated or contradicted strategies
- Write in Korean
- Output the FULL updated strategy document (not just changes)`;

  const user = `## Current Strategy Document
${currentStrategy}

## Latest Game Review
${review}`;

  return callLLM(baseURL, model, system, user);
}
