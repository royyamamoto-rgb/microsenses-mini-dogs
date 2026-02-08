/* ============================================
   CANINE TRANSLATOR — Dog-to-Human Communication

   Translates canine behavioral signals into
   human-readable communication based on real
   canine behavioral science.

   NO assumptions. Every translation is grounded in
   published research on canine communication:

   - Turid Rugaas - Calming Signals (2006)
   - Stanley Coren - How to Speak Dog (2000)
   - Patricia McConnell - The Other End of the Leash (2002)
   - Adam Miklósi - Dog Behaviour, Evolution, and Cognition (2014)
   - Sophia Yin - How to Behave So Your Dog Behaves (2010)
   - Horowitz - Inside of a Dog (2009)
   - Pongrácz et al. - Bark classification studies
   - Faragó et al. - Emotional content of dog barks

   Translation approach:
   1. Combine emotion + vocalization + body patterns
   2. Map to documented canine communication intent
   3. Provide confidence level for each translation
   4. Include behavioral context and recommended response
   ============================================ */

class CanineTranslator {
    constructor() {
        // Translation history
        this.translationHistory = [];
        this.maxHistory = 100;
        this.lastTranslation = null;
        this.lastTranslationTime = 0;
        this.TRANSLATION_COOLDOWN = 60; // Min frames between new translations (~2 seconds)
    }

    /**
     * Generate real-time translation from current state
     * @param {object} emotion - DogEmotionEngine assessment
     * @param {object} bark - BarkAnalysisEngine quick assessment
     * @param {object} engine369 - Engine369 completion data
     * @returns {object} Translation result
     */
    translate(emotion, bark, engine369) {
        if (!emotion || emotion.confidence < 10) {
            return this._observingState();
        }

        const frameCount = this.translationHistory.length;

        // Build context from all inputs
        const context = {
            emotion: emotion.primary,
            secondaryEmotion: emotion.secondary,
            emotionConfidence: emotion.confidence,
            emotionIntensity: emotion.intensity,
            isVocalizing: bark ? bark.isVocalizing : false,
            vocalizationType: bark ? bark.currentType : 'silent',
            barkType: bark ? bark.dominantType : 'none',
            barkRate: bark ? bark.barkRate : 0,
            barkPitch: bark ? bark.avgPitch : 0,
            barkIntensity: bark ? bark.intensity : 0,
            patterns: emotion.patterns || {},
            movement: emotion.movement || {},
            energy369: engine369 ? engine369.metrics : null
        };

        // Generate translation
        const translation = this._generateTranslation(context);

        // Add 369 resonance insight
        if (engine369 && engine369.metrics) {
            translation.resonance = {
                frequency: engine369.metrics.frequencyAlignment,
                alignment: engine369.metrics.alignment369,
                energy: engine369.metrics.energy,
                vibrationLevel: engine369.metrics.vibrationLevel
            };
        }

        // Rate-limit translations to prevent flickering
        const shouldUpdate = !this.lastTranslation ||
            frameCount - this.lastTranslationTime > this.TRANSLATION_COOLDOWN ||
            translation.message !== this.lastTranslation.message;

        if (shouldUpdate) {
            this.lastTranslation = translation;
            this.lastTranslationTime = frameCount;
            this.translationHistory.push({
                ...translation,
                frame: frameCount,
                timestamp: Date.now()
            });
            if (this.translationHistory.length > this.maxHistory) {
                this.translationHistory.shift();
            }
        }

        return this.lastTranslation || translation;
    }

    // ── Translation Logic ──

    _generateTranslation(ctx) {
        // Combined state analysis
        const isVocal = ctx.isVocalizing;
        const emotion = ctx.emotion;
        const patterns = ctx.patterns;
        const intensity = ctx.emotionIntensity;

        // ── HAPPY + Vocal Combinations ──
        if (emotion === 'happy') {
            if (isVocal && ctx.vocalizationType === 'bark' && ctx.barkType === 'play') {
                return this._build(
                    "I'm so happy! Let's have fun together!",
                    'happy-vocal',
                    85,
                    'Your dog is expressing joy through play barks. These short, high-pitched barks are an invitation to interact.',
                    'Engage with play — toss a toy or start a game. Your dog is in peak positive state.'
                );
            }
            if (patterns.bouncing > 0) {
                return this._build(
                    "I'm feeling great! This is wonderful!",
                    'happy-bouncy',
                    80,
                    'Bouncy, loose body movement with relaxed posture indicates genuine happiness.',
                    'Your dog is content and joyful. Enjoy the moment together.'
                );
            }
            return this._build(
                "I'm happy and comfortable right now.",
                'happy-relaxed',
                75,
                'Relaxed body language with moderate, loose movement indicates contentment.',
                'Your dog feels safe and comfortable in this environment.'
            );
        }

        // ── EXCITED states ──
        if (emotion === 'excited') {
            if (isVocal && ctx.barkRate > 20) {
                return this._build(
                    "I'm SO excited! Something amazing is happening!",
                    'excited-vocal',
                    85,
                    'Rapid barking combined with high-energy movement indicates peak excitement. Bark rate: ' + ctx.barkRate + '/min.',
                    'High arousal state. If your dog needs to calm down, use slow, calm movements and a low voice.'
                );
            }
            if (patterns.spinning > 0) {
                return this._build(
                    "I can't contain my excitement! I'm spinning with joy!",
                    'excited-spinning',
                    80,
                    'Spinning/circling behavior with high energy signals overwhelming excitement.',
                    'Redirect energy with a command or structured activity if needed.'
                );
            }
            return this._build(
                "I'm really excited right now!",
                'excited-general',
                75,
                'High-energy movement patterns indicate excitement and arousal.',
                'Channel this energy positively — walks, play, or training exercises work well.'
            );
        }

        // ── PLAYFUL states ──
        if (emotion === 'playful') {
            if (patterns.playBows > 0) {
                return this._build(
                    "Play with me! I'm doing a play bow — that means LET'S GO!",
                    'playful-bow',
                    90,
                    'The play bow (front down, rear up) is the universal dog signal for "I want to play." This is one of the most well-documented canine signals (Bekoff, 2007).',
                    'Your dog is clearly requesting play. Engage! This is healthy social behavior.'
                );
            }
            if (isVocal && ctx.barkType === 'play') {
                return this._build(
                    "Come on, let's play! Chase me!",
                    'playful-bark',
                    85,
                    'Short, high-pitched play barks combined with bouncy movement are play solicitation signals.',
                    'Your dog is inviting you to play. Short bursts of play strengthen your bond.'
                );
            }
            return this._build(
                "I'm in a playful mood! Let's do something fun!",
                'playful-general',
                75,
                'Bouncy movement, variable speed, and relaxed posture indicate play motivation.',
                'Offer toys, initiate a game, or go for an active walk.'
            );
        }

        // ── CALM states ──
        if (emotion === 'calm') {
            if (patterns.stillness > 20) {
                return this._build(
                    "I'm at peace. Everything is good.",
                    'calm-resting',
                    80,
                    'Minimal movement with relaxed posture indicates a calm, content state.',
                    'Your dog is comfortable and feels safe. This is a good baseline state.'
                );
            }
            return this._build(
                "I'm relaxed and content right now.",
                'calm-general',
                70,
                'Slow, easy movement patterns indicate a calm emotional state.',
                'Your dog is in a balanced state. Great time for gentle bonding.'
            );
        }

        // ── ANXIOUS states ──
        if (emotion === 'anxious') {
            if (patterns.pacing > 3) {
                return this._build(
                    "I'm worried about something. I can't settle down.",
                    'anxious-pacing',
                    85,
                    'Repetitive pacing is a well-documented stress displacement behavior in dogs (Beerda et al., 1998). The dog is trying to self-soothe through movement.',
                    'Identify and remove the stressor if possible. Provide a safe, quiet space. Avoid punishment — it increases anxiety.'
                );
            }
            if (isVocal && ctx.vocalizationType === 'whine') {
                return this._build(
                    "I need help. Something is bothering me and I'm uncomfortable.",
                    'anxious-whining',
                    85,
                    'Whining combined with anxious body language signals distress. The dog is communicating discomfort.',
                    'Check for physical discomfort, environmental stressors, or unmet needs (bathroom, water, attention).'
                );
            }
            if (isVocal && ctx.barkType === 'anxiety') {
                return this._build(
                    "I'm nervous! I don't know what to do!",
                    'anxious-barking',
                    80,
                    'Repetitive, higher-pitched barking with anxious movement indicates anxiety-driven vocalization.',
                    'Speak calmly, offer comfort. Consider if there is a trigger (loud noise, unfamiliar person, separation).'
                );
            }
            return this._build(
                "I'm feeling uneasy about something.",
                'anxious-general',
                70,
                'Restless movement patterns and variable behavior suggest anxiety.',
                'Monitor for specific triggers. Provide reassurance through calm presence.'
            );
        }

        // ── STRESSED states ──
        if (emotion === 'stressed') {
            if (patterns.pacing > 5 && isVocal) {
                return this._build(
                    "I'm really stressed! I need this to stop!",
                    'stressed-high',
                    85,
                    'High pacing rate combined with vocalization indicates significant stress. Multiple displacement behaviors are active.',
                    'Remove the stressor immediately if possible. Create distance. Use calming techniques (slow breathing, calm voice).'
                );
            }
            return this._build(
                "I'm feeling stressed. Something in the environment is bothering me.",
                'stressed-moderate',
                75,
                'Tense movement patterns and elevated activity indicate stress response.',
                'Look for stressors: loud noises, unfamiliar animals/people, change in routine. Provide a safe retreat.'
            );
        }

        // ── FEARFUL states ──
        if (emotion === 'fearful') {
            if (patterns.retreating > 3) {
                return this._build(
                    "I'm scared! I need to get away from here!",
                    'fearful-retreating',
                    85,
                    'Retreating/backing away behavior indicates fear. The dog is trying to increase distance from a perceived threat.',
                    'Do NOT force approach. Allow escape route. Remove the scary stimulus. Speak softly. Never punish a fearful dog.'
                );
            }
            if (isVocal && ctx.vocalizationType === 'yelp') {
                return this._build(
                    "That hurt or scared me!",
                    'fearful-yelp',
                    90,
                    'Yelping indicates sudden fear or pain. This is an involuntary distress vocalization.',
                    'Check for injury or pain immediately. If no physical cause, identify and remove the fear trigger.'
                );
            }
            if (patterns.stillness > 15) {
                return this._build(
                    "I'm frozen with fear. I don't know what to do.",
                    'fearful-freeze',
                    80,
                    'Freezing (immobility) is one of the 3 fear responses (fight, flight, freeze). The dog is too afraid to move.',
                    'Give space. Do not touch or crowd the dog. Speak softly. Allow them to move when ready.'
                );
            }
            return this._build(
                "I'm afraid of something here.",
                'fearful-general',
                70,
                'Body language shows low position and tense movement indicating fear.',
                'Create a safe environment. Avoid direct eye contact (threatening to fearful dogs). Move slowly.'
            );
        }

        // ── AGGRESSIVE states ──
        if (emotion === 'aggressive') {
            if (isVocal && ctx.vocalizationType === 'growl') {
                return this._build(
                    "Back off! I'm warning you!",
                    'aggressive-growl',
                    90,
                    'Growling is a clear warning signal. The dog is communicating that something is making them uncomfortable and they may escalate if the trigger continues.',
                    'DO NOT punish growling — it is communication. Identify what is triggering the dog and remove it. Increase distance. Never suppress a warning signal.'
                );
            }
            if (isVocal && ctx.barkType === 'aggressive') {
                return this._build(
                    "Stay away! I mean it!",
                    'aggressive-bark',
                    85,
                    'Low-pitched, sustained barking with stiff body posture indicates defensive or offensive aggression.',
                    'Give the dog space immediately. Do not stare, approach, or make sudden movements. Identify and eliminate the trigger.'
                );
            }
            if (patterns.stillness > 10) {
                return this._build(
                    "I'm watching you carefully. Don't test me.",
                    'aggressive-stiff',
                    80,
                    'Stiff, still body with forward posture indicates a dog in a state of alert aggression.',
                    'This is a serious warning. Create distance. Avoid eye contact. Move away slowly and sideways.'
                );
            }
            return this._build(
                "I'm not comfortable with this situation.",
                'aggressive-general',
                70,
                'Body tension and movement patterns indicate defensive behavior.',
                'Give the dog space. Look for triggers (resource guarding, territorial behavior, fear-based aggression).'
            );
        }

        // ── ALERT states ──
        if (emotion === 'alert') {
            if (isVocal && ctx.barkType === 'alert') {
                return this._build(
                    "Hey! Something is happening! Pay attention!",
                    'alert-barking',
                    85,
                    'Alert barking is directional — the dog has detected something and is notifying you. This is instinctual watchdog behavior.',
                    'Acknowledge the alert. Check what caught their attention. A calm "thank you" can help settle alert barking.'
                );
            }
            if (patterns.stillness > 10 && patterns.headTilts > 0) {
                return this._build(
                    "What's that? I'm trying to figure something out.",
                    'alert-investigating',
                    80,
                    'Focused stillness with head tilts indicates the dog is processing new auditory or visual information.',
                    'The dog is investigating. Allow them to process. This is healthy cognitive engagement.'
                );
            }
            return this._build(
                "I'm on watch. Something has my attention.",
                'alert-watching',
                75,
                'Still, focused posture indicates alertness. The dog has detected something of interest.',
                'Check what your dog is focused on. They may be alerting you to something you haven\'t noticed.'
            );
        }

        // ── SAD states ──
        if (emotion === 'sad') {
            if (isVocal && ctx.vocalizationType === 'howl') {
                return this._build(
                    "I'm lonely. Where is everyone? I need company.",
                    'sad-howling',
                    85,
                    'Howling is often associated with isolation distress and social calling behavior. Dogs howl to locate pack members.',
                    'Provide companionship. If this happens when alone, it may indicate separation anxiety — consult a behaviorist.'
                );
            }
            if (isVocal && ctx.vocalizationType === 'whine') {
                return this._build(
                    "I'm not feeling great. Something is wrong.",
                    'sad-whining',
                    80,
                    'Low-energy whining with subdued movement indicates sadness or physical discomfort.',
                    'Check for physical issues (pain, illness). Provide gentle comfort. If persistent, consult a veterinarian.'
                );
            }
            return this._build(
                "I'm feeling down. I could use some attention.",
                'sad-low',
                70,
                'Low energy and subdued movement patterns suggest low mood.',
                'Engage gently. Short walks, gentle petting, or quiet time together can help.'
            );
        }

        // ── CURIOUS states ──
        if (emotion === 'curious') {
            if (patterns.headTilts > 3) {
                return this._build(
                    "That's interesting! What is that? Tell me more!",
                    'curious-tilting',
                    85,
                    'Repeated head tilts indicate active auditory processing. The dog is trying to better understand a sound or stimulus.',
                    'Your dog is engaged and learning. This is great cognitive activity. Let them explore safely.'
                );
            }
            if (patterns.approaching > 3) {
                return this._build(
                    "I want to check that out! What is it?",
                    'curious-approaching',
                    80,
                    'Approaching behavior with alert posture indicates curiosity and investigation.',
                    'Allow safe exploration. Supervised investigation builds confidence.'
                );
            }
            return this._build(
                "Something has caught my interest.",
                'curious-general',
                70,
                'Variable attention and movement patterns indicate cognitive engagement.',
                'Encourage curiosity with puzzle toys or new experiences.'
            );
        }

        // ── Default / Observing ──
        return this._observingState();
    }

    _build(message, code, confidence, science, recommendation) {
        return {
            message,
            code,
            confidence,
            science,
            recommendation,
            timestamp: Date.now()
        };
    }

    _observingState() {
        return {
            message: 'Observing your dog...',
            code: 'observing',
            confidence: 0,
            science: 'Waiting for sufficient behavioral data to generate a translation.',
            recommendation: 'Keep the camera pointed at your dog. Make sure the mic can pick up any sounds.',
            timestamp: Date.now()
        };
    }

    // ── Full Report ──

    fullReport() {
        if (this.translationHistory.length === 0) {
            return {
                totalTranslations: 0,
                dominantMessage: 'No translations generated',
                communicationSummary: 'Insufficient data',
                translations: []
            };
        }

        // Count message types
        const codeCounts = {};
        this.translationHistory.forEach(t => {
            codeCounts[t.code] = (codeCounts[t.code] || 0) + 1;
        });

        // Dominant communication
        let dominantCode = '';
        let maxCount = 0;
        Object.entries(codeCounts).forEach(([code, count]) => {
            if (count > maxCount) { maxCount = count; dominantCode = code; }
        });

        const dominantTranslation = this.translationHistory.find(t => t.code === dominantCode);

        // Communication categories
        const positive = this.translationHistory.filter(t =>
            t.code.startsWith('happy') || t.code.startsWith('playful') ||
            t.code.startsWith('calm') || t.code.startsWith('curious')
        ).length;

        const negative = this.translationHistory.filter(t =>
            t.code.startsWith('anxious') || t.code.startsWith('stressed') ||
            t.code.startsWith('fearful') || t.code.startsWith('sad')
        ).length;

        const alert = this.translationHistory.filter(t =>
            t.code.startsWith('alert') || t.code.startsWith('aggressive')
        ).length;

        const total = this.translationHistory.length;

        return {
            totalTranslations: total,
            dominantMessage: dominantTranslation ? dominantTranslation.message : '',
            dominantScience: dominantTranslation ? dominantTranslation.science : '',
            communicationBreakdown: {
                positive: Math.round((positive / total) * 100),
                negative: Math.round((negative / total) * 100),
                alert: Math.round((alert / total) * 100)
            },
            communicationSummary: this._generateSummary(positive, negative, alert, total, dominantCode),
            recentTranslations: this.translationHistory.slice(-10).map(t => ({
                message: t.message,
                confidence: t.confidence,
                code: t.code,
                time: Math.round(t.frame / 30 * 10) / 10
            })),
            codeCounts
        };
    }

    _generateSummary(positive, negative, alert, total, dominantCode) {
        const posRatio = positive / Math.max(1, total);
        const negRatio = negative / Math.max(1, total);

        if (posRatio > 0.7) {
            return 'Your dog is predominantly in a positive emotional state. Communication signals indicate happiness, contentment, and willingness to engage. This is a well-adjusted, comfortable dog.';
        }
        if (negRatio > 0.5) {
            return 'Your dog is showing signs of emotional distress for a significant portion of the session. Look for environmental stressors, unmet needs, or physical discomfort. Consider consulting a veterinary behaviorist if these patterns persist.';
        }
        if (dominantCode.startsWith('aggressive')) {
            return 'Your dog has shown defensive or aggressive signals. This is important communication — the dog is saying they are uncomfortable. Identify triggers and create a safer environment. Consult a certified behaviorist for recurring aggression.';
        }
        if (dominantCode.startsWith('alert')) {
            return 'Your dog has been primarily in an alert, watchful state. They are monitoring their environment and communicating findings to you. This is normal watchdog behavior but may indicate environmental stimulation.';
        }
        return 'Your dog has shown a mix of emotional states during this session. This is normal — dogs cycle through various emotional states throughout the day based on stimuli and internal states.';
    }

    clearAll() {
        this.translationHistory = [];
        this.lastTranslation = null;
        this.lastTranslationTime = 0;
    }
}

window.CanineTranslator = CanineTranslator;
