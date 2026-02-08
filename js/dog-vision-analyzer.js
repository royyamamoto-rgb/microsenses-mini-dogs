/* ============================================
   DOG VISION ANALYZER — Pixel-Level Motion Analysis

   Analyzes ACTUAL pixel data within the dog's bounding box
   to detect micro-vibrations, tail wags, body tension,
   head movement, and zone-specific motion.

   This goes FAR beyond bounding box tracking:
   - Bounding box: 4 numbers (x, y, w, h) → coarse movement
   - Pixel analysis: thousands of pixels → fine-grained detail

   What pixel analysis detects:
   - Micro-vibrations: tiny pixel changes = body trembling, energy
   - Tail wag: oscillating motion in edge zones
   - Head movement: motion in top zones
   - Body tension: widespread uniform small motion
   - Overall activity: actual visible movement in the dog's body
   - Zone motion: which body part is moving most
   - Motion frequency: speed of movement changes
   ============================================ */

class DogVisionAnalyzer {
    constructor() {
        // Off-screen canvas for pixel analysis
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        // Resize dog crop to 64x64 for fast analysis
        // 64x64 = 4096 pixels — enough detail, very fast computation
        this.CROP_SIZE = 64;
        this.canvas.width = this.CROP_SIZE;
        this.canvas.height = this.CROP_SIZE;

        // Frame buffers (grayscale, 0-1 range)
        this.prevFrame = null;
        this.currFrame = null;

        // Motion history for temporal analysis
        this.motionHistory = [];
        this.maxHistory = 90; // 3 seconds at 30fps

        // Zone grid (3x3) — divides dog body into 9 regions
        // [top-left]    [top-center]    [top-right]      ← Head area
        // [mid-left]    [mid-center]    [mid-right]      ← Body/core
        // [bottom-left] [bottom-center] [bottom-right]   ← Legs/lower body
        this.GRID_ROWS = 3;
        this.GRID_COLS = 3;

        // Smoothed values for stability
        this.smoothedOverallMotion = 0;
        this.smoothedMicroVib = 0;
        this.smoothedMacroMotion = 0;
        this.EMA_ALPHA = 0.3;
    }

    /**
     * Analyze the dog region from the current video frame.
     * Call this every frame with the video element and the dog's bounding box.
     *
     * @param {HTMLVideoElement} videoElement - The live video feed
     * @param {object} dogBox - { x, y, width, height } from COCO-SSD (smoothed)
     * @returns {object} Pixel analysis results
     */
    analyze(videoElement, dogBox) {
        if (!videoElement || !dogBox || dogBox.width < 10 || dogBox.height < 10) {
            return this._defaultResult();
        }

        try {
            // Crop dog region from video and resize to standard size
            this.ctx.drawImage(
                videoElement,
                dogBox.x, dogBox.y, dogBox.width, dogBox.height,
                0, 0, this.CROP_SIZE, this.CROP_SIZE
            );

            // Get pixel data
            const imageData = this.ctx.getImageData(0, 0, this.CROP_SIZE, this.CROP_SIZE);
            const pixels = imageData.data; // RGBA array

            // Convert to grayscale (0-1 range)
            const totalPixels = this.CROP_SIZE * this.CROP_SIZE;
            const gray = new Float32Array(totalPixels);
            for (let i = 0; i < totalPixels; i++) {
                const r = pixels[i * 4];
                const g = pixels[i * 4 + 1];
                const b = pixels[i * 4 + 2];
                gray[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            }

            this.prevFrame = this.currFrame;
            this.currFrame = gray;

            // Need two frames to compute differences
            if (!this.prevFrame) return this._defaultResult();

            // ── Compute pixel-level differences ──
            const diff = new Float32Array(totalPixels);
            let totalDiff = 0;
            let microVibPixels = 0;    // Small but real changes (trembling, micro-motion)
            let macroMotionPixels = 0;  // Large changes (major movement)
            let stillPixels = 0;        // No change (background, still parts)

            for (let i = 0; i < totalPixels; i++) {
                diff[i] = Math.abs(this.currFrame[i] - this.prevFrame[i]);
                totalDiff += diff[i];

                if (diff[i] < 0.008) {
                    stillPixels++;
                } else if (diff[i] < 0.06) {
                    microVibPixels++;
                } else {
                    macroMotionPixels++;
                }
            }

            const avgDiff = totalDiff / totalPixels;
            const microVibRatio = microVibPixels / totalPixels;
            const macroMotionRatio = macroMotionPixels / totalPixels;
            const stillRatio = stillPixels / totalPixels;

            // EMA smoothing
            this.smoothedOverallMotion = this.EMA_ALPHA * avgDiff + (1 - this.EMA_ALPHA) * this.smoothedOverallMotion;
            this.smoothedMicroVib = this.EMA_ALPHA * microVibRatio + (1 - this.EMA_ALPHA) * this.smoothedMicroVib;
            this.smoothedMacroMotion = this.EMA_ALPHA * macroMotionRatio + (1 - this.EMA_ALPHA) * this.smoothedMacroMotion;

            // ── Per-zone motion analysis ──
            const zones = this._computeZoneMotion(diff);

            // ── Tail wag detection ──
            const tailWagScore = this._detectTailWag(zones);

            // ── Body tension (trembling/vibrating) ──
            const tensionScore = this._computeTension(microVibRatio, macroMotionRatio);

            // ── Head activity ──
            const headActivity = this._computeHeadActivity(zones);

            // ── Motion frequency (oscillation speed) ──
            const motionFrequency = this._estimateMotionFrequency();

            // ── Breathing detection ──
            const breathingDetected = this._detectBreathing(zones);

            // Build result
            const result = {
                // Raw motion data
                overallMotion: this.smoothedOverallMotion,
                microVibration: this.smoothedMicroVib,
                macroMotion: this.smoothedMacroMotion,
                stillRatio,

                // Zone data
                zones,

                // Detected features
                tailWagScore,
                tensionScore,
                headActivity,
                motionFrequency,
                breathingDetected,

                // Energy/Vibration/Frequency for 369 engine
                // These are REAL measurements from actual pixel data
                pixelEnergy: Math.round(this.smoothedOverallMotion * 5000) / 10,
                pixelVibration: Math.round(this.smoothedMicroVib * 1000) / 10,
                pixelFrequency: motionFrequency,

                // Body state interpretation
                bodyState: this._interpretBodyState(
                    this.smoothedOverallMotion, this.smoothedMicroVib,
                    this.smoothedMacroMotion, tensionScore, tailWagScore
                )
            };

            // Store history
            this.motionHistory.push(result);
            if (this.motionHistory.length > this.maxHistory) {
                this.motionHistory.shift();
            }

            return result;

        } catch (err) {
            // Canvas operations can fail on some devices
            return this._defaultResult();
        }
    }

    // ── Zone Motion Analysis ──
    // Divides the dog crop into a 3x3 grid and measures motion per zone
    _computeZoneMotion(diff) {
        const zones = [];
        const zoneW = Math.floor(this.CROP_SIZE / this.GRID_COLS);
        const zoneH = Math.floor(this.CROP_SIZE / this.GRID_ROWS);

        for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                let zoneSum = 0;
                let zoneCount = 0;

                for (let y = row * zoneH; y < (row + 1) * zoneH; y++) {
                    for (let x = col * zoneW; x < (col + 1) * zoneW; x++) {
                        const idx = y * this.CROP_SIZE + x;
                        if (idx < diff.length) {
                            zoneSum += diff[idx];
                            zoneCount++;
                        }
                    }
                }

                zones.push({
                    row, col,
                    motion: zoneCount > 0 ? zoneSum / zoneCount : 0,
                    label: this._zoneLabel(row, col)
                });
            }
        }

        return zones;
    }

    _zoneLabel(row, col) {
        const rowLabels = ['top', 'mid', 'bottom'];
        const colLabels = ['left', 'center', 'right'];
        return rowLabels[row] + '-' + colLabels[col];
    }

    // ── Tail Wag Detection ──
    // Tail wag creates oscillating motion in left/right edge zones
    _detectTailWag(currentZones) {
        if (this.motionHistory.length < 12) return 0;

        const recent = this.motionHistory.slice(-12);

        // Get left and right edge zone motion over time
        const leftMotion = recent.map(r => {
            const leftZones = r.zones.filter(z => z.col === 0);
            return leftZones.length > 0 ? leftZones.reduce((s, z) => s + z.motion, 0) / leftZones.length : 0;
        });
        const rightMotion = recent.map(r => {
            const rightZones = r.zones.filter(z => z.col === 2);
            return rightZones.length > 0 ? rightZones.reduce((s, z) => s + z.motion, 0) / rightZones.length : 0;
        });

        // Check for oscillation pattern in either edge
        const leftOsc = this._countOscillations(leftMotion);
        const rightOsc = this._countOscillations(rightMotion);

        return Math.max(leftOsc, rightOsc);
    }

    _countOscillations(values) {
        let oscillations = 0;
        for (let i = 2; i < values.length; i++) {
            const d1 = values[i - 1] - values[i - 2];
            const d2 = values[i] - values[i - 1];
            // Alternating direction = oscillation
            if ((d1 > 0.003 && d2 < -0.003) || (d1 < -0.003 && d2 > 0.003)) {
                oscillations++;
            }
        }
        return oscillations;
    }

    // ── Body Tension (Trembling/Vibrating) ──
    _computeTension(microVibRatio, macroMotionRatio) {
        // Trembling: many pixels with small motion, few with large motion
        // A tense dog shows widespread micro-vibration without macro movement
        if (microVibRatio > 0.4 && macroMotionRatio < 0.05) return 90; // Severe trembling
        if (microVibRatio > 0.25 && macroMotionRatio < 0.08) return 60; // Tense/shaking
        if (microVibRatio > 0.15 && macroMotionRatio < 0.10) return 35; // Mild tension
        if (microVibRatio > 0.08) return 15; // Slight
        return 0; // Relaxed
    }

    // ── Head Activity ──
    _computeHeadActivity(zones) {
        // Top row = head region
        const topZones = zones.filter(z => z.row === 0);
        const bodyZones = zones.filter(z => z.row === 1);

        const topMotion = topZones.reduce((s, z) => s + z.motion, 0) / Math.max(1, topZones.length);
        const bodyMotion = bodyZones.reduce((s, z) => s + z.motion, 0) / Math.max(1, bodyZones.length);

        // Head is more active than body = focused attention, looking around
        if (topMotion > bodyMotion * 1.5 && topMotion > 0.01) return 'active';
        if (topMotion > 0.005) return 'slight';
        return 'still';
    }

    // ── Motion Frequency ──
    _estimateMotionFrequency() {
        if (this.motionHistory.length < 10) return 0;

        const recent = this.motionHistory.slice(-10).map(r => r.overallMotion);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;

        // Count zero-crossings of motion derivative
        let crossings = 0;
        for (let i = 1; i < recent.length; i++) {
            if ((recent[i] - mean) * (recent[i - 1] - mean) < 0) {
                crossings++;
            }
        }

        // Convert to approximate Hz (10 frames at 30fps = 0.33s)
        return Math.round(crossings * 30 / 10);
    }

    // ── Breathing Detection ──
    _detectBreathing(zones) {
        if (this.motionHistory.length < 30) return false;

        // Body center column shows periodic expansion for breathing
        const bodyMotion = this.motionHistory.slice(-30).map(r => {
            const centerZones = r.zones.filter(z => z.col === 1);
            return centerZones.length > 0 ?
                centerZones.reduce((s, z) => s + z.motion, 0) / centerZones.length : 0;
        });

        // Count periodic peaks
        let peaks = 0;
        for (let i = 1; i < bodyMotion.length - 1; i++) {
            if (bodyMotion[i] > bodyMotion[i - 1] &&
                bodyMotion[i] > bodyMotion[i + 1] &&
                bodyMotion[i] > 0.002) {
                peaks++;
            }
        }

        // Normal dog breathing: 15-30/min → in 1 second window, expect ~0.5 peak
        return peaks >= 1;
    }

    // ── Body State Interpretation ──
    _interpretBodyState(overallMotion, microVib, macroMotion, tension, tailWag) {
        if (macroMotion > 0.15) return 'very-active';
        if (macroMotion > 0.06) return 'active';
        if (tension > 50) return 'tense';
        if (tailWag >= 3) return 'wagging';
        if (microVib > 0.15) return 'vibrating';
        if (overallMotion < 0.003 && microVib < 0.03) return 'very-still';
        if (overallMotion < 0.01) return 'calm';
        return 'slight-motion';
    }

    // ── Summary for Report ──
    getSummary() {
        if (this.motionHistory.length < 10) {
            return {
                avgOverallMotion: 0,
                avgMicroVibration: 0,
                avgMacroMotion: 0,
                peakTailWag: 0,
                avgTension: 0,
                dominantBodyState: 'unknown',
                totalFrames: this.motionHistory.length
            };
        }

        const h = this.motionHistory;
        const avgOverall = h.reduce((s, r) => s + r.overallMotion, 0) / h.length;
        const avgMicro = h.reduce((s, r) => s + r.microVibration, 0) / h.length;
        const avgMacro = h.reduce((s, r) => s + r.macroMotion, 0) / h.length;
        const peakTail = Math.max(...h.map(r => r.tailWagScore));
        const avgTension = h.reduce((s, r) => s + r.tensionScore, 0) / h.length;

        // Dominant body state
        const stateCounts = {};
        h.forEach(r => {
            stateCounts[r.bodyState] = (stateCounts[r.bodyState] || 0) + 1;
        });
        const dominantState = Object.entries(stateCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        return {
            avgOverallMotion: Math.round(avgOverall * 10000) / 10000,
            avgMicroVibration: Math.round(avgMicro * 1000) / 1000,
            avgMacroMotion: Math.round(avgMacro * 1000) / 1000,
            peakTailWag: peakTail,
            avgTension: Math.round(avgTension),
            dominantBodyState: dominantState,
            totalFrames: h.length
        };
    }

    _defaultResult() {
        return {
            overallMotion: 0, microVibration: 0, macroMotion: 0, stillRatio: 1,
            zones: [], tailWagScore: 0, tensionScore: 0,
            headActivity: 'still', motionFrequency: 0, breathingDetected: false,
            pixelEnergy: 0, pixelVibration: 0, pixelFrequency: 0,
            bodyState: 'unknown'
        };
    }

    clearAll() {
        this.prevFrame = null;
        this.currFrame = null;
        this.motionHistory = [];
        this.smoothedOverallMotion = 0;
        this.smoothedMicroVib = 0;
        this.smoothedMacroMotion = 0;
    }
}

window.DogVisionAnalyzer = DogVisionAnalyzer;
