#!/usr/bin/env node
// ============================================================
// sandbox/run-sim.js — LLM 게임 시뮬레이션 CLI 진입점
//
// 사용법:
//   node sandbox/run-sim.js [옵션]
//
// 옵션:
//   --model <id>        모델 ID (기본: qwen/qwen3.5-35b-a3b)
//   --url <url>         LM Studio URL (기본: http://100.66.65.124:1234)
//   --seed <number>     게임 시드
//   --target-vp <n>     목표 승점 (기본: 18)
//   --kingdom <ids>     킹덤 카드 콤마 구분 (예: village,smithy,market,cellar,chapel,harbinger)
//   --count <n>         연속 실행 횟수 (기본: 1)
//   --verbose           상세 로그 출력
//   --ranking           저장된 랭킹 출력 후 종료
//   --temp <n>          LLM temperature (기본: 0.3)
//
// 예시:
//   node sandbox/run-sim.js --verbose
//   node sandbox/run-sim.js --model "llama3.1:8b" --url "http://localhost:11434" --count 3
//   node sandbox/run-sim.js --kingdom "village,smithy,market,cellar,chapel,harbinger" --seed 42
// ============================================================

import { LLMAdapter } from './sim/LLMAdapter.js';
import { SimRunner   } from './sim/SimRunner.js';
import { SimStorage  } from './sim/SimStorage.js';

// ── CLI 인자 파싱 ─────────────────────────────────────────

function parseArgs(argv) {
  const args = { kingdom: null };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--model':     args.model      = argv[++i]; break;
      case '--url':       args.url        = argv[++i]; break;
      case '--seed':      args.seed       = parseInt(argv[++i], 10); break;
      case '--target-vp': args.targetVp   = parseInt(argv[++i], 10); break;
      case '--kingdom':   args.kingdom    = argv[++i].split(',').map(s => s.trim()); break;
      case '--count':     args.count      = parseInt(argv[++i], 10); break;
      case '--verbose':   args.verbose    = true; break;
      case '--ranking':   args.showRanking = true; break;
      case '--temp':      args.temp       = parseFloat(argv[++i]); break;
    }
  }
  return args;
}

// ── 메인 ─────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const storage = new SimStorage();

  // 랭킹만 출력하고 종료
  if (args.showRanking) {
    storage.printRanking(20);
    process.exit(0);
  }

  // LLM 어댑터 설정 (모델 교체는 여기만 변경)
  const llmAdapter = new LLMAdapter({
    baseURL:     args.url         ?? 'http://100.66.65.124:1234',
    model:       args.model       ?? 'qwen/qwen3.5-35b-a3b',
    temperature: args.temp        ?? 0.3,
    timeoutMs:   60_000,
  });

  const count   = args.count ?? 1;
  const results = [];

  for (let i = 0; i < count; i++) {
    if (count > 1) {
      console.log(`\n${'▓'.repeat(40)}`);
      console.log(`  게임 ${i + 1} / ${count}`);
      console.log('▓'.repeat(40));
    }

    const runner = new SimRunner({
      llmAdapter,
      kingdomIds: args.kingdom,
      seed:       args.seed,
      targetVp:   args.targetVp ?? 18,
      verbose:    args.verbose  ?? false,
      storage,
    });

    try {
      const result = await runner.run();
      results.push(result);
    } catch (err) {
      console.error(`[run-sim] 게임 ${i + 1} 오류:`, err.message);
      if (args.verbose) console.error(err.stack);
    }
  }

  // 복수 게임 요약
  if (count > 1 && results.length > 0) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${count}회 실행 요약`);
    console.log('═'.repeat(60));
    const won = results.filter(r => r.victory?.won).length;
    const avgTurns = (results.reduce((s, r) => s + r.turns, 0) / results.length).toFixed(1);
    const avgVp    = (results.reduce((s, r) => s + r.vp, 0) / results.length).toFixed(1);
    const avgCalls = (results.reduce((s, r) => s + r.llmCalls, 0) / results.length).toFixed(0);
    console.log(`  승리: ${won} / ${results.length}`);
    console.log(`  평균 턴수: ${avgTurns} | 평균 승점: ${avgVp}`);
    console.log(`  평균 LLM 호출: ${avgCalls}회`);
    console.log('═'.repeat(60));
  }

  // 최종 랭킹 출력
  storage.printRanking(10);
}

main().catch(err => {
  console.error('[run-sim] 치명적 오류:', err);
  process.exit(1);
});
