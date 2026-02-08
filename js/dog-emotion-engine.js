/* ============================================
   DOG EMOTION ENGINE — Canine Emotional State Detection

   Detects and tracks dog emotional states from:
   1. Body movement patterns (via bounding box tracking)
   2. Audio/bark analysis data
   3. Movement intensity and patterns

   Scientific Basis:
   - Turid Rugaas - "Calming Signals" (2006)
   - Stanley Coren - "How to Speak Dog" (2000)
   - Patricia McConnell - "The Other End of the Leash" (2002)
   - Dr. Sophia Yin - Body language research
   - Beerda et al. (1998) - Stress indicators in dogs
   - Bekoff (2007) - Emotional Lives of Animals
   - Horowitz (2009) - Dog cognition and perception

   Emotion Categories (research-backed):
   - Happy/Joyful: Loose body, relaxed mouth, bouncy movement
   - Excited: Rapid movement, high energy, spinning
   - Playful: Play bows, bouncy, zoomies, short barks
   - Calm/Content: Slow movement, relaxed posture, soft eyes
   - Anxious: Pacing, lip licking, yawning (displacement)
   - Stressed: Panting, pacing, whale eye, body tension
   - Fearful: Cowering, tucked body, trembling, low position
   - Aggressive: Stiff posture, forward lean, direct stare
   - Alert: Ears forward, still posture, focused
   - Sad/Lonely: Low energy, howling, low body position
   - Curious: Head tilt, ears up, approaching
   ============================================ */

class DogEmotionEngine {
    constructor() {
        this.frameHistory = [];
        this.maxHistoryFrames = 300; // 10 seconds at 30fps
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

        // Behavioral pattern counters
        this.patterns = {
            pacing: 0,       // Back and forth movement
            spinning: 0,     // Circular movement
            bouncing: 0,     // Vertical oscillation (play)
            stillness: 0,    // Minimal movement
            approaching: 0,  // Moving toward camera
            retreating: 0,   // Moving away from camera
            headTilts: 0,    // Size aspect ratio changes
            playBows: 0      // Sudden drop in Y position (front down)
        };
    }

    /**
     * Process a single detection frame
     * @param {object} detection - { box: {x,y,width,height}, confidence }
     * @param {object} barkData - Current bark analysis quick assessment
     * @returns {object} Current emotional assessment
     */
    processFrame(detection, barkData) {
        if (!detection || !detection.box) return this._defaultAssessment();

        const box = detection.box;
        const now = Date.now();

        // Store frame data
        const frameData = {
            timestamp: now,
            box: { ...box },
            centerX: box.x + box.width / 2,
            centerY: box.y + box.height / 2,
            area: box.width * box.height,
            aspectRatio: box.width / Math.max(1, box.height)
        };

        this.frameHistory.push(frameData);
        if (this.frameHistory.length > this.maxHistoryFrames) {
            this.frameHistory.shift();
        }

        // Compute movement metrics
        const movement = this._computeMovement();
        this.movementHistory.push(movement);
        if (this.movementHistory.length > this.maxHistoryFrames) {
            this.movementHistory.shift();
        }

        // Detect behavioral patterns
        this._detectPatterns(movement);

        // Determine emotional state
        const emotion = this._assessEmotion(movement, barkData);

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

        return emotion;
    }

    // ── Movement Analysis ──

    _computeMovement() {
        if (this.frameHistory.length < 2) {
            return { speed: 0, direction: 'still', magnitude: 0, sizeChange: 0, verticalOscillation: 0 };
        }

        const curr = this.frameHistory[this.frameHistory.length - 1];
        const prev = this.frameHistory[this.frameHistory.length - 2];

        const dx = curr.centerX - prev.centerX;
        const dy = curr.centerY - prev.centerY;
        const magnitude = Math.sqrt(dx * dx + dy * dy);

        // Size change (approaching/retreating indicator)
        const sizeChange = (curr.area - prev.area) / Math.max(1, prev.area);

        // Aspect ratio change (posture change indicator)
        const aspectChange = curr.aspectRatio - prev.aspectRatio;

        // Direction
        let direction = 'still';
        if (magnitude > 3) {
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }
        }

        // Vertical oscillation (bouncing/play indicator)
        let verticalOscillation = 0;
        if (this.frameHistory.length >= 6) {
            const recent6 = this.frameHistory.slice(-6);
            const yValues = recent6.map(f => f.centerY);
            let oscillations = 0;
            for (let i = 2; i < yValues.length; i++) {
                const d1 = yValues[i - 1] - yValues[i - 2];
                const d2 = yValues[i] - yValues[i - 1];
                if ((d1 > 2 && d2 < -2) || (d1 < -2 && d2 > 2)) oscillations++;
            }
            verticalOscillation = oscillations;
        }

        return {
            speed: magnitude,
            direction,
            magnitude,
            dx, dy,
            sizeChange,
            aspectChange,
            verticalOscillation
        };
    }

    _detectPatterns(movement) {
        if (this.frameHistory.length < 10) return;

        const recentFrames = this.frameHistory.slice(-30);
        const recentMovements = this.movementHistory.slice(-30);

        // ── Pacing Detection ──
        // Back-and-forth horizontal movement
        let directionChanges = 0;
        for (let i = 2; i < recentMovements.length; i++) {
            if (recentMovements[i].dx > 3 && recentMovements[i - 1].dx < -3) directionChanges++;
            if (recentMovements[i].dx < -3 && recentMovements[i - 1].dx > 3) directionChanges++;
        }
        this.patterns.pacing = directionChanges > 3 ? directionChanges : 0;

        // ── Spinning Detection ──
        // Circular movement pattern (all 4 directions in sequence)
        if (recentMovements.length >= 12) {
            const dirs = recentMovements.slice(-12).map(m => m.direction);
            const uniqueDirs = new Set(dirs.filter(d => d !== 'still'));
            this.patterns.spinning = uniqueDirs.size >= 4 ? 1 : 0;
        }

        // ── Bouncing Detection ──
        // Vertical oscillation pattern
        const recentBounces = recentMovements.slice(-15);
        const totalBounce = recentBounces.reduce((s, m) => s + m.verticalOscillation, 0);
        this.patterns.bouncing = totalBounce > 3 ? totalBounce : 0;

        // ── Stillness Detection ──
        const avgSpeed = recentMovements.reduce((s, m) => s + m.speed, 0) / recentMovements.length;
        this.patterns.stillness = avgSpeed < 2 ? Math.round(30 - avgSpeed * 10) : 0;

        // ── Approaching/Retreating ──
        const avgSizeChange = recentMovements.reduce((s, m) => s + m.sizeChange, 0) / recentMovements.length;
        this.patterns.approaching = avgSizeChange > 0.01 ? Math.round(avgSizeChange * 500) : 0;
        this.patterns.retreating = avgSizeChange < -0.01 ? Math.round(Math.abs(avgSizeChange) * 500) : 0;

        // ── Head Tilt Detection ──
        // Rapid aspect ratio changes
        const aspectChanges = recentMovements.filter(m => Math.abs(m.aspectChange) > 0.05).length;
        this.patterns.headTilts = aspectChanges > 2 ? aspectChanges : 0;

        // ── Play Bow Detection ──
        // Sudden drop in Y position (front goes down) + size increase (body widens)
        if (recentMovements.length >= 5) {
            const recent5 = recentMovements.slice(-5);
            const dropDown = recent5.some(m => m.dy > 10 && m.sizeChange > 0.02);
            this.patterns.playBows = dropDown ? 1 : 0;
        }
    }

    // ── Emotion Assessment ──

    _assessEmotion(movement, barkData) {
        const scores = {
            happy: 0,
            excited: 0,
            playful: 0,
            calm: 0,
            anxious: 0,
            stressed: 0,
            fearful: 0,
            aggressive: 0,
            alert: 0,
            sad: 0,
            curious: 0
        };

        // ── Movement-based scoring ──

        const avgSpeed = this.movementHistory.length > 0
            ? this.movementHistory.slice(-30).reduce((s, m) => s + m.speed, 0) / Math.min(30, this.movementHistory.length)
            : 0;

        // High movement + bouncing = playful/excited
        if (avgSpeed > 8 && this.patterns.bouncing > 2) {
            scores.playful += 35;
            scores.excited += 25;
        }

        // Moderate movement with variation = happy
        if (avgSpeed > 3 && avgSpeed < 10) {
            scores.happy += 20;
        }

        // Very high speed = excited or stressed
        if (avgSpeed > 15) {
            scores.excited += 30;
            scores.stressed += 10;
        }

        // Low movement = calm or sad or fearful
        if (avgSpeed < 2) {
            scores.calm += 25;
            scores.sad += 10;
        }

        // Pacing = anxious/stressed
        if (this.patterns.pacing > 3) {
            scores.anxious += 30;
            scores.stressed += 25;
        }

        // Spinning = excited or stressed
        if (this.patterns.spinning > 0) {
            scores.excited += 20;
            if (this.patterns.pacing > 2) scores.stressed += 15;
        }

        // Bouncing = playful
        if (this.patterns.bouncing > 2) {
            scores.playful += 25;
            scores.happy += 15;
        }

        // Play bow = playful (strong indicator)
        if (this.patterns.playBows > 0) {
            scores.playful += 40;
            scores.happy += 20;
        }

        // Stillness = calm or alert or fearful
        if (this.patterns.stillness > 15) {
            scores.calm += 15;
            scores.alert += 15;
        }

        // Approaching = curious or friendly
        if (this.patterns.approaching > 3) {
            scores.curious += 20;
            scores.happy += 10;
        }

        // Retreating = fearful or stressed
        if (this.patterns.retreating > 3) {
            scores.fearful += 25;
            scores.stressed += 15;
        }

        // Head tilts = curious (strong indicator)
        if (this.patterns.headTilts > 2) {
            scores.curious += 35;
            scores.alert += 10;
        }

        // ── Audio-based scoring ──

        if (barkData && barkData.isVocalizing) {
            switch (barkData.currentType) {
                case 'bark':
                    switch (barkData.dominantType) {
                        case 'alert':
                            scores.alert += 30;
                            scores.excited += 10;
                            break;
                        case 'play':
                            scores.playful += 30;
                            scores.happy += 15;
                            break;
                        case 'anxiety':
                            scores.anxious += 35;
                            scores.stressed += 20;
                            break;
                        case 'demand':
                            scores.excited += 15;
                            scores.anxious += 10;
                            break;
                        case 'aggressive':
                            scores.aggressive += 35;
                            scores.alert += 15;
                            break;
                        default:
                            scores.alert += 10;
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

            // High bark rate = excited or anxious
            if (barkData.barkRate > 30) {
                scores.excited += 15;
                scores.anxious += 15;
            }

            // Low bark rate with occasional barks = alert
            if (barkData.barkRate > 5 && barkData.barkRate < 15) {
                scores.alert += 10;
            }

            // High pitch = excitement or anxiety
            if (barkData.avgPitch > 600) {
                scores.excited += 10;
                scores.anxious += 5;
            }

            // Low pitch = aggression or confidence
            if (barkData.avgPitch > 0 && barkData.avgPitch < 300) {
                scores.aggressive += 10;
                scores.alert += 5;
            }
        } else {
            // Silence with stillness = calm
            if (this.patterns.stillness > 10) {
                scores.calm += 15;
            }
        }

        // ── Temporal patterns ──
        // Check emotional stability over time
        if (this.emotionHistory.length > 30) {
            const recent = this.emotionHistory.slice(-30);
            const emotionChanges = new Set(recent.map(e => e.emotion)).size;

            if (emotionChanges > 5) {
                scores.anxious += 10;
                scores.stressed += 10;
            }
            if (emotionChanges <= 2) {
                scores.calm += 10;
            }
        }

        // ── Determine primary and secondary emotions ──
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const primary = sorted[0];
        const secondary = sorted[1];

        // Confidence based on score difference and consistency
        const scoreDiff = primary[1] - secondary[1];
        let confidence = Math.min(95, Math.max(15, primary[1] + scoreDiff));

        // Reduce confidence if we don't have enough data
        if (this.frameHistory.length < 30) {
            confidence = Math.round(confidence * (this.frameHistory.length / 30));
        }

        // Intensity based on movement energy + vocal energy
        const intensity = Math.min(100, Math.round(
            avgSpeed * 3 +
            (barkData && barkData.isVocalizing ? barkData.intensity * 0.5 : 0) +
            this.patterns.bouncing * 5
        ));

        return {
            primary: primary[0],
            secondary: secondary[1] > 10 ? secondary[0] : null,
            confidence: Math.round(confidence),
            intensity,
            scores,
            patterns: { ...this.patterns },
            movement: {
                avgSpeed: Math.round(avgSpeed * 10) / 10,
                direction: movement.direction
            }
        };
    }

    // ── Full Analysis Report ──

    fullAnalysis() {
        if (this.frameHistory.length < 10) {
            return this._insufficientData();
        }

        const fps = 30;
        const duration = this.frameHistory.length / fps;

        // Emotion distribution
        const emotionCounts = {};
        this.emotionHistory.forEach(e => {
            emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
        });

        // Dominant emotion over entire scan
        let dominantEmotion = 'calm';
        let maxCount = 0;
        Object.entries(emotionCounts).forEach(([emotion, count]) => {
            if (count > maxCount) { maxCount = count; dominantEmotion = emotion; }
        });

        // Emotion percentages
        const total = this.emotionHistory.length;
        const emotionPercentages = {};
        Object.entries(emotionCounts).forEach(([emotion, count]) => {
            emotionPercentages[emotion] = Math.round((count / total) * 100);
        });

        // Average confidence and intensity
        const avgConfidence = this.emotionHistory.length > 0
            ? Math.round(this.emotionHistory.reduce((s, e) => s + e.confidence, 0) / total) : 0;
        const avgIntensity = this.emotionHistory.length > 0
            ? Math.round(this.emotionHistory.reduce((s, e) => s + e.intensity, 0) / total) : 0;

        // Emotional stability
        let emotionChanges = 0;
        for (let i = 1; i < this.emotionHistory.length; i++) {
            if (this.emotionHistory[i].emotion !== this.emotionHistory[i - 1].emotion) {
                emotionChanges++;
            }
        }
        const stabilityScore = Math.max(0, 100 - Math.round((emotionChanges / Math.max(1, total)) * 200));

        // Overall well-being assessment
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

        // Movement summary
        const avgSpeed = this.movementHistory.length > 0
            ? this.movementHistory.reduce((s, m) => s + m.speed, 0) / this.movementHistory.length : 0;

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
            movement: {
                avgSpeed: Math.round(avgSpeed * 10) / 10,
                energyLevel: avgSpeed > 10 ? 'high' : avgSpeed > 4 ? 'moderate' : 'low'
            },
            timeline: this.emotionHistory.filter((e, i) => i % 30 === 0).map(e => ({
                time: Math.round(e.time / 30 * 10) / 10,
                emotion: e.emotion,
                confidence: e.confidence
            }))
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
            movement: { avgSpeed: 0, direction: 'still' }
        };
    }

    _insufficientData() {
        return {
            duration: 0,
            framesAnalyzed: 0,
            dominantEmotion: 'unknown',
            currentEmotion: 'unknown',
            emotionDistribution: {},
            confidence: 0,
            intensity: 0,
            stability: 0,
            wellbeing: 50,
            emotionChanges: 0,
            patterns: {},
            movement: { avgSpeed: 0, energyLevel: 'none' },
            timeline: []
        };
    }

    clearAll() {
        this.frameHistory = [];
        this.emotionHistory = [];
        this.movementHistory = [];
        this.positionHistory = [];
        this.sizeHistory = [];
        this.primaryEmotion = 'observing';
        this.secondaryEmotion = null;
        this.emotionConfidence = 0;
        this.emotionIntensity = 0;
        this.patterns = {
            pacing: 0, spinning: 0, bouncing: 0, stillness: 0,
            approaching: 0, retreating: 0, headTilts: 0, playBows: 0
        };
    }
}

window.DogEmotionEngine = DogEmotionEngine;
