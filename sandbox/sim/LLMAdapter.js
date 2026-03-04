// ============================================================
// sim/LLMAdapter.js — 모델 교체 가능한 LLM 인터페이스
//
// OpenAI 호환 API (LM Studio, Ollama, OpenAI, Together 등) 지원
// 모델 교체: new LLMAdapter({ baseURL: '...', model: '...' })
// ============================================================

// ── 모델별 캐릭터 닉네임 ────────────────────────────────────
// 모델 ID 키워드 매칭 → 랭킹에 표시될 고유 이름
// 재치 포인트: 모델 특성/출신을 빗댄 도미니언 귀족 이름
const MODEL_PERSONAS = [
  // Qwen 계열 (중국 알리바바) — 동양 황제/상인 테마
  { match: /qwen.*35b/i,   name: '취안 대상인',     emoji: '🐉' },
  { match: /qwen.*7b/i,    name: '취안 견습생',     emoji: '🐲' },
  { match: /qwen.*14b/i,   name: '취안 길드장',     emoji: '🏮' },
  { match: /qwen.*72b/i,   name: '취안 황제',       emoji: '👑' },
  { match: /qwen/i,        name: '취안 여행자',     emoji: '🎋' },

  // Llama 계열 (Meta) — 아메리카 탐험가 테마
  { match: /llama.*3.*70b/i, name: '라마 정복자',   emoji: '🦙' },
  { match: /llama.*3.*8b/i,  name: '라마 초병',     emoji: '⚔️' },
  { match: /llama.*3/i,      name: '라마 모험가',   emoji: '🗺️' },
  { match: /llama/i,         name: '라마 유랑자',   emoji: '🏕️' },

  // DeepSeek 계열 (중국) — 심해 탐험 테마
  { match: /deepseek.*r1/i,  name: '심해경 추론공',  emoji: '🦑' },
  { match: /deepseek/i,      name: '심해경 탐험가',  emoji: '🌊' },

  // Mistral 계열 (프랑스) — 귀족 테마
  { match: /mixtral/i,       name: '믹스트랄 공작',  emoji: '⚜️' },
  { match: /mistral.*7b/i,   name: '미스트랄 기사',  emoji: '🗡️' },
  { match: /mistral/i,       name: '미스트랄 남작',  emoji: '🏰' },

  // Gemma 계열 (Google) — 보석/연금술사 테마
  { match: /gemma.*9b/i,     name: '젬마 연금술사',  emoji: '💎' },
  { match: /gemma/i,         name: '젬마 보석상',    emoji: '💍' },

  // GPT 계열 (OpenAI)
  { match: /gpt-4o/i,        name: '포 황태자',      emoji: '🤴' },
  { match: /gpt-4/i,         name: '포 대왕',        emoji: '👑' },
  { match: /gpt-3\.5/i,      name: '포 상인',        emoji: '💰' },
  { match: /gpt/i,           name: '포 여행자',      emoji: '🎩' },

  // Claude 계열 (Anthropic)
  { match: /claude.*opus/i,  name: '클로드 현자',    emoji: '🦉' },
  { match: /claude.*sonnet/i,name: '클로드 시인',    emoji: '📜' },
  { match: /claude.*haiku/i, name: '클로드 선승',    emoji: '🌸' },
  { match: /claude/i,        name: '클로드 귀족',    emoji: '🎭' },

  // Phi 계열 (Microsoft) — 학자 테마
  { match: /phi-?3/i,        name: '파이 학자',      emoji: '📚' },
  { match: /phi/i,           name: '파이 서기관',    emoji: '✒️' },

  // Solar 계열 (Upstage)
  { match: /solar/i,         name: '솔라 태양사',    emoji: '☀️' },
];

/**
 * 모델 ID → 닉네임 + 이모지 반환
 * @param {string} model - 모델 ID
 * @returns {{ name: string, emoji: string, displayName: string }}
 */
export function resolvePersona(model) {
  for (const { match, name, emoji } of MODEL_PERSONAS) {
    if (match.test(model)) {
      return { name, emoji, displayName: `${emoji} ${name}` };
    }
  }
  // 매칭 없을 때 모델 ID 마지막 부분으로 생성
  const fallback = model.split('/').pop().split(':')[0].slice(0, 12);
  return { name: fallback, emoji: '🃏', displayName: `🃏 ${fallback}` };
}

// ── LLMAdapter 클래스 ────────────────────────────────────────

export class LLMAdapter {
  /**
   * @param {object} config
   * @param {string} config.baseURL    - API 베이스 URL (e.g. 'http://100.66.65.124:1234')
   * @param {string} config.model      - 모델 ID (e.g. 'qwen/qwen3.5-35b-a3b')
   * @param {string} [config.apiKey]   - API 키 (LM Studio는 아무 값이나 가능)
   * @param {number} [config.temperature] - 기본 0.3 (전략적 일관성 우선)
   * @param {number} [config.maxTokens]   - 최대 토큰 수
   * @param {number} [config.timeoutMs]   - 요청 타임아웃 ms (기본 30초)
   */
  constructor({
    baseURL,
    model,
    apiKey = 'local',
    temperature = 0.3,
    maxTokens = 512,
    timeoutMs = 30_000,
  }) {
    this.baseURL     = baseURL.replace(/\/$/, '');
    this.model       = model;
    this.apiKey      = apiKey;
    this.temperature = temperature;
    this.maxTokens   = maxTokens;
    this.timeoutMs   = timeoutMs;
    this.persona     = resolvePersona(model);

    console.log(`[LLMAdapter] ${this.persona.displayName} (${model}) @ ${this.baseURL}`);
  }

  /**
   * LLM에 메시지 전송 → 텍스트 응답 반환
   * @param {string} systemPrompt - 시스템 프롬프트 (규칙/역할 지시)
   * @param {string} userPrompt   - 유저 프롬프트 (현재 게임 상태)
   * @returns {Promise<string>}   - LLM 응답 텍스트
   */
  async chat(systemPrompt, userPrompt) {
    const body = {
      model:       this.model,
      temperature: this.temperature,
      max_tokens:  this.maxTokens,
      messages: [
        { role: 'system',    content: systemPrompt },
        { role: 'user',      content: userPrompt   },
        // assistant 프리픽스: 모델이 { 로 시작하는 JSON을 바로 출력하도록 유도
        // (Thinking Process 등 불필요한 텍스트 억제)
        { role: 'assistant', content: '{'          },
      ],
      // LM Studio: 'text' 사용 (json_object 미지원)
      response_format: { type: 'text' },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body:   JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error(`[LLMAdapter] 타임아웃: ${this.timeoutMs}ms 초과`);
      throw new Error(`[LLMAdapter] 네트워크 오류: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`[LLMAdapter] API 오류 ${response.status}: ${text}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content === undefined || content === null) throw new Error('[LLMAdapter] 응답에 content 없음');

    // assistant 프리픽스 '{' 를 앞에 붙여서 완전한 JSON으로 복원
    return '{' + content;
  }

  /** 모델 정보 요약 반환 */
  info() {
    return {
      model:       this.model,
      baseURL:     this.baseURL,
      persona:     this.persona.name,
      displayName: this.persona.displayName,
    };
  }
}
