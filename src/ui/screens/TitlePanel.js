// ============================================================
// TitlePanel.js — 게임 타이틀 패널
// ============================================================

export function buildTitlePanel() {
  const el = document.createElement('div');
  el.className = 'ds-panel';
  el.innerHTML = `
    <h1 class="ds-title">Dominion</h1>
    <p class="ds-subtitle">1일 솔로 챌린지</p>
    <div class="ds-divider">✦ ── ✦</div>
  `;
  return el;
}
