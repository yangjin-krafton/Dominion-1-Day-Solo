// ============================================================
// ui/screens/HomeScreen.js — 메인 홈 화면 (매일 달라지는 킹덤)
// ============================================================
import { buildRankingTable } from './RankingPanel.js';

export class HomeScreen {
  constructor() {
    this._el     = null;
    /** @type {() => void} */
    this.onStart = null;
  }

  /**
   * @param {object} opts
   * @param {{ name: string, totalGames: number }} opts.profile
   * @param {Array}    opts.records    - 전체 기록 배열
   * @param {string[]} opts.kingdomIds - 오늘의 킹덤 ID 목록
   * @param {string[]} opts.kingdomNames - 표시용 이름 목록
   */
  show({ profile, records, kingdomIds, kingdomNames }) {
    if (this._el) return;

    const sorted   = [...records].sort((a, b) => b.vp - a.vp);
    const best     = sorted[0];
    const today    = new Date().toISOString().split('T')[0];
    const todayN   = records.filter(r => r.date === today).length;
    const total    = profile.totalGames ?? records.length;

    const rankingTable = sorted.length
      ? `<div class="ds-divider">— 최근 기록 —</div>${buildRankingTable(sorted, null, 3)}`
      : '';

    this._el = document.createElement('div');
    this._el.className = 'ds-screen';
    this._el.innerHTML = `
      <div class="ds-card">
        <h1 class="ds-title">Dominion</h1>
        <p class="ds-subtitle">1일 솔로 챌린지</p>
        <div class="ds-divider">✦ ── ✦</div>
        <p class="ds-greeting">안녕하세요, <strong>${_esc(profile.name)}</strong> 님</p>

        <div class="ds-stats">
          <div class="ds-stat">
            <span class="ds-stat-v">${best?.vp ?? '-'}</span>
            <span class="ds-stat-l">최고 VP</span>
          </div>
          <div class="ds-stat">
            <span class="ds-stat-v">${total}</span>
            <span class="ds-stat-l">총 게임</span>
          </div>
          <div class="ds-stat">
            <span class="ds-stat-v">${todayN}</span>
            <span class="ds-stat-l">오늘 게임</span>
          </div>
        </div>

        <div class="ds-kingdom">
          <p class="ds-label">오늘의 킹덤 (${kingdomNames.length}장)</p>
          <p class="ds-kingdom-list">${kingdomNames.join('  ·  ')}</p>
        </div>

        ${rankingTable}

        <div style="margin-top:20px">
          <button class="ds-btn" id="ds-play">⚔ 오늘의 챌린지 시작</button>
        </div>
      </div>
    `;
    document.body.appendChild(this._el);
    this._el.querySelector('#ds-play').addEventListener('click', () => {
      this.hide();
      this.onStart?.();
    });
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }
}

function _esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
