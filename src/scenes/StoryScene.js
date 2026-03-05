import Phaser from 'phaser';
import { GP } from '../systems/GamepadManager.js';

/**
 * StoryScene — between-level radio logs.
 * SPACE / ✕ reveals next line. After all lines, advances to level.
 * Circle / D-pad LEFT = skip to level immediately.
 * Ambient SFX: underwater drone + tension pulses.
 */

const STORY_BEATS = [
    {
        speaker: 'NIHAD — LOG 001', color: '#4ab890', nextHint: 'Signal active. Beginning real descent — Zone 1.', lines: [
            'The training protocols kicked in before I even thought.',
            'But this isn\'t training anymore.',
            'I saw one of them in the dark. It stopped moving.',
            'It tilted its head — studying me.',
            'I don\'t think I was supposed to survive the crash.',
        ]
    },
    {
        speaker: 'NIHAD — LOG 002', color: '#4ab890', nextHint: 'Signal stronger. The passages narrow ahead.', lines: [
            'Beacon One activated. Surface rescue ETA: unknown.',
            'These creatures... they\'re not hunting for food.',
            'They patrol in patterns. They guard specific corridors.',
            'Something down here is worth protecting.',
            'I have to find out what before my oxygen runs out.',
        ]
    },
    {
        speaker: 'NIHAD — LOG 003', color: '#5ab890', nextHint: 'Something has been following your sonar trace.', lines: [
            'These passages were cut. Not by water. Not by time.',
            'By something that understood architecture and purpose.',
            'The walls have markings I can\'t read.',
            'The creatures stop at certain points. Won\'t cross them.',
            'This place was BUILT. I\'m walking through someone\'s home.',
        ]
    },
    {
        speaker: 'NIHAD — LOG 004', color: '#cc8844', nextHint: 'You are being watched. You always have been.', lines: [
            'Seven of them tracked me through the labyrinth.',
            'But they stopped at the south wall. Every single one.',
            'They pressed themselves against it and went completely still.',
            'Reverent. That\'s the only word I have.',
            'Whatever is at the bottom — they worship it.',
        ]
    },
    {
        speaker: 'NIHAD — LOG 005', color: '#cc6622', nextHint: '⚠  Final depth. The Abyss awaits. No turning back.', lines: [
            '11,200 meters. Deeper than any human has gone and returned.',
            'One beacon left. One zone below.',
            'My hands won\'t stop shaking.',
            'There\'s a sound coming up from below. Not mechanical.',
            'Not any animal I know of. It sounds like... breathing.',
        ]
    },
];

export default class StoryScene extends Phaser.Scene {
    constructor() { super({ key: 'StoryScene' }); }

    init(data) {
        this.beat = data.beat ?? 0;
        this.nextLevel = data.nextLevel ?? 1;
        this.score = data.score ?? 0;
    }

    create() {
        const SW = this.scale.width, SH = this.scale.height;
        const mob = SW < 640, sc = mob ? 0.82 : 1.0;
        this._done = false;
        this._lineIndex = -1;
        this._revealing = false;
        this._blocked = true;
        this._actx = null;
        this.time.delayedCall(400, () => { this._blocked = false; });

        const bd = STORY_BEATS[this.beat];
        if (!bd) { this._advance(); return; }
        this._bd = bd;

        // Start ambient SFX
        this._startAmbient();

        // BG
        this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000810);
        const g = this.add.graphics();
        g.lineStyle(1, 0x080f18, 1);
        for (let x = 0; x <= SW; x += 32) g.lineBetween(x, 0, x, SH);
        for (let y = 0; y <= SH; y += 32) g.lineBetween(0, y, SW, y);

        // Sonar rings
        this.time.addEvent({ delay: 2800, loop: true, callback: this._spawnRing, callbackScope: this });
        this._spawnRing();

        const panelW = Math.min(600, SW - 40), panelH = mob ? SH * 0.72 : 390;
        this.add.rectangle(SW / 2, SH / 2 - 20, panelW, panelH, 0x030c12).setStrokeStyle(1, 0x1a4a3a, 1);

        // Speaker
        this.add.text(SW / 2, SH / 2 - panelH / 2 - 18, '[ ' + bd.speaker + ' ]', {
            fontSize: Math.round(11 * sc) + 'px', color: '#2a6a4a', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Line positions
        const lineGap = mob ? 28 : 34;
        this._lineY = bd.lines.map((_, i) => SH / 2 - (bd.lines.length - 1) * lineGap / 2 - 20 + i * lineGap);

        // Score
        this.add.text(SW / 2, SH / 2 + panelH / 2 + 12, 'SCORE: ' + this.score, {
            fontSize: Math.round(11 * sc) + 'px', color: '#1a4a3a', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Hint text
        const gp = window._gp;
        const cross = gp?.connected ? (gp.isPS5() ? '✕' : 'A') : 'SPACE';
        const back = gp?.connected ? (gp.isPS5() ? '○ / ←' : 'B / ←') : 'ESC';
        this._hintTxt = this.add.text(SW / 2, SH / 2 + panelH / 2 + 34,
            cross + ' next line   ' + back + ' skip to level', {
            fontSize: Math.round(12 * sc) + 'px', color: '#1a5a3a', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.tweens.add({ targets: this._hintTxt, alpha: { from: 1, to: 0.2 }, duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

        // Controller hint row
        if (gp?.connected) {
            this.add.text(SW - 14, SH - 14, '🎮  ' + cross + ' next line  ' + back + ' skip', {
                fontSize: '10px', color: '#1a3a2a', fontFamily: 'monospace'
            }).setOrigin(1, 1);
        }

        // Input
        this.input.keyboard.on('keydown-SPACE', () => { if (!this._blocked) this._onPress(); });
        this.input.keyboard.on('keydown-ESC', () => { if (!this._blocked) this._advance(); });
        this.input.on('pointerdown', () => { if (!this._blocked) this._onPress(); });

        if (gp?.connected) {
            this._gpPoll = this.time.addEvent({
                delay: 80, loop: true, callback: () => {
                    gp.poll();
                    if (!this._blocked) {
                        if (gp.isJust(GP.CROSS)) this._onPress();
                        if (gp.isJust(GP.CIRCLE) || gp.isJust(GP.DLEFT)) this._advance();
                    }
                    gp.endFrame();
                }
            });
        }

        // Auto-reveal first line after 800ms
        this.time.delayedCall(800, () => { this._blocked = false; this._revealNextLine(); });
    }

    shutdown() { this._stopAudio(); }

    _onPress() {
        if (this._revealing || this._done) return;
        if (this._lineIndex >= this._bd.lines.length - 1) { this._advance(); return; }
        this._revealNextLine();
    }

    _revealNextLine() {
        if (this._revealing) return;
        this._lineIndex++;
        if (this._lineIndex >= this._bd.lines.length) { this._advance(); return; }
        this._revealing = true;

        const SW = this.scale.width, mob = SW < 640, sc = mob ? 0.82 : 1.0;
        const line = this._bd.lines[this._lineIndex];
        const y = this._lineY[this._lineIndex];
        const isLast = this._lineIndex === this._bd.lines.length - 1;

        const gp = window._gp, cross = gp?.connected ? (gp.isPS5() ? '✕' : 'A') : 'SPACE';

        const txt = this.add.text(SW / 2 - Math.min(270, SW / 2 - 22), y, '', {
            fontSize: Math.round((mob ? 13 : 15) * sc) + 'px',
            color: this._bd.color, fontFamily: 'monospace',
            wordWrap: { width: Math.min(540, SW - 60) }
        }).setAlpha(0);
        this.tweens.add({
            targets: txt, alpha: 1, duration: 300, onComplete: () => {
                this._typewriter(txt, line, 22, () => {
                    this._revealing = false;
                    if (isLast) {
                        this._hintTxt.setText(cross + ' → ' + this._bd.nextHint);
                        this._hintTxt.setColor('#00ffcc');
                    } else {
                        this._hintTxt.setText(cross + ' → next line  (' + (this._lineIndex + 1) + '/' + this._bd.lines.length + ')');
                        this._hintTxt.setColor('#1a5a3a');
                    }
                });
            }
        });
    }

    _typewriter(obj, text, delay, onDone) {
        let i = 0;
        const iv = setInterval(() => {
            if (!obj?.active) { clearInterval(iv); onDone?.(); return; }
            obj.setText(text.substring(0, ++i));
            if (i >= text.length) { clearInterval(iv); onDone?.(); }
        }, delay);
    }

    _spawnRing() {
        const SW = this.scale.width, SH = this.scale.height;
        const r = this.add.circle(SW / 2, SH / 2, 4, 0x00ffcc, 0).setStrokeStyle(1, 0x00ffcc, 0.22);
        this.tweens.add({ targets: r, scaleX: 55, scaleY: 55, alpha: { from: 0.22, to: 0 }, duration: 3500, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }

    _advance() {
        if (this._done) return;
        this._done = true;
        this._stopAudio();
        this.cameras.main.fadeOut(600, 0, 8, 16);
        this.time.delayedCall(620, () => this.scene.start('LevelTransition', { level: this.nextLevel, score: this.score }));
    }

    // ── SFX (Web Audio API) ──────────────────────────────────────
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

    _startAmbient() {
        const ctx = this._getACtx();
        if (!ctx) return;
        try {
            // Deep underwater drone
            const master = ctx.createGain(); master.gain.value = 0.0;
            master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
            master.connect(ctx.destination);

            const bass = ctx.createOscillator();
            bass.type = 'sine'; bass.frequency.value = 36;
            const bassG = ctx.createGain(); bassG.gain.value = 0.18;
            bass.connect(bassG); bassG.connect(master); bass.start();

            const mid = ctx.createOscillator();
            mid.type = 'sine'; mid.frequency.value = 72;
            const midG = ctx.createGain(); midG.gain.value = 0.06;
            mid.connect(midG); midG.connect(master); mid.start();

            // Tension pulse (soft heartbeat-like thump)
            const schedPulse = (t) => {
                if (!this._actx) return;
                const b = ctx.createOscillator(); const bg = ctx.createGain();
                b.type = 'sine'; b.frequency.value = 55;
                bg.gain.setValueAtTime(0, t);
                bg.gain.linearRampToValueAtTime(0.09, t + 0.05);
                bg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
                b.connect(bg); bg.connect(master); b.start(t); b.stop(t + 0.5);
            };

            // Pulsing rumble tied to beat number (higher beats = more tense)
            const interval = 3.5 - this.beat * 0.25;
            const schedAll = () => {
                if (!this._actx) return;
                const now = ctx.currentTime;
                for (let i = 0; i < 4; i++) schedPulse(now + i * interval);
                this._pulseTimeout = setTimeout(schedAll, interval * 4 * 1000 - 50);
            };
            schedAll();

            this._masterNode = master;
            this._bassOsc = bass;
            this._midOsc = mid;
        } catch (e) { }
    }
}