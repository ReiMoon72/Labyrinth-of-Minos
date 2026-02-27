const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const mileageDisplay = document.getElementById("mileageDisplay");
const timerDisplay = document.getElementById("timerDisplay");
const healthBar = document.getElementById("health-bar");

// --- ASSET LOADING ---
const bgImg = new Image();
bgImg.src = "Plain-Map.JPG";
let bgLoaded = false;
bgImg.onload = () => {
  bgLoaded = true;
};

// Placeholder for Running Animation (10 images)
const runFrames = [];
const runFrameSources = [
  "4run.JPG",
  "5run.JPG",
  "6run.JPG",
  "7run.JPG",
  "7run.JPG",
  "6run.JPG",
  "5run.JPG",
  "4run.JPG",
  "3run.JPG",
  "2run.JPG",
  "1run.JPG",
];
runFrameSources.forEach((src) => {
  const img = new Image();
  img.src = src;
  runFrames.push(img);
});

// Placeholder for Walking Animation (2 images)
const walkFrames = [];
const walkFrameSources = ['idle.JPG', 'idle2.JPG'];;
walkFrameSources.forEach((src) => {
  const img = new Image();
  img.src = src;
  walkFrames.push(img);
});

const idleImg = new Image();
idleImg.src = "idle.png"; // One still image for when not moving

// Game Constants
const GOAL_MILES = 200;
const MILES_PER_PIXEL = 0.005;
const HITBOX_PADDING = 12;

// State Variables
let gameState = "menu";
let isPaused = false;
let startTime = 0;
let milesTravelled = 0;
let lives = 3;
let scrollX = 0;

// Player Object
const player = {
  x: 250,
  y: 0,
  width: 80, // Adjusted width for sprite aspect ratio
  height: 110,
  speed: 5,
  sprintMult: 2.2,
  jumpForce: 16,
  velX: 0,
  velY: 0,
  grounded: false,
  direction: 1,
  isSprinting: false,
  animTimer: 0,
  getHitbox() {
    return {
      x: this.x + HITBOX_PADDING,
      y: this.y + HITBOX_PADDING,
      w: this.width - HITBOX_PADDING * 2,
      h: this.height - HITBOX_PADDING * 2,
    };
  },
};

const gravity = 0.8;
const friction = 0.88;
let platforms = [];
let portal = { worldX: 5000, y: 0, width: 120, height: 180, active: false };

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyP") togglePause();
});
window.addEventListener("keyup", (e) => (keys[e.code] = false));

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const floorHeight = 85;
  platforms = [
    {
      x: -100000,
      y: canvas.height - floorHeight,
      width: 200000,
      height: floorHeight,
    },
  ];
}
window.addEventListener("resize", resize);
resize();

function showPanel(id) {
  document.getElementById(id).classList.remove("hidden");
}
function hidePanels() {
  document.querySelectorAll(".overlay").forEach((el) => {
    if (el.id !== "start-screen" && el.id !== "pause-menu")
      el.classList.add("hidden");
  });
}

function togglePause() {
  if (gameState !== "playing") return;
  isPaused = !isPaused;
  document.getElementById("pause-menu").classList.toggle("hidden", !isPaused);
  if (!isPaused) requestAnimationFrame(gameLoop);
}

function startGame() {
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("ui-layer").classList.remove("hidden");
  gameState = "playing";
  startTime = Date.now();
  player.y = canvas.height - 250;
  updateHealth();
  requestAnimationFrame(gameLoop);
}

function updateHealth() {
  healthBar.innerHTML = '<span class="heart">❤</span>'.repeat(lives);
}

/**
 * UPDATED: CHARACTER ANIMATION WITH IMAGES
 */
function drawCharacter(
  ctx,
  x,
  y,
  width,
  height,
  direction,
  animTimer,
  isSprinting,
  velX,
) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  if (direction === -1) ctx.scale(-1, 1);

  const moving = Math.abs(velX) > 0.5;
  let imgToDraw = idleImg;

  if (moving) {
    if (isSprinting) {
      // Cycle through 10 running frames
      const frameIndex = Math.floor(animTimer * 0.2) % 10;
      imgToDraw = runFrames[frameIndex];
    } else {
      // Cycle through 2 walking frames
      const frameIndex = Math.floor(animTimer * 0.1) % 2;
      imgToDraw = walkFrames[frameIndex];
    }
  }

  // Bobbing effect even for sprites
  const bob = moving ? Math.sin(animTimer * 0.2) * 4 : 0;

  // Draw the image
  // If image hasn't loaded, draw a rectangle fallback
  if (imgToDraw && imgToDraw.complete && imgToDraw.naturalWidth !== 0) {
    ctx.drawImage(imgToDraw, -width / 2, -height / 2 + bob, width, height);
  } else {
    // Fallback if images are missing
    ctx.fillStyle = isSprinting ? "#ff4d4d" : "#e2c08d";
    ctx.fillRect(-width / 2, -height / 2 + bob, width, height);
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.fillText(isSprinting ? "RUN" : "WALK", -15, 0);
  }

  ctx.restore();
}

function update() {
  if (gameState !== "playing" || isPaused) return;

  let currentSpeed = player.speed;
  player.isSprinting = keys["ShiftLeft"] || keys["ShiftRight"];
  if (player.isSprinting) currentSpeed *= player.sprintMult;

  let moved = false;
  if (keys["KeyD"] || keys["ArrowRight"]) {
    if (player.velX < currentSpeed) player.velX += 0.8;
    player.direction = 1;
    moved = true;
  }
  if (keys["KeyA"] || keys["ArrowLeft"]) {
    if (player.velX > -currentSpeed) player.velX -= 0.8;
    player.direction = -1;
    moved = true;
  }

  if (moved) player.animTimer++;

  if (keys["Space"] && player.grounded) {
    player.velY = -player.jumpForce;
    player.grounded = false;
  }

  player.velY += gravity;
  player.y += player.velY;
  player.velX *= friction;

  scrollX -= player.velX;
  milesTravelled += Math.abs(player.velX) * MILES_PER_PIXEL;

  player.grounded = false;
  const hb = player.getHitbox();
  platforms.forEach((plat) => {
    if (
      hb.x < plat.x + plat.width &&
      hb.x + hb.w > plat.x &&
      hb.y < plat.y + plat.height &&
      hb.y + hb.h > plat.y
    ) {
      if (player.velY >= 0) {
        player.y = plat.y - player.height;
        player.velY = 0;
        player.grounded = true;
      }
    }
  });

  if (milesTravelled >= GOAL_MILES && !portal.active) {
    portal.active = true;
    portal.worldX = 1500;
  }

  if (portal.active) {
    portal.worldX -= player.velX;
    if (
      player.x + player.width > player.x + portal.worldX &&
      player.x < player.x + portal.worldX + portal.width
    ) {
      window.location.href = "room2.html";
    }
  }

  mileageDisplay.innerText = milesTravelled.toFixed(2);
  let elapsed = Math.floor((Date.now() - startTime) / 1000);
  let m = Math.floor(elapsed / 60)
    .toString()
    .padStart(2, "0");
  let s = (elapsed % 60).toString().padStart(2, "0");
  timerDisplay.innerText = `${m}:${s}`;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (bgLoaded) {
    let bgW = canvas.width;
    let xPos = scrollX % bgW;
    ctx.drawImage(bgImg, xPos, 0, bgW, canvas.height);
    ctx.drawImage(
      bgImg,
      xPos + (scrollX < 0 ? bgW : -bgW),
      0,
      bgW,
      canvas.height,
    );
  }

  if (portal.active) {
    const px = player.x + portal.worldX;
    portal.y = canvas.height - 265;
    ctx.fillStyle = "#00ffcc";
    ctx.shadowBlur = 40;
    ctx.shadowColor = "#00ffcc";
    ctx.fillRect(px, portal.y, portal.width, portal.height);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px Cinzel";
    ctx.fillText("EXIT", px + 30, portal.y - 20);
  }

  drawCharacter(
    ctx,
    player.x,
    player.y,
    player.width,
    player.height,
    player.direction,
    player.animTimer,
    player.isSprinting,
    player.velX,
  );
}

function gameLoop() {
  update();
  draw();
  if (!isPaused) requestAnimationFrame(gameLoop);
}
