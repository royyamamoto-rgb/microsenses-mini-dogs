/* ============================================
   APP.JS - Microsenses MINI Dogs
   Canine Communication & Emotion Translator
   Powered by 369 Energy Engine

   Uses TensorFlow.js COCO-SSD for dog detection
   Camera defaults to environment-facing
   Microphone always on for bark analysis
   ============================================ */

// ── DOM Elements ──
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const realtimeChart = document.getElementById('realtimeChart');
const rtCtx = realtimeChart.getContext('2d');

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnFlip = document.getElementById('btn-flip');
const statusBar = document.getElementById('statusBar');
const timerSection = document.getElementById('timerSection');
const timerValue = document.getElementById('timerValue');
const resultsPanel = document.getElementById('resultsPanel');
const modeBadge = document.getElementById('modeBadge');

// ── State ──
let running = false;
let stream = null;
let modelLoaded = false;
let cocoModel = null;
let facingMode = 'environment'; // Default to rear camera for pointing at dogs
let scanStartTime = null;
let frameCount = 0;
let dogDetectionCount = 0;

// Energy tracking for chart
let energyData = [];

// ── Engines ──
const engine369 = new Engine369();
const barkEngine = new BarkAnalysisEngine();
const emotionEngine = new DogEmotionEngine();
const translator = new CanineTranslator();
let micAvailable = false;

// ── Utility ──
function setStatus(msg, type) {
    statusBar.textContent = msg;
    statusBar.className = 'status-bar ' + type;
}

function formatTimer(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// ── Model Loading ──
async function loadModels() {
    setStatus('Loading dog detection model (COCO-SSD)...', 'loading');
    try {
        cocoModel = await cocoSsd.load({
            base: 'mobilenet_v2'
        });
        modelLoaded = true;
        btnStart.disabled = false;
        setStatus('Ready. Point camera at your dog and click Start Scan.', 'ready');
    } catch (err) {
        setStatus('Model load error: ' + err.message, 'error');
        console.error(err);
    }
}

// ── Camera ──
async function startCamera() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        video.srcObject = null;
    }

    // Always request audio for bark analysis
    const constraintsList = [
        { video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: true },
        { video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
        { video: { facingMode: facingMode }, audio: true },
        { video: true, audio: true }
    ];

    let lastErr = null;
    for (const constraints of constraintsList) {
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
        } catch (err) {
            lastErr = err;
            console.warn('Camera attempt failed:', constraints, err.name);
        }
    }

    // Fallback: video without audio
    if (!stream) {
        console.warn('Audio+video failed, falling back to video-only');
        const videoOnlyList = [
            { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
            { video: { facingMode }, audio: false },
            { video: true, audio: false }
        ];
        for (const constraints of videoOnlyList) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                break;
            } catch (err) { lastErr = err; }
        }
    }

    if (!stream) {
        const errName = lastErr ? lastErr.name : 'Unknown';
        if (errName === 'NotAllowedError') setStatus('Camera/microphone permission denied.', 'error');
        else if (errName === 'NotFoundError') setStatus('No camera found.', 'error');
        else setStatus('Camera error: ' + (lastErr ? lastErr.message : 'unknown'), 'error');
        return false;
    }

    // Check audio
    const audioTracks = stream.getAudioTracks();
    micAvailable = audioTracks.length > 0;

    video.srcObject = stream;
    await new Promise((resolve) => {
        if (video.readyState >= 1) resolve();
        else video.onloadedmetadata = () => resolve();
    });

    try { await video.play(); } catch (playErr) {
        console.warn('video.play() failed, retrying...', playErr);
        await new Promise(r => setTimeout(r, 300));
        try { await video.play(); } catch (e) {
            setStatus('Could not start video playback.', 'error');
            return false;
        }
    }

    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;

    return true;
}

// ── Drawing: Dog Detection Overlay ──
function drawDogDetection(prediction) {
    const [x, y, w, h] = prediction.bbox;

    // Get emotion color
    const emotionColors = {
        happy: '#7cb342',
        excited: '#ff8a65',
        playful: '#4ecdc4',
        calm: '#4caf50',
        anxious: '#ffc107',
        stressed: '#ff9800',
        fearful: '#f44336',
        aggressive: '#f44336',
        alert: '#d4a017',
        sad: '#9e9eff',
        curious: '#82b1ff',
        observing: '#888'
    };

    const color = emotionColors[emotionEngine.primaryEmotion] || '#d4a017';
    const emotionLabel = emotionEngine.primaryEmotion.toUpperCase();

    // Draw glow aura
    const gradient = ctx.createRadialGradient(
        x + w / 2, y + h / 2, Math.min(w, h) * 0.3,
        x + w / 2, y + h / 2, Math.max(w, h) * 0.7
    );
    gradient.addColorStop(0, color + '22');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 20, y - 20, w + 40, h + 40);

    // Corner brackets
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    const cl = Math.min(w, h) * 0.15;
    ctx.beginPath(); ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + h - cl); ctx.lineTo(x, y + h); ctx.lineTo(x + cl, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w - cl, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cl); ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(`DOG [${emotionLabel}]`, x + 4, y - 8);

    // Confidence
    const confText = `${Math.round(prediction.score * 100)}%`;
    ctx.font = 'bold 11px system-ui';
    const tw = ctx.measureText(confText).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x + w - tw - 12, y + h + 4, tw + 8, 18);
    ctx.fillStyle = color;
    ctx.fillText(confText, x + w - tw - 8, y + h + 17);
}

// ── Drawing: Chart ──
function drawRealtimeChart() {
    const w = realtimeChart.width = realtimeChart.clientWidth * 2;
    const h = realtimeChart.height = 160;
    rtCtx.clearRect(0, 0, w, h);

    if (energyData.length < 2) return;

    const recent = energyData.slice(-100);
    const max = Math.max(...recent.map(d => d.energy), 1);

    const gradient = rtCtx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(212, 160, 23, 0.4)');
    gradient.addColorStop(1, 'rgba(212, 160, 23, 0)');

    rtCtx.fillStyle = gradient;
    rtCtx.beginPath();
    rtCtx.moveTo(0, h);
    for (let i = 0; i < recent.length; i++) {
        const px = (i / (recent.length - 1)) * w;
        const py = h - (recent[i].energy / max) * (h - 20);
        rtCtx.lineTo(px, py);
    }
    rtCtx.lineTo(w, h);
    rtCtx.closePath();
    rtCtx.fill();

    rtCtx.strokeStyle = '#d4a017';
    rtCtx.lineWidth = 2;
    rtCtx.beginPath();
    for (let i = 0; i < recent.length; i++) {
        const px = (i / (recent.length - 1)) * w;
        const py = h - (recent[i].energy / max) * (h - 20);
        if (i === 0) rtCtx.moveTo(px, py); else rtCtx.lineTo(px, py);
    }
    rtCtx.stroke();
}

// ── Live Indicator Chips ──
function updateLiveIndicators(emotion, barkAssess, completion) {
    const el = document.getElementById('indicatorChips');
    let html = '';

    // Emotion indicator
    if (emotion && emotion.confidence > 20) {
        html += `<span class="ind-chip ${emotion.primary}">${emotion.primary.toUpperCase()}</span>`;
        if (emotion.secondary && emotion.confidence > 40) {
            html += `<span class="ind-chip ${emotion.secondary}">${emotion.secondary.toUpperCase()}</span>`;
        }
    }

    // Bark indicators
    if (barkAssess && barkAssess.isVocalizing) {
        const barkClass = barkAssess.currentType === 'growl' ? 'growl' :
                          barkAssess.currentType === 'whine' ? 'whine' :
                          barkAssess.currentType === 'howl' ? 'howl' : 'bark';
        html += `<span class="ind-chip ${barkClass}">${barkAssess.currentType.toUpperCase()}</span>`;

        if (barkAssess.barkRate > 20) {
            html += '<span class="ind-chip bark">RAPID BARKING</span>';
        }
    }

    // 369 alignment indicator
    if (completion && completion.metrics && completion.metrics.alignment369 > 60) {
        html += `<span class="ind-chip energy369">369 ALIGNED ${completion.metrics.alignment369}%</span>`;
    }

    // Movement patterns
    if (emotion && emotion.patterns) {
        if (emotion.patterns.playBows > 0) html += '<span class="ind-chip playful">PLAY BOW!</span>';
        if (emotion.patterns.pacing > 3) html += '<span class="ind-chip anxious">PACING</span>';
        if (emotion.patterns.headTilts > 2) html += '<span class="ind-chip curious">HEAD TILT</span>';
        if (emotion.patterns.spinning > 0) html += '<span class="ind-chip excited">SPINNING</span>';
    }

    if (html === '') html = '<span class="ind-chip neutral">MONITORING...</span>';
    el.innerHTML = html;
}

// ── Update Bark Status ──
function updateBarkStatus(barkAssess) {
    const barkStatusEl = document.getElementById('barkStatus');
    const barkTextEl = document.getElementById('barkText');

    if (!micAvailable) {
        barkStatusEl.className = 'bark-status denied';
        barkTextEl.textContent = 'Microphone: Permission denied — visual analysis only';
        return;
    }

    if (barkAssess && barkAssess.isVocalizing) {
        barkStatusEl.className = 'bark-status barking';
        barkTextEl.textContent = `Microphone: ${barkAssess.currentType.toUpperCase()} detected — ${barkAssess.dominantFreq}Hz`;
    } else if (barkEngine.isActive) {
        barkStatusEl.className = 'bark-status active';
        barkTextEl.textContent = barkAssess && barkAssess.hasBaseline
            ? 'Microphone: Active — Monitoring for vocalizations'
            : 'Microphone: Establishing environmental baseline...';
    } else {
        barkStatusEl.className = 'bark-status silent';
        barkTextEl.textContent = 'Microphone: Initializing...';
    }
}

// ── Frame Processing ──
async function processFrame() {
    if (!running) return;

    const now = performance.now();
    const elapsed = now - scanStartTime;

    timerValue.textContent = formatTimer(elapsed);
    frameCount++;

    try {
        if (video.readyState < 2 || video.videoWidth === 0) {
            if (running) requestAnimationFrame(processFrame);
            return;
        }

        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
        }

        // Detect objects using COCO-SSD
        const predictions = await cocoModel.detect(video);

        // Filter for dogs only (COCO class: "dog")
        const dogs = predictions.filter(p => p.class === 'dog' && p.score > 0.3);

        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // Process bark audio every frame
        let barkAssess = null;
        if (barkEngine.isActive) {
            barkEngine.processAudioFrame();
            barkAssess = barkEngine._quickAssess();
        }

        if (dogs.length > 0) {
            dogDetectionCount++;

            // Use the highest-confidence dog detection
            const dog = dogs.reduce((best, d) => d.score > best.score ? d : best, dogs[0]);
            const [bx, by, bw, bh] = dog.bbox;

            // Process through emotion engine
            const emotionAssess = emotionEngine.processFrame(
                { box: { x: bx, y: by, width: bw, height: bh }, confidence: dog.score },
                barkAssess
            );

            // ── 369 Pipeline ──
            // Phase 3: Creation — raw input
            const creationInput = {
                movement: {
                    magnitude: emotionAssess.movement ? emotionAssess.movement.avgSpeed : 0
                },
                audio: {
                    dominantFreq: barkAssess ? barkAssess.dominantFreq : 0
                },
                timestamp: now
            };
            const creation = engine369.processCreation(creationInput);

            // Phase 6: Harmony — analysis
            const harmony = engine369.processHarmony(creation, emotionAssess, barkAssess);

            // Phase 9: Completion — translation
            const translationInput = {
                communicating: (barkAssess && barkAssess.isVocalizing) ||
                               emotionAssess.intensity > 30,
                channel: barkAssess && barkAssess.isVocalizing ? 'combined' : 'body'
            };
            const completion = engine369.processCompletion(harmony, translationInput);

            // Generate translation
            const translation = translator.translate(emotionAssess, barkAssess, completion);

            // Draw detection
            drawDogDetection(dog);

            // Update UI metrics
            document.getElementById('rtEmotion').textContent = emotionAssess.primary;
            document.getElementById('rtEmotion').style.color =
                ['happy','playful','calm','curious'].includes(emotionAssess.primary) ? '#7cb342' :
                ['anxious','stressed','fearful','aggressive'].includes(emotionAssess.primary) ? '#f44336' : '#d4a017';
            document.getElementById('rtConfidence').textContent = emotionAssess.confidence + '%';
            document.getElementById('rtIntensity').textContent = emotionAssess.intensity + '%';

            // 369 Energy metrics
            document.getElementById('rtEnergy').textContent = completion.metrics.energy.toFixed(2);
            document.getElementById('rtVibration').textContent = completion.metrics.vibrationLevel;
            document.getElementById('rtFrequency').textContent =
                completion.metrics.frequencyAlignment ? completion.metrics.frequencyAlignment.freq + ' Hz' : '--';

            // Energy chart data
            energyData.push({ energy: completion.metrics.energy });

            // Translation display
            if (translation && translation.message) {
                document.getElementById('translationMessage').textContent = translation.message;
                document.getElementById('translationScience').textContent = translation.science || '';
                document.getElementById('translationRecommendation').textContent = translation.recommendation || '';
                document.getElementById('translationConfidence').textContent =
                    translation.confidence > 0 ? `Confidence: ${translation.confidence}%` : '';
            }

            // Live indicators
            updateLiveIndicators(emotionAssess, barkAssess, completion);

        } else {
            // No dog detected
            document.getElementById('rtEmotion').textContent = '--';
            document.getElementById('rtConfidence').textContent = '--';
            document.getElementById('rtIntensity').textContent = '--';

            // Still process bark even without visual detection
            if (barkAssess && barkAssess.isVocalizing) {
                document.getElementById('translationMessage').textContent =
                    'I can hear your dog but can\'t see them. Point the camera at your dog.';
            } else {
                document.getElementById('translationMessage').textContent =
                    'Looking for your dog... Make sure they\'re in frame.';
            }
        }

        // Update bark status
        updateBarkStatus(barkAssess);

        // Draw chart
        drawRealtimeChart();

    } catch (err) {
        console.warn('Frame processing error:', err.message);
    }

    if (running) requestAnimationFrame(processFrame);
}

// ── Start Scan ──
async function startScan() {
    setStatus('Starting camera...', 'loading');

    const ok = await startCamera();
    if (!ok) return;

    running = true;
    frameCount = 0;
    dogDetectionCount = 0;
    energyData = [];
    scanStartTime = performance.now();

    // Reset all engines
    engine369.clearAll();
    barkEngine.clearAll();
    emotionEngine.clearAll();
    translator.clearAll();

    // Initialize bark analysis
    if (micAvailable && stream) {
        try {
            await barkEngine.initAudioContext(stream);
            updateBarkStatus(null);
        } catch (e) {
            console.warn('Bark engine init failed:', e);
            micAvailable = false;
        }
    }

    // Show UI elements
    document.getElementById('translationPanel').style.display = 'block';
    document.getElementById('emotionMetrics').style.display = 'grid';
    document.getElementById('energyMetrics').style.display = 'grid';
    document.getElementById('formulaBox').style.display = 'block';
    document.getElementById('barkStatus').style.display = 'flex';
    document.getElementById('chartSection').style.display = 'block';
    document.getElementById('liveIndicators').style.display = 'block';
    timerSection.style.display = 'block';
    modeBadge.style.display = 'inline-block';
    modeBadge.textContent = 'SCANNING';

    btnStart.disabled = true;
    btnStop.disabled = false;
    resultsPanel.classList.remove('active');

    setStatus('Scanning... Point camera at your dog', 'scanning');
    processFrame();
}

// ── Stop Scan ──
function stopScan() {
    if (!running) return;
    completeScan();
}

// ── Complete Scan ──
function completeScan() {
    running = false;

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
    video.srcObject = null;
    if (!video.paused) video.pause();
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Get final reports before cleanup
    const emotionReport = emotionEngine.fullAnalysis();
    const barkReport = barkEngine.fullAnalysis();
    const translationReport = translator.fullReport();
    const energyReport = engine369.fullReport();

    // Clean up bark engine
    barkEngine.destroy();
    micAvailable = false;

    timerSection.style.display = 'none';
    btnStart.disabled = false;
    btnStop.disabled = true;

    // Build report
    const elapsed = (performance.now() - scanStartTime) / 1000;
    document.getElementById('scanDurationDisplay').textContent = `${elapsed.toFixed(0)}s`;
    document.getElementById('scanFrames').textContent = frameCount;
    document.getElementById('scanDetections').textContent = dogDetectionCount;
    document.getElementById('scanCycles').textContent = energyReport.totalCycles;

    // Render results
    renderEmotionReport(emotionReport);
    renderTranslationReport(translationReport);
    renderBarkReport(barkReport);
    renderEnergyReport(energyReport);

    resultsPanel.classList.add('active');
    setStatus('Analysis complete!', 'ready');
}

// ── Render Emotion Report ──
function renderEmotionReport(report) {
    const wellbeingLevel = report.wellbeing >= 65 ? 'positive' :
                           report.wellbeing <= 35 ? 'negative' : 'mixed';
    const wellbeingLabel = report.wellbeing >= 65 ? 'Happy & Healthy' :
                           report.wellbeing <= 35 ? 'Needs Attention' : 'Mixed Signals';

    let html = `
    <div class="section-title">EMOTIONAL STATE ANALYSIS</div>
    <div class="emotion-summary-card ${wellbeingLevel}">
        <div class="emotion-header">
            <div class="emotion-title">DOMINANT: ${(report.dominantEmotion || 'unknown').toUpperCase()}</div>
            <div class="emotion-badge ${wellbeingLevel}">${wellbeingLabel}</div>
        </div>
        <div class="score-grid">
            <div class="score-ring"><div class="score-value">${report.wellbeing}%</div><div class="score-label">Well-being</div></div>
            <div class="score-ring"><div class="score-value">${report.stability}%</div><div class="score-label">Stability</div></div>
            <div class="score-ring"><div class="score-value">${report.confidence}%</div><div class="score-label">Confidence</div></div>
            <div class="score-ring"><div class="score-value">${report.intensity}%</div><div class="score-label">Intensity</div></div>
        </div>`;

    // Emotion distribution bars
    if (report.emotionDistribution && Object.keys(report.emotionDistribution).length > 0) {
        html += '<div class="emotion-bar-container" style="margin-top:16px;">';
        const emotionBarColors = {
            happy: '#7cb342', excited: '#ff8a65', playful: '#4ecdc4', calm: '#4caf50',
            anxious: '#ffc107', stressed: '#ff9800', fearful: '#f44336', aggressive: '#f44336',
            alert: '#d4a017', sad: '#9e9eff', curious: '#82b1ff'
        };

        Object.entries(report.emotionDistribution)
            .sort((a, b) => b[1] - a[1])
            .forEach(([emotion, pct]) => {
                if (pct > 0) {
                    html += `<div class="emotion-bar-label"><span>${emotion}</span><span>${pct}%</span></div>
                    <div class="emotion-bar"><div class="emotion-bar-fill" style="width:${pct}%;background:${emotionBarColors[emotion] || '#888'}"></div></div>`;
                }
            });
        html += '</div>';
    }

    html += `<div style="margin-top:12px;font-size:11px;color:#888;">
        Movement: ${report.movement.energyLevel} energy | Emotion changes: ${report.emotionChanges} | Duration: ${report.duration}s
    </div></div>`;

    document.getElementById('emotionResultsSection').innerHTML = html;
}

// ── Render Translation Report ──
function renderTranslationReport(report) {
    let html = '<div class="section-title">COMMUNICATION TRANSLATIONS</div>';

    if (report.totalTranslations === 0) {
        html += '<div class="translation-card"><div style="padding:12px;color:#888;">No translations generated. Try a longer scan with your dog visible and audible.</div></div>';
    } else {
        html += `<div class="translation-card">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Primary Message</div>
            <div style="font-size:16px;font-weight:700;color:#e8c547;margin-bottom:8px;">"${report.dominantMessage}"</div>
            <div style="font-size:11px;color:#aaa;font-style:italic;margin-bottom:12px;">${report.dominantScience || ''}</div>
            <div style="font-size:12px;color:#ccc;line-height:1.6;margin-bottom:12px;">${report.communicationSummary}</div>`;

        if (report.communicationBreakdown) {
            const bd = report.communicationBreakdown;
            html += `<div style="display:flex;gap:12px;flex-wrap:wrap;">
                <span class="ind-tag green">Positive: ${bd.positive}%</span>
                <span class="ind-tag red">Distress: ${bd.negative}%</span>
                <span class="ind-tag amber">Alert: ${bd.alert}%</span>
            </div>`;
        }

        html += '</div>';

        // Recent translations log
        if (report.recentTranslations && report.recentTranslations.length > 0) {
            html += '<div style="font-size:11px;color:#888;margin:8px 0;letter-spacing:1px;">RECENT TRANSLATIONS</div>';
            report.recentTranslations.forEach(t => {
                html += `<div class="translation-entry">
                    <div class="t-msg">"${t.message}"</div>
                    <div class="t-meta"><span>${t.code}</span><span>${t.confidence}% confidence</span></div>
                </div>`;
            });
        }
    }

    document.getElementById('translationResultsSection').innerHTML = html;
}

// ── Render Bark Report ──
function renderBarkReport(report) {
    let html = '<div class="section-title">VOCALIZATION ANALYSIS</div>';
    html += `<div class="bark-card"><div class="bark-grid">
        <div class="bark-item"><div class="b-label">Total Barks</div><div class="b-val">${report.barks.total}</div></div>
        <div class="bark-item"><div class="b-label">Bark Rate</div><div class="b-val">${report.barks.rate}/min</div></div>
        <div class="bark-item"><div class="b-label">Avg Frequency</div><div class="b-val">${report.barks.avgFrequency} Hz</div></div>
        <div class="bark-item"><div class="b-label">Avg Duration</div><div class="b-val">${report.barks.avgDuration}ms</div></div>
        <div class="bark-item"><div class="b-label">Dominant Type</div><div class="b-val">${report.barks.dominantType}</div></div>
        <div class="bark-item"><div class="b-label">Intensity</div><div class="b-val">${report.vocalizations.intensity}</div></div>
    </div>`;

    // Bark type distribution
    if (report.barks.typeDistribution && Object.keys(report.barks.typeDistribution).length > 0) {
        html += '<div style="margin-top:12px;"><div style="font-size:11px;color:#888;margin-bottom:6px;">BARK TYPE BREAKDOWN</div>';
        html += '<div class="indicators-row">';
        Object.entries(report.barks.typeDistribution).forEach(([type, count]) => {
            const color = type === 'aggressive' ? 'red' : type === 'anxiety' ? 'orange' :
                          type === 'play' ? 'green' : type === 'alert' ? 'amber' : 'blue';
            html += `<span class="ind-tag ${color}">${type}: ${count}</span>`;
        });
        html += '</div></div>';
    }

    // Recent bark log
    if (report.barkLog && report.barkLog.length > 0) {
        html += '<div style="margin-top:12px;font-size:11px;color:#888;">BARK LOG (last 20)</div>';
        report.barkLog.slice(-10).forEach(b => {
            html += `<div style="font-size:11px;padding:4px 8px;background:#2d2d1a;border-radius:4px;margin-top:4px;display:flex;justify-content:space-between;">
                <span style="color:#ff8a65;font-weight:600;">${b.type.toUpperCase()}</span>
                <span style="color:#888;">${b.freq}Hz | ${b.duration}ms | ${b.time}s</span>
            </div>`;
        });
    }

    html += `<div style="margin-top:8px;font-size:11px;color:#666;">
        Sound ratio: ${report.soundRatio}% | Duration: ${report.totalDuration}s | Spectral centroid: ${report.vocalizations.spectralCentroid} Hz
    </div></div>`;

    document.getElementById('barkResultsSection').innerHTML = html;
}

// ── Render 369 Energy Report ──
function renderEnergyReport(report) {
    let html = '<div class="section-title">369 ENERGY ANALYSIS</div>';
    html += `<div class="energy-card"><div class="energy-grid">
        <div class="energy-item"><div class="e-label">Avg Energy</div><div class="e-val">${report.energy.average}</div></div>
        <div class="energy-item"><div class="e-label">Peak Energy</div><div class="e-val">${report.energy.peak}</div></div>
        <div class="energy-item"><div class="e-label">Total Energy</div><div class="e-val">${report.energy.total}</div></div>
        <div class="energy-item"><div class="e-label">Trend</div><div class="e-val">${report.energy.trend}</div></div>
        <div class="energy-item"><div class="e-label">Completed Cycles</div><div class="e-val">${report.totalCycles}</div></div>
        <div class="energy-item"><div class="e-label">369 Alignment</div><div class="e-val">${report.alignment.ratio}%</div></div>
    </div>`;

    // Pattern analysis
    if (report.patterns && report.patterns.detected) {
        html += `<div style="margin-top:12px;font-size:11px;color:#aaa;">
            <strong style="color:#d4a017;">369 Pattern Detected</strong><br>
            Dominant phase: ${report.patterns.dominantPhase} |
            Creation: ${report.patterns.distribution.creation} |
            Harmony: ${report.patterns.distribution.harmony} |
            Completion: ${report.patterns.distribution.completion}
        </div>`;
    }

    // Vortex position
    html += `<div style="margin-top:8px;font-size:11px;color:#666;">
        Vortex: ${report.vortex.angle}° / radius ${report.vortex.radius} |
        Frames: C:${report.totalFrames.creation} H:${report.totalFrames.harmony} O:${report.totalFrames.completion}
    </div></div>`;

    document.getElementById('energyResultsSection').innerHTML = html;
}

// ── Camera Flip ──
btnFlip.addEventListener('click', async () => {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    if (running && stream) {
        const ok = await startCamera();
        if (!ok) {
            facingMode = facingMode === 'user' ? 'environment' : 'user';
            await startCamera();
        }
        // Re-init bark engine with new stream
        if (micAvailable && stream) {
            try {
                await barkEngine.initAudioContext(stream);
            } catch (e) {
                console.warn('Bark engine re-init failed:', e);
            }
        }
    }
});

// ── Event Listeners ──
btnStart.addEventListener('click', startScan);
btnStop.addEventListener('click', stopScan);
document.getElementById('btnNewScan').addEventListener('click', () => {
    resultsPanel.classList.remove('active');
    // Reset UI
    document.getElementById('translationPanel').style.display = 'none';
    document.getElementById('emotionMetrics').style.display = 'none';
    document.getElementById('energyMetrics').style.display = 'none';
    document.getElementById('formulaBox').style.display = 'none';
    document.getElementById('barkStatus').style.display = 'none';
    document.getElementById('chartSection').style.display = 'none';
    document.getElementById('liveIndicators').style.display = 'none';
    modeBadge.style.display = 'none';
    startScan();
});

// ── Init ──
loadModels();
