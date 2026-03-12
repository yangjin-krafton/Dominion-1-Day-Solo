# Dominion 1-Day Solo

도미니언을 모바일 감각의 솔로 덱빌딩 게임으로 다시 만든 프로토타입입니다.  
지금 이 저장소의 핵심은 "원작을 얼마나 그대로 옮겼는가"보다, **AI를 실제 플레이어와 테스트 도구로 붙였을 때 무엇이 작동했고 무엇이 남았는지**를 빠르게 검증한 데 있습니다.

> 비상업적 개인 학습/프로토타입 프로젝트입니다.  
> 원작 Dominion의 메커니즘을 연구용으로 변형해 다룹니다.

## 이 프로젝트가 현재 된 것

초기에는 "솔로용 도미니언 기획서"에 가까웠지만, 지금은 아래가 실제로 연결된 상태입니다.

- 브라우저에서 바로 플레이 가능한 솔로 카드게임
- 시드 기반 시장 구성과 시장 이벤트 타임라인
- 로컬 프로필, 승리 기반 카드 언락, 랭킹 저장
- 브라우저 안에서 실제 UI를 조작하는 LLM 자동 플레이어
- 같은 코어 룰을 재사용하는 헤드리스 시뮬레이터
- LLM이 자기 플레이를 리뷰하고 전략 문서를 갱신하는 장기 메모리 실험

즉, 이 저장소는 "게임 1개"라기보다 **게임 플레이어 + AI 플레이어 + AI 실험용 검증 환경**을 한 번에 묶은 프로토타입입니다.

## AI로 무엇을 시도했고, 결과가 어땠나

| 시도 | 구현 방식 | 성과 | 현재 한계 |
|---|---|---|---|
| 브라우저 내 LLM 자동 플레이 | [`src/llm/BrowserLLMPlayer.js`](/mnt/d/Weeks/Dominion-1-Day-Solo/src/llm/BrowserLLMPlayer.js) 가 실제 게임 상태를 읽고 `play`, `buy`, `end_turn`, `resolve`를 JSON으로 받아 UI 함수에 연결 | "게임 규칙을 읽고 실제 한 판을 굴리는 AI 플레이어"까지는 구현됨. 카드 선택, 구매, pending 처리까지 한 루프 안에서 동작 | OpenAI 호환 API 서버가 필요하고, 모델 응답 품질에 따라 흔들림이 있음 |
| 장기 메모리 기반 자기 개선 | [`src/llm/MemoryManager.js`](/mnt/d/Weeks/Dominion-1-Day-Solo/src/llm/MemoryManager.js) 가 게임 로그 저장, 리뷰 요청, `strategy.md` 갱신 수행 | 단발성 자동 플레이가 아니라, 최근 경기와 누적 전략 문서를 다음 게임 프롬프트에 다시 주입하는 구조가 만들어짐 | 정량 평가보다는 프롬프트 기반 개선이라, 실제로 얼마나 강해졌는지 자동 측정 대시보드는 아직 없음 |
| UI와 동일 규칙을 쓰는 헤드리스 시뮬레이션 | [`sandbox/sim/HeadlessEngine.js`](/mnt/d/Weeks/Dominion-1-Day-Solo/sandbox/sim/HeadlessEngine.js) 가 `src/core`를 직접 재사용 | 브라우저용 규칙과 실험용 시뮬레이터가 분리되지 않고 동기화됨. 룰 수정이 양쪽에 동시에 반영되는 구조가 가장 큰 성과 | 시작 덱 셔플 등 일부 랜덤은 완전 결정론보다 "실제 게임과 같은 구현"을 우선함 |
| LLM 출력 안정화 | [`sandbox/sim/agents/PlayerAgent.js`](/mnt/d/Weeks/Dominion-1-Day-Solo/sandbox/sim/agents/PlayerAgent.js), [`sandbox/sim/agents/GameMasterAgent.js`](/mnt/d/Weeks/Dominion-1-Day-Solo/sandbox/sim/agents/GameMasterAgent.js) 에서 JSON 파싱, 재시도, 규칙 검증, 폴백 전략 처리 | LLM이 이상한 답을 해도 즉시 게임이 깨지지 않고, 재시도 또는 Big Money 폴백으로 계속 굴릴 수 있게 됨 | 여전히 "좋은 플레이"를 보장하진 않음. 안정성 확보가 우선된 상태 |
| 모델 비교와 기록 누적 | [`sandbox/sim/LLMAdapter.js`](/mnt/d/Weeks/Dominion-1-Day-Solo/sandbox/sim/LLMAdapter.js), [`sandbox/sim/SimStorage.js`](/mnt/d/Weeks/Dominion-1-Day-Solo/sandbox/sim/SimStorage.js) 로 모델 교체와 랭킹 저장 지원 | LM Studio, Ollama, OpenAI 호환 엔드포인트 등으로 바꿔가며 플레이 결과를 남길 수 있음 | 벤치마크 규격은 아직 프로토타입 수준이라, 엄밀한 실험 프레임워크는 아님 |

핵심적으로, 이 프로젝트에서 AI는 "설명용 장식"이 아니라 아래 두 역할을 맡았습니다.

1. 실제 게임을 플레이하는 에이전트
2. 게임 밸런스와 전략을 반복 검증하는 실험 도구

## 실제 게임 프로토타입 범위

현재 코드 기준으로 플레이 가능한 범위는 아래에 가깝습니다.

- 390x844 모바일 화면 중심의 브라우저 UI
- 프로필 생성, 홈, 게임, 결과 화면 흐름
- 시드 번호와 목표 승점 표시
- 기본 카드 + CSV 기반 왕국 카드 로딩
- 승리 횟수에 따른 카드 언락
- 카드 도감과 결과 랭킹
- 시장 12슬롯 구성과 다음 이벤트 타임라인 표시
- 시장 간섭 카드 일부를 솔로용 규칙으로 재설계
- 효과 카드별 pending 선택 UI와 LLM 해석 루프
- 로컬 저장소 기반 기록 저장, 개발 서버에서는 파일 저장까지 지원

특히 시장 시스템은 원작의 공격 상호작용을 그대로 복제하기보다, **"혼자 해도 압박이 생기게 만드는 자동 시장"** 쪽으로 실험한 흔적이 가장 강합니다.

## 초기 기획과 지금 구현의 차이

초기 README의 기획과 실제 구현은 꽤 다릅니다. 중요한 차이만 정리하면 아래와 같습니다.

| 항목 | 초기 기획 | 현재 구현 |
|---|---|---|
| 시장 구성 | 6장 시장 중심 운영 | 실제 코드는 기본 6장 + 왕국 6장, 총 12슬롯 고정 표시 |
| 시장 이벤트 종류 | `vanish`, `drain`, `surge`, `skip` 등 복합 설계 | 현재 코드는 주로 `vanish`, `skip`, `curse_player` 중심으로 단순화 |
| 공유용 게임 코드 | `seed + ruleVersion + optionFlags` 인코딩 구상 | 현재는 시드를 화면에 표시하지만, 완전한 import/export 게임 코드 체계는 아직 아님 |
| 기록 제출 | 메일 제출, CSV/JSON export 구상 | 현재는 localStorage 저장과 dev server 파일 저장 쪽이 먼저 구현됨 |
| AI 활용 | 개발용 확장 아이디어 | 실제 브라우저 자동 플레이, 헤드리스 시뮬레이션, 장기 메모리까지 구현됨 |

정리하면, **기획 단계의 넓은 시스템 설계는 축소되거나 단순화되었고, 대신 AI 플레이와 검증 파이프라인은 예상보다 깊게 구현**됐습니다.

## 프로토타입 관점에서의 성과

- 게임 로직을 `src/core` 중심으로 모아 UI와 시뮬레이터가 같은 규칙을 공유하게 만든 점
- 카드 데이터를 CSV 기반으로 관리해 카드 추가/수정 비용을 낮춘 점
- LLM이 UI를 직접 조작하는 플레이어와, 같은 규칙을 쓰는 CLI 시뮬레이터를 둘 다 만든 점
- 게임 종료 후 리뷰와 전략 문서 갱신까지 연결해 "한 판 하고 끝"이 아닌 반복 실험 구조를 만든 점
- 프로필, 랭킹, 언락, 도감까지 붙여서 실험 결과가 그냥 로그가 아니라 게임 진행감으로 이어지게 만든 점

## 아직 남아 있는 한계

- AI 기능은 로컬 개발 서버와 별도 LLM 엔드포인트가 있어야 제대로 동작합니다
- 시장 시스템은 기획 대비 단순화된 상태라, 장기 밸런스 실험은 더 필요합니다
- 일부 문서는 현재 코드보다 오래되어 설명과 구현이 완전히 일치하지 않습니다
- 경쟁/리플레이/공유 코드 체계는 "구상"보다 "완성"에 아직 못 미칩니다

## 실행 방법

Node.js 환경이 있다고 가정합니다.

```bash
npm install
npm run dev
```

기본 개발 서버:

- 정적 파일 서빙
- `/llm-memory/*` 파일 API
- `/game-records` 기록 저장 API
- `/ranking` 통합 랭킹 API
- `/llm-proxy/*` 프록시

브라우저에서 게임을 연 뒤 콘솔에서 아래 명령으로 LLM 자동 플레이를 시험할 수 있습니다.

```js
dominion.llm.start()
dominion.llm.auto()
dominion.llm.stop()
dominion.llm.setModel('your-model')
dominion.llm.setUrl('http://localhost:1234')
```

헤드리스 시뮬레이션:

```bash
npm run sim
npm run sim:verbose
npm run sim:ranking
```

오디오 자산을 다시 만들 때:

```bash
npm run audio:regen
```

`ffmpeg`가 필요합니다.

## 폴더 가이드

- [`src/`](/mnt/d/Weeks/Dominion-1-Day-Solo/src): 실제 브라우저 게임
- [`src/core/`](/mnt/d/Weeks/Dominion-1-Day-Solo/src/core): UI와 시뮬레이터가 같이 쓰는 게임 코어
- [`src/llm/`](/mnt/d/Weeks/Dominion-1-Day-Solo/src/llm): 브라우저 자동 플레이와 장기 메모리
- [`sandbox/sim/`](/mnt/d/Weeks/Dominion-1-Day-Solo/sandbox/sim): 헤드리스 LLM 시뮬레이션
- [`docs/`](/mnt/d/Weeks/Dominion-1-Day-Solo/docs): 보조 문서

## 한 줄 요약

이 프로젝트의 현재 가치는 "도미니언 솔로 게임 기획서"보다, **같은 카드게임 코어 위에 AI 플레이어와 AI 실험 환경을 실제로 얹어본 프로토타입**이라는 데 있습니다.
