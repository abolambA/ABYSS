// PS5 DualSense button layout (Web Gamepad API standard mapping)
export const GP = {
    CROSS: 0,   // X — sonar / confirm
    CIRCLE: 1,   // cancel / back
    SQUARE: 2,
    TRIANGLE: 3,
    L1: 4, R1: 5, L2: 6, R2: 7,
    CREATE: 8,
    OPTIONS: 9,   // pause
    L3: 10, R3: 11,
    DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15,
    PS: 16,
};

export default class GamepadManager {
    constructor() {
        this.gp = null;
        this.connected = false;
        this.prevButtons = new Array(20).fill(false);
        this.deadzone = 0.18;
        this.onConnect = null;
        this.onDisconnect = null;
        this.id = '';

        window.addEventListener('gamepadconnected', e => {
            this.gp = e.gamepad;
            this.connected = true;
            this.id = e.gamepad.id;
            if (this.onConnect) this.onConnect(e.gamepad.id);
        });
        window.addEventListener('gamepaddisconnected', () => {
            this.gp = null;
            this.connected = false;
            this.id = '';
            if (this.onDisconnect) this.onDisconnect();
        });
    }

    // Call every frame to refresh state
    poll() {
        if (!this.connected) return;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
            if (pad && pad.connected) { this.gp = pad; break; }
        }
    }

    // Save state for just-pressed detection — call at END of frame
    endFrame() {
        if (!this.gp) return;
        this.prevButtons = this.gp.buttons.map(b => b.pressed);
    }

    // Left stick with deadzone applied
    leftStick() {
        if (!this.gp) return { x: 0, y: 0 };
        let x = this.gp.axes[0] ?? 0;
        let y = this.gp.axes[1] ?? 0;
        if (Math.abs(x) < this.deadzone) x = 0;
        if (Math.abs(y) < this.deadzone) y = 0;
        return { x, y };
    }

    // D-pad as stick
    dpad() {
        if (!this.gp) return { x: 0, y: 0 };
        let x = 0, y = 0;
        if (this.isHeld(GP.DLEFT)) x = -1;
        if (this.isHeld(GP.DRIGHT)) x = 1;
        if (this.isHeld(GP.DUP)) y = -1;
        if (this.isHeld(GP.DDOWN)) y = 1;
        return { x, y };
    }

    isHeld(btn) {
        return !!(this.gp?.buttons[btn]?.pressed);
    }

    isJust(btn) {
        return !!(this.gp?.buttons[btn]?.pressed && !this.prevButtons[btn]);
    }

    isPS5() {
        return this.id.toLowerCase().includes('dualsense') ||
            this.id.toLowerCase().includes('playstation') ||
            this.id.toLowerCase().includes('054c'); // Sony vendor ID
    }

    buttonLabel(btn) {
        // Returns friendly label for UI
        const ps5 = this.isPS5();
        const map = {
            [GP.CROSS]: ps5 ? '✕' : 'A',
            [GP.CIRCLE]: ps5 ? '○' : 'B',
            [GP.SQUARE]: ps5 ? '□' : 'X',
            [GP.TRIANGLE]: ps5 ? '△' : 'Y',
            [GP.OPTIONS]: ps5 ? 'OPTIONS' : 'START',
            [GP.L1]: 'L1',
            [GP.R1]: 'R1',
        };
        return map[btn] ?? `BTN${btn}`;
    }
}