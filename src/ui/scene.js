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

// ─── 스탯 칩 ─────────────────────────────────────────────────
/**
 * @returns {{ container: PIXI.Container, valueTxt: PIXI.Text }}
 */
function makeStatChip(icon, value, accentColor) {
  const chip = new PIXI.Container();

  const bg = new PIXI.Graphics();
  bg.beginFill(C.dark, 0.88);
  bg.lineStyle(1, accentColor, 0.55);
  bg.drawRoundedRect(0, 0, 56, 28, 6);
  bg.endFill();
  chip.addChild(bg);

  const iconTxt = makeText(icon, 9, accentColor);
  iconTxt.anchor.set(0, 0.5);
  iconTxt.x = 7; iconTxt.y = 14;
  chip.addChild(iconTxt);

  const valueTxt = makeText(String(value), 13, accentColor, { fontWeight: 'bold' });
  valueTxt.anchor.set(1, 0.5);
  valueTxt.x = 49; valueTxt.y = 14;
  chip.addChild(valueTxt);

  return { container: chip, valueTxt };
}

// ─── 더미 영역 레이블 패널 ───────────────────────────────────
/**
 * 4개 더미(덱·버림·낸카드·추방) 레이블을 UI 레이어에 그림
 * layout.js의 pile 위치와 일치해야 함
 */
function buildPileLabels(layer) {
  // pile 위치는 layout.js와 동일하게 계산
  const PW      = Math.round(CARD_W * PILE_SCALE);
  const PH      = Math.round(CARD_H * PILE_SCALE);
  const TOTAL_W = 4 * PW;
  const GAP     = Math.round((W - TOTAL_W) / 5);

  const pileNames  = ['덱', '버림더미', '낸카드', '추방더미'];
  const pileColors = [C.dimCream, C.dimCream, C.dimCream, 0x886644];

  // 섹션 제목
  const sectionLbl = makeText('— 더미 영역 —', 8, C.dimCream, { fontStyle: 'italic' });
  sectionLbl.anchor.set(0.5, 0);
  sectionLbl.x = W / 2;
  sectionLbl.y = ZONE.PILES_Y + 2;
  layer.addChild(sectionLbl);

  // 구분선
  const g = new PIXI.Graphics();
  g.lineStyle(0.8, C.goldDim, 0.25);
  g.moveTo(0, ZONE.PILES_Y); g.lineTo(W, ZONE.PILES_Y);
  g.moveTo(0, ZONE.PILES_Y + ZONE.PILES_H); g.lineTo(W, ZONE.PILES_Y + ZONE.PILES_H);
  layer.addChild(g);

  pileNames.forEach((name, i) => {
    const cx = GAP + i * (PW + GAP) + PW / 2;

    // 빈 더미 자리 외곽선
    const outline = new PIXI.Graphics();
    outline.lineStyle(1, C.goldDim, 0.22);
    outline.drawRect(GAP + i * (PW + GAP), ZONE.PILES_Y + 16, PW, PH);
    layer.addChild(outline);

    // 이름 레이블 (더미 아래)
    const lbl = makeText(name, 7, pileColors[i], { fontStyle: 'italic' });
    lbl.anchor.set(0.5, 0);
    lbl.x = cx;
    lbl.y = ZONE.PILES_Y + 16 + PH + 3;
    layer.addChild(lbl);
  });
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

  // 플레이어 이름 / 클래스
  refs.nameTxt = makeText('', 10, C.cream, { fontWeight: 'bold' });
  refs.nameTxt.x = 50; refs.nameTxt.y = 17;
  layer.addChild(refs.nameTxt);

  refs.classTxt = makeText('', 8, C.dimCream, { fontStyle: 'italic' });
  refs.classTxt.x = 50; refs.classTxt.y = 33;
  layer.addChild(refs.classTxt);

  // 목표 승점 배지 (중앙)
  const vpBadgeG = new PIXI.Graphics();
  vpBadgeG.beginFill(C.dark, 0.9);
  vpBadgeG.lineStyle(1, C.gold, 0.6);
  vpBadgeG.drawRoundedRect(W / 2 - 36, 14, 72, 32, 7);
  vpBadgeG.endFill();
  layer.addChild(vpBadgeG);

  const vpLbl = makeText('목표 VP', 7, C.dimCream, { fontStyle: 'italic' });
  vpLbl.anchor.set(0.5, 0); vpLbl.x = W / 2; vpLbl.y = 16;
  layer.addChild(vpLbl);

  refs.vpTxt = makeText('0 VP', 11, C.goldHi, { fontWeight: 'bold' });
  refs.vpTxt.anchor.set(0.5, 0); refs.vpTxt.x = W / 2; refs.vpTxt.y = 28;
  layer.addChild(refs.vpTxt);

  // 우측 아이콘 버튼: 음량 · 도감 · 랭킹
  const btnY = 30;
  layer.addChild(makeIconBtn('음량', W - 18,  btnY, () => gs.onOpenVolume?.()));
  layer.addChild(makeIconBtn('도감', W - 52,  btnY, () => gs.onOpenCatalog?.()));
  layer.addChild(makeIconBtn('랭킹', W - 86,  btnY, () => gs.onOpenRanking?.()));

  // ══════════════════════════════════════════════════════════
  // ② 스탯 카운트 바 (액션 · 구매 · 코인 + 페이즈 태그)
  // ══════════════════════════════════════════════════════════
  const statBg = new PIXI.Graphics();
  statBg.beginFill(0x090614, 0.94);
  statBg.drawRect(0, ZONE.STAT_Y, W, ZONE.STAT_H);
  statBg.endFill();
  statBg.lineStyle(0.8, C.goldDim, 0.3);
  statBg.moveTo(0, ZONE.STAT_Y);                   statBg.lineTo(W, ZONE.STAT_Y);
  statBg.moveTo(0, ZONE.STAT_Y + ZONE.STAT_H);     statBg.lineTo(W, ZONE.STAT_Y + ZONE.STAT_H);
  layer.addChild(statBg);

  const chipY = ZONE.STAT_Y + 6;
  const chipGap = 62;

  const actionChip = makeStatChip('⚔ 행동', 1, 0x9933cc);
  actionChip.container.x = 8;
  actionChip.container.y = chipY;
  layer.addChild(actionChip.container);
  refs.actionVal = actionChip.valueTxt;

  const buyChip = makeStatChip('⊕ 구매', 1, 0x228844);
  buyChip.container.x = 8 + chipGap;
  buyChip.container.y = chipY;
  layer.addChild(buyChip.container);
  refs.buyVal = buyChip.valueTxt;

  const coinChip = makeStatChip('● 코인', 0, C.gold);
  coinChip.container.x = 8 + chipGap * 2;
  coinChip.container.y = chipY;
  layer.addChild(coinChip.container);
  refs.coinVal = coinChip.valueTxt;

  // 우측: 이펙트 태그 영역 (텍스트 표시용)
  refs.effectTxt = makeText('', 8, C.dimCream, { fontStyle: 'italic' });
  refs.effectTxt.x = 8 + chipGap * 3 + 4;
  refs.effectTxt.y = chipY + 7;
  layer.addChild(refs.effectTxt);

  // ══════════════════════════════════════════════════════════
  // ③ 더미 영역 레이블
  // ══════════════════════════════════════════════════════════
  buildPileLabels(layer);

  // ══════════════════════════════════════════════════════════
  // ④ 턴 종료 버튼
  // ══════════════════════════════════════════════════════════
  const btnW = W - 32;
  const btn  = new PIXI.Container();

  const btnBg = new PIXI.Graphics();
  btnBg.beginFill(0x1a1030); btnBg.drawRect(0, 0, btnW, 38); btnBg.endFill();
  btnBg.lineStyle(1.5, C.gold, 0.8); btnBg.drawRect(0, 0, btnW, 38);
  [[0, 0], [btnW, 0], [0, 38], [btnW, 38]].forEach(([bx, by]) => {
    btnBg.lineStyle(0);
    btnBg.beginFill(C.goldDim, 0.8);
    btnBg.drawRect(bx - 2, by - 2, 4, 4);
    btnBg.endFill();
  });
  btn.addChild(btnBg);

  const btnTxt = makeText('턴  종료', 14, C.gold, { fontWeight: 'bold' });
  btnTxt.anchor.set(0.5); btnTxt.x = btnW / 2; btnTxt.y = 19;
  btn.addChild(btnTxt);

  btn.x = 16; btn.y = ZONE.BTN_Y;
  btn.eventMode = 'static'; btn.cursor = 'pointer';
  btn.on('pointerdown',      () => btn.scale.set(0.96));
  btn.on('pointerup',        () => { btn.scale.set(1); gs.onEndTurn?.(); });
  btn.on('pointerupoutside', () => btn.scale.set(1));
  layer.addChild(btn);

  // ══════════════════════════════════════════════════════════
  // ⑤ 페이즈 라벨
  // ══════════════════════════════════════════════════════════
  refs.phaseTxt = makeText('', 9, C.dimCream, { fontStyle: 'italic' });
  refs.phaseTxt.anchor.set(0.5, 0);
  refs.phaseTxt.x = W / 2; refs.phaseTxt.y = ZONE.PHASE_Y + 2;
  layer.addChild(refs.phaseTxt);

  // ══════════════════════════════════════════════════════════
  // ⑥ 하단 상태바
  // ══════════════════════════════════════════════════════════
  const botBg = new PIXI.Graphics();
  botBg.beginFill(0x0a0814, 0.94);
  botBg.drawRect(0, ZONE.BOTTOM_Y, W, H - ZONE.BOTTOM_Y);
  botBg.endFill();
  botBg.lineStyle(1, C.gold, 0.25);
  botBg.moveTo(0, ZONE.BOTTOM_Y); botBg.lineTo(W, ZONE.BOTTOM_Y);
  layer.addChild(botBg);
  drawOrnamentLine(layer, ZONE.BOTTOM_Y, 0.14);

  refs.statusTxt = makeText('', 9, C.dimCream);
  refs.statusTxt.anchor.set(0.5, 0.5);
  refs.statusTxt.x = W / 2;
  refs.statusTxt.y = ZONE.BOTTOM_Y + (H - ZONE.BOTTOM_Y) / 2;
  layer.addChild(refs.statusTxt);

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
  // 승점
  if (refs.vpTxt)    refs.vpTxt.text    = `${gs.vp ?? 0} VP`;

  // 스탯 칩
  if (refs.actionVal) refs.actionVal.text = String(gs.actions ?? 0);
  if (refs.buyVal)    refs.buyVal.text    = String(gs.buys    ?? 0);
  if (refs.coinVal)   refs.coinVal.text   = String(gs.coins   ?? 0);

  // 페이즈
  if (refs.phaseTxt) {
    const p = gs.phase ?? 'action';
    refs.phaseTxt.text = {
      action:  '⚔ 액션 페이즈',
      buy:     '⊕ 구매 페이즈',
      cleanup: '↺ 클린업',
    }[p] ?? '대기 중';
  }

  // 하단 상태바
  if (refs.statusTxt) {
    refs.statusTxt.text =
      `덱 ${gs.deck?.length ?? 0}  버림 ${gs.discard?.length ?? 0}  ` +
      `낸카드 ${gs.play?.length ?? 0}  Turn ${gs.turn ?? 1}`;
  }
}
