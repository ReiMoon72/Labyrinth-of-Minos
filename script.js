function loadImg(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

const sprites = { idle: null, idle2: null, walk: [], run: [] };
let spritesReady = false;

async function initSprites() {
    sprites.idle  = await loadImg(SPRITE_IDLE);
    sprites.idle2 = await loadImg(SPRITE_IDLE2);
    sprites.walk  = await Promise.all([SPRITE_WALK1, SPRITE_WALK2, SPRITE_WALK3].map(loadImg));
    sprites.run   = await Promise.all([SPRITE_RUN1, SPRITE_RUN2, SPRITE_RUN3, SPRITE_RUN4].map(loadImg));
    spritesReady = true;
}
initSprites();

const ROOM_BANK = {
    LAYER_1_ENTRY: [
        {id:'e1',platforms:[{x:0,y:0.9,w:1,h:0.1},{x:0.3,y:0.7,w:0.4,h:0.05}]},
        {id:'e2',platforms:[{x:0,y:0.9,w:0.2,h:0.1},{x:0.4,y:0.9,w:0.6,h:0.1}]},
        {id:'e3',platforms:[{x:0,y:0.9,w:0.4,h:0.1},{x:0.6,y:0.7,w:0.2,h:0.1},{x:0.9,y:0.9,w:0.1,h:0.1}]}
    ],
    LAYER_2_PITS: [
        {id:'p1',platforms:[{x:0,y:0.9,w:0.1,h:0.1},{x:0.3,y:0.8,w:0.1,h:0.1},{x:0.6,y:0.9,w:0.1,h:0.1},{x:0.9,y:0.9,w:0.1,h:0.1}]},
        {id:'p2',platforms:[{x:0,y:0.9,w:0.2,h:0.1},{x:0.4,y:0.7,w:0.2,h:0.1},{x:0.8,y:0.9,w:0.2,h:0.1}]}
    ],
    LAYER_3_HALLS: [
        {id:'h1',platforms:[{x:0,y:0.9,w:1,h:0.1}]},
        {id:'h2',platforms:[{x:0,y:0.8,w:0.4,h:0.2},{x:0.6,y:0.8,w:0.4,h:0.2}]}
    ],
    LAYER_4_CLIFFS: [
        {id:'c1',platforms:[{x:0,y:0.9,w:0.3,h:0.1},{x:0.4,y:0.6,w:0.2,h:0.1},{x:0.7,y:0.4,w:0.2,h:0.1},{x:0.9,y:0.9,w:0.1,h:0.1}]}
    ],
    LAYER_5_RUINS: [
        {id:'r1',platforms:[{x:0,y:0.9,w:0.5,h:0.1},{x:0.2,y:0.7,w:0.1,h:0.05}]}
    ],
    LAYER_6_FORGE: [
        {id:'f1',platforms:[{x:0,y:0.9,w:0.2,h:0.1},{x:0.3,y:0.8,w:0.4,h:0.1},{x:0.8,y:0.9,w:0.2,h:0.1}]}
    ],
    LAYER_7_SANCTUM: [{id:'s1',platforms:[{x:0,y:0.9,w:1,h:0.1}]}],
    LAYER_8_THRONE:  [{id:'t1',platforms:[{x:0,y:0.9,w:1,h:0.1}]}],
    INTERSECTIONS: [
        {id:'int1',platforms:[{x:0,y:0.9,w:0.3,h:0.1},{x:0.3,y:0.7,w:0.4,h:0.1},{x:0.7,y:0.9,w:0.3,h:0.1}]},
        {id:'int2',platforms:[{x:0,y:0.9,w:0.2,h:0.1},{x:0.2,y:0.5,w:0.6,h:0.1},{x:0.8,y:0.9,w:0.2,h:0.1}]}
    ]
};

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function disableSmoothing() {
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
}

let maze = [], roomIdx = 0, gameState = 'menu', isPaused = false;
let startTime = 0, lives = 3, bgScrollX = 0;
let particles = [], torchFlicker = 0;

const SPRITE_W = 56;
const SPRITE_H = 72;
const COL_W = 28;
const COL_H = 60;
const COL_OFFSET_X = (SPRITE_W - COL_W) / 2;
const COL_OFFSET_Y = SPRITE_H - COL_H;

const player = {
    x: 50, y: 0,
    vx: 0, vy: 0,
    speed: 4, sprint: 1.8, jump: 14,
    grounded: false, dir: 1,
    isMoving: false, sprinting: false,
    frame: 0, animTick: 0,
    idleFrame: 0, idleTick: 0
};

const gravity = 0.7;
const friction = 0.85;
const keys = {};

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'Enter' && gameState === 'menu') startGame();
    if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => keys[e.code] = false);

function spawnParticle(x, y, color, type) {
    if (!type) type = 'ember';
    particles.push({
        x: x, y: y,
        vx: (Math.random()-0.5)*3,
        vy: -(Math.random()*2+0.5),
        life: 1, decay: 0.016+Math.random()*0.02,
        size: Math.random()*2.5+1,
        color: color, type: type
    });
}

function drawBG() {
    const W = canvas.width, H = canvas.height;
    torchFlicker = Math.sin(Date.now()*0.003)*0.08 + Math.random()*0.04;

    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#080510');
    g.addColorStop(0.5,'#0c080f');
    g.addColorStop(1,'#090508');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = 'rgba(35,22,45,0.5)';
    ctx.lineWidth = 1;
    const bw = 80, bh = 50;
    const ox = (bgScrollX * 0.2) % bw;
    for (let bx = -ox; bx < W+bw; bx += bw) {
        for (let by = 0; by < H; by += bh) {
            ctx.strokeRect(bx + (Math.floor(by/bh)%2)*bw*0.5 - bw*0.25, by, bw, bh);
        }
    }

    const torchPositions = [W*0.12, W*0.5, W*0.88];
    torchPositions.forEach(function(tx) {
        const ty = H*0.28;
        const inten = 0.22 + torchFlicker;
        const tg = ctx.createRadialGradient(tx,ty,0,tx,ty,180);
        tg.addColorStop(0,'rgba(255,140,20,'+inten+')');
        tg.addColorStop(0.4,'rgba(180,80,10,'+(inten*0.35)+')');
        tg.addColorStop(1,'transparent');
        ctx.fillStyle = tg;
        ctx.fillRect(0,0,W,H);

        ctx.fillStyle = '#3a2010';
        ctx.fillRect(tx-5, ty-28, 10, 22);
        ctx.fillStyle = '#5a3018';
        ctx.fillRect(tx-4, ty-33, 8, 8);

        ctx.save();
        ctx.globalAlpha = 0.9+torchFlicker;
        ctx.fillStyle = 'rgba(255,120,10,0.95)';
        ctx.beginPath();
        ctx.ellipse(tx, ty-38+torchFlicker*6, 5, 10, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,210,50,0.9)';
        ctx.beginPath();
        ctx.ellipse(tx, ty-43+torchFlicker*4, 3, 7, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();

        if (Math.random() < 0.15) spawnParticle(tx+(Math.random()-0.5)*8, ty-48, '#ff8010', 'ember');
    });

    const fg = ctx.createLinearGradient(0,H*0.75,0,H);
    fg.addColorStop(0,'transparent');
    fg.addColorStop(1,'rgba(6,3,10,0.65)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, H*0.75, W, H*0.25);
}

function drawPlatforms(room) {
    if (!room || !room.platforms) return;
    const W = canvas.width, H = canvas.height;
    room.platforms.forEach(function(p) {
        const rx=p.x*W, ry=p.y*H, rw=p.w*W, rh=p.h*H;
        const sg = ctx.createLinearGradient(rx,ry,rx,ry+rh);
        sg.addColorStop(0,'#3a2628');
        sg.addColorStop(0.3,'#2c1e1e');
        sg.addColorStop(1,'#180e0e');
        ctx.fillStyle = sg;
        ctx.fillRect(rx,ry,rw,rh);

        ctx.strokeStyle = 'rgba(70,45,35,0.45)';
        ctx.lineWidth = 1;
        for (let tx=rx; tx<rx+rw; tx+=48) { ctx.beginPath(); ctx.moveTo(tx,ry); ctx.lineTo(tx,ry+rh); ctx.stroke(); }
        for (let ty=ry; ty<ry+rh; ty+=22) { ctx.beginPath(); ctx.moveTo(rx,ty); ctx.lineTo(rx+rw,ty); ctx.stroke(); }

        ctx.fillStyle = 'rgba(212,168,67,0.55)';
        ctx.fillRect(rx,ry,rw,2);
        ctx.fillStyle = 'rgba(90,65,35,0.8)';
        ctx.fillRect(rx,ry+2,rw,2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(rx,ry,3,rh);
        ctx.fillRect(rx+rw-3,ry,3,rh);
    });
}

function drawPortal() {
    const W = canvas.width, H = canvas.height;
    const t = Date.now()*0.002;
    const px = W-58, ph = H*0.38, py = H*0.62-ph;

    const pg = ctx.createRadialGradient(px+25,py+ph/2,5,px+25,py+ph/2,90);
    pg.addColorStop(0,'rgba(255,215,0,'+(0.14+Math.sin(t)*0.05)+')');
    pg.addColorStop(0.5,'rgba(180,140,20,0.07)');
    pg.addColorStop(1,'transparent');
    ctx.fillStyle = pg;
    ctx.fillRect(px-35,py-25,120,ph+50);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,0,'+(0.6+Math.sin(t)*0.2)+')';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffd700';
    ctx.strokeRect(px,py,50,ph);
    ctx.shadowBlur = 0;
    ctx.restore();

    for (let i=0; i<3; i++) {
        ctx.fillStyle = 'rgba(255,215,0,'+(0.03+i*0.01)+')';
        ctx.fillRect(px+i*4, py+i*4, 50-i*8, ph-i*8);
    }

    ctx.fillStyle = 'rgba(255,215,0,'+(0.5+Math.sin(t*1.5)*0.2)+')';
    ctx.font = 'bold 26px serif';
    ctx.textAlign = 'center';
    ctx.fillText('⊕', px+25, py+ph/2+10);
    ctx.textAlign = 'left';

    if (Math.random() < 0.25) spawnParticle(px+25+(Math.random()-0.5)*18, py+ph/2, '#ffd700', 'ember');
}

function drawPlayer() {
    ctx.save();
    disableSmoothing();

    const sx = player.x, sy = player.y;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + SPRITE_W/2, sy + SPRITE_H + 2, COL_W*0.65, 5, 0, 0, Math.PI*2);
    ctx.fill();

    let img = null;
    if (!player.isMoving) {
        img = (player.idleFrame === 0 ? sprites.idle : sprites.idle2);
    } else if (player.sprinting) {
        img = sprites.run[player.frame % Math.max(sprites.run.length, 1)];
    } else {
        img = sprites.walk[player.frame % Math.max(sprites.walk.length, 1)];
    }

    if (img && img.complete && img.naturalWidth) {
        if (player.dir === -1) {
            ctx.translate(sx + SPRITE_W, sy);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, SPRITE_W, SPRITE_H);
        } else {
            ctx.drawImage(img, sx, sy, SPRITE_W, SPRITE_H);
        }
    } else {
        const cx = sx + SPRITE_W/2;
        if (player.dir === -1) { ctx.translate(cx*2,0); ctx.scale(-1,1); }
        ctx.fillStyle = '#d4a843';
        ctx.fillRect(sx+14, sy+18, 28, 36);
        ctx.fillStyle = '#f0c080';
        ctx.fillRect(sx+16, sy+2, 24, 18);
        ctx.fillStyle = '#8a3020';
        ctx.fillRect(sx+14, sy+19, 28, 5);
    }

    ctx.restore();
    disableSmoothing();
}

function drawParticles() {
    particles.forEach(function(p) {
        ctx.save();
        ctx.globalAlpha = p.life * 0.75;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fillRect(Math.round(p.x-p.size/2), Math.round(p.y-p.size/2), Math.ceil(p.size), Math.ceil(p.size));
        ctx.restore();
    });
}

function update() {
    if (isPaused) return;
    bgScrollX += 0.6;

    player.sprinting = keys['ShiftLeft'] || keys['ShiftRight'];
    player.isMoving  = false;

    if (keys['KeyD'] || keys['KeyW']) { player.vx += 1.2; player.dir =  1; player.isMoving = true; }
    if (keys['KeyA'])                  { player.vx -= 1.2; player.dir = -1; player.isMoving = true; }
    if (keys['Space'] && player.grounded) { player.vy = -player.jump; player.grounded = false; }

    player.vy += gravity;
    player.vx *= friction;
    if (player.sprinting && player.isMoving) player.vx *= 1.15;
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < 0) { player.x = 0; player.vx = 0; }

    if (player.isMoving && player.grounded) {
        player.animTick++;
        const limit = player.sprinting ? 4 : 7;
        if (player.animTick > limit) {
            const arr = player.sprinting ? sprites.run : sprites.walk;
            player.frame = (player.frame + 1) % Math.max(arr.length, 1);
            player.animTick = 0;
        }
        if (Math.random() < 0.12) spawnParticle(player.x + SPRITE_W/2 + (Math.random()-0.5)*10, player.y + SPRITE_H, '#7a4a28', 'dust');
    } else if (!player.isMoving) {
        player.frame = 0;
        player.idleTick++;
        if (player.idleTick > 40) { player.idleFrame = (player.idleFrame+1) % 2; player.idleTick = 0; }
    }

    const room = maze[roomIdx];
    player.grounded = false;

    if (room && room.platforms) {
        room.platforms.forEach(function(p) {
            const rx = p.x * canvas.width,  ry = p.y * canvas.height;
            const rw = p.w * canvas.width,   rh = p.h * canvas.height;
            const cx = player.x + COL_OFFSET_X;
            const cy = player.y + COL_OFFSET_Y;
            if (cx < rx+rw && cx+COL_W > rx && cy+COL_H > ry && cy+COL_H < ry+rh+12) {
                if (player.vy >= 0) {
                    player.y = ry - COL_OFFSET_Y - COL_H;
                    player.vy = 0;
                    player.grounded = true;
                }
            }
        });
    }

    if (player.x + SPRITE_W > canvas.width - 5) {
        if (roomIdx < maze.length - 1) { roomIdx++; setupRoom(); }
        else showAlert('⭐','Victory!','You escaped the Labyrinth of Minos! The gods smile upon you.','↺ Play Again');
    }

    if (player.y > canvas.height + 80) {
        lives--;
        if (lives <= 0) showAlert('💀','Lost Forever','The Minotaur claims another soul. Your bones join the countless others in the dark.','↺ Restart');
        else { updateHUD(); setupRoom(); }
    }

    const diff = Math.floor((Date.now()-startTime)/1000);
    document.getElementById('timer').innerText =
        String(Math.floor(diff/60)).padStart(2,'0') + ':' + String(diff%60).padStart(2,'0');

    for (let i=particles.length-1; i>=0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.type === 'ember') p.vy -= 0.04;
        else p.vy += 0.05;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i,1);
    }
}

function draw() {
    disableSmoothing();
    drawBG();
    drawPlatforms(maze[roomIdx]);
    drawPortal();
    drawParticles();
    drawPlayer();

    const W = canvas.width, H = canvas.height;
    const vg = ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.8);
    vg.addColorStop(0,'transparent');
    vg.addColorStop(1,'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,W,H);
}

function gameLoop() {
    if (gameState === 'playing' && !isPaused) {
        update();
        draw();
        requestAnimationFrame(gameLoop);
    }
}

function generateMaze() {
    const out = [];
    const layerKeys = Object.keys(ROOM_BANK).filter(function(k){ return k.startsWith('LAYER_'); });
    layerKeys.forEach(function(key, i) {
        const pool = ROOM_BANK[key].slice();
        for (let j=pool.length-1; j>0; j--) {
            const r = Math.floor(Math.random()*(j+1));
            const tmp = pool[j]; pool[j] = pool[r]; pool[r] = tmp;
        }
        pool.forEach(function(room) {
            const copy = Object.assign({}, room);
            copy.layerName = 'L'+(i+1)+': '+key.split('_')[2];
            out.push(copy);
        });
    });
    const n = 2 + Math.floor(Math.random()*2);
    for (let i=0; i<n; i++) {
        const pos = 2 + Math.floor(Math.random()*(out.length-4));
        const ir = ROOM_BANK.INTERSECTIONS[Math.floor(Math.random()*ROOM_BANK.INTERSECTIONS.length)];
        const copy = Object.assign({}, ir);
        copy.layerName = 'Junction';
        out.splice(pos, 0, copy);
    }
    return out;
}

function startGame() {
    maze = generateMaze();
    roomIdx = 0; lives = 3; gameState = 'playing'; isPaused = false; particles = [];
    startTime = Date.now();
    setupRoom();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    document.getElementById('hud-bottom').classList.remove('hidden');
    requestAnimationFrame(gameLoop);
}

function setupRoom() {
    player.x = 50;
    player.y = canvas.height * 0.4;
    player.vx = 0; player.vy = 0; player.grounded = false;
    player.frame = 0; player.animTick = 0;
    const room = maze[roomIdx];
    document.getElementById('layer-name').innerText = room.layerName || '—';
    document.getElementById('room-prog').innerText = 'Room '+(roomIdx+1)+' / '+maze.length;
    document.getElementById('prog-fill').style.width = Math.max(5, ((roomIdx+1)/maze.length)*100) + '%';
    updateHUD();
}

function updateHUD() {
    let h = '';
    for (let i=0; i<3; i++) {
        const full = i < lives;
        h += '<div class="heart '+(full?'full':'')+'">' +
             '<svg viewBox="0 0 20 18" xmlns="http://www.w3.org/2000/svg">' +
             '<path d="M10 16.5S1 11 1 5.5A4.5 4.5 0 0 1 10 3.6 4.5 4.5 0 0 1 19 5.5C19 11 10 16.5 10 16.5z"' +
             ' fill="'+(full?'#cc2222':'#2a1010')+'" stroke="'+(full?'#ff4444':'#4a2020')+'" stroke-width="1.5"/>' +
             '</svg></div>';
    }
    document.getElementById('health-bar').innerHTML = h;
}

function togglePause() {
    if (gameState !== 'playing' || document.getElementById('custom-alert').offsetParent !== null) return;
    isPaused = !isPaused;
    document.getElementById('pause-menu').classList.toggle('hidden', !isPaused);
    if (!isPaused) requestAnimationFrame(gameLoop);
}

function showAlert(icon, title, msg, btnText) {
    isPaused = true;
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = msg;
    const btn = document.querySelector('#custom-alert .btn');
    if (btn) btn.innerHTML = btnText || '↺ Try Again';
    document.getElementById('custom-alert').classList.remove('hidden');
}

function handleAlertConfirm() {
    document.getElementById('custom-alert').classList.add('hidden');
    resetMaze();
}

function resetMaze() {
    roomIdx = 0; lives = 3; startTime = Date.now(); particles = [];
    setupRoom(); isPaused = false;
    document.getElementById('pause-menu').classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    disableSmoothing();
}
window.addEventListener('resize', function() { resize(); if (gameState === 'playing') setupRoom(); });
resize();

function showPanel(id) { document.getElementById(id).classList.remove('hidden'); }
function hidePanels() {
    document.querySelectorAll('.overlay').forEach(function(e) {
        if (!['start-screen','pause-menu','custom-alert'].includes(e.id)) e.classList.add('hidden');
    });
}
function returnToMenu() { location.reload(); }

function toggleSetting(el) {
    el.classList.toggle('on');
    if (el.id === 'tog-scanlines') {
        document.getElementById('scanlines').style.display = el.classList.contains('on') ? 'block' : 'none';
    }
}

(function() {
    const c = document.getElementById('ember-container');
    if (!c) return;
    setInterval(function() {
        const e = document.createElement('div');
        e.className = 'particle';
        e.style.cssText = 'left:'+Math.random()*100+'vw;bottom:'+Math.random()*30+'vh;animation-delay:'+Math.random()*4+'s;animation-duration:'+(3+Math.random()*3)+'s;background:'+(Math.random()<0.5?'#d4a843':'#ff6020');
        c.appendChild(e);
        setTimeout(function(){ e.remove(); }, 8000);
    }, 300);
})();