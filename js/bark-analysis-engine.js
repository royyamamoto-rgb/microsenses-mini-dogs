/* ============================================
   BARK ANALYSIS ENGINE — Canine Vocalization Analysis

   Real-time audio analysis for dog vocalizations.
   Detects and classifies bark types, whining, growling,
   howling, and other canine vocal patterns.

   Scientific Basis:
   - Dog bark frequency range: 160-2000 Hz
   - Growling: 80-300 Hz (low, sustained)
   - Whining/Whimpering: 300-1500 Hz (high, sustained)
   - Howling: 150-780 Hz (sustained, modulated)
   - Alert bark: rapid, mid-frequency
   - Play bark: higher pitch, shorter duration
   - Anxiety bark: repetitive, higher pitch
   - Demand bark: persistent, single note
   - Aggressive bark: low pitch, prolonged

   References:
   - Pongrácz et al. (2005) - Acoustic parameters of dog barks
   - Yin & McCowan (2004) - Bark classification
   - Molnár et al. (2008) - Dog vocal communication
   - Faragó et al. (2010) - Bark meaning research
   ============================================ */

class BarkAnalysisEngine {
    constructor() {
        // Audio nodes
        this.audioContext = null;
        this.analyserNode = null;
        this.sourceNode = null;
        this.muteGain = null;
        this.scriptProcessor = null;

        // Buffers
        this.fftSize = 4096;
        this.timeDomainBuffer = null;
        this.frequencyBuffer = null;

        // Ring buffer for sustained analysis (2 seconds)
        this.ringBuffer = null;
        this.ringBufferSize = 96000;
        this.ringBufferWritePos = 0;
        this.ringBufferFilled = false;

        // State
        this.isActive = false;
        this.sampleRate = 48000;

        // Sound activity detection
        this.isSoundActive = false;
        this.soundFrameCount = 0;
        this.silenceFrameCount = 0;
        this.totalFrameCount = 0;

        // Bark tracking
        this.barkEvents = [];
        this.currentBark = null;
        this.barkHistory = [];
        this.maxBarkHistory = 100;

        // Vocalization classification
        this.vocalizationType = 'silent'; // silent, bark, growl, whine, howl, yelp
        this.vocalizationHistory = [];
        this.maxVocalizationHistory = 300;

        // Frequency tracking
        this.dominantFreqHistory = [];
        this.baselineEstablished = false;
        this.baselineRMS = null;
        this.baselineFrames = [];
        this.BASELINE_FRAMES = 90; // 3 seconds

        // Spectral tracking
        this.spectralHistory = [];

        // Timeline for report
        this.timeline = [];
        this.timelineWindowFrames = 30;

        // Configuration — Dog-specific frequency ranges
        this.DOG_FREQ_MIN = 80;     // Low growl
        this.DOG_FREQ_MAX = 2000;   // High bark
        this.BARK_FREQ_MIN = 160;   // Low bark
        this.BARK_FREQ_MAX = 2000;  // High bark
        this.GROWL_FREQ_MAX = 300;  // Growl ceiling
        this.WHINE_FREQ_MIN = 300;  // Whine floor
        this.HOWL_FREQ_MIN = 150;
        this.HOWL_FREQ_MAX = 780;

        // Detection thresholds — balanced to detect real barks but not ambient noise
        this.VAD_THRESHOLD = 0.025; // Sound activity
        this.BARK_ONSET_THRESHOLD = 0.10; // Sharp onset for bark detection
        this.BARK_MIN_DURATION = 2;  // Min frames for a bark (~66ms)
        this.BARK_MAX_DURATION = 15; // Max frames for single bark (~500ms)
        this.GROWL_MIN_DURATION = 20; // Growl must be sustained
        this.HOWL_MIN_DURATION = 35;  // Howl is long sustained
        this.MIN_VOCALIZATION_RMS = 0.04; // Minimum RMS to classify as any dog vocalization

        // Inter-bark interval tracking (Pongrácz et al., 2005)
        // IBI is the most scientifically validated bark parameter
        this.lastBarkEndTime = 0;
        this.interBarkIntervals = [];
        this.maxIBIHistory = 50;

        // Tonality tracking (harmonic-to-noise ratio)
        this.tonalityHistory = [];
    }

    // ── Setup / Teardown ──

    async initAudioContext(stream) {
        this.destroy();

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sampleRate = this.audioContext.sampleRate;

            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = this.fftSize;
            this.analyserNode.smoothingTimeConstant = 0.2;

            this.sourceNode = this.audioContext.createMediaStreamSource(stream);

            this.muteGain = this.audioContext.createGain();
            this.muteGain.gain.value = 0;

            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            this.scriptProcessor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                this._fillRingBuffer(input);
            };

            this.sourceNode.connect(this.analyserNode);
            this.analyserNode.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.muteGain);
            this.muteGain.connect(this.audioContext.destination);

            this._allocateBuffers();
            this.isActive = true;
        } catch (err) {
            console.error('BarkAnalysis initAudioContext failed:', err);
            this.destroy();
            throw err;
        }
    }

    _allocateBuffers() {
        this.timeDomainBuffer = new Float32Array(this.fftSize);
        this.frequencyBuffer = new Float32Array(this.analyserNode.frequencyBinCount);
        this.ringBuffer = new Float32Array(this.ringBufferSize);
        this.ringBufferWritePos = 0;
        this.ringBufferFilled = false;
    }

    _fillRingBuffer(samples) {
        for (let i = 0; i < samples.length; i++) {
            this.ringBuffer[this.ringBufferWritePos] = samples[i];
            this.ringBufferWritePos++;
            if (this.ringBufferWritePos >= this.ringBufferSize) {
                this.ringBufferWritePos = 0;
                this.ringBufferFilled = true;
            }
        }
    }

    destroy() {
        if (this.scriptProcessor) {
            this.scriptProcessor.onaudioprocess = null;
            try { this.scriptProcessor.disconnect(); } catch (e) {}
        }
        if (this.sourceNode) {
            try { this.sourceNode.disconnect(); } catch (e) {}
        }
        if (this.analyserNode) {
            try { this.analyserNode.disconnect(); } catch (e) {}
        }
        if (this.muteGain) {
            try { this.muteGain.disconnect(); } catch (e) {}
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try { this.audioContext.close(); } catch (e) {}
        }

        this.audioContext = null;
        this.analyserNode = null;
        this.sourceNode = null;
        this.muteGain = null;
        this.scriptProcessor = null;
        this.isActive = false;
    }

    clearAll() {
        this.barkEvents = [];
        this.currentBark = null;
        this.barkHistory = [];
        this.vocalizationType = 'silent';
        this.vocalizationHistory = [];
        this.dominantFreqHistory = [];
        this.baselineEstablished = false;
        this.baselineRMS = null;
        this.baselineFrames = [];
        this.spectralHistory = [];
        this.timeline = [];
        this.soundFrameCount = 0;
        this.silenceFrameCount = 0;
        this.totalFrameCount = 0;
        this.isSoundActive = false;
        this.lastBarkEndTime = 0;
        this.interBarkIntervals = [];
        this.tonalityHistory = [];
        if (this.ringBuffer) this.ringBuffer.fill(0);
        this.ringBufferWritePos = 0;
        this.ringBufferFilled = false;
    }

    // ── Real-time Processing ──

    processAudioFrame() {
        if (!this.isActive || !this.analyserNode) return;

        this.totalFrameCount++;

        this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);
        this.analyserNode.getFloatFrequencyData(this.frequencyBuffer);

        const rms = this._computeRMS(this.timeDomainBuffer);

        // Establish environmental baseline (first 3 seconds)
        if (!this.baselineEstablished) {
            this.baselineFrames.push(rms);
            if (this.baselineFrames.length >= this.BASELINE_FRAMES) {
                this.baselineRMS = this.baselineFrames.reduce((a, b) => a + b, 0) / this.baselineFrames.length;
                this.baselineEstablished = true;
            }
        }

        // Sound activity detection (above baseline + threshold)
        // Must be 3.5x above baseline to be considered sound activity
        const effectiveThreshold = this.baselineEstablished
            ? Math.max(this.VAD_THRESHOLD, this.baselineRMS * 3.5)
            : this.VAD_THRESHOLD;

        this.isSoundActive = rms > effectiveThreshold;

        if (this.isSoundActive) {
            this.soundFrameCount++;
            this.silenceFrameCount = 0;

            // Analyze spectral content
            const spectral = this._analyzeSpectralContent();
            this.spectralHistory.push(spectral);
            if (this.spectralHistory.length > this.maxVocalizationHistory) {
                this.spectralHistory.shift();
            }

            // Track dominant frequency
            const dominantFreq = this._findDominantFrequency();
            this.dominantFreqHistory.push({ freq: dominantFreq, rms, time: this.totalFrameCount });
            if (this.dominantFreqHistory.length > this.maxVocalizationHistory) {
                this.dominantFreqHistory.shift();
            }

            // Classify vocalization type
            this._classifyVocalization(rms, dominantFreq, spectral);

            // Track bark events
            this._trackBarkEvent(rms, dominantFreq);

        } else {
            this.silenceFrameCount++;
            if (this.silenceFrameCount > 3) {
                // End any current bark
                if (this.currentBark) {
                    this._finalizeBark();
                }
                this.vocalizationType = 'silent';
            }
        }

        // Store vocalization state
        this.vocalizationHistory.push({
            type: this.vocalizationType,
            time: this.totalFrameCount,
            rms,
            isActive: this.isSoundActive
        });
        if (this.vocalizationHistory.length > this.maxVocalizationHistory) {
            this.vocalizationHistory.shift();
        }

        // Build timeline entry every ~1 second
        if (this.totalFrameCount % this.timelineWindowFrames === 0) {
            const assess = this._quickAssess();
            this.timeline.push({
                timeSeconds: Math.round(this.totalFrameCount / 30),
                vocalization: assess.currentType,
                intensity: assess.intensity,
                barkCount: this.barkHistory.length
            });
        }
    }

    // ── Quick Real-time Assessment ──

    _quickAssess() {
        const recentVocals = this.vocalizationHistory.slice(-30);
        const activeFrames = recentVocals.filter(v => v.isActive).length;
        const intensity = activeFrames > 0
            ? Math.round((recentVocals.filter(v => v.isActive).reduce((s, v) => s + v.rms, 0) / activeFrames) * 100)
            : 0;

        // Count recent bark types
        const recentBarks = this.barkHistory.filter(
            b => b.endFrame > this.totalFrameCount - 90 // Last 3 seconds
        );

        // Bark rate (barks per minute)
        const barkWindow = Math.min(this.totalFrameCount, 900); // Last 30 seconds
        const windowBarks = this.barkHistory.filter(
            b => b.endFrame > this.totalFrameCount - barkWindow
        );
        const barkRate = barkWindow > 0
            ? Math.round(windowBarks.length * (30 / barkWindow) * 60)
            : 0;

        // Dominant bark type in recent history
        let dominantType = 'silent';
        if (recentBarks.length > 0) {
            const typeCounts = {};
            recentBarks.forEach(b => {
                typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
            });
            dominantType = Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])[0][0];
        }

        // Average pitch of recent barks
        const avgPitch = recentBarks.length > 0
            ? Math.round(recentBarks.reduce((s, b) => s + b.avgFreq, 0) / recentBarks.length)
            : 0;

        // Average inter-bark interval
        const avgIBI = this.interBarkIntervals.length > 0
            ? Math.round(this.interBarkIntervals.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, this.interBarkIntervals.length))
            : 0;

        // Average tonality
        const avgTonality = this.tonalityHistory.length > 0
            ? Math.round((this.tonalityHistory.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, this.tonalityHistory.length)) * 100) / 100
            : 0.5;

        // Last bark pitch contour
        const lastBark = this.barkHistory.length > 0 ? this.barkHistory[this.barkHistory.length - 1] : null;
        const lastPitchContour = lastBark ? lastBark.pitchContour || 'flat' : 'flat';

        // Only report as vocalizing if it's an actual dog sound, not ambient noise
        const isDogSound = this.isSoundActive &&
            this.vocalizationType !== 'silent' &&
            this.vocalizationType !== 'ambient';

        return {
            isVocalizing: isDogSound,
            currentType: this.vocalizationType,
            dominantType,
            intensity: Math.min(100, intensity),
            barkRate,
            recentBarkCount: recentBarks.length,
            avgPitch,
            hasBaseline: this.baselineEstablished,
            dominantFreq: this.dominantFreqHistory.length > 0
                ? this.dominantFreqHistory[this.dominantFreqHistory.length - 1].freq : 0,
            interBarkInterval: avgIBI,
            tonality: avgTonality,
            pitchContour: lastPitchContour
        };
    }

    // ── Vocalization Classification ──

    _classifyVocalization(rms, dominantFreq, spectral) {
        if (!this.isSoundActive) {
            this.vocalizationType = 'silent';
            return;
        }

        // Sound must be above minimum RMS to be classified as dog vocalization
        // This filters very quiet ambient noise but allows real barking
        if (rms < this.MIN_VOCALIZATION_RMS) {
            this.vocalizationType = 'ambient';
            return;
        }

        // Must be clearly above baseline — real dog sounds are noticeably louder
        if (this.baselineEstablished && rms < this.baselineRMS * 4) {
            this.vocalizationType = 'ambient';
            return;
        }

        // Onset sharpness (sharp = bark, gradual = growl/whine)
        const onset = this._computeOnsetSharpness();

        // Spectral tilt (negative = more low-frequency energy = growl-like)
        const spectralTilt = spectral.lowRatio - spectral.highRatio;

        // Duration of current sound event
        const soundDuration = this.silenceFrameCount === 0 ? this.soundFrameCount : 0;

        // Must be in dog frequency range to be a dog vocalization
        const inDogRange = dominantFreq >= this.DOG_FREQ_MIN && dominantFreq <= this.DOG_FREQ_MAX;

        // Classification logic based on acoustic research
        if (inDogRange && dominantFreq < this.GROWL_FREQ_MAX && spectralTilt > 0.3 && soundDuration > this.GROWL_MIN_DURATION && rms > 0.06) {
            this.vocalizationType = 'growl';
        } else if (inDogRange && dominantFreq > this.WHINE_FREQ_MIN && spectralTilt < -0.1 && soundDuration > 10 && rms > 0.05) {
            this.vocalizationType = 'whine';
        } else if (inDogRange && dominantFreq >= this.HOWL_FREQ_MIN && dominantFreq <= this.HOWL_FREQ_MAX
            && soundDuration > this.HOWL_MIN_DURATION && this._isFrequencyModulated() && rms > 0.06) {
            this.vocalizationType = 'howl';
        } else if (inDogRange && onset > 0.2 && rms > this.BARK_ONSET_THRESHOLD) {
            this.vocalizationType = 'bark';
        } else if (inDogRange && onset > 0.4 && soundDuration < 3 && dominantFreq > 800 && rms > 0.08) {
            this.vocalizationType = 'yelp';
        } else {
            // Sound detected but not matching dog vocalization patterns — classify as ambient
            this.vocalizationType = 'ambient';
        }
    }

    _computeOnsetSharpness() {
        if (this.vocalizationHistory.length < 5) return 0;
        const recent = this.vocalizationHistory.slice(-5);
        const rmsValues = recent.map(v => v.rms);

        // Onset = how quickly RMS increased
        let maxRise = 0;
        for (let i = 1; i < rmsValues.length; i++) {
            maxRise = Math.max(maxRise, rmsValues[i] - rmsValues[i - 1]);
        }
        return maxRise;
    }

    _isFrequencyModulated() {
        if (this.dominantFreqHistory.length < 10) return false;
        const recent = this.dominantFreqHistory.slice(-10).map(d => d.freq);
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((s, v) => s + (v - mean) * (v - mean), 0) / recent.length;
        // Howling has smooth frequency modulation (moderate variance)
        return Math.sqrt(variance) > 20 && Math.sqrt(variance) < 200;
    }

    // ── Bark Event Tracking ──

    _trackBarkEvent(rms, dominantFreq) {
        // Only track actual dog vocalizations, not ambient noise
        if ((this.vocalizationType === 'bark' || this.vocalizationType === 'yelp') && this.vocalizationType !== 'ambient') {
            if (!this.currentBark) {
                this.currentBark = {
                    startFrame: this.totalFrameCount,
                    endFrame: null,
                    peakRMS: rms,
                    frequencies: [dominantFreq],
                    rmsValues: [rms],
                    type: null
                };
            } else {
                this.currentBark.peakRMS = Math.max(this.currentBark.peakRMS, rms);
                this.currentBark.frequencies.push(dominantFreq);
                this.currentBark.rmsValues.push(rms);
            }
        } else if (this.currentBark && (this.vocalizationType === 'silent' || this.vocalizationType === 'ambient')) {
            this._finalizeBark();
        }
    }

    _finalizeBark() {
        if (!this.currentBark) return;

        this.currentBark.endFrame = this.totalFrameCount;
        const duration = this.currentBark.endFrame - this.currentBark.startFrame;
        const avgFreq = this.currentBark.frequencies.reduce((a, b) => a + b, 0) / this.currentBark.frequencies.length;

        // Classify bark type based on acoustic properties
        // Based on Pongrácz et al. (2005) and Yin & McCowan (2004)
        let barkType = 'unknown';

        if (duration <= this.BARK_MAX_DURATION) {
            if (avgFreq > 600) {
                // High-pitched short bark
                if (this.currentBark.peakRMS > 0.15) barkType = 'alert';
                else barkType = 'play';
            } else if (avgFreq < 300) {
                barkType = 'aggressive';
            } else {
                // Check bark rate for demand vs alert
                const recentBarks = this.barkHistory.slice(-5);
                const isRepetitive = recentBarks.length >= 3 &&
                    recentBarks.every(b => Math.abs(b.avgFreq - avgFreq) < 50);
                barkType = isRepetitive ? 'demand' : 'alert';
            }
        } else {
            // Longer vocalization within bark tracking
            if (avgFreq < 300) barkType = 'aggressive';
            else if (avgFreq > 500) barkType = 'anxiety';
            else barkType = 'alert';
        }

        const bark = {
            startFrame: this.currentBark.startFrame,
            endFrame: this.currentBark.endFrame,
            duration,
            durationMs: Math.round((duration / 30) * 1000),
            avgFreq: Math.round(avgFreq),
            peakRMS: Math.round(this.currentBark.peakRMS * 1000) / 1000,
            type: barkType
        };

        // Inter-bark interval (IBI) — Pongrácz et al. (2005)
        // Time between end of last bark and start of this bark
        if (this.lastBarkEndTime > 0) {
            const ibi = Math.round(((this.currentBark.startFrame - this.lastBarkEndTime) / 30) * 1000);
            if (ibi > 0 && ibi < 10000) { // Reasonable range
                bark.interBarkInterval = ibi;
                this.interBarkIntervals.push(ibi);
                if (this.interBarkIntervals.length > this.maxIBIHistory) {
                    this.interBarkIntervals.shift();
                }
            }
        }
        this.lastBarkEndTime = this.currentBark.endFrame;

        // Tonality estimation (harmonic-to-noise ratio approximation)
        // Tonal barks have concentrated spectral energy; noisy barks have spread energy
        if (this.spectralHistory.length > 0) {
            const recentSpectral = this.spectralHistory.slice(-duration);
            const avgMidRatio = recentSpectral.reduce((s, sp) => s + sp.midRatio, 0) / recentSpectral.length;
            // Higher mid ratio with low spread = more tonal
            bark.tonality = Math.min(1, avgMidRatio * 2);
            this.tonalityHistory.push(bark.tonality);
            if (this.tonalityHistory.length > 50) this.tonalityHistory.shift();
        }

        // Pitch contour (rising/falling/flat)
        if (this.currentBark.frequencies.length >= 3) {
            const freqs = this.currentBark.frequencies;
            const firstThird = freqs.slice(0, Math.floor(freqs.length / 3));
            const lastThird = freqs.slice(-Math.floor(freqs.length / 3));
            const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
            const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;
            const change = avgLast - avgFirst;
            bark.pitchContour = change > 30 ? 'rising' : change < -30 ? 'falling' : 'flat';
        } else {
            bark.pitchContour = 'flat';
        }

        this.barkHistory.push(bark);
        if (this.barkHistory.length > this.maxBarkHistory) {
            this.barkHistory.shift();
        }

        this.currentBark = null;
    }

    // ── Spectral Analysis ──

    _analyzeSpectralContent() {
        const binWidth = this.sampleRate / this.fftSize;
        const numBins = this.frequencyBuffer.length;

        let lowEnergy = 0;   // 0-300 Hz (growl range)
        let midEnergy = 0;   // 300-1000 Hz (bark range)
        let highEnergy = 0;  // 1000-2500 Hz (whine/yelp range)
        let totalEnergy = 0;

        let weightedSum = 0;
        let totalMag = 0;

        for (let i = 0; i < numBins; i++) {
            const freq = i * binWidth;
            const mag = Math.pow(10, this.frequencyBuffer[i] / 20);
            const magSq = mag * mag;

            if (freq <= 300) lowEnergy += magSq;
            else if (freq <= 1000) midEnergy += magSq;
            else if (freq <= 2500) highEnergy += magSq;

            if (freq <= 3000) {
                totalEnergy += magSq;
                weightedSum += freq * mag;
                totalMag += mag;
            }
        }

        const centroid = totalMag > 0 ? weightedSum / totalMag : 0;

        return {
            lowRatio: totalEnergy > 0 ? lowEnergy / totalEnergy : 0,
            midRatio: totalEnergy > 0 ? midEnergy / totalEnergy : 0,
            highRatio: totalEnergy > 0 ? highEnergy / totalEnergy : 0,
            centroid,
            totalEnergy
        };
    }

    _findDominantFrequency() {
        const binWidth = this.sampleRate / this.fftSize;
        let maxMag = -Infinity;
        let maxBin = 0;

        // Search within dog vocalization range
        const minBin = Math.floor(this.DOG_FREQ_MIN / binWidth);
        const maxBinLimit = Math.ceil(this.DOG_FREQ_MAX / binWidth);

        for (let i = minBin; i < Math.min(maxBinLimit, this.frequencyBuffer.length); i++) {
            if (this.frequencyBuffer[i] > maxMag) {
                maxMag = this.frequencyBuffer[i];
                maxBin = i;
            }
        }

        return maxBin * binWidth;
    }

    // ── Full Post-Scan Analysis ──

    fullAnalysis() {
        const fps = 30;
        const totalDuration = this.totalFrameCount / fps;
        const soundDuration = this.soundFrameCount / fps;
        const soundRatio = this.totalFrameCount > 0
            ? Math.round((this.soundFrameCount / this.totalFrameCount) * 100) : 0;

        // Bark type distribution
        const barkTypeCount = {};
        this.barkHistory.forEach(b => {
            barkTypeCount[b.type] = (barkTypeCount[b.type] || 0) + 1;
        });

        // Average bark frequency and duration
        const avgBarkFreq = this.barkHistory.length > 0
            ? Math.round(this.barkHistory.reduce((s, b) => s + b.avgFreq, 0) / this.barkHistory.length) : 0;
        const avgBarkDuration = this.barkHistory.length > 0
            ? Math.round(this.barkHistory.reduce((s, b) => s + b.durationMs, 0) / this.barkHistory.length) : 0;

        // Bark rate
        const barkRate = totalDuration > 0
            ? Math.round((this.barkHistory.length / totalDuration) * 60 * 10) / 10 : 0;

        // Dominant bark type
        let dominantBarkType = 'none';
        let maxCount = 0;
        Object.entries(barkTypeCount).forEach(([type, count]) => {
            if (count > maxCount) { maxCount = count; dominantBarkType = type; }
        });

        // Vocalization type distribution — exclude ambient and silent
        const vocalTypeCount = {};
        this.vocalizationHistory.forEach(v => {
            if (v.isActive && v.type !== 'ambient' && v.type !== 'silent') {
                vocalTypeCount[v.type] = (vocalTypeCount[v.type] || 0) + 1;
            }
        });

        // Spectral summary
        let avgCentroid = 0;
        if (this.spectralHistory.length > 0) {
            avgCentroid = Math.round(
                this.spectralHistory.reduce((s, sp) => s + sp.centroid, 0) / this.spectralHistory.length
            );
        }

        // Intensity assessment
        const avgIntensity = this.vocalizationHistory.length > 0
            ? this.vocalizationHistory.filter(v => v.isActive)
                .reduce((s, v) => s + v.rms, 0) / Math.max(1, this.soundFrameCount)
            : 0;

        const intensityLevel = avgIntensity > 0.15 ? 'high'
            : avgIntensity > 0.08 ? 'moderate'
            : avgIntensity > 0.03 ? 'low' : 'minimal';

        return {
            totalDuration: Math.round(totalDuration * 10) / 10,
            soundDuration: Math.round(soundDuration * 10) / 10,
            soundRatio,
            baselineEstablished: this.baselineEstablished,
            barks: {
                total: this.barkHistory.length,
                rate: barkRate,
                avgFrequency: avgBarkFreq,
                avgDuration: avgBarkDuration,
                dominantType: dominantBarkType,
                typeDistribution: barkTypeCount
            },
            vocalizations: {
                typeDistribution: vocalTypeCount,
                spectralCentroid: avgCentroid,
                intensity: intensityLevel,
                avgIntensity: Math.round(avgIntensity * 1000) / 1000
            },
            timeline: this.timeline,
            barkLog: this.barkHistory.slice(-20).map(b => ({
                time: Math.round(b.startFrame / fps * 10) / 10,
                type: b.type,
                freq: b.avgFreq,
                duration: b.durationMs,
                intensity: Math.round(b.peakRMS * 100)
            }))
        };
    }

    // ── Utility ──

    _computeRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }
}

window.BarkAnalysisEngine = BarkAnalysisEngine;
