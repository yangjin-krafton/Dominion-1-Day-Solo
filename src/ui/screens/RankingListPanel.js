// ============================================================
// RankingListPanel.js — 랭킹 목록 패널 (setup / global 모드)
// ============================================================
import { buildRankingTable } from './RankingPanel.js';

/**
 * 두 가지 모드:
 *
 * mode='setup'  — 이 세팅(kingdom 구성)의 개인 Top5 랭킹 (HomeScreen용)
 *   필요: records, kingdomIds, profile
 *
 * mode='global' — 전체 승점 기준 랭킹 + 선택적 결과 헤더 (ResultScreen / 인게임 랭킹용)
 *   필요: ranking, currentId, limit
 *   선택: record (게임 결과 헤더 표시용)
 *
 * @param {object}      opts
 * @param {'setup'|'global'} opts.mode
 * @param {Array}       [opts.records]     setup: 전체 기록
 * @param {string[]}    [opts.kingdomIds]  setup: 이 세팅의 킹덤 ID 목록
 * @param {{name:string}} [opts.profile]   setup: 플레이어 프로필
 * @param {Array}       [opts.ranking]     global: 랭킹 배열
 * @param {number|null} [opts.currentId]   global: 하이라이트 ID
 * @param {number}      [opts.limit=10]    global: 표시 행 수
 * @param {object}      [opts.record]      global: 결과 헤더용 (선택)
 */
export function buildRankingListPanel({
  mode = 'global',
  records, kingdomIds, profile,
  ranking, currentId = null, limit = 10,
  record,
}) {
  const el = document.createElement('div');
  el.className = 'ds-panel';

  if (mode === 'setup') {
    el.innerHTML = _buildSetupHtml(records, kingdomIds, profile);
  } else {
    el.innerHTML = _buildGlobalHtml(ranking, currentId, limit, record);
  }

  return el;
}

// ── Setup 모드 ────────────────────────────────────────────────
function _buildSetupHtml(records, kingdomIds, profile) {
  const name       = _esc(profile.name);
  const kingdomKey = [...kingdomIds].sort().join(',');

  const setupRecords = records
    .filter(r => r.kingdom?.length && [...r.kingdom].sort().join(',') === kingdomKey)
    .sort((a, b) => b.vp - a.vp);

  const top5 = setupRecords.slice(0, 5);

  const top5Rows = top5.map((r, i) => `
    <tr>
      <td>${i === 0 ? '🏆' : `#${i + 1}`}</td>
      <td>${name}</td>
      <td>${r.vp} 승점</td>
    </tr>`).join('');

  const padRows = Array.from({ length: Math.max(0, 5 - top5.length) }, (_, i) => `
    <tr class="ds-home-rank-empty">
      <td>#${top5.length + i + 1}</td><td>—</td><td>—</td>
    </tr>`).join('');

  const myLatest = [...setupRecords].sort((a, b) => b.id - a.id)[0];
  const myRank   = myLatest ? setupRecords.findIndex(r => r.id === myLatest.id) + 1 : 0;

  let sixthRow = '';
  if (setupRecords.length === 0) {
    sixthRow = `<tr class="ds-home-rank-first"><td colspan="3">✦ 첫 도전! ✦</td></tr>`;
  } else if (myRank > 5) {
    sixthRow = `<tr class="ds-home-rank-me">
      <td>#${myRank}</td><td>${name}</td><td>${myLatest.vp} 승점</td>
    </tr>`;
  }

  return `
    <div class="ds-divider">— 이 세팅 랭킹 —</div>
    <table class="ds-rank-table">
      <thead>
        <tr style="color:#7a5c0a;font-size:15px">
          <td style="width:40px">순위</td><td>이름</td><td>승점</td>
        </tr>
      </thead>
      <tbody>${top5Rows}${padRows}${sixthRow}</tbody>
    </table>`;
}

// ── Global 모드 ───────────────────────────────────────────────
function _buildGlobalHtml(ranking, currentId, limit, record) {
  let resultHeader = '';

  if (record) {
    const m       = Math.floor(record.durationSec / 60);
    const s       = record.durationSec % 60;
    const rankIdx = ranking.findIndex(r => r.id === record.id);
    const rankMsg = rankIdx === 0 ? '🎉 신기록!'
      : rankIdx > 0 ? `개인 ${rankIdx + 1}위` : '';

    resultHeader = `
      <div class="ds-result-main">
        <span class="ds-big-vp">${record.vp}</span>
        <span class="ds-big-label">승점</span>
      </div>
      <p class="ds-meta">
        ${record.turns}턴 · ${m}분 ${String(s).padStart(2, '0')}초
        ${rankMsg ? ` · <strong style="color:#d4a520">${rankMsg}</strong>` : ''}
      </p>`;
  }

  return `
    ${resultHeader}
    <div class="ds-divider">— 개인 랭킹 —</div>
    ${buildRankingTable(ranking, currentId, limit)}`;
}

function _esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
