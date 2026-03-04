// ============================================================
// CatalogOverlay.js — 도감 PixiJS 오버레이
// CardDetail의 buildDetailCard를 3열 스케일로 재사용
// 사용법:
//   init(layer)
//   show(cardMap)                                  — 일반 도감
//   showWithUnlock(cardMap, unlockId, onClose)     — 언락 연출 포함
// ============================================================
import {
  C,
  SCREEN_W as W, SCREEN_H as H,
  DETAIL_W as DW, DETAIL_H as DH,
  BASIC_IDS, KINGDOM_POOL,
} from '../config.js';
import { buildDetailCard } from './CardDetail.js';
import { getWins } from '../core/Storage.js';

// ─── 도감 카드 스케일 (3열 기준 자동 계산) ───────────────────
const HEADER_H = 52;
const COLS     = 3;
const GAP      = 8;
const PAD      = 12;

const CAT_CW    = Math.floor((W - PAD * 2 - GAP * (COLS - 1)) / COLS); // ~116px
const CAT_SCALE = CAT_CW / DW;                                          // ~0.387
const CAT_CH    = Math.round(DH * CAT_SCALE);

// ─── 싱글턴 상태 ─────────────────────────────────────────────
let _layer   = null;
let _overlay = null;

// ─── 초기화 (부트 시 1회) ────────────────────────────────────
export function init(layer) {
  _layer = layer;
}

// ─── 일반 도감 열기 ──────────────────────────────────────────
export function show(cardMap, opts = {}) {
  const { unlockId = null, onClose = null } = opts;
  if (!_layer || _overlay) return;

  _overlay = new PIXI.Container();
  _overlay.zIndex    = 9998;
  _overlay.eventMode = 'static';

  // 배경 (반투명)
  const backdrop = new PIXI.Graphics();
  backdrop.beginFill(0x000000, 0.94);
  backdrop.drawRect(0, 0, W, H);
  backdrop.endFill();
  _overlay.addChild(backdrop);

  // ── 헤더 ──────────────────────────────────────────────────
  const header = new PIXI.Graphics();
  header.beginFill(0x0a0814, 0.98);
  header.drawRect(0, 0, W, HEADER_H);
  header.endFill();
  header.lineStyle(1, C.gold, 0.4);
  header.moveTo(0, HEADER_H); header.lineTo(W, HEADER_H);
  _overlay.addChild(header);

  const titleTxt = new PIXI.Text('도감', {
    fontFamily: 'Georgia, serif', fontSize: 18,
    fontStyle: 'italic', fill: C.gold, letterSpacing: 2,
  });
  titleTxt.anchor.set(0, 0.5);
  titleTxt.x = 16; titleTxt.y = HEADER_H / 2;
  _overlay.addChild(titleTxt);

  // 언락 연출 중 닫기 버튼 잠금 플래그
  let _closeLocked = !!unlockId;
  const closeBtn = _makeCloseBtn(() => {
    if (_closeLocked) return;
    hide();
    onClose?.();
  });
  closeBtn.x = W - 22; closeBtn.y = HEADER_H / 2;
  _overlay.addChild(closeBtn);

  // ── 스크롤 영역 (마스크) ──────────────────────────────────
  const scrollH    = H - HEADER_H;
  const scrollMask = new PIXI.Graphics();
  scrollMask.beginFill(0xffffff);
  scrollMask.drawRect(0, HEADER_H, W, scrollH);
  scrollMask.endFill();
  _overlay.addChild(scrollMask);

  const scrollCont = new PIXI.Container();
  scrollCont.y    = HEADER_H;
  scrollCont.mask = scrollMask;
  _overlay.addChild(scrollCont);

  // ── 카드 그리드 콘텐츠 ────────────────────────────────────
  const wins      = getWins();
  let contentY    = PAD;
  const colStartX = Math.round((W - (CAT_CW * COLS + GAP * (COLS - 1))) / 2);

  // 언락 연출 대상 추적
  let _unlockTarget = null;

  const _addSection = (label, ids) => {
    const defs = ids.map(id => cardMap.get(id)).filter(Boolean);
    if (!defs.length) return;

    // 섹션 레이블
    const sLbl = new PIXI.Text(label, {
      fontFamily: 'Georgia, serif', fontSize: 10,
      fontStyle: 'italic', fill: C.goldDim, letterSpacing: 3,
    });
    sLbl.x = PAD; sLbl.y = contentY;
    scrollCont.addChild(sLbl);
    contentY += 22;

    // 구분선
    const line = new PIXI.Graphics();
    line.lineStyle(0.5, C.goldDim, 0.4);
    line.moveTo(PAD, contentY); line.lineTo(W - PAD, contentY);
    scrollCont.addChild(line);
    contentY += 8;

    // 카드 배치
    defs.forEach((def, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = colStartX + col * (CAT_CW + GAP);
      const cy  = contentY  + row * (CAT_CH + GAP);

      if (def.unlockOrder === 0 || wins >= def.unlockOrder) {
        // ── 언락된 카드
        const card = buildDetailCard(def);
        card.scale.set(CAT_SCALE);
        card.x = cx; card.y = cy;
        scrollCont.addChild(card);

        // 이번에 새로 언락된 카드면 자물쇠 오버레이를 올려놓음
        if (unlockId && def.id === unlockId) {
          const lockOverlay = _buildLockOverlay(cx, cy, CAT_CW, CAT_CH);
          scrollCont.addChild(lockOverlay);
          _unlockTarget = { lockOverlay, realCard: card, cx, cy };
        }
      } else {
        // ── 잠긴 카드 (실루엣)
        scrollCont.addChild(_buildLockedCard(cx, cy, CAT_CW, CAT_CH, def.unlockOrder));
      }
    });

    contentY += Math.ceil(defs.length / COLS) * (CAT_CH + GAP) + PAD;
  };

  _addSection('기본 카드', BASIC_IDS);
  _addSection('왕국 카드', KINGDOM_POOL);

  const totalH     = contentY;
  const minScrollY = Math.min(0, scrollH - totalH);

  // ── 스크롤 인터랙션 ───────────────────────────────────────
  let _dragActive = false;
  let _dragStartY = 0;
  let _dragBase   = 0;
  let _curScrollY = 0;
  let _velocity   = 0;
  let _lastY      = 0;
  let _lastTime   = 0;
  let _rafId      = null;

  const _clamp = y => Math.max(minScrollY, Math.min(0, y));

  const _applyScroll = y => {
    _curScrollY  = _clamp(y);
    scrollCont.y = HEADER_H + _curScrollY;
  };

  _overlay.on('pointerdown', e => {
    if (e.global.y < HEADER_H) return;
    _dragActive = true;
    _dragStartY = e.global.y;
    _dragBase   = _curScrollY;
    _lastY      = e.global.y;
    _lastTime   = Date.now();
    _velocity   = 0;
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  });

  _overlay.on('pointermove', e => {
    if (!_dragActive) return;
    const now = Date.now();
    const dt  = now - _lastTime || 1;
    _velocity = (e.global.y - _lastY) / dt * 16;
    _lastY    = e.global.y;
    _lastTime = now;
    _applyScroll(_dragBase + (e.global.y - _dragStartY));
  });

  const _stopDrag = () => {
    if (!_dragActive) return;
    _dragActive = false;
    const _inertia = () => {
      _velocity *= 0.92;
      if (Math.abs(_velocity) > 0.5) {
        _applyScroll(_curScrollY + _velocity);
        _rafId = requestAnimationFrame(_inertia);
      } else {
        _rafId = null;
      }
    };
    _rafId = requestAnimationFrame(_inertia);
  };
  _overlay.on('pointerup',        _stopDrag);
  _overlay.on('pointerupoutside', _stopDrag);

  _layer.addChild(_overlay);

  // ── 페이드인
  _overlay.alpha = 0;
  const _t0 = Date.now();
  const _fadeIn = () => {
    const t = Math.min((Date.now() - _t0) / 200, 1);
    _overlay.alpha = t;
    if (t < 1) requestAnimationFrame(_fadeIn);
  };
  requestAnimationFrame(_fadeIn);

  // ── 언락 연출 시퀀스 (페이드인 완료 후 시작) ─────────────
  if (unlockId && _unlockTarget) {
    const target = _unlockTarget;

    _seq([
      // 페이드인 대기
      done => setTimeout(done, 380),

      // 대상 카드로 스크롤
      done => _animScroll(
        () => _curScrollY,
        _applyScroll,
        scrollH * 0.38 - target.cy - CAT_CH / 2,
        minScrollY,
        900,
        done,
      ),

      // 잠깐 멈춤 (긴장감)
      done => setTimeout(done, 220),

      // 자물쇠 흔들기
      done => _animShake(target.lockOverlay, target.cx, 640, done),

      // 자물쇠 파괴 + 빛 번쩍
      done => _animShatter(
        target.lockOverlay,
        scrollCont,
        _overlay,
        () => _curScrollY,
        500,
        done,
      ),

      // 카드 flip 등장 + 골든 글로우
      done => _animFlip(target.realCard, scrollCont, 900, done),

      // 닫기 버튼 활성화
      done => { _closeLocked = false; done(); },
    ]);
  }
}

// ─── 언락 연출 도감 열기 (public) ────────────────────────────
export function showWithUnlock(cardMap, unlockId, onClose = null) {
  show(cardMap, { unlockId, onClose });
}

// ─── 도감 닫기 ───────────────────────────────────────────────
export function hide() {
  if (_overlay && _layer) {
    _layer.removeChild(_overlay);
    _overlay.destroy({ children: true });
    _overlay = null;
  }
}

// ============================================================
// 애니메이션 헬퍼 (모듈 내부)
// ============================================================

/** 순차 실행 헬퍼 */
function _seq(steps) {
  let i = 0;
  const next = () => { if (i < steps.length) steps[i++](next); };
  next();
}

/** 스무스 스크롤 (easeInOut) */
function _animScroll(getY, applyScroll, targetY, minScrollY, duration, done) {
  if (!_overlay) { done(); return; }
  const fromY = getY();
  const toY   = Math.max(minScrollY, Math.min(0, targetY));
  if (Math.abs(toY - fromY) < 2) { done(); return; }

  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) { done(); return; }
    const t    = Math.min((Date.now() - t0) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    applyScroll(fromY + (toY - fromY) * ease);
    if (t < 1) requestAnimationFrame(_tick);
    else done();
  };
  requestAnimationFrame(_tick);
}

/** 자물쇠 흔들기 */
function _animShake(cont, originalX, duration, done) {
  if (!_overlay) { done(); return; }
  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) { done(); return; }
    const t = (Date.now() - t0) / duration;
    cont.x = originalX + Math.sin(t * Math.PI * 14) * 6 * (1 - t);
    if (t < 1) requestAnimationFrame(_tick);
    else { cont.x = originalX; done(); }
  };
  requestAnimationFrame(_tick);
}

/** 자물쇠 파괴 파티클 + 카드 화면 빛 번쩍 */
function _animShatter(lockOverlay, scrollCont, overlay, getScrollY, duration, done) {
  if (!_overlay) { done(); return; }

  // 파티클 발생 위치 (오버레이 공간)
  const wx = lockOverlay.x + CAT_CW / 2;
  const wy = HEADER_H + getScrollY() + lockOverlay.y + CAT_CH * 0.38;

  const FRAG_COLORS = [0xd4a820, 0xf08820, 0xa040d8, 0xffffff, 0xf04040];
  const frags = Array.from({ length: 16 }, () => {
    const s   = 3 + Math.random() * 9;
    const gfx = new PIXI.Graphics();
    gfx.beginFill(FRAG_COLORS[Math.floor(Math.random() * FRAG_COLORS.length)]);
    gfx.drawRect(-s / 2, -s / 2, s, s);
    gfx.endFill();
    gfx.x = wx; gfx.y = wy;
    overlay.addChild(gfx);
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 160;
    return { gfx, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  });

  // 카드 크기 흰 번쩍임 (오버레이 공간)
  const flash = new PIXI.Graphics();
  flash.beginFill(0xffffff, 1);
  flash.drawRoundedRect(
    lockOverlay.x,
    HEADER_H + getScrollY() + lockOverlay.y,
    CAT_CW, CAT_CH, 4,
  );
  flash.endFill();
  overlay.addChild(flash);

  // 자물쇠 오버레이 즉시 제거
  scrollCont.removeChild(lockOverlay);
  lockOverlay.destroy({ children: true });

  let _done = false;
  const _finish = () => {
    if (_done) return;
    _done = true;
    frags.forEach(f => { try { overlay.removeChild(f.gfx); f.gfx.destroy(); } catch (_) {} });
    try { overlay.removeChild(flash); flash.destroy(); } catch (_) {}
    done();
  };

  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) { _finish(); return; }
    const t  = Math.min((Date.now() - t0) / duration, 1);
    const dt = (Date.now() - t0) / 1000;
    for (const f of frags) {
      f.gfx.x = wx + f.vx * dt;
      f.gfx.y = wy + f.vy * dt + 0.5 * 520 * dt * dt;
      f.gfx.alpha = 1 - t;
    }
    flash.alpha = Math.max(0, 1 - t * 2);  // 앞 절반에 빠르게 사라짐
    if (t < 1) requestAnimationFrame(_tick);
    else _finish();
  };
  requestAnimationFrame(_tick);
}

/** 카드 flip 등장 + 골든 글로우 */
function _animFlip(realCard, scrollCont, duration, done) {
  if (!_overlay) { done(); return; }

  // 카드 뒤에 골든 글로우 삽입
  const glow = new PIXI.Graphics();
  glow.beginFill(0xd4a820, 0.6);
  glow.drawRoundedRect(
    realCard.x - 10, realCard.y - 10,
    CAT_CW + 20, CAT_CH + 20, 10,
  );
  glow.endFill();
  glow.alpha = 0;
  const idx = scrollCont.getChildIndex(realCard);
  scrollCont.addChildAt(glow, idx);

  // 카드를 edge-on 상태에서 시작
  realCard.scale.x = 0;

  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) { done(); return; }
    const t    = Math.min((Date.now() - t0) / duration, 1);
    const ease = 1 - (1 - t) ** 3;  // easeOut cubic

    realCard.scale.x = ease * CAT_SCALE;
    glow.alpha       = Math.sin(t * Math.PI) * 0.75;  // 0 → 0.75 → 0

    if (t < 1) {
      requestAnimationFrame(_tick);
    } else {
      realCard.scale.x = CAT_SCALE;
      try { scrollCont.removeChild(glow); glow.destroy(); } catch (_) {}
      done();
    }
  };
  requestAnimationFrame(_tick);
}

// ============================================================
// 카드 UI 빌더
// ============================================================

/** 잠긴 카드 실루엣 (도감 기본 표시용) */
function _buildLockedCard(x, y, w, h, unlockOrder) {
  const c = new PIXI.Container();
  c.x = x; c.y = y;

  const bg = new PIXI.Graphics();
  bg.beginFill(0x0d0b14, 1);
  bg.lineStyle(1, 0x3a2f5a, 0.7);
  bg.drawRoundedRect(0, 0, w, h, 4);
  bg.endFill();
  c.addChild(bg);

  const lock = new PIXI.Text('🔒', { fontSize: Math.round(h * 0.22) });
  lock.anchor.set(0.5);
  lock.x = w / 2; lock.y = h * 0.42;
  c.addChild(lock);

  const lbl = new PIXI.Text(`${unlockOrder}승 후 해금`, {
    fontFamily: 'Georgia, serif', fontSize: 9,
    fill: 0x7a6a9a, letterSpacing: 1,
  });
  lbl.anchor.set(0.5);
  lbl.x = w / 2; lbl.y = h * 0.70;
  c.addChild(lbl);

  return c;
}

/** 언락 연출용 자물쇠 오버레이 (레이블 없음) */
function _buildLockOverlay(x, y, w, h) {
  const c = new PIXI.Container();
  c.x = x; c.y = y;

  const bg = new PIXI.Graphics();
  bg.beginFill(0x0d0b14, 0.96);
  bg.lineStyle(1, 0x5a3f8a, 0.8);
  bg.drawRoundedRect(0, 0, w, h, 4);
  bg.endFill();
  c.addChild(bg);

  const lock = new PIXI.Text('🔒', { fontSize: Math.round(h * 0.24) });
  lock.anchor.set(0.5);
  lock.x = w / 2; lock.y = h * 0.45;
  c.addChild(lock);

  return c;
}

// ─── ✕ 닫기 버튼 ─────────────────────────────────────────────
function _makeCloseBtn(onClick) {
  const btn = new PIXI.Container();

  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a1030, 0.9);
  bg.lineStyle(1, C.goldDim, 0.6);
  bg.drawRoundedRect(-14, -14, 28, 28, 4);
  bg.endFill();
  btn.addChild(bg);

  const t = new PIXI.Text('✕', {
    fontFamily: 'Georgia, serif', fontSize: 14, fill: C.dimCream,
  });
  t.anchor.set(0.5);
  btn.addChild(t);

  btn.eventMode = 'static'; btn.cursor = 'pointer';
  btn.on('pointerdown',      e => { e.stopPropagation(); btn.scale.set(0.9); });
  btn.on('pointerup',        e => { e.stopPropagation(); btn.scale.set(1); onClick?.(); });
  btn.on('pointerupoutside', e => { e.stopPropagation(); btn.scale.set(1); });
  return btn;
}
