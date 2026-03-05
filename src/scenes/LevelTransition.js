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
        const mob = SW < 640;
        const sc = mob ? 0.82 : (SW > 1200 ? 1.15 : 1.0);

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
        this.add.text(SW / 2, SH / 2 - Math.round(86 * sc), tagLabel, {
            fontSize: Math.round(15 * sc) + 'px', color: tagColor, fontFamily: 'monospace'
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

        const title = this.add.text(SW / 2, SH / 2 - Math.round(30 * sc), name, {
            fontSize: Math.round((isBoss ? 46 : 50) * sc) + 'px',
            color: isBoss ? '#ff4422' : '#00ffcc',
            fontFamily: 'monospace',
            shadow: {
                offsetX: 0, offsetY: 0,
                color: isBoss ? '#ff2200' : '#00ffcc',
                blur: Math.round((isBoss ? 28 : 18) * sc),
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
        this.add.text(SW / 2, SH / 2 + Math.round(42 * sc), hints[this.level] || '', {
            fontSize: Math.round(14 * sc) + 'px',
            color: isBoss ? '#882200' : '#3a8a6a',
            fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Running score
        this.add.text(SW / 2, SH / 2 + Math.round(72 * sc), `SCORE: ${this.totalScore}`, {
            fontSize: Math.round(13 * sc) + 'px', color: '#1a4a3a', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // Boss extra warning
        if (isBoss) {
            const warn = this.add.text(SW / 2, SH / 2 + Math.round(100 * sc),
                '8 CREATURES  ·  DENSE MAZE  ·  HIGH OXYGEN DRAIN', {
                fontSize: Math.round(12 * sc) + 'px', color: '#882200', fontFamily: 'monospace'
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