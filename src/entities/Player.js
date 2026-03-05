import Phaser from 'phaser';

/**
 * Player — sprite-based diver with directional rotation.
 *
 * Sprite is drawn head-at-TOP of frame (PH=48, helmet at y≈10).
 * In Phaser, rotation=0 → head points SCREEN-UP.
 *
 * Rotation formula: sprite.rotation = atan2(vy, vx) + π/2
 *   W  (vy<0, vx=0):  atan2(-1,0)=-π/2  +π/2 = 0     → head UP   ✓
 *   S  (vy>0, vx=0):  atan2(+1,0)=+π/2  +π/2 = π     → head DOWN ✓
 *   D  (vx>0, vy=0):  atan2(0,+1)=0     +π/2 = π/2   → head RIGHT ✓
 *   A  (vx<0, vy=0):  atan2(0,-1)=±π    +π/2 ≈-π/2   → head LEFT ✓
 *   W+D diagonal: -π/4 + π/2 = π/4                   → head UP-RIGHT ✓
 */
export default class Player {
    constructor(scene, x, y) {
        this.scene = scene;
        this.dead = false;
        this._targetRot = 0;   // 0 = head up (matches idle default)
        this._prevAnim = '';

        // Physics body (invisible)
        this.physCircle = scene.add.circle(x, y, 11, 0x000000, 0).setDepth(0);
        scene.physics.add.existing(this.physCircle);
        this.physCircle.body.setCollideWorldBounds(true);
        this.physCircle.body.setCircle(11);

        // Visual sprite
        this.sprite = scene.add.sprite(x, y, 'player', 0).setDepth(15).setScale(1.5);
        this.sprite.rotation = 0;
        this.sprite.play('player_idle');

        // Ambient glow
        this.glow = scene.add.circle(x, y, 24, 0x00ffcc, 0.06).setDepth(14);
        scene.tweens.add({
            targets: this.glow,
            alpha: { from: 0.06, to: 0.02 },
            scaleX: { from: 1, to: 1.4 }, scaleY: { from: 1, to: 1.4 },
            duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });

        // Trail
        this.trailGraphic = scene.add.graphics().setDepth(13);
        this._trail = [];
    }

    get x() { return this.physCircle.x; }
    get y() { return this.physCircle.y; }
    get body() { return this.physCircle.body; }

    setVelocity(vx, vy) { this.physCircle.body.setVelocity(vx, vy); }

    update(vx, vy, boostActive) {
        if (!this.physCircle?.active) return;
        const px = this.physCircle.x, py = this.physCircle.y;
        this.sprite.setPosition(px, py);
        this.glow.setPosition(px, py);

        if (!this.dead) {
            const moving = Math.abs(vx) > 12 || Math.abs(vy) > 12;
            if (moving) {
                // atan2(vy, vx) + π/2 maps velocity direction to head direction
                this._targetRot = Math.atan2(vy, vx) + Math.PI / 2;
                // Shortest-path lerp
                let diff = this._targetRot - this.sprite.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.sprite.rotation += diff * 0.22;

                if (this._prevAnim !== 'player_swim_right') {
                    this._prevAnim = 'player_swim_right';
                    this.sprite.play('player_swim_right');
                }
            } else {
                // Idle — slowly settle
                let diff = this._targetRot - this.sprite.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.sprite.rotation += diff * 0.05;
                if (this._prevAnim !== 'player_idle') {
                    this._prevAnim = 'player_idle';
                    this.sprite.play('player_idle');
                }
            }
        }

        // Trail
        this._trail.push({ x: px, y: py });
        if (this._trail.length > 18) this._trail.shift();
        const g = this.trailGraphic; const color = boostActive ? 0xffcc00 : 0x00ffcc;
        g.clear();
        for (let i = 1; i < this._trail.length; i++) {
            const t = i / this._trail.length;
            if (t < 0.25) continue;
            g.fillStyle(color, t * 0.32);
            g.fillCircle(this._trail[i].x, this._trail[i].y, t * 5.5);
        }
    }

    playDeath() {
        this.dead = true; this._prevAnim = 'player_death';
        this.sprite.play('player_death');
        this.sprite.setTint(0xff2200);
        this.scene.tweens.add({ targets: this.sprite, alpha: 0.4, scaleX: 2.5, scaleY: 2.5, duration: 700, ease: 'Quad.easeOut' });
    }

    destroy() {
        try { this.physCircle.destroy(); } catch (e) { }
        try { this.sprite.destroy(); } catch (e) { }
        try { this.glow.destroy(); } catch (e) { }
        try { this.trailGraphic.destroy(); } catch (e) { }
    }
}