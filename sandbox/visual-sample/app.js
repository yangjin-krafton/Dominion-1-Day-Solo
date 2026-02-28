// 모바일 세로 화면 비율 (9:16)
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;

// 색상 정의
const COLORS = {
  background: 0x1a1a2e,
  header: 0x16213e,
  card: 0xf4f4f4,
  cardBack: 0x2c3e50,
  cardBorder: 0x333333,
  cardHover: 0xffe066,
  button: 0x4a90e2,
  buttonHover: 0x6ba3e8,
  text: 0xffffff,
  textDark: 0x333333,
  action: 0xffe066,
  treasure: 0xffd93d,
  victory: 0x95e1d3,
  supply: 0x2d3561,
};

// 카드 템플릿
const CARD_TEMPLATES = {
  copper: { name: 'Copper', cost: 0, color: COLORS.treasure, type: 'treasure' },
  silver: { name: 'Silver', cost: 3, color: COLORS.treasure, type: 'treasure' },
  gold: { name: 'Gold', cost: 6, color: COLORS.treasure, type: 'treasure' },
  estate: { name: 'Estate', cost: 2, color: COLORS.victory, type: 'victory' },
  duchy: { name: 'Duchy', cost: 5, color: COLORS.victory, type: 'victory' },
  province: { name: 'Province', cost: 8, color: COLORS.victory, type: 'victory' },
  smithy: { name: 'Smithy', cost: 4, color: COLORS.action, type: 'action' },
  village: { name: 'Village', cost: 3, color: COLORS.action, type: 'action' },
  market: { name: 'Market', cost: 5, color: COLORS.action, type: 'action' },
};

// 영역 정의
const AREAS = {
  DECK: 'deck',
  HAND: 'hand',
  PLAY: 'play',
  DISCARD: 'discard',
};

// 카드 클래스
class Card {
  constructor(template, id) {
    this.id = id;
    this.name = template.name;
    this.cost = template.cost;
    this.color = template.color;
    this.type = template.type;
    this.area = AREAS.DECK;

    this.container = new PIXI.Container();
    this.frontFace = null;
    this.backFace = null;
    this.borderGlow = null;
    this.isFaceUp = false;

    this.createGraphics();

    this.targetX = 0;
    this.targetY = 0;
    this.targetRotation = 0;
    this.targetScale = 1;
    this.hoverOffset = 0;
    this.targetHoverOffset = 0;
    this.isAnimating = false;
    this.glowTime = 0;
    this.hovered = false;
  }

  createGraphics() {
    const width = 60;
    const height = 90;

    // 그림자
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.3);
    shadow.drawRoundedRect(-width/2 + 2, -height/2 + 2, width, height, 5);
    shadow.endFill();
    this.container.addChild(shadow);

    // 테두리 글로우
    this.borderGlow = new PIXI.Graphics();
    this.container.addChild(this.borderGlow);

    // 뒷면
    this.backFace = new PIXI.Container();
    this.createBackFace(width, height);
    this.container.addChild(this.backFace);

    // 앞면
    this.frontFace = new PIXI.Container();
    this.createFrontFace(width, height);
    this.container.addChild(this.frontFace);

    // 초기 상태: 뒷면
    this.frontFace.visible = false;
    this.backFace.visible = true;

    // 인터랙티브 설정
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    this.container.on('pointerover', () => {
      if (this.area === AREAS.HAND && this.isFaceUp) {
        this.setHovered(true);
      }
    });

    this.container.on('pointerout', () => {
      this.setHovered(false);
    });

    this.container.on('pointerdown', () => {
      if (this.area === AREAS.HAND && this.isFaceUp) {
        playCard(this);
      }
    });
  }

  createBackFace(width, height) {
    const background = new PIXI.Graphics();
    background.beginFill(COLORS.cardBack);
    background.drawRoundedRect(-width/2, -height/2, width, height, 5);
    background.endFill();

    // 뒷면 패턴
    background.lineStyle(2, 0x34495e);
    for (let i = 0; i < 4; i++) {
      const y = -height/2 + (height / 3) * i;
      background.moveTo(-width/2 + 8, y);
      background.lineTo(width/2 - 8, y);
    }

    // 중앙 아이콘
    background.lineStyle(2, 0x5dade2);
    background.drawCircle(0, 0, 12);
    background.moveTo(-8, -8);
    background.lineTo(8, 8);
    background.moveTo(8, -8);
    background.lineTo(-8, 8);

    this.backFace.addChild(background);
  }

  createFrontFace(width, height) {
    // 카드 배경 (그라디언트)
    const background = new PIXI.Graphics();
    const gradientSteps = 15;
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const darkenFactor = 0.3 * ratio;

      const r = ((this.color >> 16) & 0xFF) * (1 - darkenFactor);
      const g = ((this.color >> 8) & 0xFF) * (1 - darkenFactor);
      const b = (this.color & 0xFF) * (1 - darkenFactor);

      const color = (r << 16) | (g << 8) | b;

      background.beginFill(color);
      background.drawRect(
        -width/2,
        -height/2 + (height / gradientSteps) * i,
        width,
        height / gradientSteps
      );
      background.endFill();
    }

    // 테두리
    background.lineStyle(2, this.lightenColor(this.color, 0.4));
    background.drawRoundedRect(-width/2, -height/2, width, height, 5);

    this.frontFace.addChild(background);

    // 카드 이름
    const nameText = new PIXI.Text(
      this.name,
      {
        fontFamily: 'Arial',
        fontSize: 10,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: width - 10,
      }
    );
    nameText.anchor.set(0.5);
    nameText.y = -height * 0.25;
    this.frontFace.addChild(nameText);

    // 코스트 표시
    if (this.cost > 0) {
      const costBadge = new PIXI.Graphics();
      costBadge.beginFill(0xffd700);
      costBadge.drawCircle(width * 0.3, -height * 0.35, 8);
      costBadge.endFill();
      costBadge.lineStyle(2, 0xb8860b);
      costBadge.drawCircle(width * 0.3, -height * 0.35, 8);
      this.frontFace.addChild(costBadge);

      const costText = new PIXI.Text(
        this.cost.toString(),
        {
          fontFamily: 'Arial',
          fontSize: 10,
          fontWeight: 'bold',
          fill: 0x000000,
        }
      );
      costText.anchor.set(0.5);
      costText.x = width * 0.3;
      costText.y = -height * 0.35;
      this.frontFace.addChild(costText);
    }

    // 타입 아이콘
    const typeIcon = new PIXI.Text(
      this.type === 'action' ? '⚡' : this.type === 'treasure' ? '💰' : '🏆',
      {
        fontFamily: 'Arial',
        fontSize: 16,
      }
    );
    typeIcon.anchor.set(0.5);
    typeIcon.y = height * 0.1;
    this.frontFace.addChild(typeIcon);
  }

  setHovered(hovered) {
    this.hovered = hovered;
    if (hovered) {
      this.targetScale = 1.15;
      this.targetHoverOffset = -20;
    } else {
      this.targetScale = 1.0;
      this.targetHoverOffset = 0;
    }
  }

  flip(duration = 0.3) {
    const startTime = Date.now();
    const startScaleX = this.container.scale.x;

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 0.5) {
        this.container.scale.x = startScaleX * (1 - progress * 2);
      } else {
        if (progress >= 0.5 && !this.flipped) {
          this.isFaceUp = !this.isFaceUp;
          this.frontFace.visible = this.isFaceUp;
          this.backFace.visible = !this.isFaceUp;
          this.flipped = true;
        }
        this.container.scale.x = startScaleX * ((progress - 0.5) * 2);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.container.scale.x = startScaleX;
        this.flipped = false;
      }
    };

    animate();
  }

  updateGlow(deltaTime) {
    if (!this.hovered) {
      this.borderGlow.clear();
      return;
    }

    this.glowTime += deltaTime * 3;
    const pulse = (Math.sin(this.glowTime) + 1) / 2;
    const glowAlpha = 0.3 + pulse * 0.5;
    const glowWidth = 2 + pulse * 2;

    this.borderGlow.clear();
    this.borderGlow.lineStyle(glowWidth, 0xffffff, glowAlpha);
    this.borderGlow.drawRoundedRect(-30, -45, 60, 90, 5);
  }

  update(deltaTime) {
    const smoothFactor = Math.min(1, deltaTime * 8);

    this.container.x += (this.targetX - this.container.x) * smoothFactor;
    this.container.y += (this.targetY + this.targetHoverOffset - this.container.y) * smoothFactor;
    this.container.rotation += (this.targetRotation - this.container.rotation) * smoothFactor;

    const targetScaleValue = this.targetScale;
    if (!this.flipped) {
      this.container.scale.x += (targetScaleValue - this.container.scale.x) * smoothFactor;
    }
    this.container.scale.y += (targetScaleValue - this.container.scale.y) * smoothFactor;

    this.hoverOffset += (this.targetHoverOffset - this.hoverOffset) * smoothFactor;

    this.updateGlow(deltaTime);
  }

  moveTo(x, y, rotation = 0, scale = 1) {
    this.targetX = x;
    this.targetY = y;
    this.targetRotation = rotation;
    this.targetScale = scale;
    this.isAnimating = true;
  }

  lightenColor(color, factor) {
    const r = Math.min(255, ((color >> 16) & 0xFF) * (1 + factor));
    const g = Math.min(255, ((color >> 8) & 0xFF) * (1 + factor));
    const b = Math.min(255, (color & 0xFF) * (1 + factor));
    return (r << 16) | (g << 8) | b;
  }
}

// 게임 상태
const gameState = {
  turn: 1,
  vp: 3,
  deckSize: 10,
  discardSize: 0,
  actions: 1,
  buys: 1,
  coins: 0,

  deck: [],
  hand: [],
  play: [],
  discard: [],
  cardIdCounter: 0,
};

// PixiJS 앱 초기화 (v7 방식)
const app = new PIXI.Application({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: COLORS.background,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

let lastTime = performance.now();
const cardsContainer = new PIXI.Container();
const uiContainer = new PIXI.Container();

// 앱 초기화 및 설정
function init() {
  document.querySelector('#game-container').appendChild(app.view);

  app.stage.addChild(cardsContainer);
  app.stage.addChild(uiContainer);

  cardsContainer.sortableChildren = true;

  // UI 구성 요소 생성
  createHeader();
  createResourceArea();
  createEndTurnButton();

  // 게임 초기화
  initGame();

  // 렌더링 시작
  app.ticker.add(render);
}

// 게임 초기화
function initGame() {
  gameState.deck = [];
  gameState.hand = [];
  gameState.play = [];
  gameState.discard = [];
  gameState.cardIdCounter = 0;

  // 초기 덱 생성 (Copper 7장 + Estate 3장)
  for (let i = 0; i < 7; i++) {
    const card = new Card(CARD_TEMPLATES.copper, gameState.cardIdCounter++);
    gameState.deck.push(card);
    cardsContainer.addChild(card.container);
  }
  for (let i = 0; i < 3; i++) {
    const card = new Card(CARD_TEMPLATES.estate, gameState.cardIdCounter++);
    gameState.deck.push(card);
    cardsContainer.addChild(card.container);
  }

  shuffleDeck(false);
  updateCardPositions();

  // 초기 5장 드로우
  setTimeout(() => drawCards(5), 500);
}

// 카드 위치 업데이트
function updateCardPositions() {
  const { deck, hand, play, discard } = gameState;

  // 덱 위치 (좌상단)
  const deckX = 60;
  const deckY = 150;
  deck.forEach((card, i) => {
    card.area = AREAS.DECK;
    const stackOffset = Math.min(i * 0.3, 5);
    card.moveTo(deckX + stackOffset, deckY + stackOffset, 0, 0.8);
    card.container.zIndex = i;
  });

  // 손패 (하단)
  const handY = SCREEN_HEIGHT - 140;
  const handSpacing = Math.min(65, 300 / Math.max(1, hand.length));
  const handStartX = SCREEN_WIDTH / 2 - (handSpacing * (hand.length - 1)) / 2;

  hand.forEach((card, i) => {
    card.area = AREAS.HAND;
    const angle = (i - (hand.length - 1) / 2) * 0.04;
    const yOffset = Math.abs(i - (hand.length - 1) / 2) * 3;

    card.moveTo(
      handStartX + i * handSpacing,
      handY + yOffset,
      angle,
      card.hovered ? 1.15 : 1
    );
    card.container.zIndex = 100 + i;
  });

  // 플레이 영역 (중앙)
  const playY = SCREEN_HEIGHT / 2 - 20;
  const playSpacing = 65;
  const playStartX = SCREEN_WIDTH / 2 - (playSpacing * (play.length - 1)) / 2;

  play.forEach((card, i) => {
    card.area = AREAS.PLAY;
    card.moveTo(playStartX + i * playSpacing, playY, 0, 1);
    card.container.zIndex = 50 + i;
  });

  // 버림 더미 (우상단)
  const discardX = SCREEN_WIDTH - 60;
  const discardY = 150;
  discard.forEach((card, i) => {
    card.area = AREAS.DISCARD;
    const stackOffset = Math.min(i * 0.3, 5);
    const randomRotation = (Math.random() - 0.5) * 0.1;
    card.moveTo(
      discardX + stackOffset,
      discardY + stackOffset,
      randomRotation,
      0.8
    );
    card.container.zIndex = 20 + i;
  });

  cardsContainer.sortChildren();
  updateGameState();
}

// 게임 상태 UI 업데이트
function updateGameState() {
  gameState.deckSize = gameState.deck.length;
  gameState.discardSize = gameState.discard.length;
}

// 1. 상단 헤더 생성
function createHeader() {
  const header = new PIXI.Container();
  header.y = 20;

  // 배경
  const bg = new PIXI.Graphics();
  bg.beginFill(COLORS.header);
  bg.drawRect(10, 0, SCREEN_WIDTH - 20, 80);
  bg.endFill();
  header.addChild(bg);

  // 턴 수 & VP
  const turnText = new PIXI.Text(
    `턴 ${gameState.turn} | VP ${gameState.vp}`,
    {
      fontFamily: 'Arial',
      fontSize: 24,
      fontWeight: 'bold',
      fill: COLORS.text,
    }
  );
  turnText.x = 20;
  turnText.y = 15;
  header.addChild(turnText);

  // 덱 상태
  const deckText = new PIXI.Text(
    `덱 ${gameState.deckSize} | 버림 ${gameState.discardSize}`,
    {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0xaaaaaa,
    }
  );
  deckText.x = 20;
  deckText.y = 50;
  header.addChild(deckText);

  uiContainer.addChild(header);

  // 헤더 정보를 매 프레임 업데이트하는 함수
  header.updateInfo = () => {
    turnText.text = `턴 ${gameState.turn} | VP ${gameState.vp}`;
    deckText.text = `덱 ${gameState.deckSize} | 버림 ${gameState.discardSize}`;
  };

  gameState.headerUI = header;
}

// 3. 리소스 영역 생성
function createResourceArea() {
  const resourceContainer = new PIXI.Container();
  resourceContainer.y = 270;

  // 배경
  const bg = new PIXI.Graphics();
  bg.beginFill(COLORS.header);
  bg.drawRect(10, 0, SCREEN_WIDTH - 20, 70);
  bg.endFill();
  resourceContainer.addChild(bg);

  // 액션 & 구매 (상단)
  const topText = new PIXI.Text(
    `액션 ${gameState.actions} | 구매 ${gameState.buys}`,
    {
      fontFamily: 'Arial',
      fontSize: 20,
      fontWeight: 'bold',
      fill: COLORS.text,
    }
  );
  topText.x = 20;
  topText.y = 10;
  resourceContainer.addChild(topText);

  // 코인 (하단)
  const coinText = new PIXI.Text(
    `💰 코인: ${gameState.coins}`,
    {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: COLORS.treasure,
    }
  );
  coinText.x = 20;
  coinText.y = 40;
  resourceContainer.addChild(coinText);

  uiContainer.addChild(resourceContainer);

  // 리소스 정보 업데이트 함수
  resourceContainer.updateInfo = () => {
    topText.text = `액션 ${gameState.actions} | 구매 ${gameState.buys}`;
    coinText.text = `💰 코인: ${gameState.coins}`;
  };

  gameState.resourceUI = resourceContainer;
}

// 5. 턴 종료 버튼 생성
function createEndTurnButton() {
  const button = new PIXI.Container();
  button.y = SCREEN_HEIGHT - 80;

  const buttonWidth = SCREEN_WIDTH - 40;
  const buttonHeight = 50;

  // 배경
  const bg = new PIXI.Graphics();
  bg.beginFill(COLORS.button);
  bg.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
  bg.endFill();
  button.addChild(bg);

  // 텍스트
  const text = new PIXI.Text(
    '턴 종료',
    {
      fontFamily: 'Arial',
      fontSize: 20,
      fontWeight: 'bold',
      fill: COLORS.text,
    }
  );
  text.anchor.set(0.5);
  text.x = buttonWidth / 2;
  text.y = buttonHeight / 2;
  button.addChild(text);

  button.x = 20;

  // 인터랙티브 효과
  button.eventMode = 'static';
  button.cursor = 'pointer';

  button.on('pointerover', () => {
    bg.clear();
    bg.beginFill(COLORS.buttonHover);
    bg.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
    bg.endFill();
  });

  button.on('pointerout', () => {
    bg.clear();
    bg.beginFill(COLORS.button);
    bg.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
    bg.endFill();
  });

  button.on('pointerdown', () => {
    button.scale.set(0.95);
  });

  button.on('pointerup', () => {
    button.scale.set(1);
    endTurn();
  });

  uiContainer.addChild(button);
}

// 게임 액션들
function shuffleDeck(animate = true) {
  if (gameState.deck.length === 0) return;

  for (let i = gameState.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
  }

  if (animate) {
    updateCardPositions();
  }
}

function drawCard() {
  if (gameState.deck.length === 0) {
    if (gameState.discard.length > 0) {
      gameState.deck = [...gameState.discard];
      gameState.discard = [];
      shuffleDeck(true);
      setTimeout(() => drawCard(), 500);
    }
    return;
  }

  const card = gameState.deck.pop();
  gameState.hand.push(card);

  updateCardPositions();

  // 카드 뒤집기
  setTimeout(() => card.flip(), 200);
}

function drawCards(count) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => drawCard(), i * 150);
  }
}

function playCard(card) {
  const index = gameState.hand.indexOf(card);
  if (index === -1) return;

  gameState.hand.splice(index, 1);
  gameState.play.push(card);
  card.hovered = false;

  // 액션 차감
  if (card.type === 'action') {
    gameState.actions = Math.max(0, gameState.actions - 1);
  }

  // 재화 카드는 즉시 코인 추가
  if (card.type === 'treasure') {
    if (card.name === 'Copper') gameState.coins += 1;
    else if (card.name === 'Silver') gameState.coins += 2;
    else if (card.name === 'Gold') gameState.coins += 3;
  }

  updateCardPositions();

  if (gameState.resourceUI) {
    gameState.resourceUI.updateInfo();
  }
}

function endTurn() {
  // 정리 단계: 손패와 플레이 영역을 버림 더미로
  gameState.discard.push(...gameState.play, ...gameState.hand);
  gameState.play = [];
  gameState.hand = [];

  // 리소스 초기화
  gameState.turn++;
  gameState.actions = 1;
  gameState.buys = 1;
  gameState.coins = 0;

  updateCardPositions();

  if (gameState.headerUI) {
    gameState.headerUI.updateInfo();
  }
  if (gameState.resourceUI) {
    gameState.resourceUI.updateInfo();
  }

  // 5장 드로우
  setTimeout(() => drawCards(5), 500);
}

// 렌더링
function render() {
  const currentTime = performance.now();
  const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  const allCards = [...gameState.deck, ...gameState.hand, ...gameState.play, ...gameState.discard];
  allCards.forEach(card => card.update(deltaTime));
}

// 앱 시작
init();
