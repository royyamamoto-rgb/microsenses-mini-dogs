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

        // Posture tracking
        this.postureHistory = [];
        this.currentPosture = 'unknown'; // standing, sitting, lying, crouching

        // Detected signals (for explanation)
        this.detectedSignals = [];

        // Needs assessment
        this.currentNeeds = [];

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
    }

    processFrame(detection, barkData) {
        if (!detection || !detection.box) return this._defaultAssessment();

        const box = detection.box;
        const now = Date.now();

        const frameData = {
            timestamp: now,
            box: { ...box },
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

        return emotion;
    }

    // ── Posture Estimation ──
    // Based on bounding box aspect ratio:
    // Standing dog: width ~1.2-1.8x height (horizontal body)
    // Sitting dog: width ~0.6-1.0x height (more vertical)
    // Lying down: width ~2.0+ height (very wide, short)
    // Crouching: rapid height decrease from standing

    _estimatePosture() {
        if (this.frameHistory.length < 3) return;

        const curr = this.frameHistory[this.frameHistory.length - 1];
        const ar = curr.aspectRatio;

        let posture = 'standing';
        if (ar >= 2.0) {
            posture = 'lying';
        } else if (ar >= 1.2 && ar < 2.0) {
            posture = 'standing';
        } else if (ar >= 0.5 && ar < 1.2) {
            posture = 'sitting';
        } else if (ar < 0.5) {
            // Very tall and narrow — likely sitting upright or begging
            posture = 'sitting';
        }

        // Check for crouching — rapid decrease in height from standing
        if (this.frameHistory.length >= 5) {
            const prev5 = this.frameHistory.slice(-5);
            const heightDrop = prev5[0].box.height - curr.box.height;
            const heightRatio = curr.box.height / Math.max(1, prev5[0].box.height);
            if (heightRatio < 0.7 && prev5[0].aspectRatio < 1.5) {
                posture = 'crouching';
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

    // ── Signal Detection ──

    _buildSignalList(movement, barkData) {
        const avgSpeed = this.movementHistory.length > 0
            ? this.movementHistory.slice(-30).reduce((s, m) => s + m.speed, 0) / Math.min(30, this.movementHistory.length)
            : 0;

        // Posture signal
        if (this.currentPosture !== 'unknown') {
            this.detectedSignals.push({
                type: 'posture',
                signal: `Body posture: ${this.currentPosture}`,
                detail: this.currentPosture === 'standing' ? 'Dog is upright and active' :
                        this.currentPosture === 'sitting' ? 'Dog is seated — attentive or resting' :
                        this.currentPosture === 'lying' ? 'Dog is lying down — relaxed or tired' :
                        'Dog has lowered body — could be play bow, submission, or fear',
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

        const dx = curr.centerX - prev.centerX;
        const dy = curr.centerY - prev.centerY;
        const magnitude = Math.sqrt(dx * dx + dy * dy);

        const sizeChange = (curr.area - prev.area) / Math.max(1, prev.area);
        const aspectChange = curr.aspectRatio - prev.aspectRatio;

        // Acceleration (change in speed)
        let acceleration = 0;
        if (this.movementHistory.length >= 1) {
            acceleration = magnitude - this.movementHistory[this.movementHistory.length - 1].speed;
        }

        let direction = 'still';
        if (magnitude > 3) {
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }
        }

        // Vertical oscillation
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

        // Edge oscillation (possible tail wag indicator)
        let edgeOscillation = 0;
        if (this.frameHistory.length >= 8) {
            const recent8 = this.frameHistory.slice(-8);
            const rightEdges = recent8.map(f => f.box.x + f.box.width);
            let osc = 0;
            for (let i = 2; i < rightEdges.length; i++) {
                const d1 = rightEdges[i - 1] - rightEdges[i - 2];
                const d2 = rightEdges[i] - rightEdges[i - 1];
                if ((d1 > 1 && d2 < -1) || (d1 < -1 && d2 > 1)) osc++;
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
            if (recentMovements[i].dx > 3 && recentMovements[i - 1].dx < -3) directionChanges++;
            if (recentMovements[i].dx < -3 && recentMovements[i - 1].dx > 3) directionChanges++;
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
        this.patterns.bouncing = totalBounce > 3 ? totalBounce : 0;

        // ── Jumping Detection ──
        let jumpCount = 0;
        for (let i = 1; i < recentMovements.length; i++) {
            if (recentMovements[i].dy < -8 && recentMovements[i].acceleration > 5) jumpCount++;
        }
        this.patterns.jumping = jumpCount;

        // ── Stillness Detection ──
        const avgSpeed = recentMovements.reduce((s, m) => s + m.speed, 0) / recentMovements.length;
        this.patterns.stillness = avgSpeed < 2 ? Math.round(30 - avgSpeed * 10) : 0;

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
        this.patterns.tailWagLikely = totalEdgeOsc > 3 ? totalEdgeOsc : 0;

        // ── Restlessness ──
        // Frequent posture changes or erratic movement
        const speedVariance = this._computeVariance(recentMovements.map(m => m.speed));
        this.patterns.restlessness = speedVariance > 20 ? Math.round(speedVariance / 4) : 0;

        // ── Crouching ──
        this.patterns.crouching = this.currentPosture === 'crouching' ? 1 : 0;
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

        // ── Posture-based scoring (NEW) ──
        switch (this.currentPosture) {
            case 'lying':
                scores.calm += 20;
                scores.sad += 8;
                scores.fearful += 3;
                break;
            case 'sitting':
                scores.calm += 12;
                scores.alert += 10;
                scores.curious += 5;
                break;
            case 'standing':
                scores.alert += 8;
                scores.happy += 5;
                break;
            case 'crouching':
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

        // ── Temporal patterns ──
        if (this.emotionHistory.length > 30) {
            const recent = this.emotionHistory.slice(-30);
            const emotionChanges = new Set(recent.map(e => e.emotion)).size;
            if (emotionChanges > 5) { scores.anxious += 10; scores.stressed += 10; }
            if (emotionChanges <= 2) { scores.calm += 10; }
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
        if (primary === 'calm' && this.currentPosture === 'lying' && patterns.stillness > 15) {
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
            posture: 'unknown',
            movement: { avgSpeed: 0, direction: 'still' },
            detectedSignals: [],
            confidenceExplanation: 'Waiting for dog detection...',
            dataQuality: 'none',
            needs: []
        };
    }

    _insufficientData() {
        return {
            duration: 0, framesAnalyzed: 0, dominantEmotion: 'unknown',
            currentEmotion: 'unknown', emotionDistribution: {},
            confidence: 0, intensity: 0, stability: 0, wellbeing: 50,
            emotionChanges: 0, patterns: {}, posture: { current: 'unknown', distribution: {} },
            movement: { avgSpeed: 0, energyLevel: 'none' },
            needs: [], detectedSignals: [], timeline: []
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
    }
}

window.DogEmotionEngine = DogEmotionEngine;
