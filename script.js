const SFX = (function () {
    var _ac = null;
    function ac() {
        if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
        if (_ac.state === 'suspended') _ac.resume();
        return _ac;
    }

    /* ── low-level helpers ── */
    function osc(freq, freqEnd, wave, vol, volEnd, dur, startTime) {
        try {
            var c = ac(), t = startTime || c.currentTime;
            var o = c.createOscillator(), g = c.createGain();
            o.type = wave || 'sine';
            o.frequency.setValueAtTime(freq, t);
            if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(volEnd || 0.0001, t + dur);
            o.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t + dur + 0.02);
        } catch (e) {}
    }

    function whiteNoise(dur, vol, filterHz, filterQ, startTime) {
        try {
            var c = ac(), t = startTime || c.currentTime;
            var buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
            var d = buf.getChannelData(0);
            for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            var src = c.createBufferSource();
            src.buffer = buf;
            var f = c.createBiquadFilter();
            f.type = 'bandpass'; f.frequency.value = filterHz || 600; f.Q.value = filterQ || 1;
            var g = c.createGain();
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(f); f.connect(g); g.connect(c.destination);
            src.start(t); src.stop(t + dur + 0.02);
        } catch (e) {}
    }

    // Brown noise: integrated white noise — much deeper, richer rumble
    function brownNoise(dur, vol, lpFreq, lpQ, startTime) {
        try {
            var c = ac(), t = startTime || c.currentTime;
            var sr = c.sampleRate;
            var buf = c.createBuffer(1, Math.ceil(sr * dur), sr);
            var d = buf.getChannelData(0), prev = 0;
            for (var i = 0; i < d.length; i++) {
                prev = (prev + 0.02 * (Math.random() * 2 - 1)) / 1.02;
                d[i] = prev * 4.0;
            }
            var src = c.createBufferSource(); src.buffer = buf;
            var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpFreq || 200; lp.Q.value = lpQ || 1;
            var g = c.createGain();
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(lp); lp.connect(g); g.connect(c.destination);
            src.start(t); src.stop(t + dur + 0.02);
        } catch(e) {}
    }

    // Shaped noise: attack/decay envelope with optional high+low filter stack
    function shapedNoise(attack, decay, peakVol, lpHz, hpHz, startTime) {
        try {
            var c = ac(), t = startTime || c.currentTime;
            var dur = attack + decay;
            var sr = c.sampleRate;
            var buf = c.createBuffer(1, Math.ceil(sr * dur), sr);
            var d = buf.getChannelData(0);
            for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            var src = c.createBufferSource(); src.buffer = buf;
            var lp = c.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = lpHz || 2000;
            var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hpHz || 80;
            var g = c.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(peakVol, t + attack);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(c.destination);
            src.start(t); src.stop(t + dur + 0.02);
        } catch(e) {}
    }

    function delay(fn, ms) { setTimeout(fn, ms); }

    /* ── themed sound functions ── */

    // Stone thud when foot hits platform - heavy, dungeon-like
    function land() {
        var c = ac(), t = c.currentTime;
        // Low stone thud
        osc(90, 45, 'sine',     0.35, 0.001, 0.18, t);
        osc(60, 30, 'triangle', 0.20, 0.001, 0.14, t);
        // Stone scrape texture
        whiteNoise(0.10, 0.18, 180, 0.8, t);
    }

    // Footsteps - crisp game-style tap with L/R alternation
    var _stepFoot = 0;
    var _lastStepTime = 0;
    function step(sprinting) {
        var c = ac(), t = c.currentTime;
        var minGap = sprinting ? 0.15 : 0.25;
        if (t - _lastStepTime < minGap) return;
        _lastStepTime = t;
        _stepFoot = 1 - _stepFoot;
        // Slight L/R pitch variation
        var p = _stepFoot ? 1.0 : 0.92;
        var v = sprinting ? 0.16 : 0.10;
        // Crisp click transient (the tap)
        osc(900 * p, 200 * p, 'square',   v * 0.7, 0.001, 0.022, t);
        // Body thud underneath
        osc(140 * p, 60  * p, 'sine',     v * 1.2, 0.001, 0.06,  t);
        // Surface texture snap
        whiteNoise(0.018, v * 1.1, 1200 * p, 2.0, t);
        whiteNoise(0.030, v * 0.6, 400  * p, 1.2, t + 0.005);
        // Sprint: heavier thud + louder snap
        if (sprinting) {
            osc(80, 30, 'sine', 0.18, 0.001, 0.08, t);
            whiteNoise(0.025, 0.14, 600, 1.5, t);
        }
    }

    // Jump — realistic layered: foot strike + body liftoff + air rush
    function jump() {
        var c = ac(), t = c.currentTime;

        // === FOOT LEAVING GROUND ===
        // Leather boot sole peeling off stone — sharp transient crack
        // High-freq attack (nail/leather on stone), very short
        shapedNoise(0.004, 0.018, 0.35, 4500, 1800, t);
        // Body of the sole impact — mid thump
        shapedNoise(0.005, 0.030, 0.28, 1200, 180,  t + 0.002);
        // Low resonance of stone floor vibrating briefly
        brownNoise(0.040, 0.22, 160, 3.5, t + 0.003);

        // === BODY LIFTOFF ===
        // Mass leaving ground — dull pressure thud (deepest layer)
        brownNoise(0.055, 0.30, 90,  5.0, t + 0.008);
        brownNoise(0.040, 0.18, 220, 3.0, t + 0.012);
        // Muscle/tendon effort — very short mid crunch
        shapedNoise(0.006, 0.022, 0.14, 900, 350, t + 0.010);

        // === EQUIPMENT & CLOTHING ===
        // Armor/belt/items shifting — layered fabric rustle
        shapedNoise(0.010, 0.055, 0.07, 3500, 800,  t + 0.025);
        shapedNoise(0.008, 0.040, 0.04, 6500, 2000, t + 0.032);

        // === AIR DISPLACEMENT (ascending) ===
        // Soft column of air moving past body as it rises — not a whoosh, just presence
        shapedNoise(0.015, 0.140, 0.022, 1600, 600,  t + 0.050);
        shapedNoise(0.012, 0.100, 0.014, 3200, 1200, t + 0.070);
    }

    // Dash — realistic explosive sprint: impact + pressure wave + air tear + wake
    function dash() {
        var c = ac(), t = c.currentTime;

        // === LAUNCH FOOT IMPACT ===
        // Boot slamming hard into stone floor for propulsion
        // Instant transient — very tight, very loud
        shapedNoise(0.003, 0.012, 0.55, 2000, 400,  t);
        brownNoise(0.005, 0.025, 180,  6.0,  t + 0.001);  // floor resonance
        brownNoise(0.008, 0.040, 60,   8.0,  t + 0.002);  // deep sub thud

        // === PRESSURE WAVE (air being shoved aside) ===
        // The invisible "punch" of air displaced by sudden acceleration
        brownNoise(0.040, 0.20, 120,  4.5,  t + 0.006);
        shapedNoise(0.008, 0.055, 0.32, 600,  60,   t + 0.008);
        shapedNoise(0.010, 0.060, 0.22, 1200, 200,  t + 0.012);

        // === BODY THROUGH AIR ===
        // Main air-cutting whoosh — wide frequency spread, fast attack, medium decay
        // Low body of the whoosh
        shapedNoise(0.012, 0.080, 0.30, 700,   80,  t + 0.018);
        // Mid air column
        shapedNoise(0.010, 0.065, 0.22, 1800,  350, t + 0.028);
        // High edge — air being cut sharply
        shapedNoise(0.008, 0.050, 0.14, 5000,  1200, t + 0.040);
        // Highest frequency air tear
        shapedNoise(0.006, 0.035, 0.08, 10000, 3500, t + 0.050);

        // === CLOTHING SNAP ===
        // Fabric violently catching air — sharp short bursts
        shapedNoise(0.004, 0.018, 0.18, 4000, 2000, t + 0.010);
        shapedNoise(0.004, 0.014, 0.12, 7000, 3500, t + 0.016);

        // === TURBULENCE WAKE ===
        // Air collapsing back in behind the body — trailing decay
        shapedNoise(0.015, 0.120, 0.09, 1400, 300,  t + 0.080);
        shapedNoise(0.012, 0.090, 0.05, 3000, 800,  t + 0.100);
        brownNoise(0.020, 0.080, 200,  2.0,  t + 0.085);
    }

    // Room clear - short triumphant ancient fanfare
    function roomClear() {
        var c = ac(), t = c.currentTime;
        var melody = [392, 523, 659, 784];
        melody.forEach(function(freq, i) {
            osc(freq, freq * 1.01, 'square',   0.10, 0.001, 0.14, t + i * 0.11);
            osc(freq * 0.5, freq * 0.505, 'triangle', 0.06, 0.001, 0.12, t + i * 0.11);
        });
    }

    // Full victory fanfare - Greek/ancient triumph
    function victory() {
        var c = ac(), t = c.currentTime;
        // Ascending fanfare
        var notes = [392, 494, 587, 659, 784, 659, 784, 1047];
        var times = [0, 0.13, 0.26, 0.39, 0.52, 0.68, 0.80, 0.92];
        notes.forEach(function(freq, i) {
            osc(freq, freq,       'square',   0.12, 0.001, 0.18, t + times[i]);
            osc(freq * 0.5, freq * 0.5, 'triangle', 0.07, 0.001, 0.15, t + times[i]);
        });
        // Bell-like shimmer on the final note
        delay(function() {
            osc(1047, 1047, 'sine', 0.15, 0.001, 0.6, c.currentTime);
            osc(1319, 1319, 'sine', 0.08, 0.001, 0.5, c.currentTime);
        }, 920);
    }

    // Lose a life - descending ominous toll
    function loseLife() {
        var c = ac(), t = c.currentTime;
        osc(220, 110, 'sawtooth', 0.18, 0.001, 0.35, t);
        osc(165, 82,  'square',   0.12, 0.001, 0.30, t + 0.05);
        whiteNoise(0.15, 0.10, 200, 0.6, t);
        delay(function() {
            osc(110, 55, 'sine', 0.14, 0.001, 0.40, c.currentTime);
        }, 280);
    }

    // Death - full collapse + deep dungeon toll
    function death() {
        var c = ac(), t = c.currentTime;
        // Descending crash
        osc(300, 60,  'sawtooth', 0.22, 0.001, 0.50, t);
        osc(200, 40,  'square',   0.16, 0.001, 0.45, t + 0.05);
        osc(150, 30,  'triangle', 0.14, 0.001, 0.40, t + 0.10);
        whiteNoise(0.20, 0.18, 180, 0.7, t);
        // Distant stone rumble
        delay(function() {
            whiteNoise(0.35, 0.12, 100, 0.5, c.currentTime);
            osc(55, 40, 'sine', 0.18, 0.001, 0.50, c.currentTime);
        }, 350);
        // Final toll
        delay(function() {
            osc(110, 108, 'sine', 0.16, 0.001, 0.80, c.currentTime);
            osc(82,  80,  'sine', 0.10, 0.001, 0.70, c.currentTime);
        }, 650);
    }

    // Menu click - stone button press
    function menuClick() {
        var c = ac(), t = c.currentTime;
        osc(440, 380, 'triangle', 0.08, 0.001, 0.08, t);
        whiteNoise(0.05, 0.06, 800, 1.0, t);
    }

    // Portal enter - mystical ancient resonance
    function portal() {
        var c = ac(), t = c.currentTime;
        osc(330, 660, 'sine', 0.12, 0.001, 0.30, t);
        osc(495, 990, 'sine', 0.08, 0.001, 0.25, t + 0.05);
        whiteNoise(0.20, 0.08, 2000, 0.3, t);
    }

    // Realistic dungeon ambience
    var _bgNodes = [];
    var _bgTimers = [];

    function makeLoopingNoise(c, loopSecs, lpFreq, lpQ, hpFreq, gainVal) {
        var sr = c.sampleRate;
        var len = Math.ceil(sr * loopSecs);
        var buf = c.createBuffer(1, len, sr);
        var d = buf.getChannelData(0);
        // Brown-ish noise: integrate white noise for deeper rumble
        var prev = 0;
        for (var i = 0; i < len; i++) {
            prev = (prev + 0.02 * (Math.random() * 2 - 1)) / 1.02;
            d[i] = prev * 3.5;
        }
        var src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        var lp = c.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = lpFreq; lp.Q.value = lpQ;
        var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = hpFreq; hp.Q.value = 0.5;
        var g  = c.createGain(); g.gain.value = gainVal;
        src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(c.destination);
        src.start();
        return src;
    }

    function startBG() {
        try {
            stopBG();
            var c = ac();

            // --- Layer 1: Deep cave air pressure ---
            // Very low broadband rumble (30-90 Hz) - the "weight" of tons of stone above
            var rumble = makeLoopingNoise(c, 3.7, 90, 3.0, 25, 0.18);

            // --- Layer 2: Mid cave resonance ---
            // Stone walls reflecting air currents (100-400 Hz)
            var midCave = makeLoopingNoise(c, 4.3, 380, 1.5, 95, 0.09);

            // --- Layer 3: Air movement / draft ---
            // Slow moving air through tunnels - slightly higher freq, very soft
            var draft = makeLoopingNoise(c, 5.1, 900, 0.8, 300, 0.045);

            _bgNodes = [rumble, midCave, draft];

            // --- Slow cave breathing: LFO on draft volume ---
            // Simulates slow air pressure changes - 0.08 Hz cycle (~12 seconds)
            var breathLfo = c.createOscillator();
            var breathDepth = c.createGain();
            breathLfo.type = 'sine'; breathLfo.frequency.value = 0.08;
            breathDepth.gain.value = 0.025;
            var draftG = c.createGain(); draftG.gain.value = 0.045;
            breathLfo.connect(breathDepth); breathDepth.connect(draftG.gain);
            breathLfo.start();
            _bgNodes.push(breathLfo);

            // --- Torch flame crackle ---
            // --- Torch flame: 3 layers — base roar, mid crackle, high spit ---
            // === TORCH: 4-layer realistic fire ===
            // Layer A: Deep base roar — low continuous flame body
            // Uses brown noise for richer, deeper fire fundamental
            var fbLen = Math.ceil(c.sampleRate * 2.5);
            var fb = c.createBuffer(1, fbLen, c.sampleRate);
            var fbd = fb.getChannelData(0), fbp = 0;
            for (var fi = 0; fi < fbLen; fi++) {
                fbp = (fbp + 0.02 * (Math.random()*2-1)) / 1.02;
                fbd[fi] = fbp * 3.5;
            }
            var fSrc = c.createBufferSource(); fSrc.buffer = fb; fSrc.loop = true;
            // Two-stage filter: bandpass around flame fundamental, then gentle high shelf
            var fLP = c.createBiquadFilter(); fLP.type = 'lowpass';  fLP.frequency.value = 420; fLP.Q.value = 0.8;
            var fHP = c.createBiquadFilter(); fHP.type = 'highpass'; fHP.frequency.value = 80;  fHP.Q.value = 0.6;
            var fHS = c.createBiquadFilter(); fHS.type = 'highshelf'; fHS.frequency.value = 2000; fHS.gain.value = 6;
            var fG  = c.createGain(); fG.gain.value = 0.060;
            fSrc.connect(fLP); fLP.connect(fHP); fHP.connect(fHS); fHS.connect(fG); fG.connect(c.destination);
            fSrc.start();
            _bgNodes.push(fSrc);

            // Layer B: Mid-range flame body — brighter, white noise filtered 300-900 Hz
            var fb2Len = Math.ceil(c.sampleRate * 1.9);
            var fb2 = c.createBuffer(1, fb2Len, c.sampleRate);
            var fb2d = fb2.getChannelData(0);
            for (var fi2 = 0; fi2 < fb2Len; fi2++) fb2d[fi2] = Math.random()*2-1;
            var fSrc2 = c.createBufferSource(); fSrc2.buffer = fb2; fSrc2.loop = true;
            var fBP2 = c.createBiquadFilter(); fBP2.type = 'bandpass'; fBP2.frequency.value = 550; fBP2.Q.value = 1.2;
            var fG2  = c.createGain(); fG2.gain.value = 0.032;
            fSrc2.connect(fBP2); fBP2.connect(fG2); fG2.connect(c.destination);
            fSrc2.start();
            _bgNodes.push(fSrc2);

            // Flicker LFO on base — real fire breathes irregularly
            // Two LFOs at slightly different rates = more organic variation
            var lfo1 = c.createOscillator(); var ld1 = c.createGain();
            var lfo2 = c.createOscillator(); var ld2 = c.createGain();
            lfo1.type = 'sine'; lfo1.frequency.value = 1.1 + Math.random()*0.8; ld1.gain.value = 0.020;
            lfo2.type = 'sine'; lfo2.frequency.value = 2.3 + Math.random()*1.2; ld2.gain.value = 0.012;
            lfo1.connect(ld1); ld1.connect(fG.gain); lfo1.start();
            lfo2.connect(ld2); ld2.connect(fG2.gain); lfo2.start();
            _bgNodes.push(lfo1); _bgNodes.push(lfo2);

            // Layer C: Crackle — resin/wood fiber pops at random intervals
            function flameCrackle() {
                if (_bgNodes.length === 0) return;
                try {
                    var ct = ac(), now = ct.currentTime;
                    // Main pop: short bandpass burst — wood cell exploding
                    var dur  = 0.006 + Math.random()*0.022;
                    var vol  = 0.025 + Math.random()*0.040;
                    var freq = 500  + Math.random()*1400;
                    var q    = 3.0  + Math.random()*4.0;
                    whiteNoise(dur, vol, freq, q, now);
                    // Optional secondary: resin bubble — lower pitch, slightly longer
                    if (Math.random() < 0.40) {
                        whiteNoise(0.012 + Math.random()*0.020, vol*0.55,
                                   200 + Math.random()*350, 2.5, now + 0.004);
                    }
                    // Rare loud crack: bigger piece of wood splitting
                    if (Math.random() < 0.06) {
                        whiteNoise(0.030, vol*1.4, 300 + Math.random()*200, 1.8, now);
                        whiteNoise(0.020, vol*0.8, 800 + Math.random()*400, 2.5, now + 0.008);
                    }
                } catch(e) {}
                _bgTimers.push(setTimeout(flameCrackle, 35 + Math.random()*200));
            }
            flameCrackle();

            // Layer D: Spark spit — ejected embers, very high freq, brief
            function flameSpit() {
                if (_bgNodes.length === 0) return;
                try {
                    var ct = ac(), now = ct.currentTime;
                    // Spark launch: ultra-short high burst
                    whiteNoise(0.005 + Math.random()*0.008, 0.020 + Math.random()*0.025,
                               4000 + Math.random()*4000, 5.0 + Math.random()*3.0, now);
                    // Trailing hiss as spark flies through air
                    whiteNoise(0.014, 0.007, 7000 + Math.random()*3000, 3.0, now + 0.006);
                } catch(e) {}
                _bgTimers.push(setTimeout(flameSpit, 200 + Math.random()*700));
            }
            flameSpit();
// --- Stone water drip ---
            // Real drip: sharp attack + resonant sine decay + quiet secondary drop
            function stoneDrip() {
                if (_bgNodes.length === 0) return;
                try {
                    var ct = ac(), now = ct.currentTime;
                    // Primary drop impact (water hitting stone pool)
                    // High freq attack tap
                    whiteNoise(0.008, 0.06, 2800 + Math.random()*600, 3.5, now);
                    // Resonant sine ring-out (water surface vibration)
                    osc(900 + Math.random()*300, 400 + Math.random()*150, 'sine', 0.055, 0.001, 0.18, now);
                    osc(600 + Math.random()*200, 280 + Math.random()*100, 'sine', 0.030, 0.001, 0.14, now + 0.01);
                    // Ripple tail (very soft secondary ring)
                    osc(1200 + Math.random()*400, 500, 'sine', 0.018, 0.001, 0.22, now + 0.04);
                    // Occasional double-drip
                    if (Math.random() < 0.25) {
                        var delay2 = 0.12 + Math.random() * 0.18;
                        whiteNoise(0.007, 0.04, 2600 + Math.random()*500, 3.0, now + delay2);
                        osc(800 + Math.random()*200, 380, 'sine', 0.038, 0.001, 0.14, now + delay2);
                    }
                } catch(e) {}
                _bgTimers.push(setTimeout(stoneDrip, 4000 + Math.random() * 7000));
            }
            stoneDrip();

            // --- Distant wind moan ---
            // Deep tunnels carry long low moans every 15-40 seconds
            function windMoan() {
                if (_bgNodes.length === 0) return;
                try {
                    var ct = ac(), now = ct.currentTime;
                    var dur  = 2.5 + Math.random() * 2.0;
                    var freq = 55 + Math.random() * 40;
                    // Slow swell - silence -> presence -> silence
                    whiteNoise(dur, 0.05, freq, 8.0 + Math.random()*4, now);
                    whiteNoise(dur * 0.7, 0.035, freq * 2.1, 6.0, now + 0.4);
                } catch(e) {}
                _bgTimers.push(setTimeout(windMoan, 15000 + Math.random() * 25000));
            }
            windMoan();

            // --- Occasional distant stone creak / settle ---
            function stoneCreak() {
                if (_bgNodes.length === 0) return;
                try {
                    var ct = ac(), now = ct.currentTime;
                    // Low freq noise filtered very tight = creaking stone
                    whiteNoise(0.08 + Math.random()*0.12, 0.04, 140 + Math.random()*80, 6.0 + Math.random()*4, now);
                    whiteNoise(0.06 + Math.random()*0.08, 0.025, 220 + Math.random()*60, 5.0, now + 0.05);
                } catch(e) {}
                _bgTimers.push(setTimeout(stoneCreak, 20000 + Math.random() * 35000));
            }
            stoneCreak();

        } catch(e) {}
    }

    function stopBG() {
        _bgNodes.forEach(function(n) { try { n.stop(); } catch(e) {} });
        _bgTimers.forEach(function(t) { clearTimeout(t); });
        _bgNodes = []; _bgTimers = [];
    }
    function pauseBG(paused) {
        try { var c = ac(); if (paused) c.suspend(); else c.resume(); } catch(e) {}
    }

    return {
        jump: jump, land: land, step: step, dash: dash,
        roomClear: roomClear, victory: victory,
        loseLife: loseLife, death: death,
        menuClick: menuClick, portal: portal,
        startBG: startBG, stopBG: stopBG, pauseBG: pauseBG
    };
})();

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
        {id:'e1',platforms:[{x:0,y:0.92,w:0.25,h:0.08},{x:0.3,y:0.92,w:0.2,h:0.08},{x:0.55,y:0.78,w:0.18,h:0.07},{x:0.78,y:0.92,w:0.22,h:0.08}]},
        {id:'e2',platforms:[{x:0,y:0.92,w:0.22,h:0.08},{x:0.27,y:0.82,w:0.18,h:0.07},{x:0.5,y:0.92,w:0.2,h:0.08},{x:0.75,y:0.75,w:0.25,h:0.07}]},
        {id:'e3',platforms:[{x:0,y:0.92,w:0.2,h:0.08},{x:0.25,y:0.75,w:0.15,h:0.07},{x:0.45,y:0.92,w:0.18,h:0.08},{x:0.68,y:0.82,w:0.15,h:0.07},{x:0.88,y:0.92,w:0.12,h:0.08}]}
    ],
    LAYER_2_PITS: [
        {id:'p1',platforms:[{x:0,y:0.92,w:0.18,h:0.08},{x:0.22,y:0.82,w:0.14,h:0.07},{x:0.4,y:0.92,w:0.16,h:0.08},{x:0.6,y:0.78,w:0.14,h:0.07},{x:0.78,y:0.92,w:0.22,h:0.08}]},
        {id:'p2',platforms:[{x:0,y:0.92,w:0.2,h:0.08},{x:0.25,y:0.75,w:0.15,h:0.07},{x:0.44,y:0.92,w:0.16,h:0.08},{x:0.64,y:0.82,w:0.14,h:0.07},{x:0.82,y:0.92,w:0.18,h:0.08}]}
    ],
    LAYER_3_HALLS: [
        {id:'h1',platforms:[{x:0,y:0.92,w:0.3,h:0.08},{x:0.35,y:0.8,w:0.2,h:0.07},{x:0.6,y:0.92,w:0.15,h:0.08},{x:0.8,y:0.72,w:0.2,h:0.07}]},
        {id:'h2',platforms:[{x:0,y:0.92,w:0.22,h:0.08},{x:0.27,y:0.82,w:0.18,h:0.07},{x:0.5,y:0.7,w:0.16,h:0.07},{x:0.7,y:0.82,w:0.14,h:0.07},{x:0.88,y:0.92,w:0.12,h:0.08}]}
    ],
    LAYER_4_CLIFFS: [
        {id:'c1',platforms:[{x:0,y:0.92,w:0.2,h:0.08},{x:0.25,y:0.78,w:0.15,h:0.07},{x:0.44,y:0.65,w:0.14,h:0.07},{x:0.62,y:0.78,w:0.15,h:0.07},{x:0.81,y:0.92,w:0.19,h:0.08}]},
        {id:'c2',platforms:[{x:0,y:0.85,w:0.18,h:0.08},{x:0.22,y:0.92,w:0.16,h:0.08},{x:0.42,y:0.75,w:0.14,h:0.07},{x:0.6,y:0.85,w:0.16,h:0.07},{x:0.8,y:0.7,w:0.2,h:0.07}]}
    ],
    LAYER_5_RUINS: [
        {id:'r1',platforms:[{x:0,y:0.92,w:0.22,h:0.08},{x:0.27,y:0.8,w:0.14,h:0.07},{x:0.45,y:0.92,w:0.16,h:0.08},{x:0.65,y:0.75,w:0.15,h:0.07},{x:0.84,y:0.92,w:0.16,h:0.08}]},
        {id:'r2',platforms:[{x:0,y:0.92,w:0.18,h:0.08},{x:0.22,y:0.78,w:0.16,h:0.07},{x:0.42,y:0.65,w:0.14,h:0.07},{x:0.6,y:0.78,w:0.18,h:0.07},{x:0.82,y:0.92,w:0.18,h:0.08}]}
    ],
    LAYER_6_FORGE: [
        {id:'f1',platforms:[{x:0,y:0.92,w:0.2,h:0.08},{x:0.25,y:0.82,w:0.15,h:0.07},{x:0.44,y:0.7,w:0.16,h:0.07},{x:0.64,y:0.82,w:0.14,h:0.07},{x:0.82,y:0.92,w:0.18,h:0.08}]},
        {id:'f2',platforms:[{x:0,y:0.85,w:0.22,h:0.08},{x:0.27,y:0.72,w:0.16,h:0.07},{x:0.47,y:0.85,w:0.14,h:0.07},{x:0.65,y:0.72,w:0.16,h:0.07},{x:0.85,y:0.92,w:0.15,h:0.08}]}
    ],
    LAYER_7_SANCTUM: [
        {id:'s1',platforms:[{x:0,y:0.92,w:0.18,h:0.08},{x:0.22,y:0.75,w:0.16,h:0.07},{x:0.42,y:0.92,w:0.18,h:0.08},{x:0.64,y:0.78,w:0.16,h:0.07},{x:0.84,y:0.92,w:0.16,h:0.08}]},
        {id:'s2',platforms:[{x:0,y:0.92,w:0.2,h:0.08},{x:0.25,y:0.8,w:0.14,h:0.07},{x:0.43,y:0.68,w:0.16,h:0.07},{x:0.63,y:0.8,w:0.14,h:0.07},{x:0.81,y:0.92,w:0.19,h:0.08}]}
    ],
    LAYER_8_THRONE: [
        {id:'t1',platforms:[{x:0,y:0.92,w:0.16,h:0.08},{x:0.2,y:0.78,w:0.14,h:0.07},{x:0.38,y:0.65,w:0.14,h:0.07},{x:0.56,y:0.78,w:0.14,h:0.07},{x:0.74,y:0.65,w:0.14,h:0.07},{x:0.92,y:0.92,w:0.08,h:0.08}]},
        {id:'t2',platforms:[{x:0,y:0.92,w:0.18,h:0.08},{x:0.22,y:0.8,w:0.16,h:0.07},{x:0.42,y:0.92,w:0.14,h:0.08},{x:0.6,y:0.72,w:0.16,h:0.07},{x:0.8,y:0.85,w:0.2,h:0.07}]}
    ],
    INTERSECTIONS: [
        {id:'int1',platforms:[{x:0,y:0.92,w:0.2,h:0.08},{x:0.25,y:0.78,w:0.16,h:0.07},{x:0.45,y:0.92,w:0.16,h:0.08},{x:0.65,y:0.78,w:0.16,h:0.07},{x:0.85,y:0.92,w:0.15,h:0.08}]},
        {id:'int2',platforms:[{x:0,y:0.92,w:0.18,h:0.08},{x:0.22,y:0.75,w:0.14,h:0.07},{x:0.4,y:0.85,w:0.16,h:0.07},{x:0.6,y:0.72,w:0.16,h:0.07},{x:0.8,y:0.92,w:0.2,h:0.08}]}
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

const SPRITE_W = 96;
const SPRITE_H = 96;
const COL_W = 40;
const COL_H = 80;
const COL_OFFSET_X = (SPRITE_W - COL_W) / 2;
const COL_OFFSET_Y = SPRITE_H - COL_H;

const STAMINA_MAX       = 100;
const STAMINA_DRAIN     = 0.6;
const STAMINA_REGEN     = 0.3;
const STAMINA_SPRINT_MIN = 10;
const DASH_COST         = 30;
const DASH_SPEED        = 11;
const DASH_DURATION     = 12;
const DASH_COOLDOWN     = 45;

const player = {
    x: 50, y: 0,
    vx: 0, vy: 0,
    speed: 4, sprint: 1.8, jump: 10,
    grounded: false, wasGrounded: false, dir: 1,
    isMoving: false, sprinting: false,
    frame: 0, animTick: 0,
    idleFrame: 0, idleTick: 0,
    stamina: STAMINA_MAX,
    dashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashDir: 1
};

const gravity = 0.7;
const friction = 0.78;
const keys = {};
const justPressed = {};

window.addEventListener('keydown', function(e) {
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
    if (e.code === 'KeyP') togglePause();
    if (e.code === 'Enter' && gameState === 'menu') startGame();
    if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', function(e) {
    keys[e.code] = false;
    justPressed[e.code] = false;
});

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

function spawnDashTrail() {
    for (var i = 0; i < 5; i++) {
        particles.push({
            x: player.x + SPRITE_W/2 + (Math.random()-0.5)*COL_W,
            y: player.y + SPRITE_H*0.5 + (Math.random()-0.5)*20,
            vx: -player.dashDir * (Math.random()*2+1),
            vy: (Math.random()-0.5)*1.5,
            life: 1, decay: 0.08 + Math.random()*0.06,
            size: Math.random()*5+3,
            color: '#44aaff',
            type: 'dash'
        });
    }
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
    for (var bx = -ox; bx < W+bw; bx += bw) {
        for (var by = 0; by < H; by += bh) {
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
        for (var tx=rx; tx<rx+rw; tx+=48) { ctx.beginPath(); ctx.moveTo(tx,ry); ctx.lineTo(tx,ry+rh); ctx.stroke(); }
        for (var ty=ry; ty<ry+rh; ty+=22) { ctx.beginPath(); ctx.moveTo(rx,ty); ctx.lineTo(rx+rw,ty); ctx.stroke(); }

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

    for (var i=0; i<3; i++) {
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

function drawStaminaBar() {
    const barW = 120;
    const barH = 8;
    const barX = 16;
    const barY = canvas.height - 36;
    const pct  = player.stamina / STAMINA_MAX;
    const isLow    = player.stamina < 30;
    const isDashing = player.dashing;
    const dashReady = player.dashCooldown <= 0 && player.stamina >= DASH_COST;

    ctx.save();

    ctx.fillStyle = 'rgba(10,6,14,0.75)';
    ctx.fillRect(barX - 2, barY - 14, barW + 62, barH + 20);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = 'rgba(212,168,67,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    if (pct > 0) {
        var fillColor = isDashing ? '#88ccff' : (isLow ? '#aa4400' : '#3399dd');
        var grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        grad.addColorStop(0, fillColor);
        grad.addColorStop(1, isDashing ? '#ffffff' : '#66bbff');
        ctx.fillStyle = grad;
        ctx.fillRect(barX, barY, barW * pct, barH);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(barX, barY, barW * pct, barH / 2);
    }

    ctx.font = '600 10px Cinzel, serif';
    ctx.fillStyle = isLow ? '#ff6633' : 'rgba(212,168,67,0.9)';
    ctx.fillText('STAMINA', barX, barY - 3);

    var dashX = barX + barW + 10;
    var dashH = barH + 6;
    var dashW = 44;

    ctx.fillStyle = dashReady ? 'rgba(30,80,140,0.9)' : 'rgba(20,20,30,0.7)';
    ctx.fillRect(dashX, barY - 3, dashW, dashH);
    ctx.strokeStyle = dashReady ? '#44aaff' : 'rgba(100,100,120,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dashX, barY - 3, dashW, dashH);

    if (!dashReady && player.dashCooldown > 0) {
        var cdPct = 1 - (player.dashCooldown / DASH_COOLDOWN);
        ctx.fillStyle = 'rgba(68,170,255,0.25)';
        ctx.fillRect(dashX, barY - 3, dashW * cdPct, dashH);
    }

    ctx.font = '600 9px Cinzel, serif';
    ctx.fillStyle = dashReady ? '#88ddff' : '#445566';
    ctx.textAlign = 'center';
    ctx.fillText('DASH [F]', dashX + dashW / 2, barY + barH + 1);
    ctx.textAlign = 'left';

    ctx.restore();
}

function drawPlayer() {
    ctx.save();
    disableSmoothing();

    const sx = player.x, sy = player.y;

    if (player.dashing) {
        ctx.globalAlpha = 0.5 + Math.random() * 0.3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#44aaff';
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + SPRITE_W/2, sy + SPRITE_H + 2, COL_W*0.65, 5, 0, 0, Math.PI*2);
    ctx.fill();

    var img = null;
    if (!player.isMoving) {
        img = (player.idleFrame === 0 ? sprites.idle : sprites.idle2);
    } else if (player.sprinting || player.dashing) {
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
        if (player.dir === -1) { ctx.translate((sx + SPRITE_W/2)*2, 0); ctx.scale(-1,1); }
        ctx.fillStyle = '#d4a843';
        ctx.fillRect(sx+8, sy+20, SPRITE_W-16, SPRITE_H-28);
        ctx.fillStyle = '#f0c080';
        ctx.fillRect(sx+10, sy+2, SPRITE_W-20, 20);
        ctx.fillStyle = '#8a3020';
        ctx.fillRect(sx+8, sy+22, SPRITE_W-16, 6);
    }

    ctx.restore();
    disableSmoothing();
}

function drawParticles() {
    particles.forEach(function(p) {
        ctx.save();
        ctx.globalAlpha = p.life * 0.75;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.type === 'dash' ? 12 : 6;
        ctx.shadowColor = p.color;
        ctx.fillRect(Math.round(p.x-p.size/2), Math.round(p.y-p.size/2), Math.ceil(p.size), Math.ceil(p.size));
        ctx.restore();
    });
}

function update() {
    if (isPaused) return;
    bgScrollX += 0.6;

    var canSprint = player.stamina > STAMINA_SPRINT_MIN;
    player.sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && canSprint && !player.dashing;
    player.isMoving  = false;

    if (keys['KeyD'] || keys['KeyW']) { player.vx += 0.6; player.dir =  1; player.isMoving = true; }
    if (keys['KeyA'])                  { player.vx -= 0.6; player.dir = -1; player.isMoving = true; }
    if (keys['Space'] && player.grounded) { player.vy = -player.jump; player.grounded = false; SFX.jump(); }

    if (justPressed['KeyF'] && player.dashCooldown <= 0 && player.stamina >= DASH_COST && !player.dashing) {
        player.dashing      = true; SFX.dash();
        player.dashTimer    = DASH_DURATION;
        player.dashDir      = player.dir;
        player.stamina     -= DASH_COST;
        player.dashCooldown = DASH_COOLDOWN;
        if (player.vy > 0) player.vy *= 0.3;
    }
    justPressed['KeyF'] = false;

    if (player.dashing) {
        player.vx = player.dashDir * DASH_SPEED;
        player.dashTimer--;
        spawnDashTrail();
        if (player.dashTimer <= 0) {
            player.dashing = false;
            player.vx *= 0.4;
        }
    }

    if (player.sprinting && player.isMoving) {
        player.stamina = Math.max(0, player.stamina - STAMINA_DRAIN);
        player.vx *= 1.08;
    } else if (!player.dashing) {
        var regenRate = player.isMoving ? STAMINA_REGEN * 0.5 : STAMINA_REGEN;
        player.stamina = Math.min(STAMINA_MAX, player.stamina + regenRate);
    }

    if (player.dashCooldown > 0) player.dashCooldown--;

    player.vy += gravity;
    player.vx *= friction;
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < 0) { player.x = 0; player.vx = 0; }

    if (player.isMoving && player.grounded) {
        player.animTick++;
        var limit = (player.sprinting || player.dashing) ? 4 : 7;
        if (player.animTick > limit) {
            var arr = (player.sprinting || player.dashing) ? sprites.run : sprites.walk;
            player.frame = (player.frame + 1) % Math.max(arr.length, 1);
            player.animTick = 0;
            if (!player.dashing) SFX.step(player.sprinting);
        }
        if (!player.dashing && Math.random() < 0.12) {
            spawnParticle(player.x + SPRITE_W/2 + (Math.random()-0.5)*10, player.y + SPRITE_H, '#7a4a28', 'dust');
        }
    } else if (!player.isMoving && !player.dashing) {
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
                    if (!player.wasGrounded) SFX.land();
                    player.grounded = true;
                }
            }
        });
    }

    if (player.x + SPRITE_W > canvas.width - 5) {
        if (roomIdx < maze.length - 1) { SFX.roomClear(); roomIdx++; setupRoom(); }
        else { SFX.victory(); showAlert('⭐','Victory!','You escaped the Labyrinth of Minos! The gods smile upon you.','↺ Play Again'); }
    }

    if (player.y > canvas.height + 80) {
        lives--;
        if (lives <= 0) { SFX.death(); showAlert('💀','Lost Forever','The Minotaur claims another soul. Your bones join the countless others in the dark.','↺ Restart'); } 
        else { SFX.loseLife(); updateHUD(); setupRoom(); }
    }

    const diff = Math.floor((Date.now()-startTime)/1000);
    document.getElementById('timer').innerText =
        String(Math.floor(diff/60)).padStart(2,'0') + ':' + String(diff%60).padStart(2,'0');

    player.wasGrounded = player.grounded;
    for (var i=particles.length-1; i>=0; i--) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.type === 'ember')      p.vy -= 0.04;
        else if (p.type === 'dash') { p.vx *= 0.85; p.vy *= 0.85; }
        else                         p.vy += 0.05;
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
    drawStaminaBar();

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
        for (var j=pool.length-1; j>0; j--) {
            var r = Math.floor(Math.random()*(j+1));
            var tmp = pool[j]; pool[j] = pool[r]; pool[r] = tmp;
        }
        pool.forEach(function(room) {
            var copy = Object.assign({}, room);
            copy.layerName = 'L'+(i+1)+': '+key.split('_')[2];
            out.push(copy);
        });
    });
    var n = 2 + Math.floor(Math.random()*2);
    for (var i=0; i<n; i++) {
        var pos = 2 + Math.floor(Math.random()*(out.length-4));
        var ir = ROOM_BANK.INTERSECTIONS[Math.floor(Math.random()*ROOM_BANK.INTERSECTIONS.length)];
        var copy = Object.assign({}, ir);
        copy.layerName = 'Junction';
        out.splice(pos, 0, copy);
    }
    return out;
}

async function startGame() {
    if (!spritesReady) await initSprites();
    maze = generateMaze();
    roomIdx = 0; lives = 3; gameState = 'playing'; isPaused = false; particles = [];
    startTime = Date.now();
    setupRoom();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    document.getElementById('hud-bottom').classList.remove('hidden');
    SFX.startBG();
    requestAnimationFrame(gameLoop);
}

function setupRoom() {
    player.x = 50;
    player.y = canvas.height * 0.4;
    player.vx = 0; player.vy = 0; player.grounded = false;
    player.frame = 0; player.animTick = 0;
    player.dashing = false; player.dashTimer = 0;
    const room = maze[roomIdx];
    document.getElementById('layer-name').innerText = room.layerName || '—';
    document.getElementById('room-prog').innerText = 'Room '+(roomIdx+1)+' / '+maze.length;
    document.getElementById('prog-fill').style.width = Math.max(5, ((roomIdx+1)/maze.length)*100) + '%';
    updateHUD();
}

function updateHUD() {
    var h = '';
    for (var i=0; i<3; i++) {
        var full = i < lives;
        h += '<div class="heart '+(full?'full':'')+'">'+
             '<svg viewBox="0 0 20 18" xmlns="http://www.w3.org/2000/svg">'+
             '<path d="M10 16.5S1 11 1 5.5A4.5 4.5 0 0 1 10 3.6 4.5 4.5 0 0 1 19 5.5C19 11 10 16.5 10 16.5z"'+
             ' fill="'+(full?'#cc2222':'#2a1010')+'" stroke="'+(full?'#ff4444':'#4a2020')+'" stroke-width="1.5"/>'+
             '</svg></div>';
    }
    document.getElementById('health-bar').innerHTML = h;
}

function togglePause() {
    if (gameState !== 'playing' || document.getElementById('custom-alert').offsetParent !== null) return;
    isPaused = !isPaused;
    document.getElementById('pause-menu').classList.toggle('hidden', !isPaused);
    SFX.pauseBG(isPaused);
    if (!isPaused) requestAnimationFrame(gameLoop);
}

function showAlert(icon, title, msg, btnText) {
    isPaused = true;
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = msg;
    var btn = document.querySelector('#custom-alert .btn');
    if (btn) btn.innerHTML = btnText || '↺ Try Again';
    document.getElementById('custom-alert').classList.remove('hidden');
}

function handleAlertConfirm() {
    document.getElementById('custom-alert').classList.add('hidden');
    resetMaze();
}

function resetMaze() {
    roomIdx = 0; lives = 3; startTime = Date.now(); particles = [];
    player.stamina = STAMINA_MAX;
    player.dashCooldown = 0;
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
function returnToMenu() { SFX.stopBG(); location.reload(); }

function toggleSetting(el) {
    el.classList.toggle('on');
    if (el.id === 'tog-scanlines') {
        document.getElementById('scanlines').style.display = el.classList.contains('on') ? 'block' : 'none';
    }
}

(function() {
    var c = document.getElementById('ember-container');
    if (!c) return;
    setInterval(function() {
        var e = document.createElement('div');
        e.className = 'particle';
        e.style.cssText = 'left:'+Math.random()*100+'vw;bottom:'+Math.random()*30+'vh;animation-delay:'+Math.random()*4+'s;animation-duration:'+(3+Math.random()*3)+'s;background:'+(Math.random()<0.5?'#d4a843':'#ff6020');
        c.appendChild(e);
        setTimeout(function(){ e.remove(); }, 8000);
    }, 300);
})();