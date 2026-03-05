export default class Audio {
    constructor() {
        this.ctx = null;
        this.running = false;
        this.beatInterval = 1600;
        this.melodyStep = 0;
        this.beatTimeout = null;
        this.melodyTimeout = null;
        this.masterGain = null;
        this.droneOsc = null;
        this.droneOsc2 = null;
        this.lfoNode = null;
        this.droneGainNode = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.ctx.destination);
    }

    startMusic() {
        this.init();
        if (this.running) return;
        this.running = true;
        const ctx = this.ctx;

        this.droneOsc = ctx.createOscillator();
        const droneG = ctx.createGain();
        const droneFilt = ctx.createBiquadFilter();
        droneFilt.type = 'lowpass'; droneFilt.frequency.value = 200;
        this.droneOsc.type = 'sawtooth'; this.droneOsc.frequency.value = 55;
        droneG.gain.value = 0.12;
        this.droneGainNode = droneG;
        this.droneOsc.connect(droneFilt); droneFilt.connect(droneG); droneG.connect(this.masterGain);
        this.droneOsc.start();

        this.droneOsc2 = ctx.createOscillator();
        const drone2G = ctx.createGain();
        this.droneOsc2.type = 'sine'; this.droneOsc2.frequency.value = 57.5;
        drone2G.gain.value = 0.08;
        this.droneOsc2.connect(drone2G); drone2G.connect(this.masterGain);
        this.droneOsc2.start();

        this.lfoNode = ctx.createOscillator();
        const lfoG = ctx.createGain();
        const shimOsc = ctx.createOscillator();
        const shimG = ctx.createGain();
        this.lfoNode.frequency.value = 0.3; this.lfoNode.type = 'sine';
        lfoG.gain.value = 0.025;
        shimOsc.type = 'sine'; shimOsc.frequency.value = 165;
        shimG.gain.value = 0.04;
        this.lfoNode.connect(lfoG); lfoG.connect(shimG.gain);
        shimOsc.connect(shimG); shimG.connect(this.masterGain);
        this.lfoNode.start(); shimOsc.start();

        this._scheduleBeat();
        this._scheduleMelody();
    }

    _getMelodyNote(step) {
        const phrases = [
            [220, 0.6], [196, 0.4], [174.6, 0.8], [164.8, 0.4],
            [146.8, 0.6], [130.8, 0.4], [123.5, 0.4], [110, 1.2],
            [110, 0.4], [123.5, 0.3], [130.8, 0.3], [146.8, 0.4],
            [164.8, 0.3], [174.6, 0.6], [196, 0.4], [220, 0.8],
            [220, 0.2], [0, 0.2], [220, 0.2], [0, 0.2],
            [174.6, 0.3], [0, 0.15], [164.8, 0.5], [130.8, 0.8],
            [146.8, 0.4], [130.8, 0.3], [123.5, 0.3], [110, 0.4],
            [123.5, 0.3], [130.8, 0.3], [146.8, 0.3], [110, 1.0],
        ];
        return phrases[step % phrases.length];
    }

    _scheduleMelody() {
        if (!this.running) return;
        const [freq, beats] = this._getMelodyNote(this.melodyStep);
        const duration = beats * (this.beatInterval / 1000);
        if (freq > 0) this._playMelodyNote(freq, duration * 0.85);
        this.melodyStep++;
        this.melodyTimeout = setTimeout(() => this._scheduleMelody(), duration * 1000);
    }

    _playMelodyNote(freq, dur) {
        if (!this.ctx || !this.masterGain) return;
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass'; filt.frequency.value = freq * 1.5; filt.Q.value = 2;
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.07, ctx.currentTime + Math.max(0.06, dur - 0.1));
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
        osc.connect(filt); filt.connect(gain); gain.connect(this.masterGain);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.05);
    }

    _scheduleBeat() {
        if (!this.running) return;
        this._playHeartbeat();
        this.beatTimeout = setTimeout(() => this._scheduleBeat(), this.beatInterval);
    }

    _playHeartbeat() {
        if (!this.ctx) return;
        this._thump(0, 0.55, 90);
        setTimeout(() => this._thump(0, 0.32, 70), 160);
    }

    _thump(delay, vol, cutoff) {
        if (!this.ctx || !this.masterGain) return;
        const ctx = this.ctx;
        const dur = 0.18;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 5);
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = cutoff;
        src.buffer = buf;
        src.connect(filt); filt.connect(gain); gain.connect(this.masterGain);
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.start(t);
    }

    // ── SMOOTH DYNAMIC DANGER MUSIC ──────────────────────────────
    // Called every frame — beat interval updates continuously with quadratic easing
    setDanger(dist, dangerDist, heartbeatDist) {
        if (!this.running || !this.ctx) return;
        const t = this.ctx.currentTime;
        let newInterval;

        if (dist < dangerDist) {
            // Immediate danger — max pulse 240ms
            newInterval = 240;
            if (this.lfoNode) this.lfoNode.frequency.setTargetAtTime(7, t, 0.1);
            if (this.droneGainNode) this.droneGainNode.gain.setTargetAtTime(0.28, t, 0.15);
        } else if (dist < heartbeatDist) {
            // Quadratic easing — stays calm far away, rockets near danger
            const ratio = (dist - dangerDist) / (heartbeatDist - dangerDist); // 0=danger, 1=safe
            const eased = Math.pow(ratio, 0.6); // ease out — speeds up faster when approaching
            newInterval = Math.floor(240 + eased * 1300);
            const lfoFreq = 0.4 + (1 - eased) * 6.6;
            if (this.lfoNode) this.lfoNode.frequency.setTargetAtTime(lfoFreq, t, 0.15);
            if (this.droneGainNode) this.droneGainNode.gain.setTargetAtTime(0.12 + (1 - eased) * 0.14, t, 0.2);
        } else {
            newInterval = 1600;
            if (this.lfoNode) this.lfoNode.frequency.setTargetAtTime(0.3, t, 1.5);
            if (this.droneGainNode) this.droneGainNode.gain.setTargetAtTime(0.12, t, 1.0);
        }

        // If interval changed by more than 15% — interrupt and reschedule immediately
        const change = Math.abs(newInterval - this.beatInterval) / this.beatInterval;
        this.beatInterval = newInterval;
        if (change > 0.15) {
            clearTimeout(this.beatTimeout);
            this._scheduleBeat();
        }
    }

    stopMusic() {
        this.running = false;
        clearTimeout(this.beatTimeout);
        clearTimeout(this.melodyTimeout);
        try { this.droneOsc?.stop(); } catch (e) { }
        try { this.droneOsc2?.stop(); } catch (e) { }
        try { this.lfoNode?.stop(); } catch (e) { }
        this.droneOsc = this.droneOsc2 = this.lfoNode = null;
        if (this.ctx) { this.ctx.close(); this.ctx = null; this.masterGain = null; }
    }

    // ── WARNING — horror submarine alarm ─────────────────────────
    warning() {
        this.init();
        const ctx = this.ctx;

        // Primary descending sweep — like a sub dive alarm
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const dist1 = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i * 2) / 256 - 1;
            curve[i] = (Math.PI + 60) * x / (Math.PI + 60 * Math.abs(x));
        }
        dist1.curve = curve;
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(1400, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.55);
        gain1.gain.setValueAtTime(0.14, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc1.connect(dist1); dist1.connect(gain1); gain1.connect(ctx.destination);
        osc1.start(); osc1.stop(ctx.currentTime + 0.6);

        // High shriek — detuned square wave
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.04);
        osc2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
        gain2.gain.setValueAtTime(0.07, ctx.currentTime + 0.04);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.04); osc2.stop(ctx.currentTime + 0.45);

        // Sub-bass thud — filtered noise punch
        const noiseLen = Math.floor(ctx.sampleRate * 0.35);
        const nBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
        const nData = nBuf.getChannelData(0);
        for (let i = 0; i < noiseLen; i++)
            nData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 2.5);
        const nSrc = ctx.createBufferSource();
        const nGain = ctx.createGain();
        const nFilt = ctx.createBiquadFilter();
        nFilt.type = 'lowpass'; nFilt.frequency.value = 90;
        nSrc.buffer = nBuf;
        nSrc.connect(nFilt); nFilt.connect(nGain); nGain.connect(ctx.destination);
        nGain.gain.setValueAtTime(0.5, ctx.currentTime);
        nGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        nSrc.start(); nSrc.stop(ctx.currentTime + 0.4);

        // Second stab after 0.6s
        setTimeout(() => {
            if (!this.ctx) return;
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(900, this.ctx.currentTime);
            o.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.4);
            g.gain.setValueAtTime(0.1, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
            o.connect(g); g.connect(this.ctx.destination);
            o.start(); o.stop(this.ctx.currentTime + 0.45);
        }, 600);
    }

    win() {
        this.init();
        const ctx = this.ctx;
        [[523.25, 0], [659.25, 0.18], [783.99, 0.36], [1046.5, 0.54], [783.99, 0.78], [1046.5, 0.96]]
            .forEach(([freq, t]) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square'; osc.frequency.value = freq;
                osc.connect(gain); gain.connect(ctx.destination);
                const start = ctx.currentTime + t;
                gain.gain.setValueAtTime(0.18, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + (t < 0.78 ? 0.16 : 0.5));
                osc.start(start); osc.stop(start + 0.55);
            });
        [523.25, 659.25, 783.99].forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle'; osc.frequency.value = freq;
            osc.connect(gain); gain.connect(ctx.destination);
            const t = ctx.currentTime + 1.3;
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
            osc.start(t); osc.stop(t + 1.3);
        });
    }

    lose() {
        this.init();
        const ctx = this.ctx;
        [[466.16, 0, 0.35], [440.00, 0.3, 0.35], [415.30, 0.6, 0.35], [391.99, 0.9, 0.8]]
            .forEach(([freq, delay, dur]) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filt = ctx.createBiquadFilter();
                filt.type = 'lowpass'; filt.frequency.value = 800;
                osc.type = 'sawtooth'; osc.frequency.value = freq;
                osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
                const t = ctx.currentTime + delay;
                gain.gain.setValueAtTime(0.22, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
                osc.start(t); osc.stop(t + dur + 0.05);
            });
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(130, ctx.currentTime + 1.7);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 2.4);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + 1.7);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + 1.7); osc.stop(ctx.currentTime + 2.6);
    }

    sonar() {
        this.init();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1.2);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
        osc.start(); osc.stop(ctx.currentTime + 1.5);
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(220, ctx.currentTime + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 1.4);
        g2.gain.setValueAtTime(0.08, ctx.currentTime + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
        osc2.start(ctx.currentTime + 0.1); osc2.stop(ctx.currentTime + 1.7);
    }

    oxygen() {
        this.init();
        const ctx = this.ctx;
        [0, 0.12, 0.24].forEach((delay, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.value = [440, 550, 660][i];
            const t = ctx.currentTime + delay;
            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
            osc.start(t); osc.stop(t + 0.3);
        });
    }

    growl() {
        this.init();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const dist = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i * 2) / 256 - 1;
            curve[i] = (Math.PI + 80) * x / (Math.PI + 80 * Math.abs(x));
        }
        dist.curve = curve;
        osc.connect(dist); dist.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, ctx.currentTime);
        osc.frequency.setValueAtTime(45, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.55);
    }
}