import Phaser from 'phaser';

export const POWERUP_TYPES = {
    BOOST: {
        key: 'BOOST',
        label: 'SPEED',
        color: 0xffcc00,
        glow: 0xaa8800,
        duration: 5000,
        symbol: '▶▶',
    },
    SHIELD: {
        key: 'SHIELD',
        label: 'SHIELD',
        color: 0xff6600,
        glow: 0xaa3300,
        duration: 8000,
        symbol: '◈',
    },
    PULSE: {
        key: 'PULSE',
        label: 'MEGA PING',
        color: 0xff00ff,
        glow: 0x880088,
        duration: 0, // instant — just buffs next ping
        symbol: '◎',
    },
};

export default class PowerUp {
    constructor(scene, x, y, type) {
        this.scene = scene;
        this.type = POWERUP_TYPES[type];
        this.active = true;

        // Visuals
        this.glow = scene.add.circle(x, y, 22, this.type.glow, 0.3).setDepth(2);
        this.body = scene.add.circle(x, y, 12, this.type.color, 1).setDepth(3);
        this.label = scene.add.text(x, y - 24, this.type.symbol, {
            fontSize: '11px', color: '#' + this.type.color.toString(16).padStart(6, '0'),
            fontFamily: 'monospace'
        }).setOrigin(0.5).setDepth(4);

        scene.tweens.add({
            targets: [this.body, this.glow],
            scaleX: { from: 1, to: 1.3 }, scaleY: { from: 1, to: 1.3 },
            alpha: { from: 1, to: 0.4 },
            duration: 900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });
        scene.tweens.add({
            targets: this.label,
            y: { from: y - 24, to: y - 30 },
            alpha: { from: 0.9, to: 0.4 },
            duration: 1200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });

        scene.physics.add.existing(this.body, true);
    }

    destroy() {
        this.active = false;
        this.glow.destroy();
        this.body.destroy();
        this.label.destroy();
    }
}