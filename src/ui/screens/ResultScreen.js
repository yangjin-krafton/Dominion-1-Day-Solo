// ============================================================
// ResultScreen.js — 승리: 랭킹(결과헤더포함) + 시작/홈 버튼
// ============================================================
import { ScreenOverlay }         from './ScreenOverlay.js';
import { buildRankingListPanel } from './RankingListPanel.js';
import { buildActionPanel }      from './ActionPanel.js';

export class ResultScreen {
  constructor() {
    this._overlay  = new ScreenOverlay();
    /** @type {() => void} */
    this.onNextGame = null;
    /** @type {() => void} */
    this.onHome     = null;
  }

  /**
   * @param {{ id, date, turns, vp, durationSec }} opts.record
   * @param {Array}  opts.ranking
   */
  show({ record, ranking }) {
    if (this._overlay.visible) return;
    this._overlay.show([
      buildRankingListPanel({ mode: 'global', ranking, currentId: record.id, limit: 7, record }),
      buildActionPanel({
        onHome:     () => { this.hide(); this.onHome?.(); },
        onStart:    () => { this.hide(); this.onNextGame?.(); },
        startLabel: '⚔ 다음 게임',
      }),
    ]);
  }

  hide() { this._overlay.hide(); }
}
