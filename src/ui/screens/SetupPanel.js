// ============================================================
// SetupPanel.js — 게임 목표 승점 + 시장 미니카드 패널
// ============================================================
import { buildMiniGrid } from './RankingPanel.js';

/**
 * @param {object}   opts
 * @param {number}   opts.vpTarget          - 이번 게임 목표 승점
 * @param {number}   opts.gameSeed          - 게임 시드 (번호 표시용)
 * @param {Array}    opts.todayMarketCards  - [{name,type,cost,gradTop,gradMid,gradBot}]
 * @param {string[]} opts.kingdomNames      - 킹덤 카드 이름 목록 (개수 표시용)
 */
export function buildSetupPanel({ vpTarget, gameSeed, todayMarketCards, kingdomNames }) {
  const seedCode = gameSeed
    ? gameSeed.toString(16).toUpperCase().padStart(8, '0')
    : '--------';

  const el = document.createElement('div');
  el.className = 'ds-panel';
  el.innerHTML = `
    <div class="ds-home-target">
      <span class="ds-home-target-label">게임 목표 승점</span>
      <span class="ds-home-target-vp">${vpTarget}<span class="ds-home-target-unit">승점</span></span>
    </div>
    <div class="ds-kingdom">
      <p class="ds-label">게임 번호 &nbsp;<span class="ds-seed-code">${seedCode}</span></p>
      ${buildMiniGrid(todayMarketCards)}
    </div>
  `;
  return el;
}
