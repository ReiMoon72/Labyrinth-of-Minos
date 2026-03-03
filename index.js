const ROOM_BANK = {
        LAYER_1_ENTRY: [
            { id: 'e1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 1, h: 0.1}, {x: 0.3, y: 0.7, w: 0.4, h: 0.05}] },
            { id: 'e2', type: 'linear', platforms: [{x: 0, y: 0.9, w: 0.2, h: 0.1}, {x: 0.4, y: 0.9, w: 0.6, h: 0.1}] },
            { id: 'e3', type: 'linear', platforms: [{x: 0, y: 0.9, w: 0.4, h: 0.1}, {x: 0.6, y: 0.7, w: 0.2, h: 0.1}, {x: 0.9, y: 0.9, w: 0.1, h: 0.1}] }
        ],
        LAYER_2_PITS: [
            { id: 'p1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 0.1, h: 0.1}, {x: 0.3, y: 0.8, w: 0.1, h: 0.1}, {x: 0.6, y: 0.9, w: 0.1, h: 0.1}, {x: 0.9, y: 0.9, w: 0.1, h: 0.1}] },
            { id: 'p2', type: 'linear', platforms: [{x: 0, y: 0.9, w: 0.2, h: 0.1}, {x: 0.4, y: 0.7, w: 0.2, h: 0.1}, {x: 0.8, y: 0.9, w: 0.2, h: 0.1}] }
        ],
        LAYER_3_HALLS: [
            { id: 'h1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 1, h: 0.1}] },
            { id: 'h2', type: 'linear', platforms: [{x: 0, y: 0.8, w: 0.4, h: 0.2}, {x: 0.6, y: 0.8, w: 0.4, h: 0.2}] }
        ],
        LAYER_4_CLIFFS: [
            { id: 'c1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 0.3, h: 0.1}, {x: 0.4, y: 0.6, w: 0.2, h: 0.1}, {x: 0.7, y: 0.4, w: 0.2, h: 0.1}, {x: 0.9, y: 0.9, w: 0.1, h: 0.1}] }
        ],
        LAYER_5_RUINS: [
            { id: 'r1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 0.5, h: 0.1}, {x: 0.2, y: 0.7, w: 0.1, h: 0.05}] }
        ],
        LAYER_6_FORGE: [
            { id: 'f1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 0.2, h: 0.1}, {x: 0.3, y: 0.8, w: 0.4, h: 0.1}, {x: 0.8, y: 0.9, w: 0.2, h: 0.1}] }
        ],
        LAYER_7_SANCTUM: [
            { id: 's1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 1, h: 0.1}] }
        ],
        LAYER_8_THRONE: [
            { id: 't1', type: 'linear', platforms: [{x: 0, y: 0.9, w: 1, h: 0.1}] }
        ],
        INTERSECTIONS: [
            { id: 'int1', type: 'cross', platforms: [{x: 0, y: 0.9, w: 0.3, h: 0.1}, {x: 0.3, y: 0.7, w: 0.4, h: 0.1}, {x: 0.7, y: 0.9, w: 0.3, h: 0.1}] },
            { id: 'int2', type: 'cross', platforms: [{x: 0, y: 0.9, w: 0.2, h: 0.1}, {x: 0.2, y: 0.5, w: 0.6, h: 0.1}, {x: 0.8, y: 0.9, w: 0.2, h: 0.1}] }
        ]
    };

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const uiLayer = document.getElementById('ui-layer');
    const timerDisplay = document.getElementById('timerDisplay');
    const healthBar = document.getElementById('health-bar');
    const pauseMenu = document.getElementById('pause-menu');
    const layerDisplay = document.getElementById('current-layer-name');
    const progressDisplay = document.getElementById('room-progress');

    // Sprite Handling
    const walkFiles = ['idle.JPG', '2idle.JPG', 'walk3.png', 'walk4.png'];
    const runFiles = ['run1.png', 'run2.png', 'run3.png', 'run4.png', 'run5.png', 'run6.png'];
    const walkImages = [], runImages = [], processedWalk = [], processedRun = [];
    let imagesLoading = walkFiles.length + runFiles.length;

    function processSprite(img) {
        const pCanvas = document.createElement('canvas');
        pCanvas.width = img.width; pCanvas.height = img.height;
        const pCtx = pCanvas.getContext('2d');
        pCtx.drawImage(img, 0, 0);
        const data = pCtx.getImageData(0,0,img.width,img.height);
        for(let i=0; i<data.data.length; i+=4) {
            if(data.data[i]>240 && data.data[i+1]>240 && data.data[i+2]>240) data.data[i+3]=0;
        }
        pCtx.putImageData(data,0,0);
        const res = new Image(); res.src = pCanvas.toDataURL();
        return res;
    }

    walkFiles.forEach((f, i) => { 
        const img = new Image(); img.src = f; walkImages[i] = img;
        img.onload = () => { processedWalk[i] = processSprite(img); imagesLoading--; };
    });
    runFiles.forEach((f, i) => { 
        const img = new Image(); img.src = f; runImages[i] = img;
        img.onload = () => { processedRun[i] = processSprite(img); imagesLoading--; };
    });

    // Maze State
    let currentMaze = [];
    let currentRoomIndex = 0;
    let gameState = 'menu';
    let isPaused = false;
    let startTime = 0;
    let lives = 3;

    const player = {
        x: 50, y: 0, w: 50, h: 70, 
        vx: 0, vy: 0, speed: 4, sprint: 1.8, 
        jump: 14, grounded: false, dir: 1, 
        isMoving: false, sprinting: false, frame: 0, animTick: 0
    };

    const gravity = 0.7;
    const friction = 0.85;
    const keys = {};

    window.addEventListener('keydown', e => { 
        keys[e.code] = true; 
        if(e.code === 'KeyP') togglePause();
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    /**
     * MAZE GENERATION ALGORITHM
     * 1. Iterates through 8 layers.
     * 2. Shuffles room bank for each layer.
     * 3. Injects 2-3 intersections at random indices.
     */
    function generateMaze() {
        const fullMaze = [];
        const layerKeys = Object.keys(ROOM_BANK).filter(k => k.startsWith('LAYER_'));
        
        layerKeys.forEach((key, index) => {
            const layerPool = [...ROOM_BANK[key]];
            // Shuffle pool
            for (let i = layerPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [layerPool[i], layerPool[j]] = [layerPool[j], layerPool[i]];
            }
            // Add identifying info
            layerPool.forEach(room => {
                room.layerName = `Layer ${index + 1}: ${key.split('_')[2]}`;
                fullMaze.push({...room});
            });
        });

        // Inject 2-3 Intersections at random points (not at start/end)
        const intersectionCount = 2 + Math.floor(Math.random() * 2);
        for(let i=0; i<intersectionCount; i++) {
            const pos = 2 + Math.floor(Math.random() * (fullMaze.length - 4));
            const intRoom = ROOM_BANK.INTERSECTIONS[Math.floor(Math.random() * ROOM_BANK.INTERSECTIONS.length)];
            fullMaze.splice(pos, 0, {...intRoom, layerName: "CORRIDOR JUNCTION"});
        }

        return fullMaze;
    }

    function startGame() {
        currentMaze = generateMaze();
        currentRoomIndex = 0;
        lives = 3;
        gameState = 'playing';
        isPaused = false;
        startTime = Date.now();
        setupRoom();
        uiLayer.classList.remove('hidden');
        document.getElementById('start-screen').classList.add('hidden');
        requestAnimationFrame(gameLoop);
    }

    function setupRoom() {
        const room = currentMaze[currentRoomIndex];
        player.x = 50;
        player.y = canvas.height * 0.5;
        player.vx = 0; player.vy = 0;
        layerDisplay.innerText = room.layerName;
        progressDisplay.innerText = `Room ${currentRoomIndex + 1} / ${currentMaze.length}`;
        updateHealth();
    }

    function togglePause() {
        if(gameState !== 'playing') return;
        isPaused = !isPaused;
        pauseMenu.classList.toggle('hidden', !isPaused);
        if(!isPaused) requestAnimationFrame(gameLoop);
    }

    function update() {
        if(isPaused) return;

        // Movement
        player.sprinting = keys['ShiftLeft'];
        let moveSpeed = player.speed * (player.sprinting ? player.sprint : 1);
        player.isMoving = false;

        if(keys['KeyD'] || keys['KeyW']) { player.vx += 1; player.dir = 1; player.isMoving = true; }
        if(keys['KeyA']) { player.vx -= 1; player.dir = -1; player.isMoving = true; }
        if(keys['Space'] && player.grounded) { player.vy = -player.jump; player.grounded = false; }

        player.vy += gravity;
        player.vx *= friction;
        player.x += player.vx;
        player.y += player.vy;

        // Animation
        if(player.isMoving && player.grounded) {
            player.animTick++;
            const limit = player.sprinting ? 5 : 8;
            if(player.animTick > limit) {
                const total = player.sprinting ? runFiles.length : walkFiles.length;
                player.frame = (player.frame + 1) % total;
                player.animTick = 0;
            }
        } else {
            player.frame = 0;
        }

        // Room Transition (Reach Right Side)
        if(player.x > canvas.width - player.w) {
            if(currentRoomIndex < currentMaze.length - 1) {
                currentRoomIndex++;
                setupRoom();
            } else {
                alert("You escaped the Labyrinth!");
                returnToMenu();
            }
        }

        // Collision
        const room = currentMaze[currentRoomIndex];
        player.grounded = false;
        room.platforms.forEach(p => {
            const rx = p.x * canvas.width;
            const ry = p.y * canvas.height;
            const rw = p.w * canvas.width;
            const rh = p.h * canvas.height;

            if(player.x < rx + rw && player.x + player.w > rx && 
               player.y + player.h > ry && player.y + player.h < ry + rh + 10) {
                if(player.vy >= 0) {
                    player.y = ry - player.h;
                    player.vy = 0;
                    player.grounded = true;
                }
            }
        });

        // Fall Death
        if(player.y > canvas.height) {
            lives--;
            if(lives <= 0) {
                alert("The Minotaur claims another soul.");
                returnToMenu();
            } else {
                setupRoom();
            }
        }

        // Timer
        const diff = Math.floor((Date.now() - startTime)/1000);
        const m = Math.floor(diff/60).toString().padStart(2,'0');
        const s = (diff%60).toString().padStart(2,'0');
        timerDisplay.innerText = `${m}:${s}`;
    }

    function draw() {
        ctx.fillStyle = '#110a05';
        ctx.fillRect(0,0,canvas.width,canvas.height);

        // Platforms
        ctx.fillStyle = '#3a2618';
        const room = currentMaze[currentRoomIndex];
        room.platforms.forEach(p => {
            ctx.fillRect(p.x * canvas.width, p.y * canvas.height, p.w * canvas.width, p.h * canvas.height);
            ctx.strokeStyle = '#e2c08d';
            ctx.strokeRect(p.x * canvas.width, p.y * canvas.height, p.w * canvas.width, p.h * canvas.height);
        });

        // Exit Marker
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.fillRect(canvas.width - 60, 0, 60, canvas.height);

        // Player
        ctx.save();
        ctx.translate(player.x + player.w/2, player.y + player.h/2);
        if(player.dir === -1) ctx.scale(-1, 1);
        
        const arr = player.sprinting ? processedRun : processedWalk;
        const img = arr[player.frame];
        
        if(img && img.complete) {
            ctx.drawImage(img, -player.w/2, -player.h/2, player.w, player.h);
        } else {
            ctx.fillStyle = '#e2c08d';
            ctx.fillRect(-player.w/2, -player.h/2, player.w, player.h);
        }
        ctx.restore();
    }

    function gameLoop() {
        if(gameState === 'playing' && !isPaused) {
            update();
            draw();
            requestAnimationFrame(gameLoop);
        }
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function showPanel(id) { document.getElementById(id).classList.remove('hidden'); }
    function hidePanels() { document.querySelectorAll('.overlay').forEach(e => { if(e.id !== 'start-screen' && e.id !== 'pause-menu') e.classList.add('hidden'); }); }
    function returnToMenu() { location.reload(); }
    function resetGame() { startGame(); }
    function updateHealth() {
        let h = ''; for(let i=0; i<3; i++) h += `<span class="heart" style="opacity:${i<lives?1:0.2}">❤</span>`;
        healthBar.innerHTML = h;
    }