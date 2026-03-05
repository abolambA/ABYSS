import Phaser from 'phaser';
import { GP } from '../systems/GamepadManager.js';

/**
 * IntroScene — visual story, beat-by-beat with SFX.
 * SPACE / Cross = advance to next beat (never skips all at once).
 * Circle / D-pad-left = go back to previous beat.
 * Last beat → GameScene tutorial.
 */

const BEATS = [
    {
        key: 'station',
        speaker: 'MARIANA RESEARCH STATION — DAY 1',
        lines: [
            'Research sub ABYSS-7. Depth confirmed: 8,400 m.',
            'All systems nominal. Solo dive — Dr. Nihad.',
            'Beginning specimen survey...',
        ],
        hint_kb: 'SPACE → next',
        hint_gp: '✕ → next   ○ / ← back',
        color: '#5ac8a0',
        visual: 'submarine_normal',
        sfx: 'hum',
    },
    {
        key: 'collision',
        speaker: 'LOG 001 — 02:14:33',
        lines: [
            '[ COLLISION WARNING — UNIDENTIFIED CONTACT ]',
            '"Something hit us. It wasn\'t rock — it MOVED."',
            '"Depth 9,800 m — hull breach — losing pressure—"',
        ],
        hint_kb: 'SPACE → next',
        hint_gp: '✕ → next   ○ / ← back',
        color: '#ff4422',
        visual: 'submarine_crash',
        sfx: 'crash',
        shake: true,
    },
    {
        key: 'wake',
        speaker: 'UNKNOWN TIME — EMERGENCY LIGHTING',
        lines: [
            'You wake in the wreck. Emergency oxygen: 100%.',
            'Rescue beacon: 5 levels below.',
            'Depth: 11,200 m. Deepest any human has survived.',
        ],
        hint_kb: 'SPACE → next',
        hint_gp: '✕ → next   ○ / ← back',
        color: '#4ab890',
        visual: 'player_waking',
        sfx: 'siren',
    },
    {
        key: 'sonar',
        speaker: 'ONBOARD AI — SURVIVAL BRIEF',
        lines: [
            'Your sonar still works. SPACE / ✕ to ping.',
            'Each ping briefly illuminates the world.',
            'WARNING: Every ping echoes. Others will hear it.',
        ],
        hint_kb: 'SPACE → next',
        hint_gp: '✕ → next   ○ / ← back',
        color: '#ccaa44',
        visual: 'sonar_demo',
        sfx: 'ping',
    },
    {
        key: 'objective',
        speaker: 'MISSION OBJECTIVE',
        lines: [
            'Find each beacon. Activate it. Survive.',
            'Avoid the creatures. They patrol in the dark.',
            'Ping — and they will come for you.',
        ],
        hint_kb: 'SPACE → START DIVE',
        hint_gp: '✕ → START DIVE   ○ / ← back',
        color: '#00ffcc',
        visual: 'objective',
        sfx: null,
        isLast: true,
    },
];

export default class IntroScene extends Phaser.Scene {
    constructor() { super({ key: 'IntroScene' }); }

    create() {
        this._beatIndex = 0;
        this._advancing = false;
        this._actx = null;
        // Block for 500ms to avoid mis-fire from menu SPACE
        this._blocked = true;
        this.time.delayedCall(500, () => { this._blocked = false; });

        this._buildBeat(0);

        // Keyboard
        this.input.keyboard.on('keydown-SPACE', () => { if (!this._blocked) this._next(); });
        this.input.keyboard.on('keydown-ESC', () => { if (!this._blocked) this._back(); });

        // Gamepad polling
        this._gpPoll = this.time.addEvent({
            delay: 80, loop: true, callback: () => {
                const gp = window._gp;
                if (!gp?.connected) return;
                gp.poll();
                if (!this._blocked) {
                    if (gp.isJust(GP.CROSS)) this._next();
                    if (gp.isJust(GP.CIRCLE) || gp.isJust(GP.DLEFT)) this._back();
                }
                gp.endFrame();
            }
        });
    }

    shutdown() {
        this._stopAudio();
    }

    // ── NAVIGATION ─────────────────────────────────────────────────
    _next() {
        if (this._advancing) return;
        this._advancing = true;
        const beat = BEATS[this._beatIndex];
        if (beat?.isLast) {
            this._startGame(); return;
        }
        this._beatIndex++;
        this._fadeThen(() => {
            this._advancing = false;
            this._buildBeat(this._beatIndex);
        });
    }

    _back() {
        if (this._advancing) return;
        if (this._beatIndex === 0) {
            // First beat — go back to menu
            this._advancing = true;
            this.cameras.main.fadeOut(400, 0, 8, 16);
            this.time.delayedCall(420, () => this.scene.start('MenuScene'));
            return;
        }
        this._advancing = true;
        this._beatIndex--;
        this._fadeThen(() => {
            this._advancing = false;
            this._buildBeat(this._beatIndex);
        });
    }

    _fadeThen(cb) {
        this.cameras.main.fade(280, 0, 8, 16);
        this.time.delayedCall(300, () => { this.cameras.main.resetFX(); cb(); });
    }

    _startGame() {
        this._stopAudio();
        this.cameras.main.fadeOut(700, 0, 8, 16);
        this.time.delayedCall(720, () => this.scene.start('GameScene', { level: 0, score: 0 }));
    }

    // ── BEAT BUILDER ───────────────────────────────────────────────
    _buildBeat(index) {
        this.children.removeAll(true);
        const beat = BEATS[index];
        if (!beat) { this._startGame(); return; }

        const SW = this.scale.width;
        const SH = this.scale.height;
        const mob = SW < 640;
        const sc = mob ? 0.82 : 1.0;

        // SFX for this beat
        this._playSFX(beat.sfx);

        // BG
        this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000810);
        const g = this.add.graphics();
        g.lineStyle(1, 0x080f18, 1);
        for (let x = 0; x <= SW; x += 32) g.lineBetween(x, 0, x, SH);
        for (let y = 0; y <= SH; y += 32) g.lineBetween(0, y, SW, y);

        // Progress dots
        const dotY = SH - 22;
        for (let i = 0; i < BEATS.length; i++) {
            const dx = SW / 2 - (BEATS.length - 1) * 16 + i * 32;
            const dot = this.add.circle(dx, dotY, i === index ? 6 : (i < index ? 4 : 3),
                i === index ? 0x00ffcc : (i < index ? 0x2a6a4a : 0x0a2a1a));
            if (i === index) this.tweens.add({ targets: dot, alpha: { from: 1, to: 0.3 }, duration: 600, yoyo: true, repeat: -1 });
        }

        // Visual area (top 38% of screen)
        const visH = Math.floor(SH * 0.38);
        this._drawVisual(beat.visual, SW, visH, beat, sc);

        // Speaker
        const spY = visH + 10;
        this.add.text(SW / 2, spY, '[ ' + beat.speaker + ' ]', {
            fontSize: Math.round(11 * sc) + 'px', color: '#2a6a4a', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Story lines — staggered fade-in
        const lineStartY = spY + 26;
        const lineH = mob ? 26 : 30;
        beat.lines.forEach((line, li) => {
            const txt = this.add.text(SW / 2, lineStartY + li * lineH, line, {
                fontSize: Math.round((mob ? 13 : 16) * sc) + 'px',
                color: beat.color, fontFamily: 'monospace',
                wordWrap: { width: Math.min(600, SW - 48) },
                shadow: (li === 0 && !mob) ? { offsetX: 0, offsetY: 0, color: beat.color, blur: 9, fill: true } : undefined,
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: txt, alpha: 1, duration: 450, delay: li * 280 + (beat.shake ? 450 : 0) });
        });

        // Hint / continue
        const hintY = Math.min(lineStartY + beat.lines.length * lineH + 24, SH - 50);
        const gp = window._gp;
        const hint = gp?.connected ? beat.hint_gp : beat.hint_kb;
        const hintC = beat.isLast ? '#00ffcc' : '#1a5a3a';
        const hintTxt = this.add.text(SW / 2, hintY, hint, {
            fontSize: Math.round((mob ? 11 : 14) * sc) + 'px', color: hintC, fontFamily: 'monospace'
        }).setOrigin(0.5).setAlpha(0);

        const hintDelay = beat.lines.length * 280 + 400;
        this.time.delayedCall(hintDelay, () => {
            if (!hintTxt?.active) return;
            this.tweens.add({ targets: hintTxt, alpha: 1, duration: 400 });
            this.tweens.add({ targets: hintTxt, alpha: { from: 1, to: 0.25 }, duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: 600 });
        });

        // Fade in whole screen
        this.cameras.main.setAlpha(0);
        this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 350 });
    }

    // ── VISUALS ────────────────────────────────────────────────────
    _drawVisual(type, SW, visH, beat, sc) {
        const cx = SW / 2, cy = visH / 2;

        if (type === 'submarine_normal') {
            const g = this.add.graphics();
            this._drawSub(g, cx, cy, sc);
            this.tweens.add({ targets: g, y: { from: -5, to: 5 }, duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
            // Sonar pings from sub
            this.time.addEvent({
                delay: 1800, loop: true, callback: () => {
                    const r = this.add.circle(cx + 55 * sc, cy, 4, 0x00ffcc, 0).setStrokeStyle(1, 0x00ffcc, 0.5);
                    this.tweens.add({ targets: r, scaleX: 18, scaleY: 18, alpha: 0, duration: 2200, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
                }
            });
        }

        else if (type === 'submarine_crash') {
            const subG = this.add.graphics();
            this._drawSub(subG, cx - 30 * sc, cy, sc);
            // Creature from right
            const cg = this.add.graphics();
            cg.fillStyle(0x0f0005, 1);
            cg.fillEllipse(cx + 220 * sc, cy, 55 * sc, 45 * sc);
            cg.fillStyle(0xff0033, 0.9);
            cg.fillCircle(cx + 225 * sc, cy - 8 * sc, 12 * sc);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2, r = 30 * sc;
                cg.fillStyle(0x220008, 0.6);
                cg.fillCircle(cx + 220 * sc + Math.cos(a) * r, cy + Math.sin(a) * r, 8 * sc);
            }
            if (beat.shake) {
                this.time.delayedCall(700, () => {
                    this.tweens.add({ targets: cg, x: { from: 0, to: -(190 * sc) }, duration: 480, ease: 'Quad.easeIn' });
                    this.time.delayedCall(480, () => {
                        this.cameras.main.shake(650, 0.028);
                        this.cameras.main.flash(350, 255, 50, 0);
                        for (let i = 0; i < 14; i++) {
                            const sp = this.add.circle(cx - 20 * sc + (Math.random() - 0.5) * 60 * sc, cy + (Math.random() - 0.5) * 40 * sc, 2 + Math.random() * 5, 0xffaa00);
                            const a = Math.random() * Math.PI * 2;
                            this.tweens.add({ targets: sp, x: sp.x + Math.cos(a) * 90 * sc, y: sp.y + Math.sin(a) * 90 * sc, alpha: 0, duration: 600 + Math.random() * 500, onComplete: () => sp.destroy() });
                        }
                        this.tweens.add({ targets: subG, x: { from: 0, to: -(45 * sc) }, angle: { from: 0, to: -12 }, duration: 500, ease: 'Quad.easeOut' });
                    });
                });
            }
        }

        else if (type === 'player_waking') {
            const g = this.add.graphics();
            g.lineStyle(1.5, 0x1a3a2a, 0.35);
            for (let i = 0; i < 9; i++) g.lineBetween(cx - 140 * sc + i * 34 * sc, cy - 45 * sc, cx - 120 * sc + i * 34 * sc, cy + 45 * sc);
            const helmG = this.add.graphics();
            helmG.fillStyle(0x00ffcc, 0.12); helmG.fillCircle(cx, cy, 38 * sc);
            helmG.fillStyle(0x00ffcc, 0.85); helmG.fillCircle(cx + 9 * sc, cy - 6 * sc, 12 * sc);
            this.tweens.add({ targets: helmG, alpha: { from: 0.3, to: 1 }, duration: 1300, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
        }

        else if (type === 'sonar_demo') {
            // Player glyph
            const pg = this.add.graphics();
            pg.fillStyle(0x0a1520, 1); pg.fillCircle(cx, cy, 20 * sc);
            pg.fillStyle(0x00ffcc, 0.85); pg.fillCircle(cx + 6 * sc, cy - 4 * sc, 9 * sc);
            // Creature glyph
            const cg2 = this.add.graphics();
            cg2.fillStyle(0x2a0055, 1); cg2.fillEllipse(cx + 170 * sc, cy, 30 * sc, 38 * sc);
            cg2.fillStyle(0xff0055, 0.9); cg2.fillCircle(cx + 176 * sc, cy - 5 * sc, 9 * sc);
            // Rings
            let ringN = 0;
            const spawnRing = () => {
                if (ringN++ > 120) return;
                const ring = this.add.circle(cx, cy, 4, 0x00ffcc, 0).setStrokeStyle(2, 0x00ffcc, 0.7);
                this.tweens.add({ targets: ring, scaleX: 50, scaleY: 50, alpha: { from: 0.7, to: 0 }, duration: 2000, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
                this.time.delayedCall(900, () => {
                    if (!cg2?.active) return;
                    this.tweens.add({ targets: cg2, alpha: { from: 1, to: 0.1 }, duration: 120, yoyo: true });
                });
            };
            this.time.addEvent({ delay: 1700, loop: true, callback: spawnRing });
            spawnRing();
        }

        else if (type === 'objective') {
            this.add.text(cx, cy - 12 * sc, 'A B Y S S', {
                fontSize: Math.round(40 * sc) + 'px', color: '#00ffcc', fontFamily: 'monospace',
                shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 28, fill: true }
            }).setOrigin(0.5);
            this.add.text(cx, cy + 32 * sc, '11,200 m below the surface', {
                fontSize: Math.round(12 * sc) + 'px', color: '#2a6a4a', fontFamily: 'monospace'
            }).setOrigin(0.5);
            const bigR = this.add.circle(cx, cy, 4, 0x00ffcc, 0).setStrokeStyle(1, 0x00ffcc, 0.28);
            this.tweens.add({ targets: bigR, scaleX: 85, scaleY: 85, alpha: { from: 0.28, to: 0 }, duration: 3800, ease: 'Quad.easeOut', repeat: -1, repeatDelay: 400 });
        }
    }

    _drawSub(g, cx, cy, sc) {
        g.fillStyle(0x0d1e2c, 1); g.fillEllipse(cx, cy, 130 * sc, 38 * sc);
        g.fillStyle(0x0a1525, 1); g.fillEllipse(cx - 30 * sc, cy - 10 * sc, 62 * sc, 24 * sc);
        g.fillStyle(0x00ffcc, 0.7);
        g.fillCircle(cx - 12 * sc, cy, 7 * sc);
        g.fillCircle(cx + 16 * sc, cy, 7 * sc);
        g.fillStyle(0x0d1e2c, 1);
        g.fillRect(cx - 44 * sc, cy - 30 * sc, 9 * sc, 22 * sc);
        g.fillRect(cx - 54 * sc, cy - 32 * sc, 22 * sc, 6 * sc);
        g.fillStyle(0x1a3545, 1);
        g.fillEllipse(cx + 60 * sc, cy, 12 * sc, 22 * sc);
    }

    // ── SFX (Web Audio API — no external files) ────────────────────
    _getACtx() {
        if (!this._actx) {
            try { this._actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
        }
        if (this._actx?.state === 'suspended') { try { this._actx.resume(); } catch (e) { } }
        return this._actx;
    }

    _stopAudio() {
        try { this._actx?.close(); this._actx = null; } catch (e) { }
    }

    _playSFX(type) {
        const ctx = this._getACtx();
        if (!ctx) return;

        try {
            if (type === 'hum') {
                // Submarine engine drone
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine'; osc.frequency.value = 55;
                g.gain.setValueAtTime(0, ctx.currentTime);
                g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);
                g.gain.linearRampToValueAtTime(0, ctx.currentTime + 4.5);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(); osc.stop(ctx.currentTime + 5);

                const osc2 = ctx.createOscillator();
                const g2 = ctx.createGain();
                osc2.type = 'sawtooth'; osc2.frequency.value = 110;
                g2.gain.setValueAtTime(0, ctx.currentTime);
                g2.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 2);
                g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
                osc2.connect(g2); g2.connect(ctx.destination);
                osc2.start(); osc2.stop(ctx.currentTime + 4.5);
            }

            else if (type === 'crash') {
                // Warning beep first (submarine alert)
                for (let i = 0; i < 3; i++) {
                    const w = ctx.createOscillator(); const wg = ctx.createGain();
                    w.type = 'square'; w.frequency.value = 1100;
                    wg.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.35);
                    wg.gain.setValueAtTime(0, ctx.currentTime + i * 0.35 + 0.18);
                    w.connect(wg); wg.connect(ctx.destination);
                    w.start(ctx.currentTime + i * 0.35);
                    w.stop(ctx.currentTime + i * 0.35 + 0.18);
                }

                // Collision boom — starts at 1.1s
                const t0 = ctx.currentTime + 1.1;
                // White noise burst
                const sr = ctx.sampleRate;
                const buf = ctx.createBuffer(1, sr * 1.8, sr);
                const data = buf.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
                const noise = ctx.createBufferSource();
                noise.buffer = buf;
                const flt = ctx.createBiquadFilter();
                flt.type = 'lowpass'; flt.frequency.value = 300;
                const ng = ctx.createGain();
                ng.gain.setValueAtTime(0.9, t0);
                ng.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
                noise.connect(flt); flt.connect(ng); ng.connect(ctx.destination);
                noise.start(t0); noise.stop(t0 + 1.8);

                // Low boom
                const boom = ctx.createOscillator(); const bg = ctx.createGain();
                boom.frequency.setValueAtTime(90, t0);
                boom.frequency.exponentialRampToValueAtTime(18, t0 + 1.4);
                bg.gain.setValueAtTime(0.7, t0);
                bg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
                boom.connect(bg); bg.connect(ctx.destination);
                boom.start(t0); boom.stop(t0 + 1.5);

                // Metal scrape
                const scrape = ctx.createOscillator(); const sg2 = ctx.createGain();
                scrape.type = 'sawtooth';
                scrape.frequency.setValueAtTime(440, t0);
                scrape.frequency.exponentialRampToValueAtTime(80, t0 + 0.6);
                sg2.gain.setValueAtTime(0.2, t0);
                sg2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
                scrape.connect(sg2); sg2.connect(ctx.destination);
                scrape.start(t0); scrape.stop(t0 + 0.7);
            }

            else if (type === 'siren') {
                // Emergency alarm: repeating two-tone siren
                for (let rep = 0; rep < 4; rep++) {
                    const t0 = ctx.currentTime + rep * 0.7;
                    const hi = ctx.createOscillator(); const hg = ctx.createGain();
                    hi.type = 'sawtooth'; hi.frequency.value = 880;
                    hg.gain.setValueAtTime(0.28, t0); hg.gain.setValueAtTime(0, t0 + 0.28);
                    hi.connect(hg); hg.connect(ctx.destination);
                    hi.start(t0); hi.stop(t0 + 0.28);

                    const lo = ctx.createOscillator(); const lg = ctx.createGain();
                    lo.type = 'sawtooth'; lo.frequency.value = 660;
                    lg.gain.setValueAtTime(0.22, t0 + 0.32); lg.gain.setValueAtTime(0, t0 + 0.60);
                    lo.connect(lg); lg.connect(ctx.destination);
                    lo.start(t0 + 0.32); lo.stop(t0 + 0.62);
                }
                // Background dread drone
                const drone = ctx.createOscillator(); const dg = ctx.createGain();
                drone.type = 'sine'; drone.frequency.value = 44;
                dg.gain.setValueAtTime(0, ctx.currentTime);
                dg.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1);
                dg.gain.linearRampToValueAtTime(0, ctx.currentTime + 4);
                drone.connect(dg); dg.connect(ctx.destination);
                drone.start(); drone.stop(ctx.currentTime + 4.5);
            }

            else if (type === 'ping') {
                // Sonar demonstration ping
                const osc = ctx.createOscillator(); const g = ctx.createGain();
                osc.type = 'sine'; osc.frequency.value = 1200;
                g.gain.setValueAtTime(0.4, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(); osc.stop(ctx.currentTime + 0.9);
            }
        } catch (e) { console.warn('[ABYSS] SFX error:', e); }
    }
}