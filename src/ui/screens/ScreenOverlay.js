// ============================================================
// ScreenOverlay.js — 패널 배열을 받아 전체화면 오버레이로 조합
// 사용법: overlay.show([panelEl, panelEl, ...]) → overlay.hide()
// ============================================================
import { startParticles } from './ScreenParticles.js';

export class ScreenOverlay {
  constructor() {
    this._el    = null;
    this._stopP = null;   // 파티클 cleanup
  }

  /**
   * @param {HTMLElement[]} panels - buildXxxPanel() 반환값 배열
   */
  show(panels) {
    if (this._el) this.hide();

    this._el = document.createElement('div');
    this._el.className = 'ds-screen';

    const card = document.createElement('div');
    card.className = 'ds-card';
    panels.forEach(p => { if (p) card.appendChild(p); });

    this._el.appendChild(card);
    document.body.appendChild(this._el);

    // 파티클 캔버스 시작 (카드 뒤 배경에 주입)
    this._stopP = startParticles(this._el);
  }

  hide() {
    this._stopP?.();
    this._stopP = null;
    this._el?.remove();
    this._el = null;
  }

  get visible() { return this._el !== null; }
}
