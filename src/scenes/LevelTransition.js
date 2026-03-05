import Phaser from 'phaser';

export default class LevelTransition extends Phaser.Scene {
    constructor() { super({ key: 'LevelTransition' }); }

    init(data) {
        this.level = data.level ?? 1;
        this.totalScore = data.score ?? 0;
    }

    create() {
        const SW = this.scale.width;
        const SH = this.scale.height;

        this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000810);
        const g = this.add.graphics();
        g.lineStyle(1, 0x0a1a2a, 1);
        for (let x = 0; x <= SW; x += 32) g.lineBetween(x, 0, x, SH);
        for (let y = 0; y <= SH; y += 32) g.lineBetween(0, y, SW, y);

        // Sonar ring animation
        const ring = this.add.circle(SW / 2, SH / 2, 4, 0x00ffcc, 0);
        ring.setStrokeStyle(2, 0x00ffcc, 0.8);
        this.tweens.add({
            targets: ring, scaleX: 80, scaleY: 80,
            alpha: { from: 0.8, to: 0 }, duration: 2200, ease: 'Quad.easeOut'
        });

        const isBoss = this.level === 5;

        // Level tag
        const tagLabel = isBoss ? '— BOSS LEVEL —' : `LEVEL ${this.level}`;
        const tagColor = isBoss ? '#cc4422' : '#3a8a6a';
        this.add.text(SW / 2, SH / 2 - 86, tagLabel, {
            fontSize: '15px', color: tagColor, fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Level name
        const names = [
            'TRAINING DIVE',
            'THE SHALLOWS',
            'THE CORRIDOR',
            'THE LABYRINTH',
            'THE DEEP',
            '⚠  THE ABYSS  ⚠'
        ];
        const name = names[this.level] || `LEVEL ${this.level}`;

        const title = this.add.text(SW / 2, SH / 2 - 30, name, {
            fontSize: isBoss ? '46px' : '50px',
            color: isBoss ? '#ff4422' : '#00ffcc',
            fontFamily: 'monospace',
            shadow: {
                offsetX: 0, offsetY: 0,
                color: isBoss ? '#ff2200' : '#00ffcc',
                blur: isBoss ? 28 : 18,
                fill: true
            }
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: title, alpha: 1, duration: 380, ease: 'Quad.easeIn' });

        // Atmospheric hint
        const hints = [
            'Learn the basics. Find the exit.',
            'Use sonar wisely — each ping is a beacon.',
            'The corridors are narrower here.',
            'Dead ends everywhere. Stay calm.',
            'Your oxygen drains faster in the deep.',
            'Maximum depth. 8 creatures. No mercy.',
        ];
        this.add.text(SW / 2, SH / 2 + 42, hints[this.level] || '', {
            fontSize: '14px',
            color: isBoss ? '#882200' : '#3a8a6a',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Running score
        this.add.text(SW / 2, SH / 2 + 72, `SCORE: ${this.totalScore}`, {
            fontSize: '13px', color: '#1a4a3a', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Boss extra warning
        if (isBoss) {
            const warn = this.add.text(SW / 2, SH / 2 + 100,
                '8 CREATURES  ·  DENSE MAZE  ·  HIGH OXYGEN DRAIN', {
                fontSize: '12px', color: '#882200', fontFamily: 'monospace'
            }).setOrigin(0.5).setAlpha(0);
            this.tweens.add({
                targets: warn, alpha: 0.9,
                duration: 600, delay: 700, ease: 'Quad.easeIn'
            });
        }

        // Auto-advance
        const delay = isBoss ? 3600 : 2800;
        this.time.delayedCall(delay, () => {
            this.cameras.main.fadeOut(400, 0, 8, 16);
            this.time.delayedCall(420, () =>
                this.scene.start('GameScene', { level: this.level, score: this.totalScore })
            );
        });
    }
}