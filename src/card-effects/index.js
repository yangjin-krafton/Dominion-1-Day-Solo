// ============================================================
// card-effects/index.js — 카드 효과 핸들러 레지스트리
//
// ★ 새 카드 효과 추가 방법 (3단계):
//   1. card-effects/<cardId>.js 파일 생성
//      export function handle<CardId>(pd, ctx) { ... }
//   2. 아래 import 추가
//   3. EFFECT_HANDLERS Map에 등록
//
// 핸들러 시그니처: (pd: PendingState, ctx: EffectContext) => void
//   pd  — gs.pending* 에 담긴 데이터 (type 포함)
//   ctx — { gs, lUI, makeCard, sync, drawCardsVisual }
// ============================================================

import { handleGain }       from './gain.js';
import { handleCellar }     from './cellar.js';
import { handleChapel }     from './chapel.js';
import { handleMoneylender } from './moneylender.js';
import { handlePoacher }    from './poacher.js';
import { handleHarbinger }  from './harbinger.js';
import { handleThroneRoom, handleThroneRoomSecond } from './throne_room.js';
import { handleRemodel }    from './remodel.js';
import { handleMine }       from './mine.js';
import { handleArtisan }    from './artisan.js';
import { handleVassal }     from './vassal.js';
import { handleBureaucrat } from './bureaucrat.js';
import { handleMilitia }    from './militia.js';

/**
 * 카드 type → 핸들러 함수 Map
 * 키: pd.type (또는 pendingGain의 경우 'gain')
 */
export const EFFECT_HANDLERS = new Map([
  // ── 카드 획득 ───────────────────────────────────────────
  ['gain',        handleGain],
  ['bureaucrat',  handleBureaucrat],
  ['militia',     handleMilitia],

  // ── 버리기 ──────────────────────────────────────────────
  ['cellar',      handleCellar],
  ['poacher',     handlePoacher],

  // ── 폐기 ────────────────────────────────────────────────
  ['chapel',      handleChapel],
  ['moneylender', handleMoneylender],

  // ── 단일 선택 ───────────────────────────────────────────
  ['harbinger',   handleHarbinger],
  ['throne_room',        handleThroneRoom],
  ['throne_room_second', handleThroneRoomSecond],
  ['vassal',             handleVassal],

  // ── 2단계 효과 ──────────────────────────────────────────
  ['remodel',     handleRemodel],
  ['mine',        handleMine],
  ['artisan',     handleArtisan],
]);
