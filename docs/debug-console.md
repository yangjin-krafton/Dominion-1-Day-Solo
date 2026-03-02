# 콘솔 디버그 API

브라우저 개발자 도구(F12) 콘솔에서 `window.Debug` 객체를 통해 사용합니다.
게임 화면 진입 후 `_cardMap` 로드가 완료되면 자동으로 활성화됩니다.

---

## 명령 목록

| 명령 | 설명 |
|---|---|
| `Debug.addCard(id, n=1)` | 덱 맨 위에 카드 n장 추가 |
| `Debug.addToHand(id, n=1)` | 핸드에 카드 n장 즉시 추가 (앞면) |
| `Debug.listCards()` | 전체 카드 ID·이름·비용 테이블 출력 |
| `Debug.setCoins(n)` | 코인 직접 세팅 |
| `Debug.setActions(n)` | 행동 수 직접 세팅 |
| `Debug.setBuys(n)` | 구매 수 직접 세팅 |
| `Debug.showState()` | 현재 게임 상태 요약 출력 |
| `Debug.drawAll()` | 덱 전체를 핸드로 드로우 |
| `Debug.help()` | 명령 목록 출력 |

### 사용 예시

```js
// 카드 테스트 세팅 — 스미스 3장을 덱에 넣고 즉시 드로우
Debug.addCard('smithy', 3)
Debug.drawAll()

// 비싼 카드 구매 테스트
Debug.setCoins(8)
Debug.setBuys(2)

// 핸드에 마녀 바로 추가
Debug.addToHand('witch')

// 현재 상태 확인
Debug.showState()
```

> 카드 ID를 모를 때: `Debug.listCards()` 또는 아래 테이블 참고

---

## 카드 전체 목록

### 기본 재화 / 승점 / 저주

| id | 이름 | 타입 | 비용 | 효과 |
|---|---|---|---|---|
| `copper` | 동 | 재물 | 0 | 코인 +1 |
| `silver` | 은 | 재물 | 3 | 코인 +2 |
| `gold` | 금 | 재물 | 6 | 코인 +3 |
| `estate` | 사유지 | 승점 | 2 | 승점 +1 |
| `duchy` | 공작령 | 승점 | 5 | 승점 +3 |
| `province` | 속주 | 승점 | 8 | 승점 +6 |
| `curse` | 저주 | 저주 | 0 | 승점 -1 |

### 킹덤 카드

| id | 이름 | 타입 | 비용 | 효과 요약 |
|---|---|---|---|---|
| `cellar` | 저장고 | 행동 | 2 | 행동 +1, 버린 수만큼 뽑기 |
| `chapel` | 예배당 | 행동 | 2 | 손 최대 4장 폐기 |
| `moat` | 해자 | 행동-반응 | 2 | 카드 +2, 버리면 시장 1턴 지연 |
| `harbinger` | 선구자 | 행동 | 3 | 카드+1 행동+1, 버린더미 맨위 덱위 |
| `merchant` | 상인 | 행동 | 3 | 카드+1 행동+1, 첫 은화 +1코인 |
| `vassal` | 신하 | 행동 | 3 | 코인 +2, 덱위 공개(액션은 플레이) |
| `village` | 마을 | 행동 | 3 | 카드 +1, 행동 +2 |
| `workshop` | 작업장 | 행동 | 3 | 비용 4 이하 1장 획득 |
| `bureaucrat` | 관료 | 행동-시장 | 4 | 은화 덱위 획득, 다음턴 시장 완전공개 |
| `gardens` | 정원 | 승점 | 4 | 덱 10장당 승점 +1 |
| `militia` | 민병대 | 행동-시장 | 4 | 코인 +2, 시장 소멸 수량 1감소 |
| `moneylender` | 대금업자 | 행동 | 4 | 동전 폐기 시 코인 +3 |
| `poacher` | 밀렵꾼 | 행동 | 4 | 카드+1 행동+1 코인+1, 빈더미만큼 버림 |
| `remodel` | 개조 | 행동 | 4 | 1장 폐기, 비용 +2까지 1장 획득 |
| `smithy` | 대장장이 | 행동 | 4 | 카드 +3 |
| `throne_room` | 알현실 | 행동 | 4 | 액션 1장을 두 번 플레이 |
| `bandit` | 노상강도 | 행동-시장 | 5 | 금화 획득, 3턴 소멸-1, 2턴 시장 공개 |
| `council_room` | 회의실 | 행동 | 5 | 카드 +4, 구매 +1 |
| `festival` | 축제 | 행동 | 5 | 행동 +2, 구매 +1, 코인 +2 |
| `laboratory` | 실험실 | 행동 | 5 | 카드 +2, 행동 +1 |
| `library` | 도서관 | 행동 | 5 | 손패 7장까지 뽑기(액션 제외 가능) |
| `market` | 시장 | 행동 | 5 | 카드+1 행동+1 구매+1 코인+1 |
| `mine` | 광산 | 행동 | 5 | 보물 폐기, 비용 +3까지 보물 손으로 |
| `sentry` | 보초병 | 행동 | 5 | 카드+1 행동+1, 덱위2장 정리 |
| `witch` | 마녀 | 행동-시장 | 5 | 카드 +2, 시장 3턴마다 빈턴 영구추가 |
| `artisan` | 장인 | 행동 | 6 | 비용 5 이하 획득, 손 1장 덱위 |

---

## 카드 효과 구현 현황

> 카드 효과 테스트 진행 시 이 테이블을 업데이트하세요.

| id | 이름 | effect_code | 구현 여부 | 비고 |
|---|---|---|---|---|
| `copper` | 동 | `coin:1` | ✅ | |
| `silver` | 은 | `coin:2` | ✅ | |
| `gold` | 금 | `coin:3` | ✅ | |
| `estate` | 사유지 | — | ✅ | 승점만 |
| `duchy` | 공작령 | — | ✅ | 승점만 |
| `province` | 속주 | — | ✅ | 승점만 |
| `curse` | 저주 | — | ✅ | 시장 이벤트 연계 |
| `cellar` | 저장고 | `action:1\|cellar` | ⬜ | |
| `chapel` | 예배당 | `chapel` | ⬜ | |
| `moat` | 해자 | `draw:2\|moat_market_delay` | ⬜ | |
| `harbinger` | 선구자 | `draw:1\|action:1\|harbinger` | ⬜ | |
| `merchant` | 상인 | `draw:1\|action:1\|merchant` | ⬜ | |
| `vassal` | 신하 | `coin:2\|vassal` | ⬜ | |
| `village` | 마을 | `draw:1\|action:2` | ✅ | |
| `workshop` | 작업장 | `workshop` | ✅ | |
| `bureaucrat` | 관료 | `bureaucrat_silver\|market_reveal:1` | ⬜ | |
| `gardens` | 정원 | — | ⬜ | 게임 종료 시 계산 필요 |
| `militia` | 민병대 | `coin:2\|market_reduce:1` | ⬜ | |
| `moneylender` | 대금업자 | `moneylender` | ⬜ | |
| `poacher` | 밀렵꾼 | `draw:1\|action:1\|coin:1\|poacher` | ⬜ | |
| `remodel` | 개조 | `remodel` | ⬜ | |
| `smithy` | 대장장이 | `draw:3` | ✅ | |
| `throne_room` | 알현실 | `throne_room` | ⬜ | |
| `bandit` | 노상강도 | `bandit_gold\|market_reduce:3\|market_reveal:2` | ⬜ | |
| `council_room` | 회의실 | `draw:4\|buy:1\|draw_others:1` | ⬜ | |
| `festival` | 축제 | `action:2\|buy:1\|coin:2` | ✅ | |
| `laboratory` | 실험실 | `draw:2\|action:1` | ✅ | |
| `library` | 도서관 | `library` | ⬜ | |
| `market` | 시장 | `draw:1\|action:1\|buy:1\|coin:1` | ✅ | |
| `mine` | 광산 | `mine` | ⬜ | |
| `sentry` | 보초병 | `draw:1\|action:1\|sentry` | ⬜ | |
| `witch` | 마녀 | `draw:2\|witch_market_blank` | ⬜ | |
| `artisan` | 장인 | `artisan` | ⬜ | |
