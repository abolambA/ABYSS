import Phaser from 'phaser';
import { GP } from '../systems/GamepadManager.js';

/**
 * OutroScene — plays after completing Level 5 (the Abyss).
 * Space-to-advance typewriter style, like StoryScene.
 * Visual: particles ascend upward (bubbles / rising from the deep).
 */

const OUTRO_LINES = [
    { speaker: 'NIHAD — FINAL LOG', text: 'Beacon Five: activated. Rescue sub: 4 minutes.', color: '#4ab890' },
    { speaker: '', text: 'And then I saw it.', color: '#4ab890' },
    { speaker: '', text: 'At the bottom of everything — a light.', color: '#cc8844' },
    { speaker: '', text: 'Not bioluminescent. Not mechanical.', color: '#cc8844' },
    { speaker: '', text: 'Alive. Ancient. Aware.', color: '#cc8844' },
    { speaker: '', text: 'It opened its eye.', color: '#cc6633' },
    { speaker: '', text: 'I ran.', color: '#cc6633' },
    { speaker: '', text: 'The creatures didn\'t follow.', color: '#cc6633' },
    { speaker: '', text: 'They stepped aside. They let me leave.', color: '#cc6633' },
    { speaker: '', text: 'As the rescue sub pulled me up,', color: '#aa4422' },
    { speaker: '', text: 'I looked down through the porthole.', color: '#aa4422' },
    { speaker: '', text: 'The passages were closing.', color: '#aa4422' },
    { speaker: '', text: 'Like a door.', color: '#aa4422' },
    { speaker: '', text: 'Like a choice.', color: '#aa4422' },
    { speaker: 'SURFACE — 6 HOURS LATER', text: '"Researcher recovered. Sub lost. Depth: classified."', color: '#3a8a6a' },
    { speaker: '', text: '"Recommend immediate closure of Mariana sector."', color: '#3a8a6a' },
    { speaker: '', text: '"Subject\'s account: unverifiable."', color: '#3a8a6a' },
    { speaker: '', text: 'They closed the file.', color: '#4ab890' },
    { speaker: '', text: 'But I know what I saw.', color: '#4ab890' },
    { speaker: '', text: 'And I know it saw me too.', color: '#00ffcc', isLast: true },
];

export default class OutroScene extends Phaser.Scene {
    constructor() { super({ key: 'OutroScene' }); }

    init(data) {
        this.finalScore = data.score ?? 0;
    }

    create() {
        const SW = this.scale.width, SH = this.scale.height;
        const mob = SW < 640, sc = mob ? 0.82 : 1.0;
        this._done = false;
        this._lineIndex = -1;
        this._revealing = false;
        this._blocked = true;
        this._displayedLines = [];
        this._currentSpeakerTxt = null;

        // ── BACKGROUND ────────────────────────────────────────
        // Deep ocean dark background
        this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000510);

        // Grid
        const g = this.add.graphics();
        g.lineStyle(1, 0x060c0a, 1);
        for (let x = 0; x <= SW; x += 32) g.lineBetween(x, 0, x, SH);
        for (let y = 0; y <= SH; y += 32) g.lineBetween(0, y, SW, y);

        // ── VISUAL: Rising bubbles (ascending from the abyss) ─
        this._bubbles = [];
        this.time.addEvent({ delay: 400, loop: true, callback: this._spawnBubble, callbackScope: this });

        // ── VISUAL: Sonar ring (ominous pulse from below) ─────
        this.time.addEvent({ delay: 4000, loop: true, callback: this._spawnRing, callbackScope: this });
        this._spawnRing();

        // ── VISUAL: Faint glow at bottom of screen (the Eye) ─
        const glow = this.add.graphics();
        glow.fillStyle(0xffaa00, 0.04);
        glow.fillEllipse(SW / 2, SH + 20, SW * 1.4, SH * 0.6);
        // Pulse the glow
        this.tweens.add({ targets: glow, alpha: { from: 0.6, to: 1.4 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // ── PANEL ─────────────────────────────────────────────
        const panelW = Math.min(620, SW - 40);
        const panelH = mob ? SH * 0.72 : 400;
        const panelY = SH / 2 - 20;
        this._panelBg = this.add.rectangle(SW / 2, panelY, panelW, panelH, 0x030c12, 0.95)
            .setStrokeStyle(1, 0x1a4a3a, 1);

        // Speaker label (updates as story progresses)
        this._speakerTxt = this.add.text(SW / 2, panelY - panelH / 2 - 18, '', {
            fontSize: Math.round(11 * sc) + 'px', color: '#2a6a4a', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Hint text
        const gp = window._gp;
        const cross = gp?.connected ? (gp.isPS5() ? '✕' : 'A') : 'SPACE';
        this._hintTxt = this.add.text(SW / 2, panelY + panelH / 2 + 32,
            cross + ' — next line', {
            fontSize: Math.round(12 * sc) + 'px', color: '#1a5a3a', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.tweens.add({ targets: this._hintTxt, alpha: { from: 1, to: 0.2 }, duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });

        // Computed line positions within panel
        const lineCount = 8; // max visible lines
        const lineGap = mob ? 28 : 36;
        const totalH = (lineCount - 1) * lineGap;
        this._lineYStart = panelY - totalH / 2;
        this._lineGap = lineGap;
        this._panelW = panelW;
        this._sc = sc;
        this._mob = mob;

        // Input
        this.time.delayedCall(500, () => {
            this._blocked = false;
            this._revealNextLine();
        });
        this.input.keyboard.on('keydown-SPACE', () => { if (!this._blocked) this._onPress(); });
        this.input.on('pointerdown', () => { if (!this._blocked) this._onPress(); });

        if (gp?.connected) {
            this._gpPoll = this.time.addEvent({
                delay: 80, loop: true, callback: () => {
                    gp.poll();
                    if (!this._blocked && gp.isJust(GP.CROSS)) this._onPress();
                    gp.endFrame();
                }
            });
        }
    }

    _onPress() {
        if (this._revealing) return;
        if (this._done) {
            this.cameras.main.fadeOut(800, 0, 8, 16);
            this.time.delayedCall(820, () => this.scene.start('MenuScene'));
            return;
        }
        this._revealNextLine();
    }

    _revealNextLine() {
        if (this._revealing) return;
        this._lineIndex++;

        if (this._lineIndex >= OUTRO_LINES.length) {
            this._showEnding();
            return;
        }

        this._revealing = true;
        const SW = this.scale.width;
        const entry = OUTRO_LINES[this._lineIndex];
        const gp = window._gp, cross = gp?.connected ? (gp.isPS5() ? '✕' : 'A') : 'SPACE';

        // Update speaker label if changed
        if (entry.speaker && entry.speaker !== this._lastSpeaker) {
            this._speakerTxt.setText('[ ' + entry.speaker + ' ]');
            this._lastSpeaker = entry.speaker;
        } else if (!entry.speaker && this._lineIndex === 0) {
            this._speakerTxt.setText('');
        }

        // Shift existing lines up if we have too many
        if (this._displayedLines.length >= 8) {
            const old = this._displayedLines.shift();
            this.tweens.add({
                targets: old, alpha: 0, y: old.y - 24, duration: 300,
                onComplete: () => { try { old.destroy(); } catch (e) { } }
            });
        }

        // Shift existing lines UP to make room
        this._displayedLines.forEach((t, idx) => {
            this.tweens.add({ targets: t, y: this._lineYStart + idx * this._lineGap, duration: 250 });
        });

        // New line position = bottom of current stack
        const newY = this._lineYStart + this._displayedLines.length * this._lineGap;

        const txt = this.add.text(
            SW / 2 - Math.min(280, SW / 2 - 24), newY, '', {
            fontSize: Math.round((this._mob ? 13 : 15) * this._sc) + 'px',
            color: entry.color, fontFamily: 'monospace',
            wordWrap: { width: Math.min(560, SW - 60) }
        }).setAlpha(0);

        this._displayedLines.push(txt);

        this.tweens.add({
            targets: txt, alpha: 1, duration: 300, onComplete: () => {
                this._typewriter(txt, entry.text, 20, () => {
                    this._revealing = false;
                    if (entry.isLast) {
                        this._hintTxt.setText(cross + ' — see your results');
                        this._hintTxt.setColor('#00ffcc');
                        this._done = true;
                    } else {
                        const remaining = OUTRO_LINES.length - this._lineIndex - 1;
                        this._hintTxt.setText(cross + ' — next  (' + (this._lineIndex + 1) + '/' + OUTRO_LINES.length + ')');
                        this._hintTxt.setColor('#1a5a3a');
                    }
                });
            }
        });
    }

    _showEnding() {
        const SW = this.scale.width, SH = this.scale.height;
        this._done = true;
        this._hintTxt.destroy();

        // Fade everything out
        this.cameras.main.fade(2000, 0, 3, 5);
        this.time.delayedCall(2200, () => {
            this.cameras.main.resetFX();
            this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000305);

            const title = this.add.text(SW / 2, SH / 2 - 90, 'ABYSS', {
                fontSize: '72px', color: '#00ffcc', fontFamily: 'monospace',
                shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 30, fill: true }
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: title, alpha: 1, duration: 1200, ease: 'Quad.easeIn' });

            this.time.delayedCall(600, () => {
                const survived = this.add.text(SW / 2, SH / 2 - 20, 'you survived the descent', {
                    fontSize: '16px', color: '#2a6a4a', fontFamily: 'monospace'
                }).setOrigin(0.5).setAlpha(0);
                this.tweens.add({ targets: survived, alpha: 1, duration: 900 });
            });

            this.time.delayedCall(1200, () => {
                const score = this.add.text(SW / 2, SH / 2 + 22, 'FINAL SCORE: ' + this.finalScore, {
                    fontSize: '22px', color: '#00ffcc', fontFamily: 'monospace'
                }).setOrigin(0.5).setAlpha(0);
                this.tweens.add({ targets: score, alpha: 1, duration: 800 });

                const medals = this._getMedal(this.finalScore);
                const medal = this.add.text(SW / 2, SH / 2 + 60, medals, {
                    fontSize: '14px', color: '#ffcc44', fontFamily: 'monospace'
                }).setOrigin(0.5).setAlpha(0);
                this.tweens.add({ targets: medal, alpha: 1, duration: 800, delay: 400 });

                const gp = window._gp, cross = gp?.connected ? (gp.isPS5() ? '✕' : 'A') : 'SPACE';
                const cont = this.add.text(SW / 2, SH / 2 + 110, '[ ' + cross + ' — Return to Surface ]', {
                    fontSize: '14px', color: '#1a5a3a', fontFamily: 'monospace'
                }).setOrigin(0.5).setAlpha(0);
                this.tweens.add({
                    targets: cont, alpha: 1, duration: 800, delay: 800,
                    onComplete: () => {
                        this.tweens.add({ targets: cont, alpha: { from: 1, to: 0.2 }, duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
                    }
                });

                // Re-bind input for menu
                this.input.keyboard.once('keydown-SPACE', () => {
                    this.cameras.main.fadeOut(800, 0, 8, 16);
                    this.time.delayedCall(820, () => this.scene.start('MenuScene'));
                });
            });
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

    _getMedal(score) {
        if (score >= 8000) return '🏆  ABYSS MASTER — You saw the eye and lived.';
        if (score >= 5000) return '🥇  DEEP DIVER — The darkness feared you.';
        if (score >= 3000) return '🥈  SURVIVOR — You made it out. Barely.';
        return '🥉  ESCAPED — The Abyss let you go. This time.';
    }

    _spawnBubble() {
        const SW = this.scale.width, SH = this.scale.height;
        const x = Phaser.Math.Between(SW * 0.05, SW * 0.95);
        const size = Phaser.Math.FloatBetween(1.5, 4.5);
        const duration = Phaser.Math.Between(4000, 9000);
        const bubble = this.add.circle(x, SH + 10, size, 0x00ffcc, 0)
            .setStrokeStyle(0.8, 0x00ffcc, Phaser.Math.FloatBetween(0.1, 0.35));
        this.tweens.add({
            targets: bubble,
            y: -20,
            x: x + Phaser.Math.Between(-30, 30),
            alpha: { from: 0.6, to: 0 },
            duration,
            ease: 'Sine.easeIn',
            onComplete: () => bubble.destroy()
        });
    }

    _spawnRing() {
        const SW = this.scale.width, SH = this.scale.height;
        const ring = this.add.circle(SW / 2, SH * 0.85, 4, 0xffaa00, 0);
        ring.setStrokeStyle(0.8, 0xffaa00, 0.25);
        this.tweens.add({
            targets: ring, scaleX: 80, scaleY: 40,
            alpha: { from: 0.25, to: 0 }, duration: 6000, ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }
}