// ============================================================
// ProfileScreen.js — 첫 접속: 타이틀 + 프로필 편집
// ============================================================
import { ScreenOverlay }   from './ScreenOverlay.js';
import { buildTitlePanel } from './TitlePanel.js';
import { buildProfilePanel } from './ProfilePanel.js';

export class ProfileScreen {
  constructor() {
    this._overlay = new ScreenOverlay();
    /** @type {(profile: {name:string, createdAt:string}) => void} */
    this.onSubmit = null;
  }

  show({ name = '' } = {}) {
    if (this._overlay.visible) return;
    this._overlay.show([
      buildTitlePanel(),
      buildProfilePanel({
        name,
        onSubmit: profile => {
          this.hide();
          this.onSubmit?.(profile);
        },
      }),
    ]);
  }

  hide() { this._overlay.hide(); }
}
