// ============================================================
// ui/screens/CatalogScreen.js — 전체 카드 도감 오버레이
// 사용법: show(cardMap) → ✕ 버튼 또는 배경 클릭 시 hide()
// ============================================================
import { KINGDOM_POOL, BASIC_IDS } from '../../config.js';

export class CatalogScreen {
  constructor() {
    this._el = null;
  }

  /** @param {Map<string, object>} cardMap */
  show(cardMap) {
    if (this._el) return;

    this._el = document.createElement('div');
    this._el.className = 'ds-screen ds-catalog-screen';
    this._el.innerHTML = `
      <div class="ds-catalog-panel">
        <div class="ds-catalog-header">
          <span class="ds-catalog-title">도감</span>
          <button class="ds-catalog-close" id="ds-cat-close">✕</button>
        </div>
        <div class="ds-catalog-body">
          ${_buildSection('기본 카드', BASIC_IDS, cardMap)}
          ${_buildSection('왕국 카드', KINGDOM_POOL, cardMap)}
        </div>
      </div>
    `;
    document.body.appendChild(this._el);
    this._el.querySelector('#ds-cat-close').addEventListener('click', () => this.hide());
    // 배경 클릭 시 닫기
    this._el.addEventListener('pointerdown', e => {
      if (e.target === this._el) this.hide();
    });
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }
}

// ─── 섹션 (기본/왕국) HTML ───────────────────────────────────
function _buildSection(title, ids, cardMap) {
  const cards = ids.map(id => cardMap.get(id)).filter(Boolean);
  return `
    <div class="ds-catalog-section">
      <div class="ds-catalog-section-title">${_esc(title)}</div>
      <div class="ds-catalog-grid">
        ${cards.map(_buildCardHTML).join('')}
      </div>
    </div>
  `;
}

// ─── 카드 1장 HTML ────────────────────────────────────────────
function _toHex(n) {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}

const ACCENT_HEX = {
  Action:   '#9933cc',
  Treasure: '#d4a520',
  Victory:  '#228844',
  Curse:    '#cc3311',
};

function _buildCardHTML(def) {
  const accent   = ACCENT_HEX[def.type] ?? '#d4a520';
  const gradStyle = `background:linear-gradient(to bottom,${_toHex(def.gradTop)},${_toHex(def.gradMid)} 50%,${_toHex(def.gradBot)})`;
  const typeLabel = (def.rawType ?? def.type).replace(/-/g, ' · ');

  let badge = '';
  if (def.type === 'Treasure' && def.coins > 0) {
    badge = `<div class="ds-catalog-coins">+${def.coins} 코인</div>`;
  }
  if (def.points !== 0) {
    badge += `<div class="ds-catalog-vp">${def.points > 0 ? '+' : ''}${def.points} 승점</div>`;
  }

  return `
    <div class="ds-catalog-card" style="${gradStyle};border-color:${accent}">
      <div class="ds-catalog-cost" style="border-color:${accent};color:${accent}">${def.cost}</div>
      <div class="ds-catalog-name">${_esc(def.name)}</div>
      <div class="ds-catalog-type" style="color:${accent}">${_esc(typeLabel)}</div>
      <div class="ds-catalog-desc">${_esc(def.desc ?? '')}</div>
      ${badge}
    </div>
  `;
}

// ─── HTML 이스케이프 ──────────────────────────────────────────
function _esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
