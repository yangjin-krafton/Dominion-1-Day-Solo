// ============================================================
// SetupPanel.js — 게임 목표 승점 + 시장 미니카드 패널
// ============================================================
import { buildMiniGrid } from './RankingPanel.js';

/**
 * @param {object}   opts
 * @param {number}   opts.vpTarget          - 이번 게임 목표 승점
 * @param {Array}    opts.todayMarketCards  - [{name,type,cost,gradTop,gradMid,gradBot}]
 * @param {string[]} opts.kingdomNames      - 킹덤 카드 이름 목록 (개수 표시용)
 */
export function buildSetupPanel({ vpTarget, todayMarketCards, kingdomNames }) {
  const el = document.createElement('div');
  el.className = 'ds-panel';
  el.innerHTML = `
    <div class="ds-home-target">
      <span class="ds-home-target-label">게임 목표 승점</span>
      <span class="ds-home-target-vp">${vpTarget}<span class="ds-home-target-unit">승점</span></span>
    </div>
    <div class="ds-kingdom">
      <p class="ds-label">오늘의 시장 · 킹덤 ${kingdomNames.length}장</p>
      ${buildMiniGrid(todayMarketCards)}
    </div>
  `;
  return el;
}
