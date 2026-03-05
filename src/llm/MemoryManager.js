// ============================================================
// llm/MemoryManager.js — LLM 장기 메모리 관리
//
// 게임 종료 후:
//   1. LLM에게 게임 리뷰 요청 → 게임별 로그 저장
//   2. LLM에게 전략 업데이트 요청 → strategy.md 갱신
//
// 저장소: localStorage (브라우저)
//   - dominion_llm_logs     : 게임별 로그 배열
//   - dominion_llm_strategy : 장기 전략 문서
// ============================================================

const STORAGE_LOGS     = 'dominion_llm_logs';
const STORAGE_STRATEGY = 'dominion_llm_strategy';
const MAX_LOGS         = 20;   // 최근 N게임만 유지

// ── 기본 전략 텍스트 (최초 로드용) ──────────────────────────

let _defaultStrategy = '';
fetch(new URL('./strategy.md', import.meta.url))
  .then(r => r.text())
  .then(t => {
    _defaultStrategy = t;
    // 처음이면 기본값 저장
    if (!localStorage.getItem(STORAGE_STRATEGY)) {
      localStorage.setItem(STORAGE_STRATEGY, t);
    }
  })
  .catch(() => {});

// ── 공개 API ────────────────────────────────────────────────

export function getStrategy() {
  return localStorage.getItem(STORAGE_STRATEGY) || _defaultStrategy;
}

export function setStrategy(text) {
  localStorage.setItem(STORAGE_STRATEGY, text);
}

export function getLogs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_LOGS) || '[]'); }
  catch { return []; }
}

export function getRecentLogs(n = 3) {
  return getLogs().slice(-n);
}

export function addLog(log) {
  const logs = getLogs();
  logs.push(log);
  // 오래된 것부터 삭제
  while (logs.length > MAX_LOGS) logs.shift();
  localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));
}

// ── 게임 종료 후 LLM 리뷰 요청 ─────────────────────────────

/**
 * 게임 종료 후 호출:
 *   1. 게임 요약 로그 생성
 *   2. LLM에게 리뷰 + 전략 업데이트 요청
 *
 * @param {object} params
 * @param {object} params.gs          - 게임 상태
 * @param {object} params.record      - Storage.addRecord 결과
 * @param {boolean} params.won        - 승리 여부
 * @param {string} params.baseURL     - LLM API URL
 * @param {string} params.model       - 모델 이름
 * @param {object[]} params.actionLog - 턴별 행동 기록
 */
export async function reviewGame({ gs, record, won, baseURL, model, actionLog }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // ── 1. 게임 요약 생성 ──────────────────────────────────
  const summary = buildGameSummary({ gs, record, won, actionLog, timestamp });

  // ── 2. 로그 저장 (LLM 응답 전) ─────────────────────────
  const log = { timestamp, won, turns: record.turns, vp: record.vp,
                vpTarget: record.vpTarget, kingdom: record.kingdom, summary };
  addLog(log);

  // ── 3. LLM에게 리뷰 요청 ───────────────────────────────
  try {
    const review = await requestReview({ baseURL, model, summary });
    log.review = review;
    // 로그 업데이트 (리뷰 추가)
    const logs = getLogs();
    logs[logs.length - 1] = log;
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));

    // ── 4. 전략 문서 업데이트 ─────────────────────────────
    const updatedStrategy = await requestStrategyUpdate({
      baseURL, model, review, currentStrategy: getStrategy(),
    });
    if (updatedStrategy) setStrategy(updatedStrategy);

    console.log('%c[LLM Memory] 게임 리뷰 + 전략 업데이트 완료', 'color:#88ff88');
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
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
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
