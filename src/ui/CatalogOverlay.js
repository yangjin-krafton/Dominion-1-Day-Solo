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
  if (!_layer || _overlay) { onClose?.(); return; }

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
      done => setTimeout(done, 380),

      // 대상 카드로 스크롤
      done => _animScroll(
        () => _curScrollY, _applyScroll,
        scrollH * 0.38 - target.cy - CAT_CH / 2,
        minScrollY, 900, done,
      ),

      done => setTimeout(done, 120),

      // Phase 1: 카드 테두리 자기장 글로우 + 먼지 파티클
      done => _animPreGlow(target.lockOverlay, scrollCont, 520, done),

      // Phase 2: 강한 흔들기 + 골든 스파크
      done => _animShake(target.lockOverlay, target.cx, scrollCont, 680, done),

      // Phase 3: 자물쇠 폭파 (링 버스트 + 파편 + 빛 플래시 + 방사형 빔)
      done => _animShatter(target.lockOverlay, scrollCont, _overlay, () => _curScrollY, 620, done),

      // Phase 4: 카드 elastic flip + 대각선 빛 슬라이드 + 상승 스파크
      done => _animFlip(target.realCard, scrollCont, target.cx, target.cy, 1050, done),

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

// ─── Phase 1: 자기장 글로우 + 먼지 파티클 ──────────────────
function _animPreGlow(lockOverlay, scrollCont, duration, done) {
  if (!_overlay) { done(); return; }

  const cx = lockOverlay.x;
  const cy = lockOverlay.y;

  // 테두리 글로우 그래픽
  const border = new PIXI.Graphics();
  scrollCont.addChildAt(border, scrollCont.getChildIndex(lockOverlay));

  // 공전 먼지 파티클 12개
  const DUST = 12;
  const dusts = Array.from({ length: DUST }, (_, i) => {
    const gfx = new PIXI.Graphics();
    gfx.beginFill(0xa060f0, 0.85);
    gfx.drawCircle(0, 0, 1.8 + Math.random() * 2);
    gfx.endFill();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    gfx.alpha = 0;
    scrollCont.addChild(gfx);
    const baseAngle = (i / DUST) * Math.PI * 2;
    const baseR     = CAT_CW * 0.52 + Math.random() * 10;
    return { gfx, baseAngle, baseR };
  });

  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) {
      try { scrollCont.removeChild(border); border.destroy(); } catch (_) {}
      dusts.forEach(d => { try { scrollCont.removeChild(d.gfx); d.gfx.destroy(); } catch (_) {} });
      done(); return;
    }
    const t     = Math.min((Date.now() - t0) / duration, 1);
    const pulse = 0.35 + 0.55 * Math.abs(Math.sin(t * Math.PI * 3));  // 1.5 주기 펄스
    const expand = 3 + t * 6;

    // 외곽선 글로우: 보라 + 안쪽 골드 이중 링
    border.clear();
    border.lineStyle(2.5, 0x9040e8, pulse);
    border.drawRoundedRect(cx - expand / 2, cy - expand / 2, CAT_CW + expand, CAT_CH + expand, 7);
    border.lineStyle(1.2, 0xd4a820, pulse * 0.55);
    border.drawRoundedRect(cx - 1, cy - 1, CAT_CW + 2, CAT_CH + 2, 4);

    // 자물쇠 숨쉬기 스케일
    lockOverlay.scale.set(1 + Math.sin(t * Math.PI * 5) * 0.025);

    // 먼지 공전
    const orbit = t * Math.PI * 1.5;
    dusts.forEach((d, i) => {
      const a = d.baseAngle + orbit;
      const r = d.baseR + Math.sin(t * Math.PI * 4 + i * 0.8) * 5;
      d.gfx.x     = cx + CAT_CW / 2 + Math.cos(a) * r;
      d.gfx.y     = cy + CAT_CH / 2 + Math.sin(a) * r;
      d.gfx.alpha = pulse * 0.65;
      d.gfx.scale.set(0.6 + 0.5 * Math.abs(Math.sin(t * Math.PI * 7 + i)));
    });

    if (t < 1) {
      requestAnimationFrame(_tick);
    } else {
      lockOverlay.scale.set(1);
      try { scrollCont.removeChild(border); border.destroy(); } catch (_) {}
      dusts.forEach(d => { try { scrollCont.removeChild(d.gfx); d.gfx.destroy(); } catch (_) {} });
      done();
    }
  };
  requestAnimationFrame(_tick);
}

// ─── Phase 2: 강한 흔들기 + 골든 스파크 ────────────────────
function _animShake(lockOverlay, originalX, scrollCont, duration, done) {
  if (!_overlay) { done(); return; }

  const cx = lockOverlay.x;
  const cy = lockOverlay.y;

  // 사전 생성 스파크 (지연 있음)
  const SPARK = 22;
  const SPARK_COLORS = [0xd4a820, 0xffffff, 0xff8844, 0xa060f0, 0xffd040];
  const sparks = Array.from({ length: SPARK }, (_, i) => {
    const sz  = 2 + Math.random() * 4;
    const gfx = new PIXI.Graphics();
    gfx.beginFill(SPARK_COLORS[i % SPARK_COLORS.length], 0.92);
    gfx.drawRect(-sz / 2, -sz / 2, sz, sz);
    gfx.endFill();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    gfx.alpha = 0;
    scrollCont.addChild(gfx);
    const angle = Math.random() * Math.PI * 2;
    const speed = 18 + Math.random() * 38;
    return {
      gfx,
      sx: cx + CAT_CW / 2, sy: cy + CAT_CH * 0.38,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      delay: (i / SPARK) * 0.55,  // 전체 duration의 비율
    };
  });

  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) {
      sparks.forEach(s => { try { scrollCont.removeChild(s.gfx); s.gfx.destroy(); } catch (_) {} });
      done(); return;
    }
    const t = Math.min((Date.now() - t0) / duration, 1);

    // 흔들기: 종 모양 엔벨롭 + 증가하는 주파수
    const intensity = Math.sin(t * Math.PI) * 10;
    const freq      = 13 + t * 9;
    lockOverlay.x        = originalX + Math.sin(t * Math.PI * freq) * intensity;
    lockOverlay.rotation = Math.sin(t * Math.PI * (freq * 0.65)) * 0.09 * Math.sin(t * Math.PI);

    // 스파크 위치
    sparks.forEach(s => {
      const localT = t - s.delay;
      if (localT < 0) return;
      const dt = localT * duration / 1000;
      s.gfx.x        = s.sx + s.vx * dt;
      s.gfx.y        = s.sy + s.vy * dt;
      s.gfx.rotation += 0.14;
      s.gfx.alpha    = Math.max(0, (1 - localT / (1 - s.delay)) * 0.88);
    });

    if (t < 1) {
      requestAnimationFrame(_tick);
    } else {
      lockOverlay.x        = originalX;
      lockOverlay.rotation = 0;
      sparks.forEach(s => { try { scrollCont.removeChild(s.gfx); s.gfx.destroy(); } catch (_) {} });
      done();
    }
  };
  requestAnimationFrame(_tick);
}

// ─── Phase 3: 자물쇠 폭파 (링 + 파편 + 빔 + 플래시) ────────
function _animShatter(lockOverlay, scrollCont, overlay, getScrollY, duration, done) {
  if (!_overlay) { done(); return; }

  const lockCX = lockOverlay.x + CAT_CW / 2;
  const lockCY = HEADER_H + getScrollY() + lockOverlay.y + CAT_CH * 0.38;
  const cardTop = HEADER_H + getScrollY() + lockOverlay.y;

  // 링 버스트 (2개, overlay 공간)
  const ring1 = new PIXI.Graphics();  overlay.addChild(ring1);
  const ring2 = new PIXI.Graphics();  overlay.addChild(ring2);

  // 방사형 빔 라인
  const beams = new PIXI.Graphics(); overlay.addChild(beams);

  // 파편 파티클 24개
  const FRAG_COLORS = [0xd4a820, 0xf08820, 0xffffff, 0xa040d8, 0xf04040, 0x60c0ff, 0xffd040];
  const frags = Array.from({ length: 24 }, (_, i) => {
    const s   = 3 + Math.random() * 9;
    const gfx = new PIXI.Graphics();
    gfx.beginFill(FRAG_COLORS[i % FRAG_COLORS.length], 0.95);
    if (i % 3 === 0) gfx.drawCircle(0, 0, s / 2);
    else             gfx.drawRect(-s / 2, -s / 2, s, s);
    gfx.endFill();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    overlay.addChild(gfx);
    const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 70 + Math.random() * 190;
    const gravity = 280 + Math.random() * 180;
    return {
      gfx,
      sx: lockCX + (Math.random() - 0.5) * 12,
      sy: lockCY + (Math.random() - 0.5) * 12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity,
      rot: (Math.random() - 0.5) * 10,
    };
  });

  // 카드 사이즈 화이트 플래시 (ADD 블렌드)
  const flash = new PIXI.Graphics();
  flash.beginFill(0xffffff, 1);
  flash.drawRoundedRect(lockOverlay.x, cardTop, CAT_CW, CAT_CH, 4);
  flash.endFill();
  flash.blendMode = PIXI.BLEND_MODES.ADD;
  overlay.addChild(flash);

  // 자물쇠 즉시 제거
  scrollCont.removeChild(lockOverlay);
  lockOverlay.destroy({ children: true });

  let _done = false;
  const _finish = () => {
    if (_done) return; _done = true;
    [ring1, ring2, beams, flash].forEach(g => { try { overlay.removeChild(g); g.destroy(); } catch (_) {} });
    frags.forEach(f => { try { overlay.removeChild(f.gfx); f.gfx.destroy(); } catch (_) {} });
    done();
  };

  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) { _finish(); return; }
    const t  = Math.min((Date.now() - t0) / duration, 1);
    const dt = (Date.now() - t0) / 1000;

    // 링1: 빠른 금색 팽창
    ring1.clear();
    ring1.lineStyle(3.5 * (1 - t), 0xd4a820, Math.max(0, 1 - t * 1.4));
    ring1.drawCircle(lockCX, lockCY, t * CAT_CW * 0.92);

    // 링2: 느린 보라 팽창
    ring2.clear();
    ring2.lineStyle(2 * (1 - t), 0xa060f0, Math.max(0, 1 - t * 2.2));
    ring2.drawCircle(lockCX, lockCY, t * CAT_CW * 0.52);

    // 방사형 빔 (초반 0.35 동안)
    beams.clear();
    if (t < 0.35) {
      const beamAlpha = (1 - t / 0.35) * 0.55;
      const beamLen   = (t / 0.35) * CAT_CW * 0.8;
      beams.lineStyle(1.8, 0xffeeaa, beamAlpha);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        beams.moveTo(lockCX, lockCY);
        beams.lineTo(lockCX + Math.cos(a) * beamLen, lockCY + Math.sin(a) * beamLen);
      }
    }

    // 파편 물리
    frags.forEach(f => {
      f.gfx.x        = f.sx + f.vx * dt;
      f.gfx.y        = f.sy + f.vy * dt + 0.5 * f.gravity * dt * dt;
      f.gfx.rotation = f.rot * dt;
      f.gfx.alpha    = Math.max(0, 1 - t * 1.9);
    });

    // 플래시 빠르게 소멸
    flash.alpha = Math.max(0, 1 - t * 3.2);

    if (t < 1) requestAnimationFrame(_tick);
    else _finish();
  };
  requestAnimationFrame(_tick);
}

// ─── Phase 4: Elastic flip + 대각선 빛 슬라이드 + 상승 스파크
function _animFlip(realCard, scrollCont, cx, cy, duration, done) {
  if (!_overlay) { done(); return; }

  // 골든 글로우 (카드 뒤)
  const glow = new PIXI.Graphics();
  glow.beginFill(0xd4a820, 0.55);
  glow.drawRoundedRect(cx - 12, cy - 12, CAT_CW + 24, CAT_CH + 24, 10);
  glow.endFill();
  glow.blendMode = PIXI.BLEND_MODES.ADD;
  glow.alpha = 0;
  scrollCont.addChildAt(glow, scrollCont.getChildIndex(realCard));

  // 대각선 빛 줄기 (카드 좌→우 sweep)
  const shine = new PIXI.Graphics();
  shine.beginFill(0xffffff, 0.65);
  shine.drawRect(-26, 0, 52, CAT_CH * 1.5);
  shine.endFill();
  shine.rotation  = Math.PI / 6;
  shine.blendMode = PIXI.BLEND_MODES.ADD;
  shine.alpha = 0;
  shine.y = cy - CAT_CH * 0.15;
  scrollCont.addChild(shine);

  // 상승 반짝이 파티클 (flip 완료 후 등장)
  const SPARK = 18;
  const SPARK_COLORS = [0xd4a820, 0xffffff, 0xffd040, 0xa060ff, 0xffa040];
  const sparks = Array.from({ length: SPARK }, (_, i) => {
    const sz  = 2 + Math.random() * 4;
    const gfx = new PIXI.Graphics();
    gfx.beginFill(SPARK_COLORS[i % SPARK_COLORS.length], 0.9);
    gfx.drawCircle(0, 0, sz / 2);
    gfx.endFill();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    gfx.alpha = 0;
    scrollCont.addChild(gfx);
    return {
      gfx,
      sx: cx + CAT_CW * (0.08 + Math.random() * 0.84),
      sy: cy + CAT_CH * (0.4 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 44,
      vy: -(28 + Math.random() * 72),
      gravity: 70 + Math.random() * 60,
      delay: 0.48 + Math.random() * 0.18,
    };
  });

  realCard.scale.x = 0;

  const t0 = Date.now();
  const _tick = () => {
    if (!_overlay) {
      [glow, shine].forEach(g => { try { scrollCont.removeChild(g); g.destroy(); } catch (_) {} });
      sparks.forEach(s => { try { scrollCont.removeChild(s.gfx); s.gfx.destroy(); } catch (_) {} });
      done(); return;
    }
    const t = Math.min((Date.now() - t0) / duration, 1);

    // Elastic scaleX
    realCard.scale.x = _easeElastic(t) * CAT_SCALE;

    // 글로우: sin 펄스
    glow.alpha = Math.sin(t * Math.PI) * 0.7;

    // shine sweep: t=0.18 ~ 0.72 사이
    const shineT = (t - 0.18) / 0.54;
    if (shineT >= 0 && shineT <= 1) {
      shine.x     = cx - 50 + shineT * (CAT_CW + 100);
      shine.alpha = Math.sin(shineT * Math.PI) * 0.52;
    } else {
      shine.alpha = 0;
    }

    // 상승 스파크
    sparks.forEach(s => {
      if (t < s.delay) return;
      const dt = (t - s.delay) * duration / 1000;
      s.gfx.x     = s.sx + s.vx * dt;
      s.gfx.y     = s.sy + s.vy * dt + 0.5 * s.gravity * dt * dt;
      s.gfx.alpha = Math.max(0, (1 - (t - s.delay) / (1 - s.delay)) * 0.88);
    });

    if (t < 1) {
      requestAnimationFrame(_tick);
    } else {
      realCard.scale.x = CAT_SCALE;
      [glow, shine].forEach(g => { try { scrollCont.removeChild(g); g.destroy(); } catch (_) {} });
      sparks.forEach(s => { try { scrollCont.removeChild(s.gfx); s.gfx.destroy(); } catch (_) {} });
      done();
    }
  };
  requestAnimationFrame(_tick);
}

/** Elastic easing — 1.1 오버슈트 후 1.0 안착 */
function _easeElastic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
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
