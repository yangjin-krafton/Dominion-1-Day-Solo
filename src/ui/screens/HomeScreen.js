// ============================================================
// ui/screens/HomeScreen.js — 메인 홈 화면
// 레이아웃: 타이틀 → 목표 승점 → 시장 미니그리드 → 이 세팅 랭킹 Top5
// ============================================================
import { buildMiniGrid } from './RankingPanel.js';

export class HomeScreen {
  constructor() {
    this._el     = null;
    /** @type {() => void} */
    this.onStart = null;
  }

  /**
   * @param {object}   opts
   * @param {{ name: string, totalGames: number }} opts.profile
   * @param {Array}    opts.records          - 전체 기록 배열 (보강 완료)
   * @param {string[]} opts.kingdomIds       - 오늘의 킹덤 ID 목록
   * @param {string[]} opts.kingdomNames     - 표시용 이름 목록
   * @param {Array}    opts.todayMarketCards - 오늘 시장 12장 card def 배열 (initCount=null)
   * @param {number}   opts.vpTarget         - 게임 목표 승점
   */
  show({ profile, records, kingdomIds, kingdomNames, todayMarketCards, vpTarget }) {
    if (this._el) return;

    const name = _esc(profile.name);

    // ── 이 세팅(kingdom 구성)으로 플레이한 기록만 필터 ──────────
    const kingdomKey   = [...kingdomIds].sort().join(',');
    const setupRecords = records
      .filter(r => r.kingdom?.length && [...r.kingdom].sort().join(',') === kingdomKey)
      .sort((a, b) => b.vp - a.vp);

    // Top5 행
    const top5 = setupRecords.slice(0, 5);
    const top5Rows = top5.map((r, i) => `
      <tr>
        <td>${i === 0 ? '🏆' : `#${i + 1}`}</td>
        <td>${name}</td>
        <td>${r.vp} 승점</td>
      </tr>`).join('');

    // 5위 미만이면 빈 행으로 채움
    const padRows = Array.from({ length: Math.max(0, 5 - top5.length) }, (_, i) => `
      <tr class="ds-home-rank-empty">
        <td>#${top5.length + i + 1}</td>
        <td>—</td>
        <td>—</td>
      </tr>`).join('');

    // 6번째 칸: 첫 도전 / 내 랭킹이 top5 밖인 경우
    const myLatest    = [...setupRecords].sort((a, b) => b.id - a.id)[0];
    const myRank      = myLatest ? setupRecords.findIndex(r => r.id === myLatest.id) + 1 : 0;
    let sixthRow = '';
    if (setupRecords.length === 0) {
      sixthRow = `<tr class="ds-home-rank-first">
        <td colspan="3">✦ 첫 도전! ✦</td>
      </tr>`;
    } else if (myRank > 5) {
      sixthRow = `<tr class="ds-home-rank-me">
        <td>#${myRank}</td>
        <td>${name}</td>
        <td>${myLatest.vp} 승점</td>
      </tr>`;
    }

    this._el = document.createElement('div');
    this._el.className = 'ds-screen';
    this._el.innerHTML = `
      <div class="ds-card">
        <h1 class="ds-title">Dominion</h1>
        <p class="ds-subtitle">1일 솔로 챌린지</p>
        <div class="ds-divider">✦ ── ✦</div>

        <div class="ds-home-target">
          <span class="ds-home-target-label">게임 목표 승점</span>
          <span class="ds-home-target-vp">${vpTarget}<span class="ds-home-target-unit">승점</span></span>
        </div>

        <div class="ds-kingdom">
          <p class="ds-label">오늘의 시장 · 킹덤 ${kingdomNames.length}장</p>
          ${buildMiniGrid(todayMarketCards)}
        </div>

        <div class="ds-divider">— 이 세팅 랭킹 —</div>
        <table class="ds-rank-table">
          <thead>
            <tr style="color:#7a5c0a;font-size:10px">
              <td style="width:30px">순위</td>
              <td>이름</td>
              <td>승점</td>
            </tr>
          </thead>
          <tbody>
            ${top5Rows}
            ${padRows}
            ${sixthRow}
          </tbody>
        </table>

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
