let capture;
let hands;
let predictions = [];
let gameState = 'READY'; // READY, COUNTDOWN, RESULT, MENU
let timer = 0;
let playerHand = 'None';
let computerHand = '';
let resultMsg = '';

const GESTURES = {
  ROCK: '石頭',
  PAPER: '布',
  SCISSORS: '剪刀',
  CONTINUE: '食指向上(繼續)',
  END: '比叉叉(結束)',
  UNKNOWN: '未知'
};

function setup() {
  createCanvas(windowWidth, windowHeight);

  console.log("提示：如果攝影機無法啟動，你可以使用鍵盤模擬：1(石頭), 2(布), 3(剪刀), 4(繼續), 5(結束)");

  // 改用 p5 內建的 createCapture，對 p5.js 的 image() 支援度更好
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide(); // 隱藏原生在畫布下方的 HTML 標籤

  // 初始化 MediaPipe Hands
  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(onResults);

  // 啟動攝影機工具
  const camera = new Camera(capture.elt, {
    onFrame: async () => {
      await hands.send({ image: capture.elt });
    },
    width: 640,
    height: 480
  });

  camera.start().catch(err => console.error("無法啟動攝影機: ", err));
}

function onResults(results) {
  predictions = results.multiHandLandmarks;
}

// 手勢辨識邏輯
function classifyHand(landmarks) {
  // 判斷手指是否伸直 (y 座標越小代表越高)
  const isExtended = (tip, pip) => landmarks[tip].y < landmarks[pip].y;

  const indexExtended = isExtended(8, 6);
  const middleExtended = isExtended(12, 10);
  const ringExtended = isExtended(16, 14);
  const pinkyExtended = isExtended(20, 18);

  // 1. 布：四指全開
  if (indexExtended && middleExtended && ringExtended && pinkyExtended) return GESTURES.PAPER;
  
  // 2. 剪刀 vs 叉叉 (END)
  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    // 檢查食指尖(8)與中指尖(12)的距離，判斷是否交叉
    let d = dist(landmarks[8].x, landmarks[8].y, landmarks[12].x, landmarks[12].y);
    if (d < 0.04) return GESTURES.END; // 距離近視為交叉
    return GESTURES.SCISSORS; // 距離遠視為剪刀
  }

  // 3. 只有食指向上 (繼續遊戲)
  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return GESTURES.CONTINUE;
  }

  // 4. 石頭
  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return GESTURES.ROCK;
  }

  return GESTURES.UNKNOWN;
}

function draw() {
  // 1. 設置粉嫩背景底色
  background(255, 220, 230);

  // 1. 繪製攝影機畫面 (鏡像處理)
  push();
  translate(width, 0);
  scale(-1, 1);

  // 安全檢查：確保攝影機已準備好畫面（防止因為沒有攝影機而導致程式崩潰）
  if (capture && capture.elt.videoWidth > 0) {
    image(capture, 0, 0, width, height);
  }
  
  // 2. 處理手勢數據並畫出偵測點
  if (predictions && predictions.length > 0) {
    playerHand = classifyHand(predictions[0]);
    fill(255, 100, 150); 
    noStroke();
    for (let p of predictions[0]) {
      ellipse(p.x * width, p.y * height, 10, 10);
    }
  } else if (capture && capture.elt.videoWidth > 0) {
    // 只有在攝影機有畫面但「沒看到手」時，才重置為 None
    // 這樣如果攝影機壞了，你的鍵盤模擬輸入才不會被這行程式碼立刻刷掉
    playerHand = 'None';
  }
  pop();

  // 3. 覆蓋粉嫩半透明層與裝飾
  fill(255, 220, 230, 120); // 降低透明度至 120，讓畫面更清楚
  rect(0, 0, width, height);

  drawDecoration();

  // 遊戲畫面 UI
  textAlign(CENTER, CENTER);
  fill(150, 100, 120);
  textSize(24);
  text(`目前手勢：${playerHand}`, width / 2, 50);

  // 如果攝影機還沒啟動，顯示提示
  if (!capture || capture.elt.videoWidth === 0) {
    text("攝影機啟動中...", width/2, height/2 + 100);
  }
  
  if (gameState === 'READY') {
    fill(255, 150, 180, 180); 
    rect(width / 2 - 250, height / 2 - 60, 500, 120, 20);
    fill(255); textSize(40);
    text("準備好就出拳 ❤️", width/2, height/2);

    if (playerHand === GESTURES.ROCK || playerHand === GESTURES.PAPER || playerHand === GESTURES.SCISSORS) {
      gameState = 'COUNTDOWN';
      timer = frameCount;
    }
  } 
  else if (gameState === 'COUNTDOWN') {
    let count = 3 - floor((frameCount - timer) / 60);
    fill(255, 0, 0); textSize(100);
    text(count > 0 ? count : "出！", width/2, height/2);
    if (count < 0) {
      computerHand = random([GESTURES.ROCK, GESTURES.PAPER, GESTURES.SCISSORS]);
      gameState = 'RESULT';
      timer = frameCount;
    }
  }
  else if (gameState === 'RESULT') {
    textSize(40); fill(255);
    text(`你：${playerHand}  VS  電腦：${computerHand}`, width/2, height/2 - 50);
    
    // 判定勝負
    if (playerHand === computerHand) resultMsg = "平手！";
    else if (
      (playerHand === GESTURES.ROCK && computerHand === GESTURES.SCISSORS) ||
      (playerHand === GESTURES.PAPER && computerHand === GESTURES.ROCK) ||
      (playerHand === GESTURES.SCISSORS && computerHand === GESTURES.PAPER)
    ) resultMsg = "你贏了！ 🎉";
    else resultMsg = "你輸了... 💀";

    textSize(60); fill(255, 80, 120);
    text(resultMsg, width/2, height/2 + 50);
    if ((frameCount - timer) > 120) {
      gameState = 'MENU';
      playerHand = 'None'; // 重置手勢，以免直接跳過選單
    }
  }
  else if (gameState === 'MENU') {
    fill(255, 245, 247, 220); rect(0, 0, width, height);
    fill(255, 100, 150); textSize(32);
    text("遊戲結束 - 選單 ❤️", width/2, height/2 - 100);
    textSize(24);
    text("繼續遊玩：請比「食指向上 ☝️」", width/2, height/2 - 20);
    text("結束遊戲：請比「手指交叉 🤞」", width/2, height/2 + 30);
    
    fill(255, 50, 100);
    text(`目前偵測：${playerHand}`, width/2, height/2 + 100);

    if (playerHand === GESTURES.CONTINUE) {
      gameState = 'READY';
      playerHand = 'None';
    } else if (playerHand === GESTURES.END) {
      gameState = 'EXIT';
    }
  }
  else if (gameState === 'EXIT') {
    background(0);
    fill(255); textSize(40);
    text("遊戲已結束", width/2, height/2);
    noLoop();
  }
}

// 畫背景裝飾
function drawDecoration() {
  textSize(40);
  text('❤️', 80, 120);
  text('🌸', width - 80, 150);
  text('💖', 120, height - 100);
  text('✨', width - 150, height - 150);
}

// 模擬鍵盤輸入手勢
function keyPressed() {
  if (key === '1') playerHand = GESTURES.ROCK;
  if (key === '2') playerHand = GESTURES.PAPER;
  if (key === '3') playerHand = GESTURES.SCISSORS;
  if (key === '4') playerHand = GESTURES.CONTINUE;
  if (key === '5') playerHand = GESTURES.END;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
