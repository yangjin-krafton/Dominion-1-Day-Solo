// ============================================================
// ui/screens/ResultScreen.js — 게임 결과 + 랭킹 화면
// ============================================================

export class ResultScreen {
  constructor() {
    this._el         = null;
    /** @type {() => void} */
    this.onNextGame  = null;
    /** @type {() => void} */
    this.onHome      = null;
  }

  /**
   * @param {object} opts
   * @param {{ id, date, turns, vp, durationSec }} opts.record   - 방금 끝난 게임
   * @param {Array}  opts.ranking  - 전체 랭킹 (VP 내림차순)
   */
  show({ record, ranking }) {
    if (this._el) return;

    const mins = Math.floor(record.durationSec / 60);
    const secs = record.durationSec % 60;
    const rankIdx = ranking.findIndex(r => r.id === record.id);

    const topRows = ranking.slice(0, 7).map((r, i) => {
      const isMe = r.id === record.id;
      const m2   = Math.floor(r.durationSec / 60);
      const s2   = r.durationSec % 60;
      return `<tr class="${isMe ? 'ds-rank-me' : ''}">
        <td>${i === 0 ? '🏆' : `#${i + 1}`}</td>
        <td>${r.vp} VP</td>
        <td>${r.turns}턴</td>
        <td>${m2}:${String(s2).padStart(2, '0')}</td>
        <td>${r.date}</td>
      </tr>`;
    }).join('');

    const rankMsg = rankIdx === 0
      ? '🎉 신기록!'
      : rankIdx > 0
        ? `개인 ${rankIdx + 1}위`
        : '';

    this._el = document.createElement('div');
    this._el.className = 'ds-screen';
    this._el.innerHTML = `
      <div class="ds-card">
        <h1 class="ds-title">게임 종료</h1>
        <p class="ds-subtitle">${record.date}</p>
        <div class="ds-divider">✦ ── ✦</div>

        <div class="ds-result-main">
          <span class="ds-big-vp">${record.vp}</span>
          <span class="ds-big-label">승점</span>
        </div>
        <p class="ds-meta">
          ${record.turns}턴  ·  ${mins}분 ${String(secs).padStart(2, '0')}초
          ${rankMsg ? `  ·  <strong style="color:#d4a520">${rankMsg}</strong>` : ''}
        </p>

        <div class="ds-divider">— 개인 랭킹 —</div>
        <table class="ds-rank-table">
          <thead>
            <tr style="color:#7a5c0a;font-size:10px">
              <td>순위</td><td>승점</td><td>턴</td><td>시간</td><td>날짜</td>
            </tr>
          </thead>
          <tbody>${topRows || '<tr><td colspan="5" style="color:#554433">기록 없음</td></tr>'}</tbody>
        </table>

        <div class="ds-btn-row">
          <button class="ds-btn-s" id="ds-home">홈으로</button>
          <button class="ds-btn"   id="ds-next">⚔ 다음 게임</button>
        </div>
      </div>
    `;
    document.body.appendChild(this._el);
    this._el.querySelector('#ds-next').addEventListener('click', () => {
      this.hide();
      this.onNextGame?.();
    });
    this._el.querySelector('#ds-home').addEventListener('click', () => {
      this.hide();
      this.onHome?.();
    });
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }
}
