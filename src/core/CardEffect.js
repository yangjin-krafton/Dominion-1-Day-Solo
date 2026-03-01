// ============================================================
// core/CardEffect.js — 효과 코드 파서 & 실행기
//
// effect_code 형식:  "token:n|token:n|..."
//   예) "draw:3"  /  "draw:1|action:2"  /  "action:2|buy:1|coin:2"
// ============================================================
import { EFFECT_REGISTRY } from '../data/effects.js';

/**
 * effect_code 문자열 → [{token, n}] 배열로 파싱
 * @param {string} code
 * @returns {{ token: string, n: number }[]}
 */
export function parseEffectCode(code) {
  if (!code || !code.trim()) return [];
  return code.split('|').map(part => {
    const [token, arg] = part.trim().split(':');
    return { token: token.trim(), n: arg ? parseInt(arg, 10) : 1 };
  });
}

/**
 * 카드 효과 실행
 * @param {object} def       - CardDef (effectCode 포함)
 * @param {object} gs        - GameState
 * @param {object} engine    - EngineAPI { drawCards, gainCard, ... }
 */
export function executeCardEffect(def, gs, engine) {
  const effects = parseEffectCode(def.effectCode);
  for (const { token, n } of effects) {
    const fn = EFFECT_REGISTRY.get(token);
    if (fn) {
      fn(gs, n, engine, def);
    } else {
      console.warn(`[CardEffect] 미등록 효과 토큰: "${token}" (카드: ${def.id})`);
    }
  }
}
