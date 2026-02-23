 const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startScreen = document.getElementById('start-screen');
    const gameUI = document.getElementById('game-ui');
    const distanceMeter = document.getElementById('distance-meter');

    const config = {
        width: 1000,
        height: 600,
        gravity: 0.7,
        friction: 0.85
    };

    canvas.width = config.width;
    canvas.height = config.height;

    let isRunning = false;
    let keys = {};
    
    // Camera object to handle infinite scrolling
    const camera = {
        x: 0,
        update(targetX) {
            // Smoothly follow the player, keeping them roughly in the center
            this.x = targetX - config.width / 3;
        }
    };

    const icarus = {
        x: 150,
        y: 400,
        width: 34,
        height: 58,
        velocityX: 0,
        velocityY: 0,
        speed: 6,
        jumpForce: 14,
        grounded: false,
        direction: 'right',
        animTime: 0,
        
        draw() {
            this.animTime += 0.1;
            ctx.save();
            // Apply camera transformation
            ctx.translate((this.x - camera.x) + this.width/2, this.y + this.height/2);
            if (this.direction === 'left') ctx.scale(-1, 1);

            const bounce = Math.sin(this.animTime) * 1.5;

            // Wings
            ctx.fillStyle = '#d4af37';
            ctx.beginPath();
            ctx.moveTo(-8, -5);
            const wingFlap = this.grounded ? Math.sin(this.animTime * 0.5) * 5 : this.velocityY * 2;
            ctx.quadraticCurveTo(-35, -15 + wingFlap, -40, 15);
            ctx.quadraticCurveTo(-20, 25, -5, 10);
            ctx.fill();

            // Tunic/Body
            ctx.fillStyle = '#fefefe';
            ctx.beginPath();
            ctx.roundRect(-14, -20 + bounce, 28, 42, 8);
            ctx.fill();
            
            // Head
            ctx.fillStyle = '#e6a06d';
            ctx.beginPath();
            ctx.arc(0, -35 + bounce, 13, 0, Math.PI * 2);
            ctx.fill();

            // Legs
            ctx.strokeStyle = '#e6a06d';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            let moveOffset = Math.sin(this.animTime * 1.5) * (Math.abs(this.velocityX) > 1 ? 12 : 2);
            
            ctx.beginPath();
            ctx.moveTo(-6, 20 + bounce);
            ctx.lineTo(-6 + moveOffset, 32);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(6, 20 + bounce);
            ctx.lineTo(6 - moveOffset, 32);
            ctx.stroke();

            ctx.restore();
        },

        update() {
            if (keys['ArrowRight'] || keys['d'] || keys['D']) {
                this.velocityX = this.speed;
                this.direction = 'right';
            } else if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
                this.velocityX = -this.speed;
                this.direction = 'left';
            } else {
                this.velocityX *= config.friction;
            }

            if ((keys['ArrowUp'] || keys[' '] || keys['w']) && this.grounded) {
                this.velocityY = -this.jumpForce;
                this.grounded = false;
            }

            this.velocityY += config.gravity;
            this.x += this.velocityX;
            this.y += this.velocityY;

            const floorLevel = config.height - 60;
            if (this.y + this.height > floorLevel) {
                this.y = floorLevel - this.height;
                this.velocityY = 0;
                this.grounded = true;
            }

            // Update camera to follow Icarus
            camera.update(this.x);
            
            // UI Update
            distanceMeter.innerText = `DEPTH: ${Math.floor(this.x / 10)}m`;
        }
    };

    function drawBackground() {
        // High quality static gradient
        let grad = ctx.createLinearGradient(0, 0, 0, config.height);
        grad.addColorStop(0, '#0a0a0c');
        grad.addColorStop(0.8, '#15151a');
        grad.addColorStop(1, '#1a1410');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, config.width, config.height);

        // Infinite Pillars (Parallax-ish)
        // We use modulo to wrap pillar positions based on camera
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        const pillarSpacing = 300;
        const startPillar = Math.floor(camera.x / pillarSpacing) * pillarSpacing;
        for(let x = startPillar - pillarSpacing; x < startPillar + config.width + pillarSpacing; x += pillarSpacing) {
            // Draw relative to camera
            ctx.fillRect(x - camera.x, 0, 45, config.height);
        }

        // Infinite Floor
        ctx.save();
        ctx.translate(-camera.x % 120, 0); // Offset floor texture relative to camera
        
        ctx.fillStyle = '#1c1c22';
        ctx.fillRect(-120, config.height - 60, config.width + 240, 60);
        
        ctx.fillStyle = '#25252d';
        ctx.fillRect(-120, config.height - 60, config.width + 240, 4);

        // Floor texture/cracks drawn in loop to cover view
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i = -120; i < config.width + 120; i += 120) {
            ctx.moveTo(i, config.height - 60);
            ctx.lineTo(i - 10, config.height);
        }
        ctx.stroke();
        ctx.restore();
    }

    function gameLoop() {
        if (!isRunning) return;
        ctx.clearRect(0, 0, config.width, config.height);
        drawBackground();
        icarus.update();
        icarus.draw();
        requestAnimationFrame(gameLoop);
    }

    function startGame() {
        startScreen.classList.add('hidden');
        gameUI.classList.remove('hidden');
        isRunning = true;
        gameLoop();
    }

    window.addEventListener('keydown', (e) => { keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key] = false; });

    window.onload = () => {
        drawBackground();
    };