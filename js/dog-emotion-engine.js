/* ============================================
   DOG EMOTION ENGINE v2 — Canine Emotional State Detection

   UPGRADE: Now includes posture estimation, signal detection
   explanation, needs assessment, and honest confidence reporting.

   Detection Sources (what we CAN detect from bounding box + audio):
   1. Movement speed, direction, acceleration
   2. Posture estimation (standing/sitting/lying) via aspect ratio
   3. Movement patterns (pacing, spinning, bouncing, stillness)
   4. Size changes (approaching/retreating)
   5. Vertical position shifts (jumping, crouching, play bows)
   6. Vocalization type, pitch, rate, inter-bark intervals
   7. Combined audio-visual correlation

   What we CANNOT detect (honest limitation):
   - Tail position/wag direction (too small in bounding box)
   - Ear position (requires pose estimation model)
   - Facial expression (no dog face landmark model exists in browser)
   - Eye state (whale eye, squinting)
   - Lip licking, yawning (calming signals too subtle)
   - Hackles raised (fur detail not visible)

   Scientific Basis:
   - Turid Rugaas - "Calming Signals" (2006)
   - Stanley Coren - "How to Speak Dog" (2000)
   - Patricia McConnell - "The Other End of the Leash" (2002)
   - Dr. Sophia Yin - Body language research
   - Beerda et al. (1998) - Stress indicators in dogs
   - Bekoff (2007) - Emotional Lives of Animals
   - Horowitz (2009) - Dog cognition and perception
   - Pongrácz et al. (2005) - Bark acoustic parameters
   - Faragó et al. (2014) - Cross-modal emotion detection
   ============================================ */

class DogEmotionEngine {
    constructor() {
        this.frameHistory = [];
        this.maxHistoryFrames = 300;
        this.emotionHistory = [];
        this.maxEmotionHistory = 300;

        // Current state
        this.primaryEmotion = 'observing';
        this.secondaryEmotion = null;
        this.emotionConfidence = 0;
        this.emotionIntensity = 0;

        // Movement tracking
        this.movementHistory = [];
        this.positionHistory = [];
        this.sizeHistory = [];

        // Posture tracking — uses proper K9 terminology
        // stand = upright on all fours
        // sit = hindquarters on ground, front up
        // down = lying on ground (sphinx or flat)
        // crouch = lowered body (play bow, fear, submission)
        this.postureHistory = [];
        this.currentPosture = 'unknown';

        // Detected signals (for explanation)
        this.detectedSignals = [];

        // Needs assessment
        this.currentNeeds = [];

        // EMA smoothing for bounding box (filters COCO-SSD jitter)
        this.smoothedBox = null;
        this.EMA_ALPHA = 0.3; // Lower = more smoothing (0.3 = strong filter)

        // Movement noise floor — anything below this is treated as zero
        this.MOVEMENT_NOISE_FLOOR = 6; // pixels per frame

        // Behavioral pattern counters
        this.patterns = {
            pacing: 0,
            spinning: 0,
            bouncing: 0,
            stillness: 0,
            approaching: 0,
            retreating: 0,
            headTilts: 0,
            playBows: 0,
            jumping: 0,
            crouching: 0,
            postureChanges: 0,
            restlessness: 0,
            tailWagLikely: 0
        };

        // ── K9 Action Detection System ──
        // Tracks current and historical actions
        this.currentAction = 'observing';
        this.activeActions = [];       // All currently detected actions
        this.actionHistory = [];       // Timeline of actions
        this.maxActionHistory = 600;
        this.actionCounts = {};        // Count of each action detected
    }

    processFrame(detection, barkData) {
        if (!detection || !detection.box) return this._defaultAssessment();

        const rawBox = detection.box;
        const now = Date.now();

        // Apply EMA smoothing to bounding box to filter COCO-SSD jitter
        if (!this.smoothedBox) {
            this.smoothedBox = { x: rawBox.x, y: rawBox.y, width: rawBox.width, height: rawBox.height };
        } else {
            const a = this.EMA_ALPHA;
            this.smoothedBox.x = a * rawBox.x + (1 - a) * this.smoothedBox.x;
            this.smoothedBox.y = a * rawBox.y + (1 - a) * this.smoothedBox.y;
            this.smoothedBox.width = a * rawBox.width + (1 - a) * this.smoothedBox.width;
            this.smoothedBox.height = a * rawBox.height + (1 - a) * this.smoothedBox.height;
        }
        const box = this.smoothedBox;

        const frameData = {
            timestamp: now,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            centerX: box.x + box.width / 2,
            centerY: box.y + box.height / 2,
            area: box.width * box.height,
            aspectRatio: box.width / Math.max(1, box.height),
            bottomY: box.y + box.height,
            topY: box.y
        };

        this.frameHistory.push(frameData);
        if (this.frameHistory.length > this.maxHistoryFrames) {
            this.frameHistory.shift();
        }

        // Estimate posture from aspect ratio
        this._estimatePosture();

        // Compute movement metrics
        const movement = this._computeMovement();
        this.movementHistory.push(movement);
        if (this.movementHistory.length > this.maxHistoryFrames) {
            this.movementHistory.shift();
        }

        // Detect behavioral patterns
        this._detectPatterns(movement);

        // Classify K9 actions
        this._classifyActions(movement, barkData);

        // Clear signals for this frame
        this.detectedSignals = [];

        // Build signals list
        this._buildSignalList(movement, barkData);

        // Determine emotional state
        const emotion = this._assessEmotion(movement, barkData);

        // Assess needs
        this._assessNeeds(emotion, barkData);

        // Store emotion
        this.emotionHistory.push({
            time: this.frameHistory.length,
            emotion: emotion.primary,
            confidence: emotion.confidence,
            intensity: emotion.intensity
        });
        if (this.emotionHistory.length > this.maxEmotionHistory) {
            this.emotionHistory.shift();
        }

        this.primaryEmotion = emotion.primary;
        this.secondaryEmotion = emotion.secondary;
        this.emotionConfidence = emotion.confidence;
        this.emotionIntensity = emotion.intensity;

        // Add actions to emotion return
        emotion.currentAction = this.currentAction;
        emotion.activeActions = [...this.activeActions];

        return emotion;
    }

    // ── Posture Estimation (K9 Terminology) ──
    // Based on bounding box aspect ratio (width / height):
    //
    // STAND: Dog upright on all fours. Bounding box wider than tall.
    //   - Side view: AR ~1.3-1.8 (body is horizontal rectangle)
    //   - Front view: AR ~0.7-1.2
    //
    // SIT: Hindquarters on ground, front legs upright. Box becomes taller.
    //   - Side view: AR ~0.6-1.0 (dog is more square/vertical)
    //   - Front view: AR ~0.5-0.9
    //
    // DOWN: Lying on ground (sphinx or flat). Box very wide, very short.
    //   - Side view: AR ~1.5+ (wide low rectangle)
    //   - Also check: low vertical position in frame + low box height relative to width
    //
    // CROUCH: Rapid height decrease — play bow, fear, or submission

    _estimatePosture() {
        if (this.frameHistory.length < 5) return;

        const curr = this.frameHistory[this.frameHistory.length - 1];

        // Use AVERAGED aspect ratio over last 20 frames for stability
        // Single-frame AR is noisy due to COCO-SSD bounding box jitter
        const recentFrames = this.frameHistory.slice(-20);
        const avgAR = recentFrames.reduce((s, f) => s + f.aspectRatio, 0) / recentFrames.length;

        // Also compute averaged height for reference
        const avgHeight = recentFrames.reduce((s, f) => s + f.box.height, 0) / recentFrames.length;
        const avgWidth = recentFrames.reduce((s, f) => s + f.box.width, 0) / recentFrames.length;

        let posture = 'stand';

        if (avgAR >= 1.8) {
            // Very wide rectangle — definitely in down position
            posture = 'down';
        } else if (avgAR >= 1.4) {
            // Wide rectangle — could be down or stand
            // If dog is also still, more likely down
            if (this.patterns.stillness > 5 || avgWidth / Math.max(1, avgHeight) >= 1.5) {
                posture = 'down';
            } else {
                posture = 'stand';
            }
        } else if (avgAR >= 1.0 && avgAR < 1.4) {
            // Roughly square — standing (front view) or transitioning
            posture = 'stand';
        } else if (avgAR >= 0.5 && avgAR < 1.0) {
            // Taller than wide — sitting (hindquarters down, front up)
            posture = 'sit';
        } else if (avgAR < 0.5) {
            // Very tall and narrow — sitting upright or begging
            posture = 'sit';
        }

        // Check for crouch — rapid decrease in height from stand
        if (this.frameHistory.length >= 8) {
            const prev8 = this.frameHistory.slice(-8);
            const heightRatio = curr.box.height / Math.max(1, prev8[0].box.height);
            if (heightRatio < 0.65 && prev8[0].aspectRatio < 1.5) {
                posture = 'crouch';
            }
        }

        // Stillness + wide averaged AR = more likely down than stand
        if (this.patterns.stillness > 8 && avgAR >= 1.3) {
            posture = 'down';
        }

        // STABILITY: Only change posture if the new posture has been consistent
        // for at least 5 frames in the recent history. Prevents single-frame flickers.
        if (this.postureHistory.length >= 5 && posture !== this.currentPosture) {
            const recent5Postures = this.postureHistory.slice(-5).map(p => p.posture);
            const currentPostureCount = recent5Postures.filter(p => p === this.currentPosture).length;
            // If the current posture is still dominant in recent history, don't change
            if (currentPostureCount >= 3) {
                posture = this.currentPosture;
            }
        }

        // Track posture changes
        const prevPosture = this.currentPosture;
        this.currentPosture = posture;

        this.postureHistory.push({ posture, timestamp: curr.timestamp });
        if (this.postureHistory.length > 90) this.postureHistory.shift();

        if (prevPosture !== posture && prevPosture !== 'unknown') {
            this.patterns.postureChanges++;
        }
    }

    // ── Comprehensive K9 Action Classification ──
    // Detects ALL observable dog actions from bounding box + audio

    _classifyActions(movement, barkData) {
        this.activeActions = [];
        const actions = [];
        const speed = movement.speed;
        const avgSpeed = this.movementHistory.length > 0
            ? this.movementHistory.slice(-15).reduce((s, m) => s + m.speed, 0) / Math.min(15, this.movementHistory.length)
            : 0;
        const recentMoves = this.movementHistory.slice(-20);
        const curr = this.frameHistory[this.frameHistory.length - 1];
        const hasPrev = this.frameHistory.length >= 2;
        const prev = hasPrev ? this.frameHistory[this.frameHistory.length - 2] : null;

        // ═══════════════════════════════════════════
        // LOCOMOTION — How the dog is moving
        // ═══════════════════════════════════════════

        if (avgSpeed < 0.5) {
            actions.push({ action: 'stationary', category: 'locomotion', desc: 'Holding position, not moving' });
        } else if (avgSpeed >= 0.5 && avgSpeed < 3) {
            actions.push({ action: 'slow-movement', category: 'locomotion', desc: 'Shifting weight or making small adjustments' });
        } else if (avgSpeed >= 3 && avgSpeed < 7) {
            actions.push({ action: 'walking', category: 'locomotion', desc: 'Walking at a normal pace' });
        } else if (avgSpeed >= 7 && avgSpeed < 14) {
            actions.push({ action: 'trotting', category: 'locomotion', desc: 'Moving at a trot — moderate speed gait' });
        } else if (avgSpeed >= 14 && avgSpeed < 25) {
            actions.push({ action: 'running', category: 'locomotion', desc: 'Running at speed' });
        } else if (avgSpeed >= 25) {
            actions.push({ action: 'sprinting', category: 'locomotion', desc: 'Full sprint — maximum speed' });
        }

        // Direction of travel
        if (avgSpeed > 2) {
            const avgDx = recentMoves.reduce((s, m) => s + (m.dx || 0), 0) / recentMoves.length;
            const avgDy = recentMoves.reduce((s, m) => s + (m.dy || 0), 0) / recentMoves.length;
            if (Math.abs(avgDx) > Math.abs(avgDy)) {
                actions.push({ action: avgDx > 0 ? 'moving-right' : 'moving-left', category: 'direction', desc: `Heading ${avgDx > 0 ? 'right' : 'left'}` });
            } else if (Math.abs(avgDy) > 2) {
                actions.push({ action: avgDy > 0 ? 'moving-away' : 'moving-toward', category: 'direction', desc: avgDy > 0 ? 'Moving downward in frame' : 'Moving upward in frame' });
            }
        }

        // ═══════════════════════════════════════════
        // JUMPING & VERTICAL ACTIONS
        // ═══════════════════════════════════════════

        if (movement.dy < -12 && movement.acceleration > 8) {
            actions.push({ action: 'jumping-up', category: 'jumping', desc: 'Jumping upward — excitement, greeting, or reaching' });
        }
        if (movement.dy > 12 && this.movementHistory.length > 2) {
            const prev2 = this.movementHistory[this.movementHistory.length - 2];
            if (prev2 && prev2.dy < -5) {
                actions.push({ action: 'landing', category: 'jumping', desc: 'Landing after a jump' });
            }
        }
        if (this.patterns.bouncing > 4) {
            actions.push({ action: 'bouncing', category: 'jumping', desc: 'Bouncing up and down — playful or excited' });
        }
        if (this.patterns.jumping > 2) {
            actions.push({ action: 'repeated-jumping', category: 'jumping', desc: 'Jumping repeatedly — wants attention or very excited' });
        }

        // Hop detection (small quick jumps)
        if (movement.verticalOscillation > 0 && avgSpeed > 3 && avgSpeed < 12) {
            actions.push({ action: 'hopping', category: 'jumping', desc: 'Hopping — light bouncy movement, often playful' });
        }

        // ═══════════════════════════════════════════
        // POSTURE ACTIONS — Current body position
        // ═══════════════════════════════════════════

        switch (this.currentPosture) {
            case 'stand':
                actions.push({ action: 'standing', category: 'posture', desc: 'Upright on all four paws' });
                break;
            case 'sit':
                actions.push({ action: 'sitting', category: 'posture', desc: 'In a sit — hindquarters on ground' });
                break;
            case 'down':
                actions.push({ action: 'lying-down', category: 'posture', desc: 'In a down position — body on the ground' });
                break;
            case 'crouch':
                actions.push({ action: 'crouching', category: 'posture', desc: 'Body lowered — play bow, submission, or caution' });
                break;
        }

        // Posture transitions
        if (this.postureHistory.length >= 2) {
            const prevP = this.postureHistory[this.postureHistory.length - 2];
            const currP = this.postureHistory[this.postureHistory.length - 1];
            if (prevP.posture !== currP.posture) {
                if (prevP.posture === 'stand' && currP.posture === 'sit') {
                    actions.push({ action: 'sitting-down', category: 'transition', desc: 'Transitioning from stand to sit' });
                } else if (prevP.posture === 'stand' && currP.posture === 'down') {
                    actions.push({ action: 'lying-down-from-stand', category: 'transition', desc: 'Going from standing to down position' });
                } else if (prevP.posture === 'sit' && currP.posture === 'down') {
                    actions.push({ action: 'settling-down', category: 'transition', desc: 'Settling from sit into down' });
                } else if (prevP.posture === 'down' && currP.posture === 'stand') {
                    actions.push({ action: 'getting-up', category: 'transition', desc: 'Getting up from lying down' });
                } else if (prevP.posture === 'sit' && currP.posture === 'stand') {
                    actions.push({ action: 'standing-up', category: 'transition', desc: 'Standing up from sit' });
                } else if (currP.posture === 'crouch') {
                    actions.push({ action: 'lowering-body', category: 'transition', desc: 'Dropping into a crouch or play bow' });
                }
            }
        }

        // Beg / sit pretty — very tall narrow box while still
        if (curr && curr.aspectRatio < 0.45 && avgSpeed < 2) {
            actions.push({ action: 'begging', category: 'posture', desc: 'Sitting up tall — begging or "sit pretty" position' });
        }

        // ═══════════════════════════════════════════
        // SPATIAL BEHAVIOR — Relation to camera/owner
        // ═══════════════════════════════════════════

        if (this.patterns.approaching > 3) {
            actions.push({ action: 'approaching', category: 'spatial', desc: 'Coming closer — seeking attention or interaction' });
        }
        if (this.patterns.retreating > 3) {
            actions.push({ action: 'retreating', category: 'spatial', desc: 'Moving away — avoidance or discomfort' });
        }

        // Lunging — sudden forward burst (rapid size increase + speed)
        if (hasPrev && movement.sizeChange > 0.05 && speed > 10) {
            actions.push({ action: 'lunging', category: 'spatial', desc: 'Sudden forward lunge — could be reactive or playful' });
        }

        // Backing up — slow retreat
        if (movement.sizeChange < -0.01 && avgSpeed > 1 && avgSpeed < 5) {
            actions.push({ action: 'backing-up', category: 'spatial', desc: 'Slowly backing away' });
        }

        // Following / tracking — sustained one-direction movement
        if (recentMoves.length >= 10) {
            const sameDir = recentMoves.slice(-10).filter(m => m.direction === movement.direction && m.speed > 2).length;
            if (sameDir >= 7) {
                actions.push({ action: 'following', category: 'spatial', desc: 'Moving in a consistent direction — following or tracking something' });
            }
        }

        // ═══════════════════════════════════════════
        // PLAY ACTIONS
        // ═══════════════════════════════════════════

        if (this.patterns.playBows > 0) {
            actions.push({ action: 'play-bow', category: 'play', desc: 'Play bow! Front down, rear up — universal "let\'s play!" invitation' });
        }

        // Zoomies — high speed + erratic direction changes
        if (avgSpeed > 15 && this.patterns.spinning > 0) {
            actions.push({ action: 'zoomies', category: 'play', desc: 'ZOOMIES! Running wildly in circles — pure joy and energy release' });
        } else if (avgSpeed > 18) {
            const dirChanges = recentMoves.filter((m, i) => i > 0 && m.direction !== recentMoves[i - 1].direction && m.speed > 8).length;
            if (dirChanges > 4) {
                actions.push({ action: 'zoomies', category: 'play', desc: 'ZOOMIES! Erratic high-speed running — excited energy burst' });
            }
        }

        // Play chase (running with direction changes)
        if (avgSpeed > 10 && this.patterns.pacing > 0) {
            actions.push({ action: 'chase-play', category: 'play', desc: 'Chase behavior — running back and forth playfully' });
        }

        // Pounce (sudden forward + downward)
        if (movement.dy > 8 && movement.sizeChange > 0.03 && speed > 8) {
            actions.push({ action: 'pouncing', category: 'play', desc: 'Pouncing forward — playful attack or catching something' });
        }

        // ═══════════════════════════════════════════
        // BODY ACTIONS
        // ═══════════════════════════════════════════

        // Shaking off — rapid whole-body oscillation (size and position flutter rapidly)
        if (recentMoves.length >= 6) {
            const recent6 = recentMoves.slice(-6);
            const sizeOsc = recent6.filter((m, i) => i > 0 && Math.sign(m.sizeChange) !== Math.sign(recent6[i - 1].sizeChange) && Math.abs(m.sizeChange) > 0.005).length;
            const posOsc = recent6.filter((m, i) => i > 0 && Math.sign(m.dx) !== Math.sign(recent6[i - 1].dx) && Math.abs(m.dx) > 3).length;
            if (sizeOsc >= 3 && posOsc >= 2) {
                actions.push({ action: 'shaking-off', category: 'body', desc: 'Shaking off — full body shake, often after stress or getting wet' });
            }
        }

        // Rolling — rapid aspect ratio change + vertical movement
        if (recentMoves.length >= 5) {
            const recent5 = this.frameHistory.slice(-5);
            if (recent5.length >= 5) {
                const arChanges = [];
                for (let i = 1; i < recent5.length; i++) {
                    arChanges.push(Math.abs(recent5[i].aspectRatio - recent5[i - 1].aspectRatio));
                }
                const bigARChanges = arChanges.filter(c => c > 0.3).length;
                if (bigARChanges >= 2 && movement.verticalOscillation > 0) {
                    actions.push({ action: 'rolling', category: 'body', desc: 'Rolling over — playful, scratching back, or showing belly' });
                }
            }
        }

        // Stretching — temporary size increase then return
        if (this.frameHistory.length >= 10) {
            const recent10 = this.frameHistory.slice(-10);
            const areas = recent10.map(f => f.area);
            const maxArea = Math.max(...areas);
            const minArea = Math.min(...areas);
            if (maxArea > minArea * 1.3 && curr.area < maxArea * 0.9 && avgSpeed < 3) {
                actions.push({ action: 'stretching', category: 'body', desc: 'Stretching out — loosening up after rest' });
            }
        }

        // Digging — rapid small vertical movements while mostly stationary horizontally
        if (recentMoves.length >= 8) {
            const recent8 = recentMoves.slice(-8);
            const vertActivity = recent8.filter(m => Math.abs(m.dy) > 3).length;
            const horizActivity = recent8.filter(m => Math.abs(m.dx) > 5).length;
            if (vertActivity >= 4 && horizActivity <= 2 && avgSpeed < 6) {
                actions.push({ action: 'digging', category: 'body', desc: 'Digging motion — pawing at something' });
            }
        }

        // Crawling — low position + slow forward movement
        if (this.currentPosture === 'down' && avgSpeed > 1 && avgSpeed < 5) {
            actions.push({ action: 'crawling', category: 'body', desc: 'Crawling / army crawl — low to the ground and moving slowly' });
        }

        // Scratching — localized rapid oscillation without travel
        if (recentMoves.length >= 6) {
            const recent6 = recentMoves.slice(-6);
            const smallOsc = recent6.filter(m => m.speed > 1 && m.speed < 5).length;
            const noTravel = recent6.every(m => m.speed < 6);
            const hasOsc = recent6.filter((m, i) => i > 0 && Math.sign(m.dy) !== Math.sign(recent6[i - 1].dy)).length;
            if (smallOsc >= 4 && noTravel && hasOsc >= 3) {
                actions.push({ action: 'scratching', category: 'body', desc: 'Scratching — repetitive localized movement' });
            }
        }

        // ═══════════════════════════════════════════
        // HEAD & ATTENTION ACTIONS
        // ═══════════════════════════════════════════

        if (this.patterns.headTilts > 2) {
            actions.push({ action: 'head-tilting', category: 'attention', desc: 'Tilting head — processing a sound or trying to understand' });
        }

        // Alert freeze — sudden stop after movement
        if (this.movementHistory.length >= 5) {
            const prev5speeds = this.movementHistory.slice(-5).map(m => m.speed);
            if (prev5speeds[0] > 5 && prev5speeds[1] > 5 && prev5speeds[3] < 1 && prev5speeds[4] < 1) {
                actions.push({ action: 'freeze', category: 'attention', desc: 'Alert freeze — suddenly stopped and locked on something' });
            }
        }

        // Startle — sudden movement after stillness
        if (this.movementHistory.length >= 5) {
            const prev5speeds = this.movementHistory.slice(-5).map(m => m.speed);
            if (prev5speeds[0] < 1 && prev5speeds[1] < 1 && prev5speeds[3] > 10) {
                actions.push({ action: 'startled', category: 'attention', desc: 'Startle response — reacted suddenly to something' });
            }
        }

        // Sniffing — small forward movements with low position
        if (avgSpeed > 0.5 && avgSpeed < 4 && this.currentPosture === 'stand') {
            const smallMoves = recentMoves.filter(m => m.speed > 0.5 && m.speed < 4).length;
            if (smallMoves > 10 && recentMoves.length >= 12) {
                actions.push({ action: 'sniffing', category: 'attention', desc: 'Slow deliberate movement — likely sniffing and exploring' });
            }
        }

        // Looking around — small lateral movements while mostly still
        if (avgSpeed < 3 && this.patterns.stillness < 10) {
            const lateralOsc = recentMoves.filter((m, i) => i > 0 && Math.sign(m.dx) !== Math.sign(recentMoves[i - 1].dx) && Math.abs(m.dx) > 1).length;
            if (lateralOsc >= 3) {
                actions.push({ action: 'looking-around', category: 'attention', desc: 'Looking around — scanning the environment' });
            }
        }

        // ═══════════════════════════════════════════
        // REPETITIVE / BEHAVIORAL PATTERNS
        // ═══════════════════════════════════════════

        if (this.patterns.spinning > 0) {
            actions.push({ action: 'spinning', category: 'pattern', desc: 'Spinning in circles' });
        }
        if (this.patterns.pacing > 3) {
            actions.push({ action: 'pacing', category: 'pattern', desc: 'Pacing back and forth — anxious or needs something' });
        }
        if (this.patterns.restlessness > 5) {
            actions.push({ action: 'restless', category: 'pattern', desc: 'Restless — can\'t settle, keeps changing position' });
        }

        // Settling sequence — circling then lying down
        if (this.postureHistory.length >= 5) {
            const recent5p = this.postureHistory.slice(-5);
            const wasStanding = recent5p.slice(0, 3).some(p => p.posture === 'stand');
            const nowDown = recent5p[recent5p.length - 1].posture === 'down';
            if (wasStanding && nowDown && this.patterns.spinning > 0) {
                actions.push({ action: 'nesting', category: 'pattern', desc: 'Nesting — circling before lying down to find a comfortable spot' });
            }
        }

        // Guard posture — still, standing, facing one direction
        if (this.currentPosture === 'stand' && this.patterns.stillness > 15 && avgSpeed < 1) {
            actions.push({ action: 'guarding', category: 'pattern', desc: 'Alert guard stance — standing still and watching intently' });
        }

        // ═══════════════════════════════════════════
        // TAIL ACTIONS (from edge analysis)
        // ═══════════════════════════════════════════

        if (this.patterns.tailWagLikely > 6) {
            actions.push({ action: 'tail-wagging-fast', category: 'tail', desc: 'Fast tail wagging — very happy or excited' });
        } else if (this.patterns.tailWagLikely > 3) {
            actions.push({ action: 'tail-wagging', category: 'tail', desc: 'Tail wagging detected — generally positive signal' });
        }

        // ═══════════════════════════════════════════
        // STRESS & ANXIETY ACTIONS
        // ═══════════════════════════════════════════

        if (this.currentPosture === 'crouch' && this.patterns.retreating > 2) {
            actions.push({ action: 'cowering', category: 'stress', desc: 'Cowering — crouched low and backing away, fearful' });
        }
        if (this.patterns.stillness > 25 && this.currentPosture === 'crouch') {
            actions.push({ action: 'freezing-fearful', category: 'stress', desc: 'Fear freeze — crouched and completely still' });
        }

        // ═══════════════════════════════════════════
        // VOCALIZATION ACTIONS
        // ═══════════════════════════════════════════

        if (barkData && barkData.isVocalizing) {
            const vocalActions = {
                bark: { action: 'barking', desc: 'Barking — communicating vocally' },
                growl: { action: 'growling', desc: 'Growling — warning or discomfort' },
                whine: { action: 'whining', desc: 'Whining — wants something or in distress' },
                howl: { action: 'howling', desc: 'Howling — social call or responding to sounds' },
                yelp: { action: 'yelping', desc: 'Yelping — pain or surprise' }
            };
            const va = vocalActions[barkData.currentType];
            if (va) {
                actions.push({ action: va.action, category: 'vocalization', desc: va.desc });
            }

            if (barkData.barkRate > 30) {
                actions.push({ action: 'rapid-barking', category: 'vocalization', desc: 'Rapid-fire barking — high urgency or alarm' });
            }
            if (barkData.barkRate > 5 && barkData.barkRate <= 15) {
                actions.push({ action: 'intermittent-barking', category: 'vocalization', desc: 'Occasional barking — alert or demand' });
            }
        }

        // ═══════════════════════════════════════════
        // REST & COMFORT
        // ═══════════════════════════════════════════

        if (this.currentPosture === 'down' && this.patterns.stillness > 25) {
            actions.push({ action: 'resting', category: 'rest', desc: 'Resting quietly — settled and comfortable' });
        }
        if (this.currentPosture === 'down' && this.patterns.stillness > 50) {
            actions.push({ action: 'sleeping', category: 'rest', desc: 'Possibly sleeping — very still for extended period' });
        }

        // ═══════════════════════════════════════════
        // DETERMINE PRIMARY ACTION
        // ═══════════════════════════════════════════

        // Priority: vocalization > jumping > play > body > locomotion > posture > rest
        const priorityOrder = ['vocalization', 'jumping', 'play', 'stress', 'body', 'transition', 'attention', 'pattern', 'spatial', 'locomotion', 'posture', 'tail', 'rest', 'direction'];
        let primary = actions.length > 0 ? actions[0] : { action: 'observing', category: 'system', desc: 'Waiting for detectable activity' };

        for (const cat of priorityOrder) {
            const match = actions.find(a => a.category === cat);
            if (match) { primary = match; break; }
        }

        this.currentAction = primary.action;
        this.activeActions = actions;

        // Track action history
        this.actionHistory.push({ action: primary.action, time: this.frameHistory.length });
        if (this.actionHistory.length > this.maxActionHistory) this.actionHistory.shift();

        // Count actions
        actions.forEach(a => {
            this.actionCounts[a.action] = (this.actionCounts[a.action] || 0) + 1;
        });
    }

    // ── Signal Detection ──

    _buildSignalList(movement, barkData) {
        const avgSpeed = this.movementHistory.length > 0
            ? this.movementHistory.slice(-30).reduce((s, m) => s + m.speed, 0) / Math.min(30, this.movementHistory.length)
            : 0;

        // Posture signal (K9 terminology)
        if (this.currentPosture !== 'unknown') {
            const postureLabels = {
                stand: 'Stand — dog is upright on all fours, alert and ready',
                sit: 'Sit — hindquarters on ground, attentive or waiting',
                down: 'Down — lying on the ground, resting or settled',
                crouch: 'Crouch — lowered body, could be play bow, submission, or fear'
            };
            this.detectedSignals.push({
                type: 'posture',
                signal: `Position: ${this.currentPosture.toUpperCase()}`,
                detail: postureLabels[this.currentPosture] || 'Unknown posture',
                source: 'bounding box aspect ratio'
            });
        }

        // Movement signals
        if (avgSpeed > 12) {
            this.detectedSignals.push({ type: 'movement', signal: 'High-speed movement detected', detail: `Average speed: ${avgSpeed.toFixed(1)} px/frame — indicates high arousal`, source: 'bounding box tracking' });
        } else if (avgSpeed > 5) {
            this.detectedSignals.push({ type: 'movement', signal: 'Moderate movement', detail: `Speed: ${avgSpeed.toFixed(1)} px/frame — active but controlled`, source: 'bounding box tracking' });
        } else if (avgSpeed < 1.5) {
            this.detectedSignals.push({ type: 'movement', signal: 'Very little movement', detail: 'Dog is mostly stationary', source: 'bounding box tracking' });
        }

        // Pattern signals
        if (this.patterns.pacing > 3) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Repetitive pacing detected', detail: `${this.patterns.pacing} direction reversals — displacement behavior (Beerda et al., 1998)`, source: 'horizontal direction changes' });
        }
        if (this.patterns.bouncing > 2) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Bouncing/jumping movement', detail: `${this.patterns.bouncing} vertical oscillations — associated with play and excitement`, source: 'vertical position tracking' });
        }
        if (this.patterns.spinning > 0) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Spinning/circling detected', detail: 'Movement in all directions — excitement or compulsive behavior', source: 'multi-directional tracking' });
        }
        if (this.patterns.playBows > 0) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Play bow detected!', detail: 'Sudden drop in front + widening — universal play invitation (Bekoff, 2007)', source: 'vertical drop + size increase' });
        }
        if (this.patterns.headTilts > 2) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Head tilting detected', detail: `${this.patterns.headTilts} aspect ratio shifts — auditory processing/curiosity`, source: 'aspect ratio oscillation' });
        }
        if (this.patterns.approaching > 3) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Approaching camera/owner', detail: 'Dog is moving closer — interest, seeking attention, or demand', source: 'bounding box size increase' });
        }
        if (this.patterns.retreating > 3) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Moving away', detail: 'Dog is increasing distance — avoidance, fear, or disinterest', source: 'bounding box size decrease' });
        }
        if (this.patterns.restlessness > 5) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Restless behavior', detail: 'Frequent position changes without settling — anxiety or unmet need', source: 'movement variability analysis' });
        }
        if (this.patterns.tailWagLikely > 3) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Possible tail wagging', detail: 'Rapid small oscillations at body edge — likely tail movement (low certainty)', source: 'bounding box edge oscillation' });
        }
        if (this.patterns.stillness > 20) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Sustained stillness', detail: 'Dog has been very still — resting, alert freeze, or fear freeze', source: 'low movement for 20+ frames' });
        }
        if (this.patterns.jumping > 2) {
            this.detectedSignals.push({ type: 'pattern', signal: 'Jumping detected', detail: 'Upward movement bursts — excitement, greeting, or demand', source: 'rapid vertical position changes' });
        }

        // Audio signals
        if (barkData && barkData.isVocalizing) {
            this.detectedSignals.push({ type: 'audio', signal: `${barkData.currentType} detected`, detail: `Frequency: ${barkData.dominantFreq}Hz | Intensity: ${barkData.intensity}% | Rate: ${barkData.barkRate}/min`, source: 'microphone spectral analysis' });

            if (barkData.interBarkInterval !== undefined && barkData.interBarkInterval > 0) {
                const ibi = barkData.interBarkInterval;
                let ibiMeaning = ibi < 200 ? 'Very rapid — high arousal/urgency' : ibi < 500 ? 'Moderate — alert or demand' : 'Spaced — low urgency or boredom';
                this.detectedSignals.push({ type: 'audio', signal: `Inter-bark interval: ${ibi}ms`, detail: ibiMeaning + ' (Pongrácz et al., 2005)', source: 'bark timing analysis' });
            }
        }
    }

    // ── Movement Analysis ──

    _computeMovement() {
        if (this.frameHistory.length < 2) {
            return { speed: 0, direction: 'still', magnitude: 0, sizeChange: 0, verticalOscillation: 0, acceleration: 0 };
        }

        const curr = this.frameHistory[this.frameHistory.length - 1];
        const prev = this.frameHistory[this.frameHistory.length - 2];

        const rawDx = curr.centerX - prev.centerX;
        const rawDy = curr.centerY - prev.centerY;
        const rawMagnitude = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

        // Apply noise floor — suppress COCO-SSD bounding box jitter
        const magnitude = rawMagnitude < this.MOVEMENT_NOISE_FLOOR ? 0 : rawMagnitude;
        const dx = magnitude === 0 ? 0 : rawDx;
        const dy = magnitude === 0 ? 0 : rawDy;

        const sizeChange = (curr.area - prev.area) / Math.max(1, prev.area);
        const aspectChange = curr.aspectRatio - prev.aspectRatio;

        // Acceleration (change in speed)
        let acceleration = 0;
        if (this.movementHistory.length >= 1) {
            acceleration = magnitude - this.movementHistory[this.movementHistory.length - 1].speed;
        }

        let direction = 'still';
        if (magnitude > this.MOVEMENT_NOISE_FLOOR) {
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }
        }

        // Vertical oscillation (increased thresholds to filter noise)
        let verticalOscillation = 0;
        if (this.frameHistory.length >= 6) {
            const recent6 = this.frameHistory.slice(-6);
            const yValues = recent6.map(f => f.centerY);
            let oscillations = 0;
            for (let i = 2; i < yValues.length; i++) {
                const d1 = yValues[i - 1] - yValues[i - 2];
                const d2 = yValues[i] - yValues[i - 1];
                // Threshold raised from 2 to 8 to filter COCO-SSD jitter
                if ((d1 > 8 && d2 < -8) || (d1 < -8 && d2 > 8)) oscillations++;
            }
            verticalOscillation = oscillations;
        }

        // Edge oscillation (possible tail wag indicator)
        let edgeOscillation = 0;
        if (this.frameHistory.length >= 8) {
            const recent8 = this.frameHistory.slice(-8);
            const rightEdges = recent8.map(f => f.box.x + f.box.width);
            let osc = 0;
            for (let i = 2; i < rightEdges.length; i++) {
                const d1 = rightEdges[i - 1] - rightEdges[i - 2];
                const d2 = rightEdges[i] - rightEdges[i - 1];
                // Threshold raised from 1 to 5 to filter jitter
                if ((d1 > 5 && d2 < -5) || (d1 < -5 && d2 > 5)) osc++;
            }
            edgeOscillation = osc;
        }

        return {
            speed: magnitude,
            direction,
            magnitude,
            dx, dy,
            sizeChange,
            aspectChange,
            verticalOscillation,
            acceleration,
            edgeOscillation
        };
    }

    _detectPatterns(movement) {
        if (this.frameHistory.length < 10) return;

        const recentFrames = this.frameHistory.slice(-30);
        const recentMovements = this.movementHistory.slice(-30);

        // ── Pacing Detection ──
        let directionChanges = 0;
        for (let i = 2; i < recentMovements.length; i++) {
            // Threshold raised from 3 to 8 to require real movement
            if (recentMovements[i].dx > 8 && recentMovements[i - 1].dx < -8) directionChanges++;
            if (recentMovements[i].dx < -8 && recentMovements[i - 1].dx > 8) directionChanges++;
        }
        this.patterns.pacing = directionChanges > 3 ? directionChanges : 0;

        // ── Spinning Detection ──
        if (recentMovements.length >= 12) {
            const dirs = recentMovements.slice(-12).map(m => m.direction);
            const uniqueDirs = new Set(dirs.filter(d => d !== 'still'));
            this.patterns.spinning = uniqueDirs.size >= 4 ? 1 : 0;
        }

        // ── Bouncing Detection ──
        const recentBounces = recentMovements.slice(-15);
        const totalBounce = recentBounces.reduce((s, m) => s + m.verticalOscillation, 0);
        // Threshold raised from 3 to 6 to require real bouncing
        this.patterns.bouncing = totalBounce > 6 ? totalBounce : 0;

        // ── Jumping Detection ──
        let jumpCount = 0;
        for (let i = 1; i < recentMovements.length; i++) {
            if (recentMovements[i].dy < -8 && recentMovements[i].acceleration > 5) jumpCount++;
        }
        this.patterns.jumping = jumpCount;

        // ── Stillness Detection ──
        // With noise floor applied, avgSpeed=0 means truly still
        const avgSpeed = recentMovements.reduce((s, m) => s + m.speed, 0) / recentMovements.length;
        // More aggressive stillness detection: anything under noise floor = still
        this.patterns.stillness = avgSpeed < this.MOVEMENT_NOISE_FLOOR ? Math.round(30 - avgSpeed * 3) : 0;

        // ── Approaching/Retreating ──
        const avgSizeChange = recentMovements.reduce((s, m) => s + m.sizeChange, 0) / recentMovements.length;
        this.patterns.approaching = avgSizeChange > 0.01 ? Math.round(avgSizeChange * 500) : 0;
        this.patterns.retreating = avgSizeChange < -0.01 ? Math.round(Math.abs(avgSizeChange) * 500) : 0;

        // ── Head Tilt Detection ──
        const aspectChanges = recentMovements.filter(m => Math.abs(m.aspectChange) > 0.05).length;
        this.patterns.headTilts = aspectChanges > 2 ? aspectChanges : 0;

        // ── Play Bow Detection ──
        if (recentMovements.length >= 5) {
            const recent5 = recentMovements.slice(-5);
            const dropDown = recent5.some(m => m.dy > 10 && m.sizeChange > 0.02);
            this.patterns.playBows = dropDown ? 1 : 0;
        }

        // ── Tail Wag Estimation ──
        const recentEdge = recentMovements.slice(-10);
        const totalEdgeOsc = recentEdge.reduce((s, m) => s + (m.edgeOscillation || 0), 0);
        // Threshold raised from 3 to 6 to filter bounding box jitter
        this.patterns.tailWagLikely = totalEdgeOsc > 6 ? totalEdgeOsc : 0;

        // ── Restlessness ──
        // Frequent posture changes or erratic movement
        const speedVariance = this._computeVariance(recentMovements.map(m => m.speed));
        this.patterns.restlessness = speedVariance > 20 ? Math.round(speedVariance / 4) : 0;

        // ── Crouching ──
        this.patterns.crouching = this.currentPosture === 'crouch' ? 1 : 0;
    }

    _computeVariance(arr) {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((s, v) => s + (v - mean) * (v - mean), 0) / arr.length;
    }

    // ── Emotion Assessment ──

    _assessEmotion(movement, barkData) {
        const scores = {
            happy: 0, excited: 0, playful: 0, calm: 0,
            anxious: 0, stressed: 0, fearful: 0, aggressive: 0,
            alert: 0, sad: 0, curious: 0
        };

        const avgSpeed = this.movementHistory.length > 0
            ? this.movementHistory.slice(-30).reduce((s, m) => s + m.speed, 0) / Math.min(30, this.movementHistory.length)
            : 0;

        // ── Posture-based scoring (K9 positions) ──
        switch (this.currentPosture) {
            case 'down':
                scores.calm += 25;
                scores.sad += 8;
                scores.fearful += 3;
                break;
            case 'sit':
                scores.calm += 12;
                scores.alert += 10;
                scores.curious += 5;
                break;
            case 'stand':
                scores.alert += 8;
                scores.happy += 5;
                break;
            case 'crouch':
                scores.fearful += 20;
                scores.playful += 15; // Could be play bow
                scores.stressed += 10;
                break;
        }

        // ── Movement-based scoring ──
        if (avgSpeed > 8 && this.patterns.bouncing > 2) {
            scores.playful += 35;
            scores.excited += 25;
        }
        if (avgSpeed > 3 && avgSpeed < 10) {
            scores.happy += 20;
        }
        if (avgSpeed > 15) {
            scores.excited += 30;
            scores.stressed += 10;
        }
        if (avgSpeed < 2) {
            scores.calm += 25;
            scores.sad += 10;
        }

        // ── Pattern-based scoring ──
        if (this.patterns.pacing > 3) {
            scores.anxious += 30;
            scores.stressed += 25;
        }
        if (this.patterns.spinning > 0) {
            scores.excited += 20;
            if (this.patterns.pacing > 2) scores.stressed += 15;
        }
        if (this.patterns.bouncing > 2) {
            scores.playful += 25;
            scores.happy += 15;
        }
        if (this.patterns.playBows > 0) {
            scores.playful += 40;
            scores.happy += 20;
        }
        if (this.patterns.stillness > 15) {
            scores.calm += 15;
            scores.alert += 15;
        }
        if (this.patterns.approaching > 3) {
            scores.curious += 20;
            scores.happy += 10;
        }
        if (this.patterns.retreating > 3) {
            scores.fearful += 25;
            scores.stressed += 15;
        }
        if (this.patterns.headTilts > 2) {
            scores.curious += 35;
            scores.alert += 10;
        }
        if (this.patterns.jumping > 1) {
            scores.excited += 25;
            scores.playful += 15;
            scores.happy += 10;
        }
        if (this.patterns.tailWagLikely > 3) {
            scores.happy += 20;
            scores.excited += 10;
            scores.playful += 10;
        }
        if (this.patterns.restlessness > 5) {
            scores.anxious += 20;
            scores.stressed += 15;
        }

        // ── Audio-based scoring ──
        if (barkData && barkData.isVocalizing) {
            switch (barkData.currentType) {
                case 'bark':
                    switch (barkData.dominantType) {
                        case 'alert': scores.alert += 30; scores.excited += 10; break;
                        case 'play': scores.playful += 30; scores.happy += 15; break;
                        case 'anxiety': scores.anxious += 35; scores.stressed += 20; break;
                        case 'demand': scores.excited += 15; scores.anxious += 10; break;
                        case 'aggressive': scores.aggressive += 35; scores.alert += 15; break;
                        default: scores.alert += 10;
                    }
                    break;
                case 'growl':
                    scores.aggressive += 30;
                    scores.alert += 15;
                    scores.stressed += 10;
                    break;
                case 'whine':
                    scores.anxious += 25;
                    scores.sad += 20;
                    scores.stressed += 15;
                    break;
                case 'howl':
                    scores.sad += 30;
                    scores.anxious += 15;
                    break;
                case 'yelp':
                    scores.fearful += 30;
                    scores.stressed += 20;
                    break;
            }

            // Inter-bark interval scoring (Pongrácz et al., 2005)
            if (barkData.interBarkInterval !== undefined && barkData.interBarkInterval > 0) {
                const ibi = barkData.interBarkInterval;
                if (ibi < 200) {
                    scores.excited += 15; scores.anxious += 15; scores.fearful += 10;
                } else if (ibi < 500) {
                    scores.alert += 15; scores.anxious += 5;
                } else {
                    scores.calm += 5; scores.alert += 5;
                }
            }

            if (barkData.barkRate > 30) { scores.excited += 15; scores.anxious += 15; }
            if (barkData.barkRate > 5 && barkData.barkRate < 15) { scores.alert += 10; }
            if (barkData.avgPitch > 600) { scores.excited += 10; scores.anxious += 5; }
            if (barkData.avgPitch > 0 && barkData.avgPitch < 300) { scores.aggressive += 10; scores.alert += 5; }

            // Tonality scoring
            if (barkData.tonality !== undefined) {
                if (barkData.tonality > 0.6) {
                    // Tonal (harmonic) — more affiliative
                    scores.happy += 8; scores.playful += 5;
                } else if (barkData.tonality < 0.3) {
                    // Noisy — more aggressive/distressed
                    scores.aggressive += 8; scores.stressed += 5;
                }
            }
        } else {
            if (this.patterns.stillness > 10) {
                scores.calm += 15;
            }
        }

        // ── STILLNESS OVERRIDE ──
        // Critical fix: If the dog is genuinely still (high stillness score),
        // hard-suppress high-energy emotions. A still dog is NOT playful or excited.
        if (this.patterns.stillness > 15) {
            scores.playful = Math.round(scores.playful * 0.15);
            scores.excited = Math.round(scores.excited * 0.15);
            scores.calm += 30;
            // Still + no audio = very likely calm or alert
            if (!(barkData && barkData.isVocalizing)) {
                scores.calm += 20;
            }
        } else if (this.patterns.stillness > 8) {
            scores.playful = Math.round(scores.playful * 0.4);
            scores.excited = Math.round(scores.excited * 0.4);
            scores.calm += 15;
        }

        // ── LOW MOVEMENT OVERRIDE ──
        // If average speed is near zero, strongly favor calm/alert over active emotions
        if (avgSpeed < 1) {
            scores.playful = Math.round(scores.playful * 0.1);
            scores.excited = Math.round(scores.excited * 0.1);
            scores.happy = Math.round(scores.happy * 0.5);
            scores.calm += 25;
        }

        // ── Temporal patterns ──
        if (this.emotionHistory.length > 30) {
            const recent = this.emotionHistory.slice(-30);
            const emotionChanges = new Set(recent.map(e => e.emotion)).size;
            if (emotionChanges > 5) { scores.anxious += 10; scores.stressed += 10; }
            if (emotionChanges <= 2) { scores.calm += 10; }
        }

        // ── TEMPORAL MOMENTUM ──
        // Give a stability bonus to the current emotion to prevent flickering
        if (this.emotionHistory.length > 5) {
            const lastEmotion = this.emotionHistory[this.emotionHistory.length - 1].emotion;
            if (scores[lastEmotion] !== undefined) {
                scores[lastEmotion] += 12; // Stability bonus
            }
        }

        // ── Determine primary and secondary emotions ──
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const primary = sorted[0];
        const secondary = sorted[1];

        // Confidence based on score difference and data quality
        const scoreDiff = primary[1] - secondary[1];
        let confidence = Math.min(95, Math.max(15, primary[1] + scoreDiff));

        // Data quality factors
        const hasAudio = barkData && barkData.isVocalizing;
        const hasPosture = this.currentPosture !== 'unknown';
        const hasPatterns = Object.values(this.patterns).some(v => v > 0);

        // Reduce confidence if limited data
        if (this.frameHistory.length < 30) {
            confidence = Math.round(confidence * (this.frameHistory.length / 30));
        }

        // Boost or penalize based on data sources
        let dataQuality = 'visual-only';
        if (hasAudio && hasPosture && hasPatterns) {
            confidence = Math.min(95, confidence + 10);
            dataQuality = 'full-multimodal';
        } else if (hasAudio) {
            confidence = Math.min(90, confidence + 5);
            dataQuality = 'visual+audio';
        } else if (!hasPatterns && this.patterns.stillness < 5) {
            confidence = Math.max(15, confidence - 10);
            dataQuality = 'limited-visual';
        }

        // Build confidence explanation
        const confidenceExplanation = this._buildConfidenceExplanation(
            confidence, dataQuality, hasAudio, primary[0], scoreDiff
        );

        const intensity = Math.min(100, Math.round(
            avgSpeed * 3 +
            (barkData && barkData.isVocalizing ? barkData.intensity * 0.5 : 0) +
            this.patterns.bouncing * 5
        ));

        // Raw scan readings — actual measured values from the camera
        const currFrame = this.frameHistory[this.frameHistory.length - 1];
        const rawReadings = {
            movementSpeed: Math.round(avgSpeed * 10) / 10,
            instantSpeed: Math.round(movement.speed * 10) / 10,
            bodyWidth: currFrame ? Math.round(currFrame.box.width) : 0,
            bodyHeight: currFrame ? Math.round(currFrame.box.height) : 0,
            bodyArea: currFrame ? Math.round(currFrame.area) : 0,
            aspectRatio: currFrame ? Math.round(currFrame.aspectRatio * 100) / 100 : 0,
            sizeChangeRate: Math.round((movement.sizeChange || 0) * 10000) / 100,
            centerX: currFrame ? Math.round(currFrame.centerX) : 0,
            centerY: currFrame ? Math.round(currFrame.centerY) : 0,
            verticalMotion: Math.round((movement.dy || 0) * 10) / 10,
            horizontalMotion: Math.round((movement.dx || 0) * 10) / 10,
            verticalOscillation: movement.verticalOscillation || 0,
            edgeOscillation: movement.edgeOscillation || 0,
            acceleration: Math.round((movement.acceleration || 0) * 10) / 10,
            framesAnalyzed: this.frameHistory.length,
            stillnessScore: this.patterns.stillness,
            activePatterns: Object.entries(this.patterns).filter(([k, v]) => v > 0).map(([k]) => k)
        };

        return {
            primary: primary[0],
            secondary: secondary[1] > 10 ? secondary[0] : null,
            confidence: Math.round(confidence),
            intensity,
            scores,
            patterns: { ...this.patterns },
            posture: this.currentPosture,
            movement: {
                avgSpeed: Math.round(avgSpeed * 10) / 10,
                direction: movement.direction
            },
            rawReadings,
            detectedSignals: [...this.detectedSignals],
            confidenceExplanation,
            dataQuality,
            needs: [...this.currentNeeds]
        };
    }

    _buildConfidenceExplanation(confidence, dataQuality, hasAudio, emotion, scoreDiff) {
        const parts = [];

        if (dataQuality === 'full-multimodal') {
            parts.push('Using camera + microphone + movement patterns');
        } else if (dataQuality === 'visual+audio') {
            parts.push('Using camera + microphone (limited patterns)');
        } else if (dataQuality === 'limited-visual') {
            parts.push('Camera only — limited movement data so far');
        } else {
            parts.push('Camera only — no vocalizations detected');
        }

        if (scoreDiff > 20) {
            parts.push('Strong signal differentiation');
        } else if (scoreDiff < 5) {
            parts.push('Multiple emotions scoring similarly — ambiguous');
        }

        if (!hasAudio) {
            parts.push('Bark/voice data would increase accuracy');
        }

        parts.push('Cannot detect: tail position, ear angle, facial expression, eye state');

        return parts.join('. ') + '.';
    }

    // ── Needs Assessment ──
    // Maps emotional state + behavioral patterns to likely needs

    _assessNeeds(emotion, barkData) {
        this.currentNeeds = [];
        const primary = emotion.primary;
        const patterns = emotion.patterns;
        const isVocal = barkData && barkData.isVocalizing;

        // PLAY need
        if (primary === 'playful' || primary === 'excited' ||
            patterns.bouncing > 2 || patterns.playBows > 0 || patterns.jumping > 1) {
            this.currentNeeds.push({
                need: 'Play & Exercise',
                urgency: primary === 'playful' && patterns.playBows > 0 ? 'high' : 'moderate',
                detail: 'Your dog wants to play. Toss a toy, play tug, or go for an active walk.',
                science: 'Play behavior is fundamental to canine well-being (Bekoff, 2007). Play bows are the clearest invitation signal documented in canine ethology.'
            });
        }

        // ATTENTION need
        if ((primary === 'excited' || primary === 'happy') && patterns.approaching > 3) {
            this.currentNeeds.push({
                need: 'Attention & Interaction',
                urgency: 'moderate',
                detail: 'Your dog is seeking your attention and engagement.',
                science: 'Approach behavior combined with positive arousal indicates social bonding motivation (Miklósi, 2007).'
            });
        }
        if (isVocal && barkData.dominantType === 'demand') {
            this.currentNeeds.push({
                need: 'Attention — Demand',
                urgency: 'high',
                detail: 'Your dog is actively demanding something — food, outside, a toy, or your attention.',
                science: 'Repetitive single-note barking at consistent pitch is classified as demand vocalization (Yin & McCowan, 2004).'
            });
        }

        // BATHROOM need
        if (primary === 'anxious' && patterns.pacing > 3 && !isVocal) {
            this.currentNeeds.push({
                need: 'Bathroom Break',
                urgency: 'high',
                detail: 'Pacing without vocalization is a common signal that your dog needs to go outside.',
                science: 'Restless pacing is one of the top indicators of bathroom urgency in house-trained dogs (Yin, 2004).'
            });
        }

        // COMFORT need
        if (primary === 'anxious' || primary === 'stressed' || primary === 'fearful') {
            this.currentNeeds.push({
                need: 'Comfort & Safety',
                urgency: primary === 'fearful' ? 'high' : 'moderate',
                detail: 'Your dog needs reassurance. Speak calmly, remove stressors, provide a safe space.',
                science: 'Stress indicators require environmental modification and calming intervention (Beerda et al., 1998).'
            });
        }

        // REST need
        if (primary === 'calm' && this.currentPosture === 'down' && patterns.stillness > 15) {
            this.currentNeeds.push({
                need: 'Rest',
                urgency: 'low',
                detail: 'Your dog is resting comfortably. Let them be — rest is important for dogs.',
                science: 'Adult dogs need 12-14 hours of sleep per day. Undisturbed rest supports health (Coren, 2004).'
            });
        }

        // SPACE need
        if (primary === 'aggressive' || (primary === 'fearful' && patterns.retreating > 3)) {
            this.currentNeeds.push({
                need: 'Space & Distance',
                urgency: 'high',
                detail: 'Your dog needs distance from whatever is causing discomfort. Do NOT approach.',
                science: 'Retreat behavior or aggression signals indicate the dog has exceeded their comfort threshold (McConnell, 2002).'
            });
        }

        // MEDICAL CHECK need
        if (primary === 'sad' && patterns.stillness > 20 && isVocal && barkData.currentType === 'whine') {
            this.currentNeeds.push({
                need: 'Possible Medical Attention',
                urgency: 'moderate',
                detail: 'Sustained low energy with whining may indicate pain or illness. Monitor and consult a vet if persistent.',
                science: 'Whining with lethargy can indicate pain or systemic illness. Dogs often hide pain until it becomes severe (Yin, 2004).'
            });
        }

        // COMPANIONSHIP need
        if (primary === 'sad' && isVocal && barkData.currentType === 'howl') {
            this.currentNeeds.push({
                need: 'Companionship',
                urgency: 'high',
                detail: 'Your dog is expressing loneliness. Provide company and reassurance.',
                science: 'Howling is primarily a social calling behavior — the dog is trying to locate pack members (Coren, 2000).'
            });
        }

        // STIMULATION need
        if (primary === 'curious' || patterns.headTilts > 3) {
            this.currentNeeds.push({
                need: 'Mental Stimulation',
                urgency: 'low',
                detail: 'Your dog is cognitively engaged. Encourage exploration with puzzle toys or new experiences.',
                science: 'Head tilting indicates active auditory processing. Cognitive enrichment improves well-being (Horowitz, 2009).'
            });
        }

        // Default if nothing matched
        if (this.currentNeeds.length === 0) {
            this.currentNeeds.push({
                need: 'Monitoring',
                urgency: 'low',
                detail: 'Your dog appears to be in a neutral state. Continue observing.',
                science: 'Dogs cycle through many emotional states throughout the day. Neutral states are healthy baseline.'
            });
        }
    }

    // ── Full Analysis Report ──

    fullAnalysis() {
        if (this.frameHistory.length < 10) {
            return this._insufficientData();
        }

        const fps = 30;
        const duration = this.frameHistory.length / fps;

        const emotionCounts = {};
        this.emotionHistory.forEach(e => {
            emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
        });

        let dominantEmotion = 'calm';
        let maxCount = 0;
        Object.entries(emotionCounts).forEach(([emotion, count]) => {
            if (count > maxCount) { maxCount = count; dominantEmotion = emotion; }
        });

        const total = this.emotionHistory.length;
        const emotionPercentages = {};
        Object.entries(emotionCounts).forEach(([emotion, count]) => {
            emotionPercentages[emotion] = Math.round((count / total) * 100);
        });

        const avgConfidence = total > 0
            ? Math.round(this.emotionHistory.reduce((s, e) => s + e.confidence, 0) / total) : 0;
        const avgIntensity = total > 0
            ? Math.round(this.emotionHistory.reduce((s, e) => s + e.intensity, 0) / total) : 0;

        let emotionChanges = 0;
        for (let i = 1; i < this.emotionHistory.length; i++) {
            if (this.emotionHistory[i].emotion !== this.emotionHistory[i - 1].emotion) {
                emotionChanges++;
            }
        }
        const stabilityScore = Math.max(0, 100 - Math.round((emotionChanges / Math.max(1, total)) * 200));

        const positiveEmotions = ['happy', 'playful', 'calm', 'curious', 'excited'];
        const negativeEmotions = ['anxious', 'stressed', 'fearful', 'aggressive', 'sad'];
        let positiveTime = 0;
        let negativeTime = 0;
        this.emotionHistory.forEach(e => {
            if (positiveEmotions.includes(e.emotion)) positiveTime++;
            if (negativeEmotions.includes(e.emotion)) negativeTime++;
        });

        const wellbeingScore = total > 0
            ? Math.round(((positiveTime - negativeTime * 0.5) / total) * 100 + 50) : 50;

        const avgSpeed = this.movementHistory.length > 0
            ? this.movementHistory.reduce((s, m) => s + m.speed, 0) / this.movementHistory.length : 0;

        // Posture summary
        const postureCounts = {};
        this.postureHistory.forEach(p => {
            postureCounts[p.posture] = (postureCounts[p.posture] || 0) + 1;
        });

        // Action summary — top actions detected during scan
        const sortedActions = Object.entries(this.actionCounts)
            .sort((a, b) => b[1] - a[1]);
        const topActions = sortedActions.slice(0, 20);

        // Determine the most frequent primary action
        let primaryAction = 'observing';
        if (this.actionHistory.length > 0) {
            const actionFreq = {};
            this.actionHistory.forEach(a => {
                actionFreq[a.action] = (actionFreq[a.action] || 0) + 1;
            });
            primaryAction = Object.entries(actionFreq).sort((a, b) => b[1] - a[1])[0][0];
        }

        return {
            duration: Math.round(duration * 10) / 10,
            framesAnalyzed: this.frameHistory.length,
            dominantEmotion,
            currentEmotion: this.primaryEmotion,
            emotionDistribution: emotionPercentages,
            confidence: avgConfidence,
            intensity: avgIntensity,
            stability: stabilityScore,
            wellbeing: Math.max(0, Math.min(100, wellbeingScore)),
            emotionChanges,
            patterns: { ...this.patterns },
            posture: {
                current: this.currentPosture,
                distribution: postureCounts
            },
            movement: {
                avgSpeed: Math.round(avgSpeed * 10) / 10,
                energyLevel: avgSpeed > 10 ? 'high' : avgSpeed > 4 ? 'moderate' : 'low'
            },
            needs: [...this.currentNeeds],
            detectedSignals: [...this.detectedSignals],
            timeline: this.emotionHistory.filter((e, i) => i % 30 === 0).map(e => ({
                time: Math.round(e.time / 30 * 10) / 10,
                emotion: e.emotion,
                confidence: e.confidence
            })),
            actionSummary: {
                primary: primaryAction,
                allDetected: { ...this.actionCounts },
                topActions: topActions,
                totalUniqueActions: sortedActions.length,
                timeline: this.actionHistory.filter((a, i) => i % 30 === 0).map(a => ({
                    time: Math.round(a.time / 30 * 10) / 10,
                    action: a.action
                }))
            }
        };
    }

    // ── Utilities ──

    _defaultAssessment() {
        return {
            primary: 'observing',
            secondary: null,
            confidence: 0,
            intensity: 0,
            scores: {},
            patterns: { ...this.patterns },
            posture: 'unknown',
            movement: { avgSpeed: 0, direction: 'still' },
            detectedSignals: [],
            confidenceExplanation: 'Waiting for dog detection...',
            dataQuality: 'none',
            needs: [],
            currentAction: 'observing',
            activeActions: []
        };
    }

    _insufficientData() {
        return {
            duration: 0, framesAnalyzed: 0, dominantEmotion: 'unknown',
            currentEmotion: 'unknown', emotionDistribution: {},
            confidence: 0, intensity: 0, stability: 0, wellbeing: 50,
            emotionChanges: 0, patterns: {}, posture: { current: 'unknown', distribution: {} },
            movement: { avgSpeed: 0, energyLevel: 'none' },
            needs: [], detectedSignals: [], timeline: [],
            actionSummary: { primary: 'observing', allDetected: {}, timeline: [] }
        };
    }

    clearAll() {
        this.frameHistory = [];
        this.emotionHistory = [];
        this.movementHistory = [];
        this.positionHistory = [];
        this.sizeHistory = [];
        this.postureHistory = [];
        this.currentPosture = 'unknown';
        this.smoothedBox = null;
        this.detectedSignals = [];
        this.currentNeeds = [];
        this.primaryEmotion = 'observing';
        this.secondaryEmotion = null;
        this.emotionConfidence = 0;
        this.emotionIntensity = 0;
        this.patterns = {
            pacing: 0, spinning: 0, bouncing: 0, stillness: 0,
            approaching: 0, retreating: 0, headTilts: 0, playBows: 0,
            jumping: 0, crouching: 0, postureChanges: 0, restlessness: 0,
            tailWagLikely: 0
        };
        // Reset K9 action state
        this.currentAction = 'observing';
        this.activeActions = [];
        this.actionHistory = [];
        this.actionCounts = {};
    }
}

window.DogEmotionEngine = DogEmotionEngine;
