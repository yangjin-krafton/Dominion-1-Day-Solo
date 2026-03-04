// ============================================================
// HomeScreen.js — 재접속: 타이틀 + 세팅 + 랭킹 + 시작 버튼
// ============================================================
import { ScreenOverlay }        from './ScreenOverlay.js';
import { buildTitlePanel }      from './TitlePanel.js';
import { buildSetupPanel }      from './SetupPanel.js';
import { buildRankingListPanel } from './RankingListPanel.js';
import { buildActionPanel }     from './ActionPanel.js';

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
   */
  show({ profile, records, kingdomIds, kingdomNames, todayMarketCards, vpTarget }) {
    if (this._overlay.visible) return;
    this._overlay.show([
      buildTitlePanel(),
      buildSetupPanel({ vpTarget, todayMarketCards, kingdomNames }),
      buildRankingListPanel({ mode: 'setup', records, kingdomIds, profile }),
      buildActionPanel({
        onStart: () => { this.hide(); this.onStart?.(); },
        startLabel: '⚔ 오늘의 챌린지 시작',
      }),
    ]);
  }

  hide() { this._overlay.hide(); }
}
