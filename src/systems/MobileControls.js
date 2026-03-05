export default class MobileControls {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.joystick = { dx: 0, dy: 0, active: false, pointerId: null };
        this._pauseJustPressed = false;
        this.joystickBase = null;
        this.joystickThumb = null;
        this.sonarCircle = null;
        this.sonarLabel = null;
        this.pauseBtn = null;
        this.BASE_R = 55;
        this.THUMB_R = 22;
        this.JOY_X = 110;
        this.JOY_Y_OFFSET = 130;
        this.BTN_X_OFFSET = 110;
        this.BTN_Y_OFFSET = 130;
    }

    create() {
        if (!this.scene.sys.game.device.input.touch) return;
        this.active = true;
        this.build();
    }

    build() {
        const SW = this.scene.scale.width;
        const SH = this.scene.scale.height;
        const jx = this.JOY_X;
        const jy = SH - this.JOY_Y_OFFSET;
        const bx = SW - this.BTN_X_OFFSET;
        const by = SH - this.BTN_Y_OFFSET;

        // Joystick base
        this.joystickBase = this.scene.add.circle(jx, jy, this.BASE_R, 0x00ffcc, 0.1)
            .setScrollFactor(0).setDepth(50);
        this.joystickBase.setStrokeStyle(2, 0x00ffcc, 0.35);

        // Joystick thumb
        this.joystickThumb = this.scene.add.circle(jx, jy, this.THUMB_R, 0x00ffcc, 0.45)
            .setScrollFactor(0).setDepth(51);

        // Sonar button
        this.sonarCircle = this.scene.add.circle(bx, by, 45, 0x00ffcc, 0.12)
            .setScrollFactor(0).setDepth(50);
        this.sonarCircle.setStrokeStyle(2, 0x00ffcc, 0.45);
        this.scene.add.text(bx, by, 'PING', {
            fontSize: '13px', color: '#00ffcc', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

        // Pause button — top right
        const px = SW - 36, py = 36;
        this.pauseBtn = this.scene.add.circle(px, py, 22, 0x1a3a4a, 0.75)
            .setScrollFactor(0).setDepth(50).setInteractive();
        this.pauseBtn.setStrokeStyle(1.5, 0x3a7a6a, 0.6);
        this.scene.add.text(px, py, '⏸', {
            fontSize: '16px', color: '#5ab8a0', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
        this.pauseBtn.on('pointerdown', () => { this._pauseJustPressed = true; });

        // Touch handlers
        this.scene.input.on('pointerdown', p => this._onDown(p));
        this.scene.input.on('pointermove', p => this._onMove(p));
        this.scene.input.on('pointerup', p => this._onUp(p));
        this.scene.input.on('pointercancel', p => this._onUp(p));
    }

    _onDown(p) {
        const SW = this.scene.scale.width;
        if (p.x < SW / 2) {
            if (this.joystick.pointerId === null) {
                this.joystick.active = true;
                this.joystick.pointerId = p.id;
                this._updateJoystick(p.x, p.y);
            }
        } else {
            const SH = this.scene.scale.height;
            // Don't fire sonar if tapping pause area
            if (p.y > 70) {
                this.scene.fireSonar();
                this.scene.tweens.add({
                    targets: this.sonarCircle,
                    alpha: { from: 0.55, to: 0.12 },
                    duration: 300, ease: 'Quad.easeOut'
                });
            }
        }
    }

    _onMove(p) {
        if (p.id === this.joystick.pointerId) this._updateJoystick(p.x, p.y);
    }

    _onUp(p) {
        if (p.id === this.joystick.pointerId) {
            this.joystick.active = false;
            this.joystick.pointerId = null;
            this.joystick.dx = 0;
            this.joystick.dy = 0;
            const jx = this.JOY_X;
            const jy = this.scene.scale.height - this.JOY_Y_OFFSET;
            this.joystickThumb?.setPosition(jx, jy);
        }
    }

    _updateJoystick(px, py) {
        const jx = this.JOY_X;
        const jy = this.scene.scale.height - this.JOY_Y_OFFSET;
        let dx = px - jx, dy = py - jy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const max = this.BASE_R - this.THUMB_R;
        if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
        this.joystickThumb?.setPosition(jx + dx, jy + dy);
        const norm = Math.min(dist, max) / max;
        const angle = Math.atan2(dy, dx);
        this.joystick.dx = Math.cos(angle) * norm;
        this.joystick.dy = Math.sin(angle) * norm;
    }

    getVelocity(speed) {
        if (!this.active || !this.joystick.active) return null;
        let vx = this.joystick.dx * speed;
        let vy = this.joystick.dy * speed;
        if (Math.abs(vx) > 10 && Math.abs(vy) > 10) { vx *= 0.707; vy *= 0.707; }
        return { vx, vy };
    }

    isPauseJustPressed() {
        if (this._pauseJustPressed) { this._pauseJustPressed = false; return true; }
        return false;
    }

    destroy() {
        this.joystickBase?.destroy();
        this.joystickThumb?.destroy();
        this.sonarCircle?.destroy();
        this.pauseBtn?.destroy();
    }
}