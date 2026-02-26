const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const uiLayer = document.getElementById('ui-layer');
    const timerDisplay = document.getElementById('timerDisplay');
    const healthBar = document.getElementById('health-bar');
    const pauseMenu = document.getElementById('pause-menu');

    // Offscreen canvas for background removal processing
    const processCanvas = document.createElement('canvas');
    const pCtx = processCanvas.getContext('2d', { willReadFrequently: true });

    /* IMAGE ASSETS SETUP - Arrays for individual frame files */
    // Edit these arrays with your actual filenames
    const walkFiles = ['idle.JPG', 'idle2.JPG'];
    const runFiles = ['4run.JPG', '5run.JPG', '6run.JPG', '7run.JPG', '7run.JPG', '6run.JPG', '5run.JPG', '4run.JPG', '3run.JPG', '2run.JPG', '1run.JPG'];
    
    const walkImages = [];
    const runImages = [];
    const processedWalkImages = [];
    const processedRunImages = [];

    const bgImg = new Image();
    bgImg.src = 'Plain-Map.JPG';
    let bgLoaded = false;
    bgImg.onload = () => bgLoaded = true;

    // Load and process all individual walking frames
    walkFiles.forEach((src, index) => {
        const img = new Image();
        img.src = src;
        walkImages.push(img);
        img.onload = () => {
            processedWalkImages[index] = removeWhiteBackground(img);
        };
    });

    // Load and process all individual running frames
    runFiles.forEach((src, index) => {
        const img = new Image();
        img.src = src;
        runImages.push(img);
        img.onload = () => {
            processedRunImages[index] = removeWhiteBackground(img);
        };
    });

    function removeWhiteBackground(imgSource) {
        processCanvas.width = imgSource.width;
        processCanvas.height = imgSource.height;
        pCtx.clearRect(0, 0, processCanvas.width, processCanvas.height);
        pCtx.drawImage(imgSource, 0, 0);
        
        const imageData = pCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > 235 && g > 235 && b > 235) {
                data[i + 3] = 0; 
            }
        }
        
        pCtx.putImageData(imageData, 0, 0);
        const result = new Image();
        result.src = processCanvas.toDataURL();
        return result;
    }

    // Animation Settings
    const spriteConfig = {
        currentFrame: 0,
        animCounter: 0,
        animSpeed: 8    
    };

    let gameState = 'menu';
    let isPaused = false;
    let startTime = 0;
    let elapsedTime = 0;
    let pausedTime = 0;
    let lives = 3;

    const player = {
        x: 100,
        y: 0,
        width: 60,
        height: 80,
        speed: 5,
        sprintMultiplier: 1.8,
        jumpForce: 12,
        velX: 0,
        velY: 0,
        grounded: false,
        direction: 1,
        isMoving: false,
        isSprinting: false
    };

    const gravity = 0.6;
    const friction = 0.8;
    let platforms = [];

    const keys = {};
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'KeyP' && gameState === 'playing') {
            togglePause();
        }
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        platforms = [
            { x: 0, y: canvas.height - 40, width: canvas.width, height: 40 }
        ];
        if (gameState === 'playing') {
            player.y = canvas.height - 150;
        }
    }

    window.addEventListener('resize', resize);
    resize();

    function showPanel(id) {
        document.getElementById(id).classList.remove('hidden');
    }

    function hidePanels() {
        document.querySelectorAll('.overlay').forEach(el => {
            if(el.id !== 'start-screen' && el.id !== 'pause-menu') el.classList.add('hidden');
        });
    }

    function togglePause() {
        if (gameState !== 'playing') return;
        isPaused = !isPaused;
        if (isPaused) {
            pausedTime = Date.now();
            pauseMenu.classList.remove('hidden');
        } else {
            startTime += (Date.now() - pausedTime);
            pauseMenu.classList.add('hidden');
            hidePanels();
            requestAnimationFrame(gameLoop);
        }
    }

    function resetGame() {
        lives = 3;
        isPaused = false;
        pauseMenu.classList.add('hidden');
        startGame();
    }

    function returnToMenu() {
        isPaused = false;
        gameState = 'menu';
        pauseMenu.classList.add('hidden');
        uiLayer.classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
    }

    function startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        uiLayer.classList.remove('hidden');
        gameState = 'playing';
        isPaused = false;
        startTime = Date.now();
        player.y = canvas.height - 150;
        player.x = 100;
        player.velX = 0;
        player.velY = 0;
        updateHealth();
        requestAnimationFrame(gameLoop);
    }

    function updateHealth() {
        let hearts = '';
        for(let i=0; i<3; i++) {
            hearts += `<span class="heart" style="opacity: ${i < lives ? 1 : 0.2}">❤</span>`;
        }
        healthBar.innerHTML = hearts;
    }

    function updateTimer() {
        if (gameState !== 'playing' || isPaused) return;
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
        const secs = (elapsedTime % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${mins}:${secs}`;
    }

    function update() {
        if (gameState !== 'playing' || isPaused) return;

        let currentSpeed = player.speed;
        player.isSprinting = keys['ShiftLeft'] || keys['ShiftRight'];
        
        if (player.isSprinting) {
            currentSpeed *= player.sprintMultiplier;
            spriteConfig.animSpeed = 5; 
        } else {
            spriteConfig.animSpeed = 9; 
        }

        player.isMoving = false;
        if (keys['KeyW']) {
            if (player.velX < currentSpeed) player.velX++;
            player.direction = 1;
            player.isMoving = true;
        }
        if (keys['KeyA']) {
            if (player.velX > -currentSpeed) player.velX--;
            player.direction = -1;
            player.isMoving = true;
        }

        // Cycle through individual frame files
        if (player.isMoving && player.grounded) {
            spriteConfig.animCounter++;
            const totalFrames = player.isSprinting ? runFiles.length : walkFiles.length;
            
            if (spriteConfig.animCounter >= spriteConfig.animSpeed) {
                spriteConfig.currentFrame = (spriteConfig.currentFrame + 1) % totalFrames;
                spriteConfig.animCounter = 0;
            }
        } else if (!player.isMoving) {
            spriteConfig.currentFrame = 0; 
        }

        if (keys['Space'] && player.grounded) {
            player.velY = -player.jumpForce;
            player.grounded = false;
        }

        player.velY += gravity;
        player.x += player.velX;
        player.y += player.velY;
        player.velX *= friction;

        player.grounded = false;
        platforms.forEach(plat => {
            if (player.x < plat.x + plat.width &&
                player.x + player.width > plat.x &&
                player.y < plat.y + plat.height &&
                player.y + player.height > plat.y) {
                if (player.velY > 0 && player.y + player.height - player.velY <= plat.y) {
                    player.y = plat.y - player.height;
                    player.velY = 0;
                    player.grounded = true;
                }
            }
        });

        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
        
        updateTimer();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (bgLoaded) {
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        } else {
            let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, '#1a1a1a');
            grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.fillStyle = '#332211';
        platforms.forEach(plat => {
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.strokeStyle = '#443322';
            ctx.lineWidth = 2;
            ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
        });

        /* DRAW PLAYER USING INDIVIDUAL FRAME IMAGE */
        ctx.save();
        ctx.translate(player.x + player.width/2, player.y + player.height/2);
        
        if (player.direction === -1) {
            ctx.scale(-1, 1);
        }

        // Get the current processed frame from the correct array
        const currentArray = player.isSprinting ? processedRunImages : processedWalkImages;
        const currentFrameImg = currentArray[spriteConfig.currentFrame];

        if (currentFrameImg && currentFrameImg.complete) {
            ctx.drawImage(
                currentFrameImg, 
                -player.width/2, -player.height/2, 
                player.width, player.height       
            );
        } else {
            // Placeholder while images are loading/processing
            ctx.fillStyle = player.isSprinting ? '#ff4d4d' : '#e2c08d';
            ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
        }
        
        ctx.restore();
    }

    function gameLoop() {
        if (gameState === 'playing' && !isPaused) {
            update();
            draw();
            requestAnimationFrame(gameLoop);
        }
    }