// ============================================================
// ui/MarketTimeline.js — 시장 이벤트 타임라인 (Art-Nouveau 스타일)
//
// reveal 단계 (미공개 레벨):
//   0 (T+1) : 완전 공개  — 풀 컬러 + 글로우 + 카드명 + 수량
//   1 (T+2) : 카드명 공개, 수량 '?'  — 중간 밝기
//   2 (T+3) : 타입명만  — 어두움 + fog
//   3 (T+4) : 완전 숨김 '???' — 최대 fog
// ============================================================
import { C, SCREEN_W as W, ZONE } from '../config.js';

// ── 아이스 GLSL 프래그먼트 쉐이더 ────────────────────────────
// 해자(Moat) 차단 시 타임라인에 적용되는 ICE 이펙트
const ICE_FRAG = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uStrength;

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 ip = floor(p);
  vec2 u  = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  float a = rand(ip);
  float b = rand(ip + vec2(1.0, 0.0));
  float c = rand(ip + vec2(0.0, 1.0));
  float d = rand(ip + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2  uv = vTextureCoord;
  // 얼음 굴절 왜곡
  float n  = (noise(uv * 7.0 + uTime * 0.4) - 0.5) * 0.009 * uStrength;
  vec4  col = texture2D(uSampler, clamp(uv + vec2(n, n * 0.6), 0.001, 0.999));
  // 얼음 파란 틴트
  vec3  ice = vec3(0.52, 0.83, 1.0);
  col.rgb = mix(col.rgb, ice, 0.48 * uStrength);
  // 결정 반짝임
  float sp = pow(max(0.0, noise(uv * 22.0 + uTime * 1.5) - 0.62), 2.8) * 2.2 * uStrength;
  col.rgb += vec3(sp * 0.65, sp * 0.82, sp);
  // 가장자리 프로스트
  float ex = max(0.0, 1.0 - min(uv.x, 1.0 - uv.x) * 6.0);
  float ey = max(0.0, 1.0 - min(uv.y, 1.0 - uv.y) * 6.0);
  col.rgb += ice * (ex + ey) * 0.22 * uStrength;
  gl_FragColor = col;
}
`;

// ── 눈결정 그리기 헬퍼 ────────────────────────────────────────
function _drawSnowflake(g, cx, cy, r, color, alpha) {
  g.lineStyle(0.7, color, alpha);
  for (let i = 0; i < 6; i++) {
    const a  = (i * Math.PI) / 3;
    const ex = cx + Math.cos(a) * r;
    const ey = cy + Math.sin(a) * r;
    g.moveTo(cx, cy);
    g.lineTo(ex, ey);
    // 작은 가지
    const mx = cx + Math.cos(a) * r * 0.55;
    const my = cy + Math.sin(a) * r * 0.55;
    g.moveTo(mx, my);
    g.lineTo(mx + Math.cos(a + Math.PI / 3) * r * 0.28, my + Math.sin(a + Math.PI / 3) * r * 0.28);
    g.moveTo(mx, my);
    g.lineTo(mx + Math.cos(a - Math.PI / 3) * r * 0.28, my + Math.sin(a - Math.PI / 3) * r * 0.28);
  }
  g.lineStyle(0);
}

// ── 레이아웃 ───────────────────────────────────────────────
const TL_Y       = ZONE.MARKET_Y + 2;    // 시장 섹션 Y + 2px 여백
export const TL_H = 26;                   // Market.js CARD_Y0 계산에 사용

const LABEL_H  = 7;    // 턴 레이블 행 높이
const CAP_H    = 16;   // 캡슐 높이
const CAP_W    = 88;   // 캡슐 너비
const CAP_GAP  = 4;    // 캡슐 간격
const TOTAL_W  = 4 * CAP_W + 3 * CAP_GAP;  // 364px
const START_X  = Math.round((W - TOTAL_W) / 2);  // 13px
const SLIDE    = CAP_W + CAP_GAP;              // 스크롤 1스텝

const CAP_Y    = TL_Y + LABEL_H + 2;     // 캡슐 시작 Y

// ── 컬러 팔레트 (이벤트 타입별 3톤) ──────────────────────
const PAL = {
  vanish:       { bright: 0xff4444, mid: 0x8a1818, dark: 0x200606 },
  drain:        { bright: 0xcc66ff, mid: 0x661aaa, dark: 0x130820 },
  surge:        { bright: 0xffaa33, mid: 0x885518, dark: 0x1e1205 },
  skip:         { bright: 0x66bb66, mid: 0x2a5528, dark: 0x081208 },
  curse_player: { bright: 0xff6688, mid: 0x881830, dark: 0x200508 },  // 저주 획득 — 핑크
  witch_curse:  { bright: 0xaa44ff, mid: 0x5a1888, dark: 0x110520 },  // 마녀 저주 — 보라
};
// T+4: 숨겨진 캡슐도 내용이 "???"로 표시되므로 밝기를 낮추지 않음
const PAL_HIDDEN = { bright: 0x666666, mid: 0x333333, dark: 0x0e0e0e };

// 영문 타입 → 한국어 변환
const KO_TYPE = {
  Action: '행동', Treasure: '재물', Victory: '승점', Curse: '저주',
  // CSV에서 이미 한국어로 오는 경우도 처리
  '행동': '행동', '재물': '재물', '승점': '승점', '저주': '저주',
  '행동-시장': '행동', '행동-반응': '행동',
};
function koType(raw) { return KO_TYPE[raw] ?? raw ?? '?'; }

// 턴 레이블
const TURN_LABELS = ['다음 턴', '+2턴', '+3턴', '+4턴'];

// 포그 오버레이 제거 — 정보 숨김은 텍스트 내용("?")으로만 표현
// 컨테이너 전체 alpha: 거리감만 살짝 표시 (T+4도 충분히 보임)
const CAP_ALPHA  = [1.0, 0.90, 0.82, 0.70];

// ── 유틸 ──────────────────────────────────────────────────
function lerp(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16)
       | (Math.round(ag + (bg - ag) * t) << 8)
       |  Math.round(ab + (bb - ab) * t);
}

function getPal(event, reveal) {
  // 마녀 저주 skip: reveal 단계 무관하게 항상 보라색 팔레트로 표시
  if (event?.witchCurse) return PAL.witch_curse;
  if (!event || reveal >= 3) return PAL_HIDDEN;
  return PAL[event.type] ?? PAL_HIDDEN;
}

/**
 * 캡슐에 표시할 완성 한국어 문장 생성
 * reveal 0=완전공개, 1=수량숨김, 2=타입만, 3=완전숨김
 */
function capsuleFullText(event, reveal) {
  // 마녀 저주: reveal 단계 무관하게 항상 '마녀 저주' 표시
  if (event?.witchCurse) return '마녀 저주';

  if (!event || reveal >= 3) return '미공개';

  const { type, cardName, cardType, count } = event;
  const typeName = koType(cardType);

  if (type === 'skip')         return '변동 없음';
  if (type === 'curse_player') return reveal >= 2 ? '저주 획득' : '저주 1장 획득';

  if (type === 'surge') {
    if (reveal >= 2) return `${typeName} 가격 상승`;
    return `${cardName ?? typeName} 가격 상승`;
  }

  // vanish / drain
  const subject = reveal >= 2 ? `${typeName}` : (cardName ?? typeName);
  const qty     = reveal >= 1 ? '?장' : `${count ?? '?'}장`;
  return `${subject} ${qty} 소멸`;
}

// ── 캡슐 팩토리 ───────────────────────────────────────────
/**
 * 단일 캡슐 생성 (멀티레이어: 글로우·그라데이션·악센트·보더·텍스트·포그)
 * @param {number} idx  0~3
 */
function makeCap(idx) {
  const ct = new PIXI.Container();

  // ─ 그래픽 레이어들 ─
  const glowG    = new PIXI.Graphics();  // 외부 글로우 (T+1)
  const bgG      = new PIXI.Graphics();  // 그라데이션 배경
  const accentG  = new PIXI.Graphics();  // 좌측 컬러 스트라이프
  const borderG  = new PIXI.Graphics();  // 테두리 + 하이라이트
  // fogG 제거 — 정보 숨김은 "?" 텍스트로만 표현

  // ─ 단일 텍스트 (전체폭, 중앙 정렬) ─
  const mainTxt = new PIXI.Text('', {
    fontFamily: 'Malgun Gothic, NanumGothic, sans-serif',
    fontSize: 7.5,
    fill: C.cream,
  });
  mainTxt.anchor.set(0.5, 0.5);
  mainTxt.x = CAP_W / 2;
  mainTxt.y = CAP_H / 2;

  ct.addChild(glowG, bgG, accentG, borderG, mainTxt);

  // ─ 캡슐 간 연결선 (첫 캡슐 제외) ─
  if (idx > 0) {
    const conn = new PIXI.Graphics();
    conn.lineStyle(0.5, C.goldDim, 0.35);
    conn.moveTo(-CAP_GAP + 1, CAP_H / 2);
    conn.lineTo(-1, CAP_H / 2);
    conn.lineStyle(0);
    // 중앙 다이아몬드 포인트
    conn.beginFill(C.goldDim, 0.4);
    conn.drawPolygon([
      -CAP_GAP / 2 - 1, CAP_H / 2,
      -CAP_GAP / 2 + 1, CAP_H / 2 - 1.5,
      -CAP_GAP / 2 + 3, CAP_H / 2,
      -CAP_GAP / 2 + 1, CAP_H / 2 + 1.5,
    ]);
    conn.endFill();
    ct.addChild(conn);
  }

  // ── update 함수 ────────────────────────────────────────
  const update = (event, reveal) => {
    const { bright, mid, dark } = getPal(event, reveal);
    const isTop = reveal === 0;

    // ── 1. 외부 글로우 (T+1만) ────────────────────────
    glowG.clear();
    if (isTop) {
      const glowRings = [[4, 0.04], [3, 0.07], [2, 0.12], [1, 0.20]];
      for (const [r, a] of glowRings) {
        glowG.lineStyle(r * 1.2, bright, a);
        glowG.drawRoundedRect(-r, -r, CAP_W + r * 2, CAP_H + r * 2, 4 + r);
      }
      glowG.lineStyle(0);
    }

    // ── 2. 그라데이션 배경 (8밴드) ────────────────────
    bgG.clear();
    const BANDS = 8;
    for (let b = 0; b < BANDS; b++) {
      const t = b / (BANDS - 1);
      let c;
      if (t < 0.3) {
        // 상단: dark → 이벤트 dark/mid 살짝 혼합
        c = lerp(C.dark, lerp(dark, mid, 0.25), t / 0.3);
      } else if (t < 0.65) {
        // 중간: 이벤트 컬러 블리드
        c = lerp(lerp(dark, mid, 0.25), dark, (t - 0.3) / 0.35);
      } else {
        // 하단: dark → C.dark
        c = lerp(dark, C.dark, (t - 0.65) / 0.35);
      }
      bgG.beginFill(c);
      bgG.drawRect(0, Math.floor(b * CAP_H / BANDS), CAP_W, Math.ceil(CAP_H / BANDS) + 1);
      bgG.endFill();
    }

    // ── 3. 좌측 컬러 스트라이프 (3px) ─────────────────
    accentG.clear();
    accentG.beginFill(bright, isTop ? 1.0 : reveal === 1 ? 0.75 : 0.45);
    accentG.drawRect(0, 0, 3, CAP_H);
    accentG.endFill();
    // 스트라이프 상단 하이라이트
    if (isTop) {
      accentG.beginFill(0xffffff, 0.40);
      accentG.drawRect(0, 0, 1, Math.round(CAP_H * 0.35));
      accentG.endFill();
    }
    // 스트라이프 우측 컬러 블리드 (8px 그라데이션)
    const bleedSteps = 5;
    for (let s = 0; s < bleedSteps; s++) {
      const a = (isTop ? 0.12 : 0.06) * (1 - s / bleedSteps);
      accentG.beginFill(bright, a);
      accentG.drawRect(3 + s, 0, 1, CAP_H);
      accentG.endFill();
    }

    // ── 4. 테두리 ──────────────────────────────────────
    borderG.clear();
    // 메인 테두리
    const bw = isTop ? 1.2 : reveal === 1 ? 0.8 : 0.5;
    const bc = isTop ? bright : reveal === 1 ? mid : dark;
    const ba = isTop ? 0.92 : reveal === 1 ? 0.65 : reveal === 2 ? 0.40 : 0.18;
    borderG.lineStyle(bw, bc, ba);
    borderG.drawRoundedRect(0, 0, CAP_W, CAP_H, 3);

    // T+1: 상단 에지 하이라이트 shimmer
    if (isTop) {
      borderG.lineStyle(0.6, 0xffffff, 0.18);
      borderG.moveTo(4, 0.5);
      borderG.lineTo(CAP_W - 4, 0.5);
      // 하단 그림자 라인
      borderG.lineStyle(0.5, 0x000000, 0.35);
      borderG.moveTo(2, CAP_H - 0.5);
      borderG.lineTo(CAP_W - 2, CAP_H - 0.5);
    }
    borderG.lineStyle(0);

    // T+1 내부 얇은 이벤트 컬러 라인 (이중 테두리 효과)
    if (isTop) {
      borderG.lineStyle(0.5, bright, 0.22);
      borderG.drawRoundedRect(1.5, 1.5, CAP_W - 3, CAP_H - 3, 2);
      borderG.lineStyle(0);
    }

    // ── 5. 한국어 문장 텍스트 ─────────────────────────
    mainTxt.text = capsuleFullText(event, reveal);

    if (!event || reveal >= 3) {
      mainTxt.style.fill     = 0x888888;
      mainTxt.style.fontSize = 7;
    } else {
      mainTxt.style.fill     = isTop ? C.cream : C.dimCream;
      mainTxt.style.fontSize = isTop ? 8 : 7;
    }

    ct.alpha = CAP_ALPHA[reveal] ?? 0.70;
  };

  return { ct, update };
}

// ============================================================
export class MarketTimeline {
  /**
   * @param {PIXI.Container} layer
   * @param {object[]} queue  - 초기 큐 4개
   */
  constructor(layer, queue) {
    this.layer = layer;
    this._caps = [];

    // ── 패널 배경 (전체 너비) — 반드시 container보다 먼저 추가 ──
    // layer의 addChild 순서 = 렌더링 순서 (나중 = 앞)
    // _panelG가 뒤(배경), container(캡슐+레이블)가 앞에 오도록 설정
    this._panelG = new PIXI.Graphics();
    this._drawPanel();
    layer.addChild(this._panelG);

    // ── 컨테이너 (캡슐 + 레이블) — panelG 위에 렌더링 ──
    this.container = new PIXI.Container();
    layer.addChild(this.container);

    // ── 클리핑 마스크: 레이블 행 + 캡슐 행 포함 ─────────
    this._maskG = new PIXI.Graphics();
    this._maskG.beginFill(0xffffff);
    // TL_Y부터 TL_H+4까지 커버 (레이블 y=71, 캡슐 y=73~89 모두 포함)
    this._maskG.drawRect(START_X - 2, TL_Y, TOTAL_W + 4, TL_H + 4);
    this._maskG.endFill();
    layer.addChild(this._maskG);
    this.container.mask = this._maskG;

    this._build(queue);
  }

  _drawPanel() {
    const g = this._panelG;
    g.clear();

    // 패널 배경 — 시장 섹션 배경에 통합되므로 아주 얕게만 표시
    const panelH = TL_H + 2;
    g.beginFill(0x06040f, 0.28);
    g.drawRect(0, TL_Y, W, panelH);
    g.endFill();

    // 패널 상단 골드 라인
    g.lineStyle(0.6, C.goldDim, 0.5);
    g.moveTo(0, TL_Y); g.lineTo(W, TL_Y);

    // 패널 하단 구분선 (캡슐 아래)
    g.lineStyle(0.5, C.goldDim, 0.3);
    g.moveTo(START_X, CAP_Y + CAP_H + 2);
    g.lineTo(START_X + TOTAL_W, CAP_Y + CAP_H + 2);
    g.lineStyle(0);

    // 좌우 장식 다이아몬드 포인트
    const midY = CAP_Y + CAP_H / 2;
    [[START_X - 7, midY], [START_X + TOTAL_W + 7, midY]].forEach(([px, py]) => {
      const dp = 3;
      g.beginFill(C.goldDim, 0.45);
      g.drawPolygon([px, py - dp, px + dp, py, px, py + dp, px - dp, py]);
      g.endFill();
    });
  }

  // ── 초기 빌드 ─────────────────────────────────────────
  _build(queue) {
    this._turnLabels = [];

    for (let i = 0; i < 4; i++) {
      const cap = makeCap(i);
      cap.ct.x = START_X + i * SLIDE;
      cap.ct.y = CAP_Y;
      this.container.addChild(cap.ct);
      cap.update(queue[i] ?? null, i);
      this._caps.push(cap);
    }

    // 턴 레이블 — 캡슐 컨테이너 밖(container 직속)에 배치
    // → ct.alpha 영향을 받지 않아 항상 독립 밝기 유지
    const LABEL_FILL   = [C.goldHi, C.dimCream, C.dimCream, C.dimCream];
    const LABEL_ALPHA  = [1.0, 0.80, 0.58, 0.38];
    for (let i = 0; i < 4; i++) {
      const lbl = new PIXI.Text(TURN_LABELS[i] ?? '', {
        fontFamily: 'Georgia, serif',
        fontSize:   i === 0 ? 6.5 : 5.5,
        fontStyle:  'italic',
        fill:       LABEL_FILL[i],
      });
      lbl.anchor.set(0.5, 1);
      lbl.x     = START_X + i * SLIDE + CAP_W / 2;
      lbl.y     = CAP_Y - 1;
      lbl.alpha = LABEL_ALPHA[i];
      this.container.addChild(lbl);
      this._turnLabels.push(lbl);
    }
  }

  // ── 즉시 갱신 (애니메이션 없음) ──────────────────────
  /** @param {object[]} queue */
  refresh(queue) {
    const bonus = this._revealBonus ?? 0;
    for (let i = 0; i < 4; i++) {
      this._caps[i]?.update(queue[i] ?? null, Math.max(0, i - bonus));
    }
  }

  // ── 관료(Bureaucrat) 시장 공개 파티클 이펙트 ──────────
  /**
   * market_reveal 효과: 황금 스캔라인이 타임라인을 가로질러 숨겨진 정보 공개.
   * @param {number}   n       공개 보너스 (reveal 단계 감소량)
   * @param {object[]} queue   현재 큐
   * @param {function} onDone  완료 콜백
   */
  revealUnlock(n, queue, onDone, label = '官  시장 정보 공개') {
    this._revealBonus = n;

    // 캡슐 즉시 갱신 (애니메이션과 동시에 내용 변경)
    this.refresh(queue);

    const DUR_SWEEP = 500;   // 스캔라인 이동
    const DUR_HOLD  = 380;   // 유지
    const DUR_OUT   = 280;   // 페이드아웃
    const TOTAL     = DUR_SWEEP + DUR_HOLD + DUR_OUT;
    const t0        = Date.now();

    // ── 오버레이 레이어 ────────────────────────────────
    const overlayG   = new PIXI.Graphics();
    const overlayTxt = new PIXI.Text(label, {
      fontFamily: 'Georgia, serif',
      fontSize:   9,
      fontStyle:  'italic',
      fill:       0xffe090,
      dropShadow: true,
      dropShadowColor:    0x5c2800,
      dropShadowDistance: 1,
    });
    overlayTxt.anchor.set(0.5, 0.5);
    overlayTxt.x = W / 2;
    overlayTxt.y = TL_Y + TL_H / 2;
    overlayTxt.alpha = 0;
    this.layer.addChild(overlayG, overlayTxt);

    // ── 파티클 초기화 (황금 먼지) ────────────────────
    const PARTICLE_COUNT = 28;
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, k) => ({
      x:     START_X + (k / PARTICLE_COUNT) * TOTAL_W,
      y:     CAP_Y + CAP_H * (0.3 + Math.random() * 0.4),
      vx:    (Math.random() - 0.5) * 22,
      vy:    -(8 + Math.random() * 20),
      life:  0,
      maxL:  0.55 + Math.random() * 0.45,
      r:     0.8 + Math.random() * 1.4,
      delay: (k / PARTICLE_COUNT) * (DUR_SWEEP * 0.001) + Math.random() * 0.08,
    }));

    const easeOut = t => 1 - (1 - t) ** 3;
    let lastMs = t0;

    const tick = () => {
      const now     = Date.now();
      const dt      = (now - lastMs) / 1000;
      lastMs        = now;
      const elapsed = now - t0;
      const sweepT  = Math.min(elapsed / DUR_SWEEP, 1);
      const scanX   = START_X + easeOut(sweepT) * TOTAL_W;

      overlayG.clear();

      // ── 황금 스캔라인 ──────────────────────────────
      if (elapsed < DUR_SWEEP + 60) {
        const sa = (1 - sweepT * 0.7) * 0.85;
        for (let g = 4; g >= 0; g--) {
          const gAlpha = (sa * (0.45 - g * 0.09));
          if (gAlpha <= 0) continue;
          overlayG.beginFill(0xffe090, gAlpha);
          overlayG.drawRect(scanX - g * 2.2, TL_Y - 1, g * 2.2 + 2, TL_H + 4);
          overlayG.endFill();
        }
        // 선두 다이아몬드 포인트
        if (sa > 0.1) {
          overlayG.beginFill(0xfff4b0, sa * 0.9);
          overlayG.drawPolygon([
            scanX,     CAP_Y + CAP_H / 2 - 4,
            scanX + 3, CAP_Y + CAP_H / 2,
            scanX,     CAP_Y + CAP_H / 2 + 4,
            scanX - 3, CAP_Y + CAP_H / 2,
          ]);
          overlayG.endFill();
        }
      }

      // ── 전체 황금 틴트 오버레이 ────────────────────
      const holdT = elapsed < DUR_SWEEP ? sweepT * 0.12
                  : elapsed < DUR_SWEEP + DUR_HOLD ? 0.12
                  : 0.12 * (1 - Math.min((elapsed - DUR_SWEEP - DUR_HOLD) / DUR_OUT, 1));
      if (holdT > 0.001) {
        overlayG.beginFill(0xffe090, holdT);
        overlayG.drawRect(0, TL_Y - 1, W, TL_H + 4);
        overlayG.endFill();
      }

      // ── 상하 황금 테두리 라인 ──────────────────────
      const lineA = Math.max(0, holdT * 4);
      if (lineA > 0.01) {
        overlayG.lineStyle(0.9, 0xffe090, Math.min(lineA, 0.7));
        overlayG.moveTo(0, TL_Y); overlayG.lineTo(W, TL_Y);
        overlayG.moveTo(0, TL_Y + TL_H + 2); overlayG.lineTo(W, TL_Y + TL_H + 2);
        overlayG.lineStyle(0);
      }

      // ── 파티클 업데이트 ────────────────────────────
      for (const p of particles) {
        if (p.delay > 0) { p.delay -= dt; continue; }
        if (p.life < p.maxL) p.life = Math.min(p.life + dt * 1.8, p.maxL);

        p.x  += p.vx * dt;
        p.y  += p.vy * dt;
        p.vy += 55 * dt;   // 중력

        const fade = p.life > 0.01 ? Math.min(p.life * 3, 1) * (1 - elapsed / TOTAL) : 0;
        if (fade > 0.01) {
          overlayG.beginFill(0xffe8a0, fade * 0.9);
          overlayG.drawCircle(p.x, p.y, p.r);
          overlayG.endFill();
          // 작은 다이아 장식
          overlayG.beginFill(0xfff4c0, fade * 0.6);
          overlayG.drawPolygon([
            p.x,           p.y - p.r * 1.8,
            p.x + p.r * 1.2, p.y,
            p.x,           p.y + p.r * 1.8,
            p.x - p.r * 1.2, p.y,
          ]);
          overlayG.endFill();
        }
      }

      // ── 텍스트 페이드인/아웃 ───────────────────────
      const txtIn  = elapsed > DUR_SWEEP * 0.5
                   ? Math.min((elapsed - DUR_SWEEP * 0.5) / (DUR_SWEEP * 0.5 + DUR_HOLD * 0.5), 1)
                   : 0;
      const txtOut = elapsed > DUR_SWEEP + DUR_HOLD
                   ? Math.min((elapsed - DUR_SWEEP - DUR_HOLD) / DUR_OUT, 1)
                   : 0;
      overlayTxt.alpha = txtIn * 0.78 * (1 - txtOut);

      if (elapsed < TOTAL) {
        requestAnimationFrame(tick);
      } else {
        overlayG.parent?.removeChild(overlayG);   overlayG.destroy();
        overlayTxt.parent?.removeChild(overlayTxt); overlayTxt.destroy();
        this.refresh(queue);
        onDone?.();
      }
    };
    requestAnimationFrame(tick);
  }

  // ── 해자(Moat) 지속 아이스 효과 ──────────────────────
  /**
   * 핸드에 Moat 카드가 있는 동안 타임라인에 은은한 얼음 이펙트를 지속 표시.
   * @param {boolean} active  true=활성화, false=해제
   */
  setFrozen(active) {
    if (this._isFreezeAnim) return;   // freeze() 애니메이션 진행 중엔 무시

    if (active && !this._frozenFilter) {
      // ── 필터 생성 ─────────────────────────────────────
      this._frozenFilter = new PIXI.Filter(null, ICE_FRAG);
      this._frozenFilter.uniforms.uTime     = 0.0;
      this._frozenFilter.uniforms.uStrength = 0.0;
      this.container.filters = [this._frozenFilter];

      // ── 오버레이 그래픽 ─────────────────────────────────
      this._frozenG   = new PIXI.Graphics();
      this._frozenTxt = new PIXI.Text('❄ 해자 보호 중', {
        fontFamily: 'Malgun Gothic, NanumGothic, sans-serif',
        fontSize:   10.5,
        fill:       0xb8e8ff,
        dropShadow: true,
        dropShadowColor: 0x003366,
        dropShadowDistance: 1,
      });
      this._frozenTxt.anchor.set(0.5, 0.5);
      this._frozenTxt.x = W / 2;
      this._frozenTxt.y = TL_Y + TL_H / 2;
      this._frozenTxt.alpha = 0;
      this.layer.addChild(this._frozenG, this._frozenTxt);

      // ── 틱 루프 (부드럽게 fade-in 후 shimmer 유지) ──────
      const FADE_DUR = 500;
      const startT   = Date.now();
      this._frozenTick = () => {
        if (!this._frozenFilter) return;   // 이미 해제됨
        const elapsed  = Date.now() - startT;
        const strength = Math.min(elapsed / FADE_DUR, 1.0) * 0.38;  // 은은하게 38%

        this._frozenFilter.uniforms.uTime     = elapsed * 0.001;
        this._frozenFilter.uniforms.uStrength = strength;

        this._frozenG.clear();
        // 반투명 아이스 틴트
        this._frozenG.beginFill(0x66bbff, 0.06 * (strength / 0.38));
        this._frozenG.drawRect(0, TL_Y - 1, W, TL_H + 4);
        this._frozenG.endFill();
        // 상하 라인
        this._frozenG.lineStyle(0.6, 0x99ccff, 0.35 * (strength / 0.38));
        this._frozenG.moveTo(0, TL_Y);
        this._frozenG.lineTo(W, TL_Y);
        this._frozenG.moveTo(0, TL_Y + TL_H + 2);
        this._frozenG.lineTo(W, TL_Y + TL_H + 2);
        this._frozenG.lineStyle(0);
        // 눈결정 3개 (양 끝 + 중앙)
        const ratio = strength / 0.38;
        _drawSnowflake(this._frozenG, START_X + 12,           CAP_Y + CAP_H / 2, 4, 0x99ccff, 0.30 * ratio);
        _drawSnowflake(this._frozenG, START_X + TOTAL_W / 2,  CAP_Y + CAP_H / 2, 5, 0xaaddff, 0.35 * ratio);
        _drawSnowflake(this._frozenG, START_X + TOTAL_W - 12, CAP_Y + CAP_H / 2, 4, 0x99ccff, 0.30 * ratio);

        this._frozenTxt.alpha = 0.65 * (strength / 0.38);

        requestAnimationFrame(this._frozenTick);
      };
      requestAnimationFrame(this._frozenTick);

    } else if (!active && this._frozenFilter) {
      // ── 페이드아웃 후 해제 ───────────────────────────────
      const filter = this._frozenFilter;
      const g      = this._frozenG;
      const txt    = this._frozenTxt;
      this._frozenFilter = null;
      this._frozenTick   = null;

      const FADE_DUR = 300;
      const startT   = Date.now();
      const fade = () => {
        const t = Math.min((Date.now() - startT) / FADE_DUR, 1.0);
        const s = 0.38 * (1.0 - t);
        filter.uniforms.uTime     = Date.now() * 0.001;
        filter.uniforms.uStrength = s;
        if (g.parent) {
          g.clear();
          g.beginFill(0x66bbff, 0.06 * (1 - t));
          g.drawRect(0, TL_Y - 1, W, TL_H + 4);
          g.endFill();
        }
        if (txt.parent) txt.alpha = 0.65 * (1 - t);

        if (t < 1.0) {
          requestAnimationFrame(fade);
        } else {
          this.container.filters = null;
          g.parent?.removeChild(g);   g.destroy();
          txt.parent?.removeChild(txt); txt.destroy();
        }
      };
      requestAnimationFrame(fade);
    }
  }

  // ── 턴 종료 스크롤 연출 ──────────────────────────────
  /**
   * T+1이 왼쪽으로 퇴장, 나머지 좌이동, 새 T+4가 오른쪽에서 진입
   * @param {object[]} newQueue  - roll 후 새 큐 [T+1…T+4]
   * @param {function} onDone
   */
  scroll(newQueue, onDone) {
    this._revealBonus = 0;   // 턴 종료 시 공개 보너스 초기화
    const DUR = 460;
    const t0  = Date.now();

    // 새 T+4 캡슐 (오른쪽 바깥에서 등장)
    const incoming = makeCap(3);
    incoming.ct.x = START_X + 4 * SLIDE;
    incoming.ct.y = CAP_Y;
    incoming.update(newQueue[3] ?? null, 3);
    this.container.addChild(incoming.ct);

    // 퇴장하는 T+1 — 페이드+좌 슬라이드
    const outgoing = this._caps[0];

    const easeOut  = t => 1 - Math.pow(1 - t, 3);
    const easeIn   = t => t * t;

    const LABEL_ALPHA = [1.0, 0.80, 0.58, 0.38];

    const tick = () => {
      const t   = Math.min((Date.now() - t0) / DUR, 1);
      const dx  = easeOut(t) * SLIDE;

      // 퇴장 캡슐: 왼쪽으로 + 페이드
      outgoing.ct.x = START_X - dx;
      outgoing.ct.alpha = Math.max(0, 1 - easeIn(t) * 2.5);

      // 기존 캡슐 1~3 : 왼쪽으로 슬라이드
      for (let i = 1; i < 4; i++) {
        this._caps[i].ct.x = START_X + i * SLIDE - dx;
      }

      // 신입 캡슐: 오른쪽에서 진입 + 페이드인
      incoming.ct.x     = START_X + 4 * SLIDE - dx;
      incoming.ct.alpha = Math.min(1, easeOut(t) * 1.8);

      // 턴 레이블도 같이 슬라이드 (0번 페이드아웃, 1~3 슬라이드)
      this._turnLabels[0].x     = START_X + CAP_W / 2 - dx;
      this._turnLabels[0].alpha = Math.max(0, 1 - easeIn(t) * 2.5) * LABEL_ALPHA[0];
      for (let i = 1; i < 4; i++) {
        this._turnLabels[i].x = START_X + i * SLIDE + CAP_W / 2 - dx;
      }

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // ── 완료 처리 ──────────────────────────────────
        this.container.removeChild(outgoing.ct);
        outgoing.ct.destroy({ children: true });
        this._caps.shift();
        this._caps.push(incoming);

        for (let i = 0; i < 4; i++) {
          this._caps[i].ct.x = START_X + i * SLIDE;
          this._caps[i].ct.alpha = 1;
          this._caps[i].update(newQueue[i] ?? null, i);
          // 레이블 위치·색 복원
          this._turnLabels[i].x     = START_X + i * SLIDE + CAP_W / 2;
          this._turnLabels[i].alpha = LABEL_ALPHA[i];
        }
        // T+1 레이블은 항상 goldHi로 강조
        this._turnLabels[0].style.fill = C.goldHi;
        this._turnLabels[0].style.fontSize = 6.5;
        onDone?.();
      }
    };
    requestAnimationFrame(tick);
  }

  // ── 해자 차단: 타임라인 얼림 전환 애니메이션 ──────────
  /**
   * 해자 차단 시: scroll() 대신 호출.
   * 얼음 쉐이더 + 결정 오버레이를 보여준 뒤 새 큐 상태로 전환.
   * @param {object[]} newQueue  - roll 후 새 큐 [T+1…T+4]
   * @param {function} onDone
   */
  freeze(newQueue, onDone) {
    this._revealBonus  = 0;   // 턴 종료 시 공개 보너스 초기화
    this._isFreezeAnim = true;

    // 기존 setFrozen 지속 효과가 있으면 즉시 제거 (freeze가 대신 처리)
    if (this._frozenFilter) {
      this.container.filters = null;
      this._frozenFilter = null;
      this._frozenTick   = null;
      this._frozenG?.parent?.removeChild(this._frozenG);
      this._frozenG?.destroy();
      this._frozenG = null;
      this._frozenTxt?.parent?.removeChild(this._frozenTxt);
      this._frozenTxt?.destroy();
      this._frozenTxt = null;
    }

    const DUR_IN   = 380;
    const DUR_HOLD = 750;
    const DUR_OUT  = 460;
    const TOTAL    = DUR_IN + DUR_HOLD + DUR_OUT;
    const t0       = Date.now();

    // ── 아이스 쉐이더 필터 ──────────────────────────────
    const iceFilter = new PIXI.Filter(null, ICE_FRAG);
    iceFilter.uniforms.uTime     = 0.0;
    iceFilter.uniforms.uStrength = 0.0;
    this.container.filters = [iceFilter];

    // ── 오버레이 그래픽 & 텍스트 ─────────────────────────
    const overlayG   = new PIXI.Graphics();
    const overlayTxt = new PIXI.Text('❄  해자 — 시장 이벤트 봉인', {
      fontFamily: 'Malgun Gothic, NanumGothic, sans-serif',
      fontSize:   8,
      fill:       0xd8f4ff,
      dropShadow: true,
      dropShadowColor:    0x003880,
      dropShadowDistance: 1,
    });
    overlayTxt.anchor.set(0.5, 0.5);
    overlayTxt.x = W / 2;
    overlayTxt.y = TL_Y + TL_H / 2;
    overlayTxt.alpha = 0;
    this.layer.addChild(overlayG, overlayTxt);

    const drawOverlay = (strength) => {
      overlayG.clear();
      if (strength <= 0.001) return;

      // 반투명 얼음 배경
      overlayG.beginFill(0x88ccff, 0.13 * strength);
      overlayG.drawRect(0, TL_Y - 1, W, TL_H + 4);
      overlayG.endFill();

      // 가장자리 반짝 라인
      overlayG.lineStyle(0.8, 0xbbdeff, 0.55 * strength);
      overlayG.moveTo(0, TL_Y); overlayG.lineTo(W, TL_Y);
      overlayG.moveTo(0, TL_Y + TL_H + 2); overlayG.lineTo(W, TL_Y + TL_H + 2);
      overlayG.lineStyle(0);

      // 스노우플레이크 결정들
      const pts = [
        [START_X + 18,            CAP_Y + CAP_H / 2, 5],
        [START_X + TOTAL_W * 0.5, CAP_Y + CAP_H / 2, 7],
        [START_X + TOTAL_W - 18,  CAP_Y + CAP_H / 2, 5],
        [START_X + TOTAL_W * 0.27, TL_Y + 5,         3],
        [START_X + TOTAL_W * 0.73, TL_Y + 5,         3],
      ];
      for (const [cx, cy, r] of pts) {
        _drawSnowflake(overlayG, cx, cy, r, 0xaaddff, 0.50 * strength);
      }
      overlayTxt.alpha = strength;
    };

    const easeOut = t => 1 - (1 - t) ** 3;
    const easeIn  = t => t * t;

    const tick = () => {
      const elapsed = Date.now() - t0;
      let strength;
      if      (elapsed < DUR_IN)                     strength = easeOut(elapsed / DUR_IN);
      else if (elapsed < DUR_IN + DUR_HOLD)          strength = 1.0;
      else {
        const p = (elapsed - DUR_IN - DUR_HOLD) / DUR_OUT;
        strength = easeIn(1.0 - Math.min(p, 1.0));
      }
      strength = Math.max(0, Math.min(1, strength));

      iceFilter.uniforms.uTime     = elapsed * 0.001;
      iceFilter.uniforms.uStrength = strength;
      drawOverlay(strength);

      if (elapsed < TOTAL) {
        requestAnimationFrame(tick);
      } else {
        // ── 정리 & 새 큐 상태 반영 ──────────────────────
        this.container.filters = null;
        overlayG.parent?.removeChild(overlayG);   overlayG.destroy();
        overlayTxt.parent?.removeChild(overlayTxt); overlayTxt.destroy();
        this._isFreezeAnim = false;
        this.refresh(newQueue);
        onDone?.();
      }
    };
    requestAnimationFrame(tick);
  }

  // ── 정리 ──────────────────────────────────────────────
  destroy() {
    // 지속 아이스 효과 정리
    this._frozenFilter = null;
    this._frozenTick   = null;
    this._frozenG?.parent?.removeChild(this._frozenG);
    this._frozenG?.destroy();
    this._frozenTxt?.parent?.removeChild(this._frozenTxt);
    this._frozenTxt?.destroy();

    if (this._panelG?.parent) this._panelG.parent.removeChild(this._panelG);
    this._panelG?.destroy();
    if (this._maskG?.parent) this._maskG.parent.removeChild(this._maskG);
    this._maskG?.destroy();
    this.layer.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
