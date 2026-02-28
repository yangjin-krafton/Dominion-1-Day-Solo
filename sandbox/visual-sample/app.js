// 모바일 세로 화면 비율 (9:16)
const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;

// 색상 정의
const COLORS = {
  background: 0x1a1a2e,
  header: 0x16213e,
  card: 0xf4f4f4,
  cardBorder: 0x333333,
  cardHover: 0xffe066,
  button: 0x4a90e2,
  buttonHover: 0x6ba3e8,
  text: 0xffffff,
  textDark: 0x333333,
  action: 0xff6b6b,
  buy: 0x4ecdc4,
  coin: 0xffd93d,
  supply: 0x2d3561,
};

// 카드 샘플 데이터
const SAMPLE_HAND = [
  { name: 'Copper', type: 'treasure', cost: 0 },
  { name: 'Estate', type: 'victory', cost: 2 },
  { name: 'Smithy', type: 'action', cost: 4 },
  { name: 'Silver', type: 'treasure', cost: 3 },
  { name: 'Village', type: 'action', cost: 3 },
];

const SAMPLE_SUPPLY = [
  { name: 'Province', cost: 8, count: 8, type: 'victory' },
  { name: 'Gold', cost: 6, count: 12, type: 'treasure' },
  { name: 'Duchy', cost: 5, count: 8, type: 'victory' },
  { name: 'Smithy', cost: 4, count: 10, type: 'action' },
  { name: 'Silver', cost: 3, count: 30, type: 'treasure' },
  { name: 'Village', cost: 3, count: 8, type: 'action' },
  { name: 'Estate', cost: 2, count: 8, type: 'victory' },
  { name: 'Copper', cost: 0, count: 46, type: 'treasure' },
];

// 게임 상태 샘플
const gameState = {
  turn: 5,
  vp: 9,
  deckSize: 18,
  discardSize: 7,
  actions: 1,
  buys: 1,
  coins: 3,
};

// PixiJS 앱 초기화 (v7 방식)
const app = new PIXI.Application({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: COLORS.background,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

// 앱 초기화 및 설정
function init() {
  document.querySelector('#game-container').appendChild(app.view);

  // UI 구성 요소 생성
  createHeader();
  createHandArea();
  createResourceArea();
  createSupplyArea();
  createEndTurnButton();
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

  app.stage.addChild(header);
}

// 2. 손패 영역 생성
function createHandArea() {
  const handContainer = new PIXI.Container();
  handContainer.y = 130;

  // 라벨
  const label = new PIXI.Text(
    '손패',
    {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0xaaaaaa,
    }
  );
  label.x = 20;
  label.y = 0;
  handContainer.addChild(label);

  // 카드들 (가로로 배치)
  const cardWidth = 60;
  const cardHeight = 90;
  const cardSpacing = 10;
  const startX = (SCREEN_WIDTH - (cardWidth * 5 + cardSpacing * 4)) / 2;

  SAMPLE_HAND.forEach((card, index) => {
    const cardContainer = createCard(card, cardWidth, cardHeight);
    cardContainer.x = startX + (cardWidth + cardSpacing) * index;
    cardContainer.y = 30;

    // 인터랙티브 효과
    cardContainer.eventMode = 'static';
    cardContainer.cursor = 'pointer';

    cardContainer.on('pointerover', () => {
      cardContainer.scale.set(1.05);
    });

    cardContainer.on('pointerout', () => {
      cardContainer.scale.set(1);
    });

    handContainer.addChild(cardContainer);
  });

  app.stage.addChild(handContainer);
}

// 카드 생성 헬퍼 함수
function createCard(cardData, width, height) {
  const container = new PIXI.Container();

  // 카드 타입별 색상
  const cardColors = {
    action: 0xffe066,
    treasure: 0xffd93d,
    victory: 0x95e1d3,
  };

  // 카드 배경
  const bg = new PIXI.Graphics();
  bg.lineStyle(2, COLORS.cardBorder);
  bg.beginFill(COLORS.card);
  bg.drawRoundedRect(0, 0, width, height, 5);
  bg.endFill();
  container.addChild(bg);

  // 타입 표시 (상단 색상 바)
  const typeBar = new PIXI.Graphics();
  typeBar.beginFill(cardColors[cardData.type] || 0xcccccc);
  typeBar.drawRoundedRect(0, 0, width, 20, 5);
  typeBar.endFill();
  container.addChild(typeBar);

  // 카드 이름
  const nameText = new PIXI.Text(
    cardData.name,
    {
      fontFamily: 'Arial',
      fontSize: 11,
      fontWeight: 'bold',
      fill: COLORS.textDark,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: width - 10,
    }
  );
  nameText.anchor.set(0.5);
  nameText.x = width / 2;
  nameText.y = height / 2;
  container.addChild(nameText);

  // 비용 표시 (우상단)
  const costBg = new PIXI.Graphics();
  costBg.beginFill(0x333333);
  costBg.drawCircle(width - 15, 15, 12);
  costBg.endFill();
  container.addChild(costBg);

  const costText = new PIXI.Text(
    cardData.cost.toString(),
    {
      fontFamily: 'Arial',
      fontSize: 12,
      fontWeight: 'bold',
      fill: COLORS.text,
    }
  );
  costText.anchor.set(0.5);
  costText.x = width - 15;
  costText.y = 15;
  container.addChild(costText);

  return container;
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
      fill: COLORS.coin,
    }
  );
  coinText.x = 20;
  coinText.y = 40;
  resourceContainer.addChild(coinText);

  app.stage.addChild(resourceContainer);
}

// 4. 공급 영역 생성
function createSupplyArea() {
  const supplyContainer = new PIXI.Container();
  supplyContainer.y = 370;

  // 라벨
  const label = new PIXI.Text(
    '🛒 공급 카드',
    {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: COLORS.text,
    }
  );
  label.x = 20;
  label.y = 0;
  supplyContainer.addChild(label);

  // 공급 카드 목록 (세로로 배치)
  const itemHeight = 50;
  const startY = 40;

  SAMPLE_SUPPLY.forEach((card, index) => {
    const item = createSupplyItem(card, SCREEN_WIDTH - 40, itemHeight);
    item.x = 20;
    item.y = startY + index * (itemHeight + 5);

    // 인터랙티브 효과
    item.eventMode = 'static';
    item.cursor = 'pointer';

    item.on('pointerover', () => {
      item.alpha = 0.8;
    });

    item.on('pointerout', () => {
      item.alpha = 1;
    });

    supplyContainer.addChild(item);
  });

  app.stage.addChild(supplyContainer);
}

// 공급 아이템 생성 헬퍼 함수
function createSupplyItem(cardData, width, height) {
  const container = new PIXI.Container();

  // 타입별 색상
  const typeColors = {
    action: 0xffe066,
    treasure: 0xffd93d,
    victory: 0x95e1d3,
  };

  // 배경
  const bg = new PIXI.Graphics();
  bg.beginFill(COLORS.supply);
  bg.drawRoundedRect(0, 0, width, height, 5);
  bg.endFill();
  container.addChild(bg);

  // 타입 표시 바 (좌측)
  const typeBar = new PIXI.Graphics();
  typeBar.beginFill(typeColors[cardData.type] || 0xcccccc);
  typeBar.drawRect(0, 0, 5, height);
  typeBar.endFill();
  container.addChild(typeBar);

  // 카드 이름
  const nameText = new PIXI.Text(
    cardData.name,
    {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: COLORS.text,
    }
  );
  nameText.x = 15;
  nameText.y = 8;
  container.addChild(nameText);

  // 비용 & 개수
  const infoText = new PIXI.Text(
    `(${cardData.cost}) x${cardData.count}`,
    {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0xaaaaaa,
    }
  );
  infoText.x = 15;
  infoText.y = 28;
  container.addChild(infoText);

  return container;
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
  });

  app.stage.addChild(button);
}

// 앱 시작
init();
