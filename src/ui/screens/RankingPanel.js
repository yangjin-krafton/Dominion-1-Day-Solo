// ============================================================
// ui/screens/RankingPanel.js — 랭킹 테이블 공유 컴포넌트
// ResultScreen 과 인게임 랭킹 버튼이 함께 사용
// ============================================================

/**
 * 랭킹 테이블 <tr> 행 HTML 생성 (공유 헬퍼)
 * @param {Array}       ranking    - Storage.getRanking() 결과
 * @param {number|null} currentId  - 현재 게임 ID (하이라이트용, 없으면 null)
 * @param {number}      limit      - 표시할 최대 행 수
 * @returns {string} HTML
 */
export function buildRankingRows(ranking, currentId = null, limit = 10) {
  return ranking.slice(0, limit).map((r, i) => {
    const isMe = currentId != null && r.id === currentId;
    const m    = Math.floor(r.durationSec / 60);
    const s    = r.durationSec % 60;
    return `<tr class="${isMe ? 'ds-rank-me' : ''}">
      <td>${i === 0 ? '🏆' : `#${i + 1}`}</td>
      <td>${r.vp} VP</td>
      <td>${r.turns}턴</td>
      <td>${m}:${String(s).padStart(2, '0')}</td>
      <td>${r.date}</td>
    </tr>`;
  }).join('');
}

/**
 * 인게임 랭킹 버튼용 모달 오버레이
 * 사용법: panel.show(ranking) → 닫기 버튼 또는 배경 탭으로 hide()
 */
export class RankingPanel {
  constructor() {
    this._el = null;
  }

  /**
   * @param {Array}       ranking   - Storage.getRanking() 결과
   * @param {number|null} currentId - 하이라이트할 게임 ID (옵션)
   */
  show(ranking, currentId = null) {
    if (this._el) return;

    const rows = buildRankingRows(ranking, currentId, 10);

    this._el = document.createElement('div');
    this._el.className = 'ds-screen';
    this._el.innerHTML = `
      <div class="ds-card">
        <h1 class="ds-title">개인 랭킹</h1>
        <p class="ds-subtitle">VP 기준 상위 10위</p>
        <div class="ds-divider">✦ ── ✦</div>
        <table class="ds-rank-table">
          <thead>
            <tr style="color:#7a5c0a;font-size:10px">
              <td>순위</td><td>승점</td><td>턴</td><td>시간</td><td>날짜</td>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" style="color:#554433">기록 없음</td></tr>'}</tbody>
        </table>
        <div style="margin-top:18px">
          <button class="ds-btn-s" id="ds-rank-close">닫기</button>
        </div>
      </div>
    `;

    document.body.appendChild(this._el);
    this._el.querySelector('#ds-rank-close')
      .addEventListener('click', () => this.hide());
    // 배경(오버레이 자체) 탭 시 닫기
    this._el.addEventListener('pointerdown', e => {
      if (e.target === this._el) this.hide();
    });
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }
}
