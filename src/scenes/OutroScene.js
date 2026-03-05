import Phaser from 'phaser';

/**
 * OutroScene — plays after completing Level 5 (the Abyss).
 * The escape sequence. Nihad ascends. The Abyss closes.
 */

const OUTRO_BEATS = [
    {
        delay: 0,
        speaker: 'NIHAD — FINAL LOG',
        lines: [
            'Beacon Five: activated. Rescue sub: 4 minutes.',
            'And then I saw it.',
        ],
        color: '#4ab890',
    },
    {
        delay: 3800,
        speaker: '',
        lines: [
            'At the bottom of everything — a light.',
            'Not bioluminescent. Not mechanical.',
            'Alive. Ancient. Aware.',
            'It opened its eye.',
        ],
        color: '#cc8844',
    },
    {
        delay: 8400,
        speaker: '',
        lines: [
            'I ran.',
            'The creatures didn\'t follow.',
            'They stepped aside. They let me leave.',
        ],
        color: '#cc6633',
    },
    {
        delay: 12200,
        speaker: '',
        lines: [
            'As the rescue sub pulled me up,',
            'I looked down through the porthole.',
            'The passages were closing.',
            'Like a door.',
            'Like a choice.',
        ],
        color: '#aa4422',
    },
    {
        delay: 17000,
        speaker: 'SURFACE — 6 HOURS LATER',
        lines: [
            '"Researcher recovered. Sub lost. Depth: classified."',
            '"Recommend immediate closure of Mariana sector."',
            '"Subject\'s account: unverifiable."',
        ],
        color: '#3a8a6a',
    },
    {
        delay: 21000,
        speaker: '',
        lines: [
            'They closed the file.',
            'But I know what I saw.',
            'And I know it saw me too.',
        ],
        color: '#4ab890',
        isLast: true,
    },
];

export default class OutroScene extends Phaser.Scene {
    constructor() { super({ key: 'OutroScene' }); }

    init(data) {
        this.finalScore = data.score ?? 0;
    }

    create() {
        const SW = this.scale.width;
        const SH = this.scale.height;
        this._done = false;

        this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000305);
        const g = this.add.graphics();
        g.lineStyle(1, 0x060c0a, 1);
        for (let x = 0; x <= SW; x += 32) g.lineBetween(x, 0, x, SH);
        for (let y = 0; y <= SH; y += 32) g.lineBetween(0, y, SW, y);

        // Slow sonar rings (deep, ominous)
        this.time.addEvent({ delay: 3500, loop: true, callback: this._spawnRing, callbackScope: this });

        this.currentGroup = [];
        this._beatsDone = 0;

        OUTRO_BEATS.forEach((beat, i) => {
            this.time.delayedCall(beat.delay, () => {
                this._showBeat(beat, SW, SH);
                if (beat.isLast) {
                    this.time.delayedCall(4500, () => this._showEnding(SW, SH));
                }
            });
        });

        this.input.keyboard.on('keydown-SPACE', () => {
            if (this._done) this.scene.start('MenuScene');
        });
    }

    _showBeat(beat, SW, SH) {
        if (this.currentGroup.length > 0) {
            this.tweens.add({
                targets: this.currentGroup, alpha: 0, duration: 500,
                onComplete: () => this.currentGroup.forEach(o => { try { o.destroy(); } catch (e) { } })
            });
        }
        this.currentGroup = [];

        const startY = SH / 2 - (beat.lines.length * 30) / 2 - 20;

        if (beat.speaker) {
            const sp = this.add.text(SW / 2, startY - 28, `[ ${beat.speaker} ]`, {
                fontSize: '11px', color: '#1a5a3a', fontFamily: 'monospace'
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: sp, alpha: 1, duration: 400 });
            this.currentGroup.push(sp);
        }

        beat.lines.forEach((line, li) => {
            const y = startY + li * 30;
            const txt = this.add.text(SW / 2, y, line, {
                fontSize: '15px', color: beat.color, fontFamily: 'monospace',
                shadow: li === 0 ? { offsetX: 0, offsetY: 0, color: beat.color, blur: 8, fill: true } : undefined
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: txt, alpha: 1, duration: 600, delay: li * 350 });
            this.currentGroup.push(txt);
        });
    }

    _showEnding(SW, SH) {
        this._done = true;

        // Fade to near-black
        this.cameras.main.fade(2000, 0, 3, 5);

        this.time.delayedCall(2200, () => {
            this.cameras.main.resetFX();
            this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000305);

            const title = this.add.text(SW / 2, SH / 2 - 80, 'ABYSS', {
                fontSize: '72px', color: '#00ffcc', fontFamily: 'monospace',
                shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 30, fill: true }
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({ targets: title, alpha: 1, duration: 1200, ease: 'Quad.easeIn' });

            this.add.text(SW / 2, SH / 2 - 20, 'you survived the descent', {
                fontSize: '16px', color: '#2a6a4a', fontFamily: 'monospace'
            }).setOrigin(0.5).setAlpha(0);

            this.time.delayedCall(800, () => {
                this.add.text(SW / 2, SH / 2 - 20, 'you survived the descent', {
                    fontSize: '16px', color: '#2a6a4a', fontFamily: 'monospace'
                }).setOrigin(0.5);

                this.add.text(SW / 2, SH / 2 + 22, `FINAL SCORE: ${this.finalScore}`, {
                    fontSize: '22px', color: '#00ffcc', fontFamily: 'monospace'
                }).setOrigin(0.5);

                const medals = this._getMedal(this.finalScore);
                this.add.text(SW / 2, SH / 2 + 58, medals, {
                    fontSize: '14px', color: '#ffcc44', fontFamily: 'monospace'
                }).setOrigin(0.5);

                const cont = this.add.text(SW / 2, SH / 2 + 110, '[ SPACE — Return to Surface ]', {
                    fontSize: '14px', color: '#1a5a3a', fontFamily: 'monospace'
                }).setOrigin(0.5);
                this.tweens.add({
                    targets: cont, alpha: { from: 1, to: 0.2 },
                    duration: 700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
                });

                this.input.keyboard.once('keydown-SPACE', () => {
                    this.cameras.main.fadeOut(800, 0, 8, 16);
                    this.time.delayedCall(820, () => this.scene.start('MenuScene'));
                });
            });
        });
    }

    _getMedal(score) {
        if (score >= 8000) return '🏆  ABYSS MASTER — You saw the eye and lived.';
        if (score >= 5000) return '🥇  DEEP DIVER — The darkness feared you.';
        if (score >= 3000) return '🥈  SURVIVOR — You made it out. Barely.';
        return '🥉  ESCAPED — The Abyss let you go. This time.';
    }

    _spawnRing() {
        const SW = this.scale.width, SH = this.scale.height;
        const ring = this.add.circle(SW / 2, SH / 2, 4, 0x00ffcc, 0);
        ring.setStrokeStyle(0.8, 0x00ffcc, 0.2);
        this.tweens.add({
            targets: ring, scaleX: 70, scaleY: 70,
            alpha: { from: 0.2, to: 0 }, duration: 5000, ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }
}