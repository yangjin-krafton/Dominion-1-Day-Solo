// ============================================================
// scene.js — 배경 · 금먼지 파티클 · 인게임 UI 패널 (리뉴얼)
// ============================================================
import { C, SCREEN_W as W, SCREEN_H as H, ZONE, CARD_W, CARD_H, PILE_SCALE } from '../config.js';
import { drawOrnamentLine } from './CardArt.js';

// ─── 배경 ────────────────────────────────────────────────────
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16)
       | (Math.round(ag + (bg - ag) * t) << 8)
       |  Math.round(ab + (bb - ab) * t);
}

export function buildBackground(layer) {
  const g = new PIXI.Graphics();

  // 그라디언트 (16단 레이어)
  for (let i = 0; i < 16; i++) {
    g.beginFill(lerpColor(0x0d0a18, 0x120e22, i / 16));
    g.drawRect(0, H / 16 * i, W, H / 16 + 1);
    g.endFill();
  }

  // 다이아몬드 래티스 패턴
  const step = 28;
  g.lineStyle(0.5, C.goldDim, 0.2);
  for (let row = -1; row < H / step + 2; row++) {
    for (let col = -1; col < W / step + 2; col++) {
      const cx = col * step + (row % 2 === 0 ? 0 : step / 2);
      const cy = row * step;
      g.moveTo(cx, cy - step / 2); g.lineTo(cx + step / 2, cy);
      g.lineTo(cx, cy + step / 2); g.lineTo(cx - step / 2, cy);
      g.closePath();
    }
  }
  layer.addChild(g);

  // 중앙 방사형 글로우
  const radial = new PIXI.Graphics();
  radial.beginFill(C.gold, 0.03);
  radial.drawCircle(W / 2, H * 0.42, 210);
  radial.endFill();
  radial.filters = [new PIXI.filters.BlurFilter(44)];
  layer.addChild(radial);
}

// ─── 금먼지 파티클 ────────────────────────────────────────────
export class GoldMote {
  constructor(layer) {
    this.gfx = new PIXI.Graphics();
    layer.addChild(this.gfx);
    this._reset(true);
  }

  _reset(init = false) {
    this.x     = Math.random() * W;
    this.y     = init ? Math.random() * H : H + 5;
    this.vy    = -(8 + Math.random() * 18);
    this.vx    = (Math.random() - 0.5) * 5;
    this.life  = 1.0;
    this.decay = 0.002 + Math.random() * 0.004;
    this.r     = 1 + Math.random() * 1.4;
    this.color = Math.random() < 0.6 ? C.gold : C.goldHi;
  }

  update(dt) {
    this.life -= this.decay;
    this.x    += this.vx * dt;
    this.y    += this.vy * dt;
    if (this.life <= 0 || this.y < -10) {
      this._reset();
    } else {
      this.gfx.clear();
      this.gfx.beginFill(this.color, this.life * 0.65);
      this.gfx.drawCircle(this.x, this.y, this.r);
      this.gfx.endFill();
    }
  }
}

export function buildParticles(layer, count = 44) {
  return Array.from({ length: count }, () => new GoldMote(layer));
}

// ─── 텍스트 팩토리 ───────────────────────────────────────────
function makeText(str, size, color, opts = {}) {
  return new PIXI.Text(str, {
    fontFamily: 'Georgia, serif',
    fontSize: size,
    fill: color,
    ...opts,
  });
}

// ─── 아이콘 버튼 ─────────────────────────────────────────────
function makeIconBtn(label, x, y, onClick) {
  const btn = new PIXI.Container();
  btn.x = x; btn.y = y;

  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a1030, 0.9);
  bg.lineStyle(1, C.goldDim, 0.6);
  bg.drawRoundedRect(-15, -12, 30, 24, 5);
  bg.endFill();
  btn.addChild(bg);

  const t = makeText(label, 9, C.gold, { fontStyle: 'italic' });
  t.anchor.set(0.5);
  btn.addChild(t);

  btn.eventMode = 'static'; btn.cursor = 'pointer';
  btn.on('pointerdown',      () => btn.scale.set(0.92));
  btn.on('pointerup',        () => { btn.scale.set(1); onClick?.(); });
  btn.on('pointerupoutside', () => btn.scale.set(1));
  return btn;
}

// ─── 스탯 칩 이펙트 유틸 ─────────────────────────────────────
const CHIP_W = 78;
const CHIP_H = 24;

/** 색상 역색 (XOR white) */
function _invertColor(hex) {
  return 0xFFFFFF ^ (hex & 0xFFFFFF);
}

/**
 * 스탯 칩 생성 — 4종 애니메이션 포함
 *
 * animate(type) 타입:
 *   'increase' — 값 증가: 역색 플래시 + 값 위 바운스 + 스케일 업
 *   'decrease' — 값 감소: 역색 플래시 + 진동 회전 + 스케일 다운
 *   'spawn'    — 칩 등장: 스프링 스케일 인 (0→1.2→1.0)
 *   'destroy'  — 칩 소멸: 스케일·알파 페이드 아웃
 *
 * @returns {{ container, valueTxt, animate }}
 */
function makeStatChip(label, value, accentColor) {
  const outer = new PIXI.Container();  // 외부 위치 고정 컨테이너
  const inner = new PIXI.Container();  // 애니메이션 대상
  outer.addChild(inner);

  const inv = _invertColor(accentColor);
  const cx  = CHIP_W / 2;
  const cy  = CHIP_H / 2;

  // ── 배경 ──────────────────────────────────────────────────
  const bg = new PIXI.Graphics();
  bg.beginFill(C.dark, 0.92);
  bg.lineStyle(1.2, accentColor, 0.65);
  bg.drawRoundedRect(0, 0, CHIP_W, CHIP_H, 6);
  bg.endFill();
  inner.addChild(bg);

  // ── 역색 플래시 오버레이 (increase/decrease용) ────────────
  const flash = new PIXI.Graphics();
  flash.beginFill(inv, 1.0);
  flash.drawRoundedRect(1, 1, CHIP_W - 2, CHIP_H - 2, 5);
  flash.endFill();
  flash.alpha = 0;
  inner.addChild(flash);

  // ── 경고 플래시 오버레이 (blocked용, 빨간색) ──────────────
  const warnFlash = new PIXI.Graphics();
  warnFlash.beginFill(0xff2222, 1.0);
  warnFlash.drawRoundedRect(1, 1, CHIP_W - 2, CHIP_H - 2, 5);
  warnFlash.endFill();
  warnFlash.alpha = 0;
  inner.addChild(warnFlash);

  // ── 레이블 ────────────────────────────────────────────────
  const labelTxt = makeText(label, 9, C.cream, { fontStyle: 'italic' });
  labelTxt.anchor.set(0, 0.5);
  labelTxt.x = 8; labelTxt.y = cy;
  inner.addChild(labelTxt);

  // ── 값 ────────────────────────────────────────────────────
  const valueTxt = makeText(String(value), 15, C.goldHi, { fontWeight: 'bold' });
  valueTxt.anchor.set(1, 0.5);
  valueTxt.x = CHIP_W - 7; valueTxt.y = cy;
  inner.addChild(valueTxt);

  // ── 파티클 시스템 ─────────────────────────────────────────
  /**
   * 파티클 이펙트
   *  increase → 역색 파티클이 위로 상승, 감속하며 사라짐
   *  decrease → 칩 컬러 파티클이 아래로 추락, 중력 가속
   */
  function _spawnParticles(type) {
    const count  = 9;
    const pColor = type === 'increase' ? inv : accentColor;

    for (let i = 0; i < count; i++) {
      const r = 2.5 + Math.random() * 2;
      const p = new PIXI.Graphics();
      p.beginFill(pColor, 1.0);
      p.drawCircle(0, 0, r);
      p.endFill();
      outer.addChild(p);
      p.x = cx; p.y = cy;

      const dur = 520 + Math.random() * 200;

      if (type === 'increase') {
        // ── 상승 ──────────────────────────────────────────────
        // 위쪽 부채꼴로 날아오르며 감속 → 멈추듯 사라짐
        const ang = -Math.PI * 0.8 + Math.random() * Math.PI * 0.6;  // 위 방향 扇
        const spd = 65 + Math.random() * 60;
        const vx  = Math.cos(ang) * spd;
        const vy  = Math.sin(ang) * spd;   // 음수 = 위쪽

        setTimeout(() => {
          const t0 = Date.now();
          const tick = () => {
            const t  = Math.min((Date.now() - t0) / dur, 1);
            const sc = 1 - t * 0.6;          // 감속 계수
            p.x      = cx + vx * t * sc;
            p.y      = cy + vy * t * sc;     // 중력 없음 → 계속 상승
            p.alpha  = 1 - t * t;
            p.scale.set(1 - t * 0.45);
            if (t < 1) requestAnimationFrame(tick);
            else { if (p.parent) p.parent.removeChild(p); p.destroy(); }
          };
          requestAnimationFrame(tick);
        }, i * 24);

      } else {
        // ── 추락 ──────────────────────────────────────────────
        // 살짝 옆으로 퍼지다가 중력으로 아래 추락
        const vx     = (Math.random() - 0.5) * 70;   // 좌우 랜덤
        const vy_ini = -(10 + Math.random() * 25);    // 약한 초기 상방
        const grav   = 200 + Math.random() * 80;      // 강한 중력

        setTimeout(() => {
          const t0 = Date.now();
          const tick = () => {
            const t = Math.min((Date.now() - t0) / dur, 1);
            p.x     = cx + vx * t;
            p.y     = cy + vy_ini * t + grav * t * t;   // 포물선 추락
            p.alpha = 1 - t * t;
            p.scale.set(1 - t * 0.50);
            if (t < 1) requestAnimationFrame(tick);
            else { if (p.parent) p.parent.removeChild(p); p.destroy(); }
          };
          requestAnimationFrame(tick);
        }, i * 24);
      }
    }
  }

  // ── 애니메이션 엔진 ───────────────────────────────────────
  let _raf = null;

  const _cancel = () => { if (_raf) { cancelAnimationFrame(_raf); _raf = null; } };

  // 중앙 스케일 보정: sc배 스케일 시 top-left를 이동해 시각적 중심 유지
  const _cx = (sc) => Math.round(cx * (1 - sc));
  const _cy = (sc) => Math.round(cy * (1 - sc));

  const _reset = () => {
    flash.alpha      = 0;
    warnFlash.alpha  = 0;
    inner.rotation   = 0;
    inner.alpha      = 1;
    inner.scale.set(1);
    inner.x = 0; inner.y = 0;   // pivot 없이 원점 복원
    valueTxt.scale.set(1);
    valueTxt.y     = cy;
    valueTxt.tint  = 0xFFFFFF;
  };

  const _run = (dur, fn) => {
    _cancel();
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - t0) / dur, 1);
      fn(t);
      if (t < 1) { _raf = requestAnimationFrame(tick); }
      else        { _raf = null; _reset(); }
    };
    _raf = requestAnimationFrame(tick);
  };

  function animate(type) {
    _cancel(); _reset();

    switch (type) {
      case 'increase':
        // 파티클 + 역색 플래시 + 숫자 위 바운스 + 칩 중앙 스케일 업
        _spawnParticles('increase');
        _run(380, t => {
          const arc = Math.sin(Math.PI * t);
          const sc  = 1 + arc * 0.26;
          flash.alpha = arc * 0.72;
          inner.scale.set(sc);
          inner.x = _cx(sc); inner.y = _cy(sc);   // 중앙 기준 확장 보정
          valueTxt.scale.set(1 + arc * 0.50);
          valueTxt.y = cy - arc * 9;
        });
        break;

      case 'decrease':
        // 파티클 + 역색 플래시 + 진동 회전 + 칩 수축
        _spawnParticles('decrease');
        _run(320, t => {
          const arc = Math.sin(Math.PI * t);
          const sc  = 1 - arc * 0.18;
          flash.alpha    = arc * 0.60;
          inner.scale.set(sc);
          inner.x = _cx(sc); inner.y = _cy(sc);
          inner.rotation = Math.sin(t * Math.PI * 6) * 0.12 * (1 - t);
          valueTxt.y     = cy + Math.sin(t * Math.PI * 8) * 3 * (1 - t);
        });
        break;

      case 'spawn':
        // 스프링 스케일 인 (0 → 1.2 → 1.0)
        inner.alpha = 0; inner.scale.set(0);
        _run(420, t => {
          const sc = Math.max(0, t < 0.6 ? (t / 0.6) * 1.22 : 1.22 - (t - 0.6) / 0.4 * 0.22);
          inner.scale.set(sc);
          inner.x = _cx(sc); inner.y = _cy(sc);
          inner.alpha = Math.min(1, t * 3);
        });
        break;

      case 'destroy':
        // 스케일 + 알파 페이드 아웃
        _run(200, t => {
          const sc = 1 - t * 0.7;
          inner.scale.set(sc);
          inner.x = _cx(sc); inner.y = _cy(sc);
          inner.alpha = 1 - t;
        });
        break;

      case 'blocked':
        // 빨간 경고 플래시 + 강한 좌우 진동
        _run(280, t => {
          const arc = Math.sin(Math.PI * t);
          warnFlash.alpha = arc * 0.85;
          inner.rotation  = Math.sin(t * Math.PI * 9) * 0.16 * (1 - t);
          const sc = 1 - arc * 0.06;
          inner.scale.set(sc);
          inner.x = _cx(sc); inner.y = _cy(sc);
        });
        break;
    }
  }

  return { container: outer, valueTxt, animate };
}

// ─── 이펙트 태그 칩 (행2) ────────────────────────────────────
/**
 * 카드 효과 태그 생성
 * @param {string} text   표시 텍스트 (예: "공격방어", "은화×2")
 * @param {number} color  테두리/텍스트 색상 (기본 dimCream)
 * @returns {PIXI.Container}
 */
function makeEffectTag(text, color = C.dimCream) {
  const tag = new PIXI.Container();

  const lbl = makeText(text, 8, color, { fontWeight: 'bold' });
  const tw  = lbl.width + 14;   // 좌우 패딩 7px

  const bg = new PIXI.Graphics();
  bg.beginFill(0x1a1428, 0.9);
  bg.lineStyle(1, color, 0.45);
  bg.drawRoundedRect(0, 0, tw, 16, 4);
  bg.endFill();
  tag.addChild(bg);

  lbl.anchor.set(0, 0.5);
  lbl.x = 7; lbl.y = 8;
  tag.addChild(lbl);

  return tag;
}

// ─── 더미 영역 + 턴 종료 버튼 통합 패널 (5등분) ─────────────
/**
 * 5등분 컬럼: [덱] [버림] [낸카드] [패기더미] [턴종료버튼]
 * layout.js의 PILE 위치 계산과 동일한 상수 사용 (COL_M=4, COL_G=3)
 */
function buildPileArea(layer, gs) {
  const PW = Math.round(CARD_W * PILE_SCALE);   // 63px
  const PH = Math.round(CARD_H * PILE_SCALE);   // 95px

  // 5등분 컬럼 레이아웃 (4더미 + 1버튼)
  const COL_M = 4;   // 좌우 여백
  const COL_G = 3;   // 컬럼 사이 간격
  const COL_W = Math.floor((W - COL_M * 2 - COL_G * 4) / 5);  // 74px
  const colX  = i => COL_M + i * (COL_W + COL_G);
  const CARD_Y_OFF = 14;
  const py    = ZONE.PILES_Y + CARD_Y_OFF;

  // 섹션 상단 경계선만 (배경 fill 없음)
  const bg = new PIXI.Graphics();
  bg.lineStyle(0.8, C.goldDim, 0.3);
  bg.moveTo(0, ZONE.PILES_Y); bg.lineTo(W, ZONE.PILES_Y);
  layer.addChild(bg);

  // 4개 더미 (컬럼 0–3): 외곽선 + 이름 레이블
  ['덱', '버림', '낸카드', '패기'].forEach((name, i) => {
    const cx = colX(i);
    const px = cx + Math.floor((COL_W - PW) / 2);

    const outline = new PIXI.Graphics();
    outline.lineStyle(1, C.goldDim, 0.28);
    outline.drawRect(px, py, PW, PH);
    layer.addChild(outline);

    const lbl = makeText(name, 7, C.dimCream, { fontStyle: 'italic' });
    lbl.anchor.set(0.5, 0);
    lbl.x = cx + COL_W / 2;
    lbl.y = py + PH + 3;
    layer.addChild(lbl);
  });

  // 턴 종료 버튼 (컬럼 4)
  const BTN_X = colX(4) + 2;
  const BTN_W = COL_W - 4;    // 70px
  const BTN_H = PH;            // 카드와 동일 높이
  const BTN_Y = py;

  const btn   = new PIXI.Container();
  const btnBg = new PIXI.Graphics();
  btnBg.beginFill(0x1a1030); btnBg.drawRect(0, 0, BTN_W, BTN_H); btnBg.endFill();
  btnBg.lineStyle(1.5, C.gold, 0.8); btnBg.drawRect(0, 0, BTN_W, BTN_H);
  [[0, 0], [BTN_W, 0], [0, BTN_H], [BTN_W, BTN_H]].forEach(([bx, by]) => {
    btnBg.lineStyle(0); btnBg.beginFill(C.goldDim, 0.8);
    btnBg.drawRect(bx - 2, by - 2, 4, 4); btnBg.endFill();
  });
  btn.addChild(btnBg);

  const btnTxt = makeText('턴\n종료', 12, C.gold, { fontWeight: 'bold', align: 'center' });
  btnTxt.anchor.set(0.5); btnTxt.x = BTN_W / 2; btnTxt.y = BTN_H / 2;
  btn.addChild(btnTxt);

  btn.x = BTN_X; btn.y = BTN_Y;
  btn.eventMode = 'static'; btn.cursor = 'pointer';
  btn.on('pointerdown',      () => btn.scale.set(0.96));
  btn.on('pointerup',        () => { btn.scale.set(1); gs.onEndTurn?.(); });
  btn.on('pointerupoutside', () => btn.scale.set(1));
  layer.addChild(btn);
}

// ─── 참조 map (updateUI에서 사용) ───────────────────────────
const refs = {};

// ─── 메인 UI 빌드 ────────────────────────────────────────────
/**
 * @param {PIXI.Container} layer
 * @param {object} gs   - 게임 상태
 * @param {object|null} profile - 플레이어 프로필 (name, class)
 */
export function buildUI(layer, gs, profile = null) {

  // ══════════════════════════════════════════════════════════
  // ① 상단바
  // ══════════════════════════════════════════════════════════
  const topBg = new PIXI.Graphics();
  topBg.beginFill(0x0a0814, 0.96);
  topBg.drawRect(0, 0, W, ZONE.TOP_H);
  topBg.endFill();
  topBg.lineStyle(1, C.gold, 0.45);
  topBg.moveTo(0, ZONE.TOP_H); topBg.lineTo(W, ZONE.TOP_H);
  layer.addChild(topBg);
  drawOrnamentLine(layer, ZONE.TOP_H, 0.22);

  // 유저 아바타 (원형)
  const avatarG = new PIXI.Graphics();
  avatarG.beginFill(C.goldDim, 0.7);
  avatarG.drawCircle(26, 30, 18);
  avatarG.endFill();
  avatarG.lineStyle(1.5, C.gold, 0.8);
  avatarG.drawCircle(26, 30, 18);
  layer.addChild(avatarG);

  refs.avatarTxt = makeText('?', 13, C.dark, { fontWeight: 'bold' });
  refs.avatarTxt.anchor.set(0.5);
  refs.avatarTxt.x = 26; refs.avatarTxt.y = 30;
  layer.addChild(refs.avatarTxt);

  // 플레이어 이름 (상단)
  refs.nameTxt = makeText('', 10, C.cream, { fontWeight: 'bold' });
  refs.nameTxt.x = 50; refs.nameTxt.y = 15;
  layer.addChild(refs.nameTxt);

  // 클래스 (하단)
  refs.classTxt = makeText('', 8, C.dimCream, { fontStyle: 'italic' });
  refs.classTxt.x = 50; refs.classTxt.y = 30;
  layer.addChild(refs.classTxt);

  // VP는 스탯 칩으로 이동 (top bar에서 제거)

  // 우측 아이콘 버튼: 음량 · 도감 · 랭킹
  const btnY = 30;
  layer.addChild(makeIconBtn('음량', W - 18,  btnY, () => gs.onOpenVolume?.()));
  layer.addChild(makeIconBtn('도감', W - 52,  btnY, () => gs.onOpenCatalog?.()));
  layer.addChild(makeIconBtn('랭킹', W - 86,  btnY, () => gs.onOpenRanking?.()));

  // ══════════════════════════════════════════════════════════
  // ② 스탯 카운트 바 — 2행 레이아웃
  //    행1: [⚔ 행동 N] [⊕ 구매 N] [● 코인 N]
  //    행2: 이펙트 태그 (카드 효과에 따라 동적 추가)
  // ══════════════════════════════════════════════════════════
  // ── 행 1: 기본 스탯 칩 ──────────────────────────────────
  const R1_Y  = ZONE.STAT_Y + 5;
  const C_GAP = 6;

  // ── 승점 칩 (첫 번째, 녹색) ──────────────────────────────
  const vpChip = makeStatChip('승점', 0, 0x22bb55);
  vpChip.container.x = 6; vpChip.container.y = R1_Y;
  layer.addChild(vpChip.container);
  refs.vpVal  = vpChip.valueTxt;
  refs.vpAnim = vpChip.animate;
  // 값 폰트 크기를 줄여 "8/15" 형식이 칩 안에 맞도록
  refs.vpVal.style.fontSize = 11;
  // 목표 승점 (/ 15) — 칩 레이블 우측, 고정 텍스트
  refs.vpTargetTxt = makeText('/ ?', 7, 0x448844, {});
  refs.vpTargetTxt.anchor.set(0, 0.5);
  refs.vpTargetTxt.x = 36; refs.vpTargetTxt.y = CHIP_H / 2;
  vpChip.container.addChild(refs.vpTargetTxt);

  const actionChip = makeStatChip('행동', 1, 0x3399ff);
  actionChip.container.x = 6 + (CHIP_W + C_GAP); actionChip.container.y = R1_Y;
  layer.addChild(actionChip.container);
  refs.actionVal   = actionChip.valueTxt;
  refs.actionAnim  = actionChip.animate;

  const buyChip = makeStatChip('구매', 1, 0xdd3333);
  buyChip.container.x = 6 + (CHIP_W + C_GAP) * 2; buyChip.container.y = R1_Y;
  layer.addChild(buyChip.container);
  refs.buyVal   = buyChip.valueTxt;
  refs.buyAnim  = buyChip.animate;

  const coinChip = makeStatChip('코인', 0, C.gold);
  coinChip.container.x = 6 + (CHIP_W + C_GAP) * 3; coinChip.container.y = R1_Y;
  layer.addChild(coinChip.container);
  refs.coinVal   = coinChip.valueTxt;
  refs.coinAnim  = coinChip.animate;

  // spawn 애니메이션 (게임 시작 시 칩 등장)
  setTimeout(() => refs.vpAnim?.('spawn'),     0);
  setTimeout(() => refs.actionAnim?.('spawn'), 60);
  setTimeout(() => refs.buyAnim?.('spawn'),    120);
  setTimeout(() => refs.coinAnim?.('spawn'),   180);

  // ── 행 2: 이펙트 태그 컨테이너 ──────────────────────────
  refs.tagsCont = new PIXI.Container();
  refs.tagsCont.x = 6;
  refs.tagsCont.y = ZONE.STAT_Y + 36;
  layer.addChild(refs.tagsCont);

  // ══════════════════════════════════════════════════════════
  // ③ 더미 영역 + 턴 종료 버튼 (통합)
  // ══════════════════════════════════════════════════════════
  buildPileArea(layer, gs);

  // 초기 프로필 + UI 반영
  if (profile) applyProfile(profile);
  updateUI(gs);
}

// ─── 스탯 차단 피드백 ────────────────────────────────────────
/**
 * 특정 스탯이 0이어서 조작이 차단됐을 때 경고 애니메이션
 * @param {'action'|'buy'|'coin'} stat
 */
export function notifyBlocked(stat) {
  if (stat === 'action') refs.actionAnim?.('blocked');
  else if (stat === 'buy') refs.buyAnim?.('blocked');
  else if (stat === 'coin') refs.coinAnim?.('blocked');
}

// ─── 프로필 표시 갱신 ────────────────────────────────────────
export function applyProfile(profile) {
  if (!profile) return;
  if (refs.avatarTxt) refs.avatarTxt.text = (profile.name ?? '?')[0].toUpperCase();
  if (refs.nameTxt)   refs.nameTxt.text   = profile.name  ?? '';
  if (refs.classTxt)  refs.classTxt.text  = profile.class ?? '';
}

// ─── 게임 상태 변경 시 UI 텍스트 갱신 ───────────────────────
export function updateUI(gs) {
  // 승점 칩 + 목표
  const curVP = gs.vp ?? 0;
  const prvVP = refs._prevVP ?? curVP;
  if (refs.vpVal) {
    if (curVP !== prvVP) refs.vpAnim?.(curVP > prvVP ? 'increase' : 'decrease');
    refs.vpVal.text = String(curVP);
  }
  refs._prevVP = curVP;
  if (refs.vpTargetTxt) refs.vpTargetTxt.text = `/ ${gs.vpTarget ?? '?'}`;

  // 행 1: 기본 스탯 칩 — 값 변경 시 이펙트 트리거
  const cur = { actions: gs.actions ?? 0, buys: gs.buys ?? 0, coins: gs.coins ?? 0 };
  const prv = refs._prev ?? cur;

  if (refs.actionVal) {
    if (cur.actions !== prv.actions)
      refs.actionAnim?.(cur.actions > prv.actions ? 'increase' : 'decrease');
    refs.actionVal.text = String(cur.actions);
  }
  if (refs.buyVal) {
    if (cur.buys !== prv.buys)
      refs.buyAnim?.(cur.buys > prv.buys ? 'increase' : 'decrease');
    refs.buyVal.text = String(cur.buys);
  }
  if (refs.coinVal) {
    if (cur.coins !== prv.coins)
      refs.coinAnim?.(cur.coins > prv.coins ? 'increase' : 'decrease');
    refs.coinVal.text = String(cur.coins);
  }
  refs._prev = { ...cur };

  // 행 2: 이펙트 태그 재빌드
  if (refs.tagsCont) {
    refs.tagsCont.removeChildren();
    const tags = _collectEffectTags(gs);
    let tx = 0;
    for (const { text, color } of tags) {
      const tag = makeEffectTag(text, color);
      tag.x = tx;
      refs.tagsCont.addChild(tag);
      tx += tag.width + 5;
    }
  }
}

/**
 * 현재 게임 상태에서 표시할 이펙트 태그 목록을 수집
 * 추후 카드 효과 시스템 확장 시 여기에 조건 추가
 * @returns {{ text: string, color: number }[]}
 */
/**
 * 지속효과 태그 정의
 *  key     = card.def.id
 *  text    = 표시 텍스트
 *  color   = 태그 색상
 * 새 카드 추가 시 여기에만 추가하면 됨
 */
const BUFF_TAG_MAP = new Map([
  ['moat',     { text: '공격방어', color: 0x44bbff }],   // 해자: 공격 방어
  ['merchant', { text: '첫은화+1', color: C.gold   }],   // 상인: 첫 은화 코인 버프
  ['workshop', { text: '비용4↓획득', color: 0xcc8833 }], // 작업장: 비용 4 이하 카드 획득
]);

function _collectEffectTags(gs) {
  const tags = [];

  // 플레이된 재화 코인 합계 (재화 카드 플레이 현황)
  const playedTreasureCoins = (gs.play ?? [])
    .filter(c => c.def?.type === 'Treasure')
    .reduce((s, c) => s + (c.def.coins ?? 0), 0);
  if (playedTreasureCoins > 0) {
    tags.push({ text: `재화 ×${playedTreasureCoins}`, color: C.gold });
  }

  // 지속효과 카드: BUFF_TAG_MAP에 등록된 카드만 표시 (중복 방지)
  const seen = new Set();
  for (const card of (gs.play ?? [])) {
    const id   = card.def?.id;
    const buff = BUFF_TAG_MAP.get(id);
    if (buff && !seen.has(id)) {
      tags.push({ text: buff.text, color: buff.color });
      seen.add(id);
    }
  }

  return tags;
}
