// ============================================================
// ProfilePanel.js — 플레이어 이름 입력 패널
// ============================================================

/**
 * @param {object} opts
 * @param {string}   [opts.name='']   - 현재 저장된 이름 (재편집 시 미리채움)
 * @param {function} opts.onSubmit    - ({ name, createdAt }) => void
 */
export function buildProfilePanel({ name = '', onSubmit }) {
  const el = document.createElement('div');
  el.className = 'ds-panel';
  el.innerHTML = `
    <p style="color:#fff3d6;font-size:21px;margin-bottom:20px;line-height:1.7">
      ${name ? `<strong style="color:#d4a520">${_esc(name)}</strong> 님, 이름을 수정하세요.`
             : '처음 오셨군요!<br>플레이어 이름을 입력해 주세요.'}
    </p>
    <p class="ds-label">플레이어 이름 (최대 12자)</p>
    <input
      class="ds-input" id="pp-name" type="text"
      placeholder="이름을 입력하세요..."
      value="${_esc(name)}"
      maxlength="12" autocomplete="off" spellcheck="false"
    >
    <button class="ds-btn" id="pp-submit">${name ? '저장' : '시작하기'}</button>
  `;

  const input  = el.querySelector('#pp-name');
  const submit = () => {
    const v = input.value.trim();
    if (!v) { input.style.borderColor = '#cc3311'; input.focus(); return; }
    onSubmit?.({ name: v, createdAt: new Date().toISOString().split('T')[0] });
  };

  el.querySelector('#pp-submit').addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  setTimeout(() => input.focus(), 80);

  return el;
}

function _esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
