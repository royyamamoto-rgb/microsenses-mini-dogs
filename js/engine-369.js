/* ============================================
   ENGINE 369 — Tesla Energy/Vibration/Frequency Core

   The computational backbone of Microsenses Mini Dogs.
   Based on Nikola Tesla's 3-6-9 universal pattern:

   3 = CREATION  (Input/Sensing phase)
   6 = HARMONY   (Processing/Analysis phase)
   9 = COMPLETION (Output/Translation phase)

   Divine Frequencies:
   432 Hz — Universal harmony (sums to 9)
   528 Hz — Love/healing frequency (sums to 6)
   639 Hz — Connection frequency (sums to 9)

   Energy Formula: E = V² × F × k
   Where V = vibration amplitude, F = frequency, k = 369 constant
   ============================================ */

class Engine369 {
    constructor() {
        // 369 Constants
        this.CREATION = 3;
        this.HARMONY = 6;
        this.COMPLETION = 9;
        this.CYCLE_SUM = 18; // 3 + 6 + 9

        // Divine Frequencies (Hz)
        this.FREQ_UNIVERSAL = 432;   // Sums to 9 — universal harmony
        this.FREQ_LOVE = 528;        // Sums to 6 — healing/love
        this.FREQ_CONNECTION = 639;  // Sums to 9 — connection

        // 369 Energy Constant
        this.K_369 = 0.00369;

        // Power multipliers for each phase
        this.PHASE_MULTIPLIERS = {
            creation: 3,
            harmony: 6,
            completion: 9
        };

        // Resonance state
        this.resonanceHistory = [];
        this.maxResonanceHistory = 369;

        // Cycle tracking
        this.cycleCount = 0;
        this.phaseFrames = { creation: 0, harmony: 0, completion: 0 };

        // Energy accumulator
        this.totalEnergy = 0;
        this.peakEnergy = 0;
        this.energyHistory = [];

        // Vortex state (3-6-9 spiral computation)
        this.vortexAngle = 0;
        this.vortexRadius = 0;
    }

    // ── Phase 3: CREATION — Raw Input Processing ──

    /**
     * Process raw sensor inputs through the Creation phase
     * Takes raw vibration/movement data and structures it for analysis
     * @param {object} rawInput - { movement, audio, timestamp }
     * @returns {object} Structured creation output
     */
    processCreation(rawInput) {
        this.phaseFrames.creation++;
        const { movement, audio, timestamp } = rawInput;

        // Extract vibration amplitude from movement
        const vibration = movement ? movement.magnitude || 0 : 0;

        // Extract frequency components from audio
        const frequency = audio ? audio.dominantFreq || 0 : 0;

        // Compute base energy: E = V² × F × k
        const energy = this._computeEnergy(vibration, frequency);

        // Apply 369 signature to the input
        const signature = this._compute369Signature(vibration, frequency, energy);

        // Resonance with divine frequencies
        const resonance = this._computeResonance(frequency);

        return {
            phase: 'creation',
            phaseNumber: this.CREATION,
            vibration,
            frequency,
            energy,
            signature,
            resonance,
            timestamp,
            cyclePosition: this.phaseFrames.creation % 9
        };
    }

    // ── Phase 6: HARMONY — Pattern Analysis ──

    /**
     * Process creation output through the Harmony phase
     * Finds patterns, correlations, and meaning in structured data
     * @param {object} creationData - Output from processCreation
     * @param {object} emotionData - Current emotional state data
     * @param {object} barkData - Current bark analysis data
     * @returns {object} Harmonized analysis
     */
    processHarmony(creationData, emotionData, barkData) {
        this.phaseFrames.harmony++;

        // Store resonance history
        this.resonanceHistory.push({
            energy: creationData.energy,
            resonance: creationData.resonance,
            signature: creationData.signature,
            timestamp: creationData.timestamp
        });
        if (this.resonanceHistory.length > this.maxResonanceHistory) {
            this.resonanceHistory.shift();
        }

        // Track energy
        this.totalEnergy += creationData.energy;
        this.peakEnergy = Math.max(this.peakEnergy, creationData.energy);
        this.energyHistory.push(creationData.energy);
        if (this.energyHistory.length > this.maxResonanceHistory) {
            this.energyHistory.shift();
        }

        // Compute harmonic convergence between audio and movement
        const harmonicScore = this._computeHarmonicConvergence(
            creationData, emotionData, barkData
        );

        // Determine current emotional resonance frequency
        const emotionalFrequency = this._mapEmotionToFrequency(
            emotionData ? emotionData.primaryEmotion : 'calm'
        );

        // Compute vortex position (3-6-9 spiral)
        const vortex = this._computeVortex(creationData.energy);

        // Pattern detection across time
        const patterns = this._detectPatterns();

        // Confidence based on 369 alignment
        const alignment = this._compute369Alignment(
            creationData.vibration,
            creationData.frequency,
            creationData.energy
        );

        return {
            phase: 'harmony',
            phaseNumber: this.HARMONY,
            harmonicScore,
            emotionalFrequency,
            vortex,
            patterns,
            alignment,
            energyTrend: this._computeEnergyTrend(),
            cyclePosition: this.phaseFrames.harmony % 9
        };
    }

    // ── Phase 9: COMPLETION — Output/Translation ──

    /**
     * Process harmony output through the Completion phase
     * Produces final actionable intelligence
     * @param {object} harmonyData - Output from processHarmony
     * @param {object} translationInput - Raw translation data
     * @returns {object} Complete 369 analysis
     */
    processCompletion(harmonyData, translationInput) {
        this.phaseFrames.completion++;
        this.cycleCount = Math.floor(
            Math.min(this.phaseFrames.creation, this.phaseFrames.harmony, this.phaseFrames.completion) / 9
        );

        // Final energy state
        const currentEnergy = this.energyHistory.length > 0
            ? this.energyHistory[this.energyHistory.length - 1] : 0;

        // Confidence multiplier based on completed cycles
        const cycleConfidence = Math.min(100, (this.cycleCount * 9) +
            (harmonyData.alignment * 0.3));

        // Translate harmonic data to communication state
        const communicationState = this._deriveCommState(
            harmonyData, translationInput
        );

        // Generate 369 report metrics
        const metrics = {
            energy: Math.round(currentEnergy * 100) / 100,
            peakEnergy: Math.round(this.peakEnergy * 100) / 100,
            vibrationLevel: this._getVibrationLevel(currentEnergy),
            frequencyAlignment: harmonyData.emotionalFrequency,
            harmonicScore: harmonyData.harmonicScore,
            vortexPosition: harmonyData.vortex,
            patterns: harmonyData.patterns,
            alignment369: Math.round(harmonyData.alignment),
            completedCycles: this.cycleCount,
            confidence: Math.round(cycleConfidence)
        };

        return {
            phase: 'completion',
            phaseNumber: this.COMPLETION,
            metrics,
            communicationState,
            energyTrend: harmonyData.energyTrend,
            cyclePosition: this.phaseFrames.completion % 9
        };
    }

    // ── Core 369 Computations ──

    _computeEnergy(vibration, frequency) {
        // E = V² × F × k
        const adjustedFreq = Math.max(frequency, 0.1);
        return vibration * vibration * adjustedFreq * this.K_369;
    }

    _compute369Signature(v, f, e) {
        // Reduce each value to its digital root (repeatedly sum digits until single digit)
        const vRoot = this._digitalRoot(Math.round(v * 1000));
        const fRoot = this._digitalRoot(Math.round(f));
        const eRoot = this._digitalRoot(Math.round(e * 1000));
        const sum = vRoot + fRoot + eRoot;
        const sumRoot = this._digitalRoot(sum);

        return {
            vibrationRoot: vRoot,
            frequencyRoot: fRoot,
            energyRoot: eRoot,
            totalRoot: sumRoot,
            is369: sumRoot === 3 || sumRoot === 6 || sumRoot === 9,
            alignment: sumRoot === 9 ? 'perfect' : (sumRoot === 6 ? 'harmonic' : (sumRoot === 3 ? 'creative' : 'transitional'))
        };
    }

    _digitalRoot(n) {
        if (n === 0) return 0;
        n = Math.abs(n);
        return 1 + ((n - 1) % 9);
    }

    _computeResonance(frequency) {
        if (frequency <= 0) return { divine: null, distance: Infinity, strength: 0 };

        // Check resonance with each divine frequency
        const divineFreqs = [
            { freq: this.FREQ_UNIVERSAL, name: 'Universal Harmony', hz: 432 },
            { freq: this.FREQ_LOVE, name: 'Love/Healing', hz: 528 },
            { freq: this.FREQ_CONNECTION, name: 'Connection', hz: 639 }
        ];

        // Find closest divine frequency (also check harmonics/subharmonics)
        let bestMatch = null;
        let bestDistance = Infinity;

        divineFreqs.forEach(df => {
            // Check fundamental and first 3 harmonics/subharmonics
            for (let mult = 0.25; mult <= 4; mult *= 2) {
                const target = df.freq * mult;
                const distance = Math.abs(frequency - target);
                const relativeDistance = distance / target;
                if (relativeDistance < bestDistance) {
                    bestDistance = relativeDistance;
                    bestMatch = { ...df, harmonic: mult, targetFreq: target };
                }
            }
        });

        // Resonance strength: closer = stronger (1.0 = perfect match)
        const strength = Math.max(0, 1 - bestDistance * 3);

        return {
            divine: bestMatch,
            distance: Math.round(bestDistance * 1000) / 1000,
            strength: Math.round(strength * 100) / 100
        };
    }

    _computeHarmonicConvergence(creation, emotion, bark) {
        let score = 50; // Baseline

        // Energy alignment with 369 pattern
        if (creation.signature.is369) score += 15;

        // Resonance with divine frequencies
        score += creation.resonance.strength * 20;

        // Emotional coherence boost
        if (emotion && emotion.confidence > 60) score += 10;

        // Active vocalization adds harmonic data
        if (bark && bark.isVocalizing) {
            score += 5;
            // Higher score if bark frequency aligns with divine frequencies
            if (creation.resonance.strength > 0.5) score += 10;
        }

        return Math.min(100, Math.round(score));
    }

    _mapEmotionToFrequency(emotion) {
        // Map emotional states to resonant frequencies
        const emotionFreqMap = {
            'happy': { freq: 528, name: 'Love/Joy Frequency', note: 'Resonating at 528 Hz — love frequency' },
            'excited': { freq: 528, name: 'Activation Frequency', note: 'High vibration — excitement resonance' },
            'playful': { freq: 639, name: 'Connection Frequency', note: 'Play creates connection at 639 Hz' },
            'calm': { freq: 432, name: 'Universal Harmony', note: 'Resting at 432 Hz — natural harmony' },
            'content': { freq: 432, name: 'Universal Harmony', note: 'Content state — universal balance' },
            'anxious': { freq: 396, name: 'Liberation Frequency', note: 'Seeking liberation from fear — 396 Hz' },
            'fearful': { freq: 396, name: 'Liberation Frequency', note: 'Fear state — needs grounding to 432 Hz' },
            'stressed': { freq: 417, name: 'Change Frequency', note: 'Stress pattern — transitioning at 417 Hz' },
            'aggressive': { freq: 741, name: 'Awakening Frequency', note: 'Aggression spike — 741 Hz alertness' },
            'sad': { freq: 396, name: 'Grief Release', note: 'Sadness pattern — releasing at 396 Hz' },
            'lonely': { freq: 639, name: 'Connection Seeking', note: 'Seeking connection — 639 Hz deficit' },
            'curious': { freq: 852, name: 'Intuition Frequency', note: 'Curiosity activated — 852 Hz exploration' },
            'alert': { freq: 741, name: 'Awakening', note: 'Alert state — 741 Hz awareness' }
        };

        return emotionFreqMap[emotion] || emotionFreqMap['calm'];
    }

    _computeVortex(energy) {
        // 3-6-9 vortex spiral computation
        this.vortexAngle = (this.vortexAngle + energy * 9) % 360;
        this.vortexRadius = Math.min(100, this.vortexRadius * 0.99 + energy * 3);

        // Position in the 369 vortex
        const sector = Math.floor(this.vortexAngle / 120); // 0=Creation, 1=Harmony, 2=Completion
        const sectorNames = ['Creation', 'Harmony', 'Completion'];
        const sectorNumbers = [3, 6, 9];

        return {
            angle: Math.round(this.vortexAngle),
            radius: Math.round(this.vortexRadius * 100) / 100,
            sector: sectorNames[sector],
            sectorNumber: sectorNumbers[sector],
            x: Math.round(Math.cos(this.vortexAngle * Math.PI / 180) * this.vortexRadius * 100) / 100,
            y: Math.round(Math.sin(this.vortexAngle * Math.PI / 180) * this.vortexRadius * 100) / 100
        };
    }

    _detectPatterns() {
        if (this.resonanceHistory.length < 9) return { detected: false };

        const recent = this.resonanceHistory.slice(-27); // Last 3 full 9-cycles

        // Check for recurring 369 signatures
        let tripleCount = 0;
        let sixCount = 0;
        let nineCount = 0;

        recent.forEach(r => {
            if (r.signature.totalRoot === 3) tripleCount++;
            if (r.signature.totalRoot === 6) sixCount++;
            if (r.signature.totalRoot === 9) nineCount++;
        });

        const total = recent.length;
        const alignmentRatio = (tripleCount + sixCount + nineCount) / total;

        // Energy oscillation pattern
        let oscillations = 0;
        for (let i = 2; i < recent.length; i++) {
            const d1 = recent[i - 1].energy - recent[i - 2].energy;
            const d2 = recent[i].energy - recent[i - 1].energy;
            if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) oscillations++;
        }

        return {
            detected: alignmentRatio > 0.33,
            alignmentRatio: Math.round(alignmentRatio * 100),
            distribution: {
                creation: tripleCount,
                harmony: sixCount,
                completion: nineCount,
                transitional: total - tripleCount - sixCount - nineCount
            },
            oscillationRate: Math.round((oscillations / Math.max(1, recent.length - 2)) * 100),
            dominantPhase: nineCount >= sixCount && nineCount >= tripleCount ? 'completion' :
                           sixCount >= tripleCount ? 'harmony' : 'creation'
        };
    }

    _compute369Alignment(v, f, e) {
        // How well the current state aligns with 369 principles
        let alignment = 0;

        // Digital root check
        const vr = this._digitalRoot(Math.round(v * 100));
        const fr = this._digitalRoot(Math.round(f));
        const er = this._digitalRoot(Math.round(e * 100));

        if (vr === 3 || vr === 6 || vr === 9) alignment += 20;
        if (fr === 3 || fr === 6 || fr === 9) alignment += 20;
        if (er === 3 || er === 6 || er === 9) alignment += 20;

        // Sum alignment
        const sumRoot = this._digitalRoot(vr + fr + er);
        if (sumRoot === 9) alignment += 30;
        else if (sumRoot === 6) alignment += 20;
        else if (sumRoot === 3) alignment += 15;

        // Completed cycles bonus
        alignment += Math.min(10, this.cycleCount);

        return Math.min(100, alignment);
    }

    _computeEnergyTrend() {
        if (this.energyHistory.length < 9) return 'establishing';

        const recent = this.energyHistory.slice(-9);
        const older = this.energyHistory.slice(-18, -9);

        if (older.length < 3) return 'establishing';

        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

        const change = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

        if (change > 0.15) return 'rising';
        if (change < -0.15) return 'falling';
        return 'stable';
    }

    _getVibrationLevel(energy) {
        if (energy > 50) return 'intense';
        if (energy > 20) return 'high';
        if (energy > 5) return 'moderate';
        if (energy > 1) return 'low';
        return 'minimal';
    }

    _deriveCommState(harmonyData, translationInput) {
        if (!translationInput) return { state: 'observing', confidence: 0 };

        return {
            state: translationInput.communicating ? 'active' : 'passive',
            channel: translationInput.channel || 'body', // 'bark', 'body', 'combined'
            intensity: harmonyData.harmonicScore,
            resonance: harmonyData.emotionalFrequency,
            confidence: harmonyData.alignment
        };
    }

    // ── Full Analysis Report ──

    fullReport() {
        const avgEnergy = this.energyHistory.length > 0
            ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length : 0;

        // Count 369 alignments
        let alignedFrames = 0;
        this.resonanceHistory.forEach(r => {
            if (r.signature.is369) alignedFrames++;
        });

        return {
            totalCycles: this.cycleCount,
            totalFrames: {
                creation: this.phaseFrames.creation,
                harmony: this.phaseFrames.harmony,
                completion: this.phaseFrames.completion
            },
            energy: {
                average: Math.round(avgEnergy * 1000) / 1000,
                peak: Math.round(this.peakEnergy * 1000) / 1000,
                total: Math.round(this.totalEnergy * 100) / 100,
                trend: this._computeEnergyTrend()
            },
            alignment: {
                ratio: this.resonanceHistory.length > 0
                    ? Math.round((alignedFrames / this.resonanceHistory.length) * 100) : 0,
                alignedFrames,
                totalFrames: this.resonanceHistory.length
            },
            patterns: this._detectPatterns(),
            vortex: {
                angle: Math.round(this.vortexAngle),
                radius: Math.round(this.vortexRadius * 100) / 100
            }
        };
    }

    // ── Reset ──

    clearAll() {
        this.resonanceHistory = [];
        this.cycleCount = 0;
        this.phaseFrames = { creation: 0, harmony: 0, completion: 0 };
        this.totalEnergy = 0;
        this.peakEnergy = 0;
        this.energyHistory = [];
        this.vortexAngle = 0;
        this.vortexRadius = 0;
    }
}

window.Engine369 = Engine369;
