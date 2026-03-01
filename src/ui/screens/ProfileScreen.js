// ============================================================
// ui/screens/ProfileScreen.js — 최초 방문 프로필 생성 화면
// ============================================================

export class ProfileScreen {
  constructor() {
    this._el      = null;
    /** @type {(profile: {name: string, createdAt: string}) => void} */
    this.onSubmit = null;
  }

  show() {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.className = 'ds-screen';
    this._el.innerHTML = `
      <div class="ds-card">
        <h1 class="ds-title">Dominion</h1>
        <p class="ds-subtitle">1일 솔로 챌린지</p>
        <div class="ds-divider">✦ ── ✦</div>
        <p style="color:#fff3d6;font-size:14px;margin-bottom:20px;">
          처음 오셨군요!<br>플레이어 이름을 입력해 주세요.
        </p>
        <p class="ds-label">플레이어 이름 (최대 12자)</p>
        <input
          class="ds-input"
          id="ds-name"
          type="text"
          placeholder="이름을 입력하세요..."
          maxlength="12"
          autocomplete="off"
          spellcheck="false"
        >
        <button class="ds-btn" id="ds-start">시작하기</button>
      </div>
    `;
    document.body.appendChild(this._el);

    const nameInput = this._el.querySelector('#ds-name');
    this._el.querySelector('#ds-start').addEventListener('click', () => this._submit());
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') this._submit(); });
    setTimeout(() => nameInput.focus(), 80);
  }

  _submit() {
    const name = this._el?.querySelector('#ds-name')?.value?.trim() ?? '';
    if (!name) {
      this._el.querySelector('#ds-name').style.borderColor = '#cc3311';
      this._el.querySelector('#ds-name').focus();
      return;
    }
    this.hide();
    this.onSubmit?.({
      name,
      createdAt: new Date().toISOString().split('T')[0],
    });
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }
}
