// ============================================================
// ui/screens/RankingPanel.js — 랭킹 테이블 공유 컴포넌트
// ResultScreen · HomeScreen · 인게임 랭킹 버튼이 함께 사용
// ============================================================

// 타입별 강조색 (config.js ACCENT 와 동일값, CSS용 hex string)
const ACCENT_CSS = {
  Action:   '#9933cc',
  Treasure: '#d4a520',
  Victory:  '#228844',
  Curse:    '#cc3311',
};

/** PixiJS 색상 정수 → CSS hex 문자열 */
function _hex(n) {
  return '#' + (n ?? 0).toString(16).padStart(6, '0');
}

/**
 * 시장 카드 미니 그리드 HTML 생성 (공개 — HomeScreen 등 외부에서도 사용)
 *
 * @param {Array<{name, type, cost, gradTop, gradMid, gradBot, initCount}>} marketCards
 *   - initCount === null 이면 재고 배지 숨김 (게임 시작 전 미리보기용)
 * @returns {string} HTML  (빈 배열이면 '')
 */
export function buildMiniGrid(marketCards) {
  if (!marketCards?.length) return '';

  const items = marketCards.map(c => {
    const accent = ACCENT_CSS[c.type] ?? '#d4a520';
    const top    = _hex(c.gradTop);
    const mid    = _hex(c.gradMid);
    const bot    = _hex(c.gradBot);
    return `
      <div class="ds-mini-card" style="
        background: linear-gradient(to bottom, ${top} 0%, ${mid} 50%, ${bot} 100%);
        border-color: ${accent};
      "><span class="ds-mini-cost">${c.cost}</span></div>`;
  }).join('');

  return `<div class="ds-mini-grid">${items}</div>`;
}

/**
 * 랭킹 테이블 <tr> 행 HTML 생성 (공유 헬퍼)
 *
 * 각 레코드당 2행 출력:
 *   행 1: 순위 | 승점 | 턴 | 시간 | 날짜 | 목표VP
 *   행 2: 시장 mini-card 그리드 (colspan 6)
 *
 * @param {Array}       ranking    - Storage.getRanking() 결과
 * @param {number|null} currentId  - 하이라이트할 현재 게임 ID (없으면 null)
 * @param {number}      limit      - 표시할 최대 항목 수
 * @returns {string} HTML
 */
export function buildRankingRows(ranking, currentId = null, limit = 10) {
  return ranking.slice(0, limit).map((r, i) => {
    const isMe = currentId != null && r.id === currentId;
    const cls  = isMe ? 'ds-rank-me' : '';
    const m    = Math.floor(r.durationSec / 60);
    const s    = r.durationSec % 60;

    const vpTargetCell = r.vpTarget != null
      ? `<td>목표&nbsp;${r.vpTarget}승점</td>`
      : '<td></td>';

    const grid = buildMiniGrid(r.marketCards);

    return `
      <tr class="${cls}">
        <td>${i === 0 ? '🏆' : `#${i + 1}`}</td>
        <td>${r.vp}&nbsp;승점</td>
        <td>${r.turns}턴</td>
        <td>${m}:${String(s).padStart(2, '0')}</td>
        <td>${r.date}</td>
        ${vpTargetCell}
      </tr>
      ${grid ? `
      <tr class="ds-rank-setup${isMe ? ' ds-rank-me' : ''}">
        <td colspan="6">${grid}</td>
      </tr>` : ''}`;
  }).join('');
}

/**
 * 헤더 포함 전체 <table> HTML 생성 (공유 헬퍼)
 * ResultScreen · HomeScreen · RankingPanel 모두 이 함수 사용
 */
export function buildRankingTable(ranking, currentId = null, limit = 10) {
  const rows = buildRankingRows(ranking, currentId, limit);
  return `
    <table class="ds-rank-table">
      <thead>
        <tr style="color:#7a5c0a;font-size:15px">
          <td>순위</td><td>승점</td><td>턴</td><td>시간</td><td>날짜</td><td>목표</td>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" style="color:#554433">기록 없음</td></tr>'}</tbody>
    </table>`;
}

/**
 * 인게임 랭킹 버튼용 오버레이 — 타이틀 + 랭킹 + 닫기
 * 순환 의존 방지: RankingListPanel 대신 buildRankingTable을 직접 사용
 */
import { ScreenOverlay }   from './ScreenOverlay.js';
import { buildTitlePanel } from './TitlePanel.js';
import { buildActionPanel } from './ActionPanel.js';

export class RankingPanel {
  constructor() {
    this._overlay = new ScreenOverlay();
  }

  show(ranking, currentId = null) {
    if (this._overlay.visible) return;

    // 랭킹 내용 패널 (buildRankingTable — 같은 파일이므로 순환 없음)
    const rankingEl = document.createElement('div');
    rankingEl.className = 'ds-panel';
    rankingEl.innerHTML = `
      <div class="ds-divider">— 개인 랭킹 —</div>
      ${buildRankingTable(ranking, currentId, 10)}
    `;

    this._overlay.show([
      buildTitlePanel(),
      rankingEl,
      buildActionPanel({ onClose: () => this.hide() }),
    ]);
  }

  hide() { this._overlay.hide(); }
}
