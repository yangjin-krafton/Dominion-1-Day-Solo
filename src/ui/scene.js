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

// ─── 기본 스탯 칩 (행1) ──────────────────────────────────────
const CHIP_W = 78;
const CHIP_H = 24;
/**
 * @returns {{ container: PIXI.Container, valueTxt: PIXI.Text }}
 */
function makeStatChip(label, value, accentColor) {
  const chip = new PIXI.Container();

  const bg = new PIXI.Graphics();
  bg.beginFill(C.dark, 0.92);
  bg.lineStyle(1.2, accentColor, 0.65);
  bg.drawRoundedRect(0, 0, CHIP_W, CHIP_H, 6);
  bg.endFill();
  chip.addChild(bg);

  // 레이블 (밝은 흰색)
  const labelTxt = makeText(label, 9, C.cream, { fontStyle: 'italic' });
  labelTxt.anchor.set(0, 0.5);
  labelTxt.x = 8; labelTxt.y = CHIP_H / 2;
  chip.addChild(labelTxt);

  // 값 (오른쪽 정렬, 밝은 골드 굵게)
  const valueTxt = makeText(String(value), 15, C.goldHi, { fontWeight: 'bold' });
  valueTxt.anchor.set(1, 0.5);
  valueTxt.x = CHIP_W - 7; valueTxt.y = CHIP_H / 2;
  chip.addChild(valueTxt);

  return { container: chip, valueTxt };
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

  // 섹션 배경
  const bg = new PIXI.Graphics();
  bg.beginFill(0x06040f, 0.45);
  bg.drawRect(0, ZONE.PILES_Y, W, ZONE.PILES_H);
  bg.endFill();
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

  // VP 배지 (프로필 우측 · 카메라 영역 밖 좌단 고정)
  const vpBg = new PIXI.Graphics();
  vpBg.beginFill(C.dark, 0.88);
  vpBg.lineStyle(1, C.gold, 0.55);
  vpBg.drawRoundedRect(0, 0, 52, 28, 6);
  vpBg.endFill();
  vpBg.x = 120; vpBg.y = 16;
  layer.addChild(vpBg);

  const vpLbl = makeText('VP', 7, C.dimCream, { fontStyle: 'italic' });
  vpLbl.anchor.set(0, 0.5); vpLbl.x = 125; vpLbl.y = 30;
  layer.addChild(vpLbl);

  refs.vpTxt = makeText('0', 13, C.goldHi, { fontWeight: 'bold' });
  refs.vpTxt.anchor.set(0, 0.5); refs.vpTxt.x = 143; refs.vpTxt.y = 30;
  layer.addChild(refs.vpTxt);

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
  const statBg = new PIXI.Graphics();
  statBg.beginFill(0x080511, 0.97);
  statBg.drawRect(0, ZONE.STAT_Y, W, ZONE.STAT_H);
  statBg.endFill();
  statBg.lineStyle(0.8, C.goldDim, 0.35);
  statBg.moveTo(0, ZONE.STAT_Y);              statBg.lineTo(W, ZONE.STAT_Y);
  statBg.moveTo(0, ZONE.STAT_Y + ZONE.STAT_H); statBg.lineTo(W, ZONE.STAT_Y + ZONE.STAT_H);
  layer.addChild(statBg);

  // ── 행 1: 기본 스탯 칩 ──────────────────────────────────
  const R1_Y  = ZONE.STAT_Y + 5;
  const C_GAP = 6;

  const actionChip = makeStatChip('행동', 1, 0x3399ff);
  actionChip.container.x = 6; actionChip.container.y = R1_Y;
  layer.addChild(actionChip.container);
  refs.actionVal = actionChip.valueTxt;

  const buyChip = makeStatChip('구매', 1, 0x228844);
  buyChip.container.x = 6 + CHIP_W + C_GAP; buyChip.container.y = R1_Y;
  layer.addChild(buyChip.container);
  refs.buyVal = buyChip.valueTxt;

  const coinChip = makeStatChip('코인', 0, C.gold);
  coinChip.container.x = 6 + (CHIP_W + C_GAP) * 2; coinChip.container.y = R1_Y;
  layer.addChild(coinChip.container);
  refs.coinVal = coinChip.valueTxt;

  // 행1·행2 구분선
  const divG = new PIXI.Graphics();
  divG.lineStyle(0.5, C.goldDim, 0.2);
  divG.moveTo(6, ZONE.STAT_Y + 32); divG.lineTo(W - 6, ZONE.STAT_Y + 32);
  layer.addChild(divG);

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

// ─── 프로필 표시 갱신 ────────────────────────────────────────
export function applyProfile(profile) {
  if (!profile) return;
  if (refs.avatarTxt) refs.avatarTxt.text = (profile.name ?? '?')[0].toUpperCase();
  if (refs.nameTxt)   refs.nameTxt.text   = profile.name  ?? '';
  if (refs.classTxt)  refs.classTxt.text  = profile.class ?? '';
}

// ─── 게임 상태 변경 시 UI 텍스트 갱신 ───────────────────────
export function updateUI(gs) {
  // 승점 (좌측 배지)
  if (refs.vpTxt) refs.vpTxt.text = String(gs.vp ?? 0);

  // 행 1: 기본 스탯 칩
  if (refs.actionVal) refs.actionVal.text = String(gs.actions ?? 0);
  if (refs.buyVal)    refs.buyVal.text    = String(gs.buys    ?? 0);
  if (refs.coinVal)   refs.coinVal.text   = String(gs.coins   ?? 0);

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
function _collectEffectTags(gs) {
  const tags = [];
  // 보유 코인이 기본 보화 외 추가 코인이 있을 때 (플레이한 재화 기준)
  const playedTreasureCoins = (gs.play ?? [])
    .filter(c => c.def?.type === 'Treasure')
    .reduce((s, c) => s + (c.def.coins ?? 0), 0);
  if (playedTreasureCoins > 0) {
    tags.push({ text: `재화 ×${playedTreasureCoins}`, color: C.gold });
  }
  // 낸 액션 카드
  const playedActions = (gs.play ?? []).filter(c => c.def?.type === 'Action');
  for (const card of playedActions) {
    tags.push({ text: card.def.name, color: 0x9933cc });
  }
  return tags;
}
