// ============================================================
// ActionPanel.js — 버튼 액션 패널
// ============================================================

/**
 * @param {object}    opts
 * @param {function}  [opts.onStart]      - 시작 버튼 콜백
 * @param {string}    [opts.startLabel]   - 시작 버튼 텍스트 (기본: '⚔ 게임 시작')
 * @param {function}  [opts.onHome]       - 홈으로 버튼 콜백
 * @param {function}  [opts.onClose]      - 닫기 버튼 콜백
 */
export function buildActionPanel({ onStart, startLabel = '⚔ 게임 시작', onHome, onClose }) {
  const el = document.createElement('div');
  el.className = 'ds-panel';

  let buttons = '';
  if (onHome)  buttons += `<button class="ds-btn-s" id="ap-home">홈으로</button>`;
  if (onClose) buttons += `<button class="ds-btn-s" id="ap-close">닫기</button>`;
  if (onStart) buttons += `<button class="ds-btn"   id="ap-start">${startLabel}</button>`;

  el.innerHTML = `<div class="ds-btn-row" style="margin-top:20px">${buttons}</div>`;

  el.querySelector('#ap-home')?.addEventListener('click', onHome);
  el.querySelector('#ap-close')?.addEventListener('click', onClose);
  el.querySelector('#ap-start')?.addEventListener('click', onStart);

  return el;
}
