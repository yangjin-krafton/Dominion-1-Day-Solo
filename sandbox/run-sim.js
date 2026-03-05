#!/usr/bin/env node
// ============================================================
// sandbox/run-sim.js — LLM 게임 시뮬레이션 CLI 진입점
//
// 실제 게임과 동일한 환경 (buildMarketSetup, 서브시드 분리)
//
// 옵션:
//   --model <id>        모델 ID (기본: qwen/qwen3.5-35b-a3b)
//   --url <url>         LM Studio URL (기본: http://100.66.65.124:1234)
//   --seed <number>     게임 시드 (미지정 시 랜덤 생성)
//   --vp <n>            목표 승점 직접 지정 (미지정 시 시드 기반 10~20 자동)
//   --wins <n>          누적 승리수 — 언락 카드 범위 (기본: 0)
//   --count <n>         연속 실행 횟수 (기본: 1)
//   --verbose           상세 로그 출력
//   --ranking           저장된 랭킹 출력 후 종료
//   --temp <n>          LLM temperature (기본: 0.3)
//
// 예시:
//   node sandbox/run-sim.js --verbose
//   node sandbox/run-sim.js --seed 42
//   node sandbox/run-sim.js --count 3 --wins 10
//   node sandbox/run-sim.js --model "llama3.1:8b" --url "http://localhost:11434"
// ============================================================

import { LLMAdapter } from './sim/LLMAdapter.js';
import { SimRunner   } from './sim/SimRunner.js';
import { SimStorage  } from './sim/SimStorage.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--model':   args.model       = argv[++i]; break;
      case '--url':     args.url         = argv[++i]; break;
      case '--seed':    args.gameSeed    = parseInt(argv[++i], 10); break;
      case '--vp':      args.vp          = parseInt(argv[++i], 10); break;
      case '--wins':    args.wins        = parseInt(argv[++i], 10); break;
      case '--count':     args.count     = parseInt(argv[++i], 10); break;
      case '--max-turns': args.maxTurns  = parseInt(argv[++i], 10); break;
      case '--verbose':   args.verbose   = true; break;
      case '--ranking': args.showRanking = true; break;
      case '--temp':    args.temp        = parseFloat(argv[++i]); break;
    }
  }
  return args;
}

async function main() {
  const args    = parseArgs(process.argv.slice(2));
  const storage = new SimStorage();

  if (args.showRanking) {
    storage.printRanking(20);
    process.exit(0);
  }

  const llmAdapter = new LLMAdapter({
    baseURL:     args.url   ?? 'http://100.66.65.124:1234',
    model:       args.model ?? 'qwen/qwen3.5-35b-a3b',
    temperature: args.temp  ?? 0.3,
    timeoutMs:   60_000,
  });

  const count   = args.count ?? 1;
  const results = [];

  for (let i = 0; i < count; i++) {
    if (count > 1) {
      console.log(`\n${'▓'.repeat(40)}\n  게임 ${i + 1} / ${count}\n${'▓'.repeat(40)}`);
    }

    const runner = new SimRunner({
      llmAdapter,
      gameSeed:         args.gameSeed  ?? null,
      wins:             args.wins      ?? 0,
      vpTargetOverride: args.vp        ?? null,   // null → 시드 기반 10~20 자동
      maxTurns:         args.maxTurns  ?? 30,
      verbose:          args.verbose   ?? false,
      storage,
    });

    try {
      results.push(await runner.run());
    } catch (err) {
      console.error(`[run-sim] 게임 ${i + 1} 오류:`, err.message);
      if (args.verbose) console.error(err.stack);
    }
  }

  if (count > 1 && results.length > 0) {
    const won      = results.filter(r => r.victory?.won).length;
    const avgTurns = (results.reduce((s, r) => s + r.turns,    0) / results.length).toFixed(1);
    const avgVp    = (results.reduce((s, r) => s + r.vp,       0) / results.length).toFixed(1);
    const avgCalls = (results.reduce((s, r) => s + r.llmCalls, 0) / results.length).toFixed(0);
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${count}회 실행 요약`);
    console.log(`  승리: ${won}/${results.length} | 평균 턴: ${avgTurns} | 평균 승점: ${avgVp}`);
    console.log(`  평균 LLM 호출: ${avgCalls}회`);
    console.log('═'.repeat(60));
  }

  storage.printRanking(10);
}

main().catch(err => {
  console.error('[run-sim] 치명적 오류:', err);
  process.exit(1);
});
