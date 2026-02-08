/* ============================================
   SCAN REPORT AGENT — Post-Scan Coherence & Accuracy

   This agent runs AFTER all engines produce their raw scan data
   and BEFORE the report is rendered to the user.

   Purpose:
   - Reviews ALL raw data from emotion engine, bark engine, 369 energy,
     and pixel vision analyzer
   - Determines the TRUE behavioral state using multi-signal analysis
   - Filters contradictory actions (e.g., "resting" + "trotting")
   - Validates the emotion reading against reality
   - Produces a coherent, accurate report

   Why this is needed:
   - Raw action counts include noise from early frames (before EMA
     smoothing and stillness detection stabilize)
   - Without coherence filtering, a sleeping dog can show "trotting 5%"
     because bounding box jitter in the first second produced false movement
   - The report must match what the camera actually sees
   ============================================ */

class ScanReportAgent {
    constructor() {
        // Science database for evidence-backed determinations
        this.scienceDB = typeof CanineScienceDB !== 'undefined' ? new CanineScienceDB() : null;

        // Behavioral states and their incompatible actions
        // If the dominant state is "resting", these actions are physically
        // impossible and must be filtered as sensor noise artifacts
        this.incompatibleActions = {
            sleeping: [
                // A sleeping dog CANNOT do any of these
                'walking', 'trotting', 'running', 'sprinting',
                'slow-movement', 'jumping-up', 'landing', 'bouncing',
                'repeated-jumping', 'hopping', 'approaching', 'retreating',
                'lunging', 'backing-up', 'following', 'play-bow', 'zoomies',
                'chase-play', 'pouncing', 'spinning', 'pacing', 'restless',
                'nesting', 'head-tilting', 'freeze', 'startled',
                'moving-left', 'moving-right', 'moving-away', 'moving-toward',
                'cowering', 'begging', 'sitting-down', 'standing-up',
                'getting-up', 'lowering-body', 'tail-wagging', 'tail-wagging-fast'
            ],
            resting: [
                // A resting (lying down, still) dog cannot do these
                'walking', 'trotting', 'running', 'sprinting',
                'jumping-up', 'landing', 'bouncing', 'repeated-jumping',
                'hopping', 'lunging', 'play-bow', 'zoomies', 'chase-play',
                'pouncing', 'spinning', 'pacing', 'restless', 'nesting',
                'moving-left', 'moving-right', 'begging',
                'sitting-down', 'standing-up', 'getting-up', 'lowering-body'
            ],
            'alert-watching': [
                // A dog standing still and watching cannot do these
                'trotting', 'running', 'sprinting', 'bouncing',
                'repeated-jumping', 'zoomies', 'chase-play', 'pouncing',
                'spinning', 'pacing', 'play-bow'
            ],
            'calm-standing': [
                // A calm standing dog — filter high-energy actions
                'running', 'sprinting', 'zoomies', 'chase-play',
                'bouncing', 'repeated-jumping', 'pouncing'
            ],
            active: []  // Active dog — all actions valid
        };
    }

    /**
     * Post-process all scan data to produce a coherent, accurate report.
     *
     * @param {object} emotionReport - From emotionEngine.fullAnalysis()
     * @param {object} barkReport - From barkEngine.fullAnalysis()
     * @param {object} energyReport - From engine369.fullReport()
     * @param {object} visionSummary - From visionAnalyzer.getSummary()
     * @returns {object} Coherent, validated report data
     */
    analyze(emotionReport, barkReport, energyReport, visionSummary) {
        // Step 1: Determine the TRUE behavioral state
        const behaviorState = this._determineBehaviorState(
            emotionReport, barkReport, visionSummary
        );

        // Step 2: Filter contradictory actions
        const filteredActions = this._filterActions(
            emotionReport.actionSummary, behaviorState, emotionReport.framesAnalyzed
        );

        // Step 3: Validate the dominant emotion against behavioral state
        const validatedEmotion = this._validateEmotion(
            emotionReport, behaviorState
        );

        // Step 4: Clean up patterns — remove contradictory pattern reports
        const cleanPatterns = this._filterPatterns(
            emotionReport.patterns, behaviorState
        );

        // Step 5: Filter detected signals — remove impossible detections
        const filteredSignals = this._filterSignals(
            emotionReport.detectedSignals, behaviorState
        );

        // Step 6: Build vision analysis summary for the report
        const visionInsights = this._buildVisionInsights(visionSummary, behaviorState);

        // Step 7: Build science-backed evidence chain
        const evidenceChain = this._buildEvidenceChain(
            behaviorState, emotionReport, barkReport, visionSummary
        );

        // Step 8: Add science summary to behavioral state
        if (this.scienceDB) {
            behaviorState.scienceSummary = this.scienceDB.getScienceSummary(behaviorState.state);
        }

        return {
            behaviorState,
            filteredActions,
            validatedEmotion,
            cleanPatterns,
            filteredSignals,
            visionInsights,
            evidenceChain,
            // Pass through original data for technical detail section
            raw: {
                emotionReport,
                barkReport,
                energyReport,
                visionSummary
            }
        };
    }

    /**
     * Determine the TRUE behavioral state from multi-signal analysis.
     * Uses posture, stillness, speed, vocalizations, AND pixel data.
     */
    _determineBehaviorState(emotionReport, barkReport, visionSummary) {
        const posture = emotionReport.posture ? emotionReport.posture.current : 'unknown';
        const stillness = emotionReport.patterns ? emotionReport.patterns.stillness : 0;
        const avgSpeed = emotionReport.movement ? emotionReport.movement.avgSpeed : 0;
        const hasBarks = barkReport && barkReport.barks && barkReport.barks.total > 0;
        const vocalFrames = barkReport && barkReport.vocalizations
            ? Object.values(barkReport.vocalizations.typeDistribution || {}).reduce((s, v) => s + v, 0)
            : 0;
        const hasVocalization = hasBarks || vocalFrames > 10;

        // Pixel-level data (if available)
        const pixelMotion = visionSummary ? visionSummary.avgOverallMotion : 0;
        const pixelBodyState = visionSummary ? visionSummary.dominantBodyState : 'unknown';
        const pixelTension = visionSummary ? visionSummary.avgTension : 0;

        // ── SLEEPING ──
        // Lying down + extremely still + silent + pixel confirms very-still/calm
        if (posture === 'down' && stillness > 20 && avgSpeed < 1.5 && !hasVocalization) {
            if (pixelBodyState === 'very-still' || pixelBodyState === 'calm' || pixelMotion < 0.01) {
                return {
                    state: 'sleeping',
                    confidence: 92,
                    label: 'Sleeping / Deep Rest',
                    description: 'Your dog is lying down, extremely still, and silent — likely sleeping or in deep rest.'
                };
            }
        }

        // ── RESTING ──
        // Lying down + still + quiet
        if (posture === 'down' && stillness > 10 && avgSpeed < 3 && !hasVocalization) {
            return {
                state: 'resting',
                confidence: 90,
                label: 'Resting',
                description: 'Your dog is lying down and relaxed — resting comfortably.'
            };
        }

        // ── LYING DOWN BUT ALERT ──
        // Down but with some activity or vocalizing
        if (posture === 'down' && hasVocalization) {
            return {
                state: 'resting',
                confidence: 75,
                label: 'Lying Down — Vocal',
                description: 'Your dog is lying down but vocalizing — they want something or are responding to a stimulus.'
            };
        }

        // ── ALERT WATCHING ──
        // Standing + still + silent
        if (posture === 'stand' && stillness > 10 && avgSpeed < 3 && !hasVocalization) {
            return {
                state: 'alert-watching',
                confidence: 85,
                label: 'Alert & Watching',
                description: 'Your dog is standing still and focused — watching something intently.'
            };
        }

        // ── CALM STANDING ──
        // Standing + moderate stillness + quiet
        if (posture === 'stand' && stillness > 5 && avgSpeed < 5 && !hasVocalization) {
            return {
                state: 'calm-standing',
                confidence: 75,
                label: 'Calm & Standing',
                description: 'Your dog is standing calmly — relaxed but upright.'
            };
        }

        // ── SITTING ──
        if (posture === 'sit' && stillness > 5 && avgSpeed < 3) {
            return {
                state: 'resting',
                confidence: 80,
                label: 'Sitting Calmly',
                description: 'Your dog is sitting — attentive and at ease.'
            };
        }

        // ── ACTIVE ──
        // Moving around significantly
        if (avgSpeed > 8) {
            return {
                state: 'active',
                confidence: 85,
                label: 'Active & Moving',
                description: 'Your dog is actively moving around — engaged and energetic.'
            };
        }

        // ── MODERATE ACTIVITY ──
        if (avgSpeed > 3) {
            return {
                state: 'active',
                confidence: 70,
                label: 'Moderately Active',
                description: 'Your dog is moving around at a moderate pace.'
            };
        }

        // ── DEFAULT ──
        return {
            state: 'active',
            confidence: 50,
            label: 'Normal Activity',
            description: 'Your dog is in a normal activity state.'
        };
    }

    /**
     * Filter actions that contradict the behavioral state.
     * A sleeping dog CANNOT be trotting — that's sensor noise.
     */
    _filterActions(actionSummary, behaviorState, totalFrames) {
        if (!actionSummary || !actionSummary.topActions) {
            return { primary: 'observing', topActions: [], totalUniqueActions: 0 };
        }

        const blocked = this.incompatibleActions[behaviorState.state] || [];
        const frames = totalFrames || 1;

        // Filter out incompatible actions AND raise threshold to 8%
        const filtered = actionSummary.topActions.filter(([action, count]) => {
            // Always skip generic actions
            if (action === 'observing' || action === 'stationary') return false;
            // Block actions incompatible with behavioral state
            if (blocked.includes(action)) return false;
            // Require at least 8% of frames (was 5%)
            const pct = Math.round((count / frames) * 100);
            if (pct < 8) return false;
            return true;
        });

        // Determine the true primary action after filtering
        let primary = actionSummary.primary || 'observing';
        if (blocked.includes(primary)) {
            // The raw primary action is incompatible — find the best valid one
            if (filtered.length > 0) {
                primary = filtered[0][0];
            } else {
                // Fall back to behavioral state
                const stateActions = {
                    sleeping: 'sleeping',
                    resting: 'resting',
                    'alert-watching': 'guarding',
                    'calm-standing': 'standing',
                    active: 'observing'
                };
                primary = stateActions[behaviorState.state] || 'observing';
            }
        }

        return {
            primary,
            topActions: filtered,
            totalUniqueActions: filtered.length
        };
    }

    /**
     * Validate the emotion against the behavioral state.
     * A sleeping dog's dominant emotion should be "calm", not "excited".
     */
    _validateEmotion(emotionReport, behaviorState) {
        const raw = emotionReport.dominantEmotion || 'unknown';
        const distribution = emotionReport.emotionDistribution || {};

        // Emotion overrides based on behavioral state
        const emotionOverrides = {
            sleeping: {
                valid: ['calm', 'sad'],
                override: 'calm',
                reason: 'Dog is sleeping/resting — overriding to calm'
            },
            resting: {
                valid: ['calm', 'sad', 'alert'],
                override: 'calm',
                reason: 'Dog is resting quietly — overriding to calm'
            },
            'alert-watching': {
                valid: ['alert', 'calm', 'curious'],
                override: 'alert',
                reason: 'Dog is standing still and watching — overriding to alert'
            }
        };

        const override = emotionOverrides[behaviorState.state];
        if (override && !override.valid.includes(raw)) {
            return {
                emotion: override.override,
                wasOverridden: true,
                originalEmotion: raw,
                reason: override.reason,
                distribution
            };
        }

        return {
            emotion: raw,
            wasOverridden: false,
            originalEmotion: raw,
            reason: null,
            distribution
        };
    }

    /**
     * Filter patterns that contradict the behavioral state.
     */
    _filterPatterns(patterns, behaviorState) {
        if (!patterns) return {};

        const clean = { ...patterns };

        if (behaviorState.state === 'sleeping' || behaviorState.state === 'resting') {
            // A resting/sleeping dog does NOT have these patterns — they're noise
            clean.pacing = 0;
            clean.spinning = 0;
            clean.bouncing = 0;
            clean.jumping = 0;
            clean.playBows = 0;
            clean.restlessness = 0;
            clean.headTilts = 0;
        }

        if (behaviorState.state === 'alert-watching' || behaviorState.state === 'calm-standing') {
            clean.spinning = 0;
            clean.bouncing = 0;
            clean.jumping = 0;
            clean.playBows = 0;
        }

        return clean;
    }

    /**
     * Filter detected signals that contradict the behavioral state.
     * A sleeping dog does NOT have "tail wagging" or "body tension" —
     * those are camera noise artifacts.
     */
    _filterSignals(signals, behaviorState) {
        if (!signals || signals.length === 0) return [];

        // Signals that are impossible for sleeping/resting dogs
        const impossibleWhenResting = [
            'Tail wagging detected',
            'Body tension detected',
            'Micro-vibrations detected',
            'High body activity',
            'Active head movement',
            'High-speed movement detected',
            'Moderate movement',
            'Repetitive pacing detected',
            'Bouncing/jumping movement',
            'Spinning/circling detected',
            'Play bow detected!',
            'Jumping detected',
            'Restless behavior'
        ];

        const impossibleWhenAlertStill = [
            'Tail wagging detected',
            'High body activity',
            'High-speed movement detected',
            'Bouncing/jumping movement',
            'Spinning/circling detected',
            'Play bow detected!',
            'Jumping detected'
        ];

        if (behaviorState.state === 'sleeping' || behaviorState.state === 'resting') {
            return signals.filter(s => !impossibleWhenResting.includes(s.signal));
        }

        if (behaviorState.state === 'alert-watching' || behaviorState.state === 'calm-standing') {
            return signals.filter(s => !impossibleWhenAlertStill.includes(s.signal));
        }

        return signals;
    }

    /**
     * Build vision analysis insights from the pixel analyzer summary.
     * Gate insights by behavioral state — don't report noise as observation.
     */
    _buildVisionInsights(visionSummary, behaviorState) {
        if (!visionSummary || visionSummary.totalFrames < 10) {
            return null;
        }

        const isResting = behaviorState &&
            (behaviorState.state === 'sleeping' || behaviorState.state === 'resting');

        const insights = [];

        // Body state
        const stateDescriptions = {
            'very-still': 'Pixel analysis confirms the dog was extremely still — minimal body movement detected at the pixel level.',
            'calm': 'Pixel analysis shows calm, relaxed body movement — no tension or agitation.',
            'slight-motion': 'Minor body adjustments detected — normal micro-movements for a resting or calm dog.',
            'tense': 'Pixel analysis detected body tension — widespread micro-vibration suggesting stress or discomfort.',
            'wagging': 'Pixel analysis detected tail wagging — oscillating motion in the body\'s edge zones.',
            'vibrating': 'Noticeable body vibration detected — could indicate excitement, cold, or anxiety.',
            'active': 'Clear body movement visible at the pixel level — the dog is actively moving.',
            'very-active': 'High body activity detected — large areas of visible motion across the dog\'s body.'
        };

        if (visionSummary.dominantBodyState && stateDescriptions[visionSummary.dominantBodyState]) {
            insights.push({
                type: 'body-state',
                title: `Body State: ${visionSummary.dominantBodyState.replace(/-/g, ' ')}`,
                detail: stateDescriptions[visionSummary.dominantBodyState]
            });
        }

        // Tail wag — only report if NOT resting and high confidence
        if (!isResting && visionSummary.peakTailWag >= 5) {
            insights.push({
                type: 'tail',
                title: 'Tail Wagging Confirmed',
                detail: `Peak tail wag score: ${visionSummary.peakTailWag} — oscillating motion detected in edge zones, indicating a happy or engaged dog.`
            });
        }

        // Tension — only report if NOT resting (camera noise on still dogs = false tension)
        if (!isResting && visionSummary.avgTension > 40) {
            insights.push({
                type: 'tension',
                title: 'Body Tension Detected',
                detail: `Average tension score: ${visionSummary.avgTension}% — widespread micro-vibration without major movement suggests stress or discomfort.`
            });
        }

        return insights.length > 0 ? insights : null;
    }
    /**
     * Build a science-backed evidence chain for the report.
     * Each item links a measured signal to peer-reviewed research.
     */
    _buildEvidenceChain(behaviorState, emotionReport, barkReport, visionSummary) {
        if (!this.scienceDB) return [];

        // Gather measurements for the science database
        const posture = emotionReport.posture ? emotionReport.posture.current : 'unknown';
        const patterns = emotionReport.patterns || {};
        const avgSpeed = emotionReport.movement ? emotionReport.movement.avgSpeed : 0;
        const hasBarks = barkReport && barkReport.barks && barkReport.barks.total > 0;
        const vocalFrames = barkReport && barkReport.vocalizations
            ? Object.values(barkReport.vocalizations.typeDistribution || {}).reduce((s, v) => s + v, 0)
            : 0;
        const hasVocalization = hasBarks || vocalFrames > 10;

        // Determine dominant vocalization type
        let vocalType = 'silent';
        if (hasVocalization && barkReport) {
            if (hasBarks) {
                vocalType = 'bark';
            } else if (barkReport.vocalizations && barkReport.vocalizations.typeDistribution) {
                const dist = barkReport.vocalizations.typeDistribution;
                const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
                if (top) vocalType = top[0];
            }
        }

        const measurements = {
            posture: posture,
            stillness: patterns.stillness || 0,
            avgSpeed: avgSpeed,
            hasVocalization: hasVocalization,
            vocalType: vocalType,
            barkPitch: barkReport && barkReport.barks ? barkReport.barks.avgFrequency : 0,
            barkRate: barkReport && barkReport.barks ? barkReport.barks.rate : 0,
            barkType: barkReport && barkReport.barks ? barkReport.barks.dominantType : 'unknown',
            hasTailWag: visionSummary ? visionSummary.peakTailWag >= 5 : false,
            tailWagScore: visionSummary ? visionSummary.peakTailWag : 0,
            hasTension: visionSummary ? visionSummary.avgTension > 40 : false,
            tensionScore: visionSummary ? visionSummary.avgTension : 0,
            framesAnalyzed: emotionReport.framesAnalyzed || 0,
            pixelBodyState: visionSummary ? visionSummary.dominantBodyState : 'unknown',
            pacing: patterns.pacing || 0,
            bouncing: patterns.bouncing || 0,
            playBows: patterns.playBows || 0,
            restlessness: patterns.restlessness || 0
        };

        return this.scienceDB.getEvidenceForState(behaviorState.state, measurements);
    }
}

window.ScanReportAgent = ScanReportAgent;
