// ============================================================
// HomeScreen.js — 재접속: 타이틀 + 세팅 + 시작 버튼
// ============================================================
import { ScreenOverlay }    from './ScreenOverlay.js';
import { buildTitlePanel }  from './TitlePanel.js';
import { buildSetupPanel }  from './SetupPanel.js';
import { buildActionPanel } from './ActionPanel.js';

export class HomeScreen {
  constructor() {
    this._overlay = new ScreenOverlay();
    /** @type {() => void} */
    this.onStart  = null;
  }

  /**
   * @param {object}   opts
   * @param {{ name: string }} opts.profile
   * @param {Array}    opts.records
   * @param {string[]} opts.kingdomIds
   * @param {string[]} opts.kingdomNames
   * @param {Array}    opts.todayMarketCards
   * @param {number}   opts.vpTarget
   * @param {number}   [opts.gameSeed]
   */
  show({ kingdomNames, todayMarketCards, vpTarget, gameSeed }) {
    if (this._overlay.visible) return;
    this._overlay.show([
      buildTitlePanel(),
      buildSetupPanel({ vpTarget, gameSeed, todayMarketCards, kingdomNames }),
      buildActionPanel({
        onStart: () => { this.hide(); this.onStart?.(); },
        startLabel: '⚔ 오늘의 챌린지 시작',
      }),
    ]);
  }

  hide() { this._overlay.hide(); }
}
