// ============================================================
// sim/SimStorage.js — 파일 기반 시뮬레이션 결과 저장소
//
// 저장 위치:
//   - 게임별 raw JSON : sim-results/raw/YYYY-MM-DD_HH-MM-SS_{seed}.json  (git 제외)
//   - 통합 랭킹       : sim-results/ranking.json                          (git 관리)
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, '../../sim-results');
const RAW_DIR     = resolve(RESULTS_DIR, 'raw');          // git 제외 폴더
const RANKING_FILE = resolve(RESULTS_DIR, 'ranking.json'); // git 관리

export class SimStorage {
  constructor() {
    mkdirSync(RAW_DIR, { recursive: true }); // raw 포함 전체 경로 생성
  }

  /**
   * 게임 결과 저장
   * @param {object} result - SimRunner.run()의 반환값
   */
  async save(result) {
    const ts = new Date().toISOString()
      .replace('T', '_')
      .replace(/:/g, '-')
      .slice(0, 19);
    const filename = `${ts}_seed${result.seed}.json`;
    const filepath = resolve(RAW_DIR, filename);           // raw/ 서브폴더에 저장

    writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`[SimStorage] raw 저장: raw/${filename}`);

    // 랭킹 업데이트
    this._updateRanking(result);

    return filepath;
  }

  // ── 랭킹 관리 ────────────────────────────────────────────

  _loadRanking() {
    if (!existsSync(RANKING_FILE)) return [];
    try {
      return JSON.parse(readFileSync(RANKING_FILE, 'utf-8'));
    } catch {
      return [];
    }
  }

  _updateRanking(result) {
    const ranking = this._loadRanking();

    ranking.push({
      id:          Date.now(),
      date:        new Date().toISOString().split('T')[0],
      player:      result.displayName ?? result.persona ?? result.model,   // 랭킹 표시 이름
      persona:     result.persona,
      model:       result.model,
      seed:        result.seed,
      turns:       result.turns,
      vp:          result.vp,
      targetVp:    result.targetVp,
      won:         result.victory?.won ?? false,
      reason:      result.victory?.reason,
      totalBuys:   result.totalBuys,
      totalPlays:  result.totalPlays,
      llmCalls:    result.llmCalls,
      durationSec: result.durationSec,
      kingdom:     result.kingdom,
    });

    // 정렬: 승리 우선 → 턴수 낮을수록 상위
    ranking.sort((a, b) => {
      if (a.won !== b.won) return b.won - a.won;
      return a.turns - b.turns || a.totalBuys - b.totalBuys;
    });

    // 최대 500개 유지
    if (ranking.length > 500) ranking.splice(500);

    writeFileSync(RANKING_FILE, JSON.stringify(ranking, null, 2), 'utf-8');
    console.log(`[SimStorage] 랭킹 업데이트 완료 (총 ${ranking.length}개)`);
  }

  /** 상위 N개 랭킹 반환 */
  getTopRanking(limit = 20) {
    return this._loadRanking().slice(0, limit);
  }

  /** 랭킹 출력 */
  printRanking(limit = 10) {
    const ranking = this.getTopRanking(limit);
    if (ranking.length === 0) {
      console.log('[랭킹] 기록 없음');
      return;
    }

    const W = 76;
    console.log('\n' + '─'.repeat(W));
    console.log('  🏆  도미니언 LLM 시뮬레이션 명예의 전당');
    console.log('─'.repeat(W));
    console.log('  순위 | 날짜       | 플레이어           | 턴  | 승점 | 호출  | 결과');
    console.log('─'.repeat(W));
    ranking.forEach((r, i) => {
      const rank   = String(i + 1).padStart(4);
      const player = (r.player ?? r.model).slice(0, 18).padEnd(18);
      const turns  = String(r.turns).padStart(3);
      const vp     = String(r.vp).padStart(3);
      const calls  = String(r.llmCalls ?? '?').padStart(5);
      const won    = r.won ? '✓ 승리' : '✗ 미완';
      const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      console.log(`  ${medal}${rank} | ${r.date} | ${player} | ${turns} | ${vp} | ${calls} | ${won}`);
    });
    console.log('─'.repeat(W));
  }
}
