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
  if (!event || reveal >= 3) return PAL_HIDDEN;
  return PAL[event.type] ?? PAL_HIDDEN;
}

/**
 * 캡슐에 표시할 완성 한국어 문장 생성
 * reveal 0=완전공개, 1=수량숨김, 2=타입만, 3=완전숨김
 */
function capsuleFullText(event, reveal) {
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
    for (let i = 0; i < 4; i++) {
      this._caps[i]?.update(queue[i] ?? null, i);
    }
  }

  // ── 턴 종료 스크롤 연출 ──────────────────────────────
  /**
   * T+1이 왼쪽으로 퇴장, 나머지 좌이동, 새 T+4가 오른쪽에서 진입
   * @param {object[]} newQueue  - roll 후 새 큐 [T+1…T+4]
   * @param {function} onDone
   */
  scroll(newQueue, onDone) {
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

  // ── 정리 ──────────────────────────────────────────────
  destroy() {
    if (this._panelG?.parent) this._panelG.parent.removeChild(this._panelG);
    this._panelG?.destroy();
    if (this._maskG?.parent) this._maskG.parent.removeChild(this._maskG);
    this._maskG?.destroy();
    this.layer.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
