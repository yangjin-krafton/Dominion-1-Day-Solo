// ============================================================
// Card.js — Card 클래스 (Art-Nouveau 비주얼 · 모션 시스템)
// 모바일 전용: hover 없음, tap(click) / hold(long-press) 만 사용
// ============================================================
import { C, CARD_W as CW, CARD_H as CH, AREAS } from '../config.js';
import { buildFrontFace, buildBackFace } from './CardArt.js';
import * as CardDetail from './CardDetail.js';

export class Card {
  /**
   * @param {object} def     - CardDef
   * @param {number} id      - 고유 ID
   * @param {Function} onPlay - 탭 시 콜백 (main.js에서 주입)
   */
  constructor(def, id, onPlay) {
    this.def    = def;
    this.id     = id;
    this.onPlay = onPlay;
    this.area   = AREAS.DECK;
    this.isFaceUp = false;

    // ── 모션 상태 ────────────────────────────────────────────
    this.targetX        = 0;
    this.targetY        = 0;
    this.targetRotation = 0;
    this.targetScale    = 1;
    this.flipped        = false;   // flip 애니메이션 진행 중 플래그
    this._stackBadge    = null;    // 중첩 수량 배지 (lazy 생성)
    this._stackBadgeText = null;

    this.container = new PIXI.Container();
    this._build();
    this._bindEvents();
  }

  // ── 그래픽 구성 ───────────────────────────────────────────
  _build() {
    // 드롭 섀도
    const shadow = new PIXI.Graphics();
    shadow.beginFill(C.shadow, 0.45);
    shadow.drawRect(3, 3, CW, CH);
    shadow.endFill();
    this.container.addChild(shadow);

    // 뒷면 / 앞면
    this.backFace  = buildBackFace();
    this.frontFace = buildFrontFace(this.def);
    this.frontFace.visible = false;
    this.container.addChild(this.backFace, this.frontFace);
  }

  // ── 이벤트 바인딩 ─────────────────────────────────────────
  _bindEvents() {
    this.container.eventMode = 'static';
    this.container.cursor    = 'pointer';

    let _timer = null, _startX = 0, _startY = 0;
    const _cancel = () => { clearTimeout(_timer); _timer = null; };

    // 롱프레스 시작 (500ms → 상세 보기)
    this.container.on('pointerdown', (e) => {
      _startX = e.global.x; _startY = e.global.y;
      _timer = setTimeout(() => {
        _timer = null;
        CardDetail.show(this.def);
      }, 500);
    });

    // 이동 시 롱프레스 취소 (8px 임계값)
    this.container.on('pointermove', (e) => {
      if (!_timer) return;
      const dx = e.global.x - _startX, dy = e.global.y - _startY;
      if (dx * dx + dy * dy > 64) _cancel();
    });

    // 짧은 탭 → 카드 플레이
    this.container.on('pointerup', () => {
      if (_timer) {
        _cancel();
        if (this.area === AREAS.HAND && this.isFaceUp && this.onPlay) this.onPlay(this);
      }
    });
    this.container.on('pointerupoutside', _cancel);
  }

  // ── 공개 API ──────────────────────────────────────────────

  /** 목표 위치 설정 (lerp로 부드럽게 이동) */
  moveTo(x, y, rotation = 0, scale = 1) {
    this.targetX        = x;
    this.targetY        = y;
    this.targetRotation = rotation;
    this.targetScale    = scale;
  }

  /**
   * 카드 뒤집기 애니메이션
   * scaleX: 1 → 0 (중간에 face 교체) → 1
   *
   * this.flipped = true  → update()가 scale.x lerp 건드리지 않도록 차단
   * faceToggled (local)  → 면 교체를 정확히 1회만 수행
   */
  flip(duration = 0.3) {
    const startTime  = Date.now();
    const initScaleX = this.container.scale.x;
    this.flipped     = true;    // ← 시작부터 차단 (기존: false → 충돌 버그)
    let faceToggled  = false;

    const animate = () => {
      const t = Math.min((Date.now() - startTime) / 1000 / duration, 1);

      if (t < 0.5) {
        this.container.scale.x = initScaleX * (1 - t * 2);
      } else {
        if (!faceToggled) {
          this.isFaceUp          = !this.isFaceUp;
          this.frontFace.visible = this.isFaceUp;
          this.backFace.visible  = !this.isFaceUp;
          faceToggled            = true;
        }
        this.container.scale.x = initScaleX * ((t - 0.5) * 2);
      }

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.container.scale.x = initScaleX;
        this.flipped            = false;  // ← 애니메이션 종료 후 해제
      }
    };

    animate();
  }

  /**
   * 매 프레임 호출 — lerp 업데이트
   * @param {number} dt - 초 단위 델타타임
   */
  update(dt) {
    const s = Math.min(1, dt * 8);   // 부드럽기 계수

    // 위치 lerp
    this.container.x += (this.targetX - this.container.x) * s;
    this.container.y += (this.targetY - this.container.y) * s;

    // 회전 lerp
    this.container.rotation += (this.targetRotation - this.container.rotation) * s;

    // 스케일 lerp (flip 중에는 X 축 건드리지 않음)
    if (!this.flipped) {
      this.container.scale.x += (this.targetScale - this.container.scale.x) * s;
    }
    this.container.scale.y += (this.targetScale - this.container.scale.y) * s;
  }

  // ── 중첩 배지 ─────────────────────────────────────────────

  /**
   * 같은 카드 중첩 수량 배지 표시/갱신
   * n = 0 or 1 → 배지 숨김 / n ≥ 2 → "×N" 배지 표시
   */
  setStackCount(n) {
    if (n > 1 && this.area === AREAS.HAND) {
      if (!this._stackBadge) this._createStackBadge();
      this._stackBadgeText.text = `×${n}`;
      this._stackBadge.visible  = true;
    } else if (this._stackBadge) {
      this._stackBadge.visible = false;
    }
  }

  /** 수량 배지 초기 생성 (lazy) */
  _createStackBadge() {
    const BR = 11;
    const bg = new PIXI.Graphics();
    bg.lineStyle(1.5, C.dark, 1);
    bg.beginFill(C.gold); bg.drawCircle(0, 0, BR); bg.endFill();
    bg.lineStyle(0.8, C.dark, 0.4); bg.drawCircle(0, 0, BR - 3);

    this._stackBadgeText = new PIXI.Text('×1', {
      fontFamily: 'Georgia, serif', fontSize: 9,
      fontWeight: 'bold', fill: C.dark,
    });
    this._stackBadgeText.anchor.set(0.5);

    this._stackBadge = new PIXI.Container();
    this._stackBadge.addChild(bg, this._stackBadgeText);
    this._stackBadge.x = CW - 4;
    this._stackBadge.y = 4;
    this.container.addChild(this._stackBadge);
  }
}
