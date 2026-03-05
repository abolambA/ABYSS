import Phaser from 'phaser';
import { GP } from '../systems/GamepadManager.js';

/**
 * PauseScene — overlays GameScene (which is paused + dimmed).
 * D-pad LEFT / Circle = back / ESC equivalent.
 * Tabs: main | levels | settings
 */
export default class PauseScene extends Phaser.Scene {
    constructor() { super({ key: 'PauseScene' }); }

    init(data) {
        this.currentLevel = data?.level ?? 1;
        this.currentScore = data?.score ?? 0;
    }

    create() {
        const SW = this.scale.width, SH = this.scale.height;
        this._tab = 'main';
        this._sel = 0;
        this._gpMoved = false;
        this._mob = SW < 640;
        this._sc = this._mob ? 0.78 : 1.0;
        this._completedLevels = this._loadCompleted();
        this._accessibleLevels = new Set();
        for (let i = 0; i <= this.currentLevel; i++) this._accessibleLevels.add(i);
        this._completedLevels.forEach(l => { this._accessibleLevels.add(l); this._accessibleLevels.add(l + 1); });

        // Fully opaque background — GameScene camera is hidden so this is all you see
        this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000d18, 1.0).setDepth(0);

        // Subtle grid lines for "deep sea" feel
        const sl = this.add.graphics().setDepth(1);
        sl.lineStyle(1, 0x002233, 0.4);
        for (let y = 0; y < SH; y += 40) sl.lineBetween(0, y, SW, y);
        for (let x = 0; x < SW; x += 40) sl.lineBetween(x, 0, x, SH);

        // Subtle scanlines
        const scan = this.add.graphics().setDepth(2);
        scan.lineStyle(1, 0x000000, 0.12);
        for (let y = 0; y < SH; y += 4) scan.lineBetween(0, y, SW, y);

        this._container = this.add.container(0, 0).setDepth(10);
        this._buildMainTab();

        // ESC / DLEFT = back or resume
        this.input.keyboard.on('keydown-ESC', () => {
            if (this._tab !== 'main') { this._tab = 'main'; this._rebuild(); }
            else this.resume();
        });
    }

    shutdown() {
        // Restore GameScene camera brightness
        try {
            const gs = this.scene.get('GameScene');
            if (gs?.cameras?.main) gs.cameras.main.setAlpha(1.0);
        } catch (e) { }
    }

    _rebuild() {
        this._container.removeAll(true);
        if (this._tab === 'main') this._buildMainTab();
        else if (this._tab === 'levels') this._buildLevelsTab();
        else if (this._tab === 'settings') this._buildSettingsTab();
    }

    _fs(n) { return Math.round(n * this._sc) + 'px'; }

    // ── MAIN TAB ─────────────────────────────────────────────────
    _buildMainTab() {
        const SW = this.scale.width, SH = this.scale.height;
        const C = this._container;

        const panelW = Math.min(420, SW - 40);
        const panelH = Math.min(440, SH - 80);
        const px = SW / 2, py = SH / 2;

        C.add(this.add.rectangle(px, py, panelW, panelH, 0x03121a, 1.0).setStrokeStyle(1.5, 0x1a6a5a, 1));
        C.add(this.add.text(px, py - panelH / 2 + 30, '⏸  PAUSED', {
            fontSize: this._fs(28), color: '#00ffcc', fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 12, fill: true }
        }).setOrigin(0.5));

        const isBoss = this.currentLevel === 5;
        const lLabel = this.currentLevel === 0 ? 'Training Dive' : isBoss ? '⚠  THE ABYSS' : 'Level ' + this.currentLevel;
        C.add(this.add.text(px, py - panelH / 2 + 58, lLabel, {
            fontSize: this._fs(12), color: isBoss ? '#cc4422' : '#3a8a6a', fontFamily: 'monospace'
        }).setOrigin(0.5));
        C.add(this.add.rectangle(px, py - panelH / 2 + 70, panelW - 40, 1, 0x1a4a3a));

        const gp = window._gp;
        const ps5 = gp?.connected && gp.isPS5();

        const btns = [
            { label: '▶  RESUME', kHint: 'ESC', gHint: ps5 ? 'OPTIONS' : 'START', color: '#00ffcc', bg: 0x0c2530, action: () => this.resume() },
            { label: '📊  LEVELS', kHint: 'L', gHint: ps5 ? '△' : 'Y', color: '#4ab890', bg: 0x0a202a, action: () => { this._tab = 'levels'; this._rebuild(); } },
            { label: '🔊  SETTINGS', kHint: 'S', gHint: ps5 ? '□' : 'X', color: '#4ab890', bg: 0x0a202a, action: () => { this._tab = 'settings'; this._rebuild(); } },
            { label: '⟳  RESTART', kHint: 'R', gHint: ps5 ? 'L1' : 'LB', color: '#cc8844', bg: 0x1a120a, action: () => this.restart() },
            { label: '⬅  MAIN MENU', kHint: 'M', gHint: ps5 ? 'CREATE' : 'BACK', color: '#cc6633', bg: 0x24140a, action: () => this.menu() },
        ];

        const btnW = panelW - 60;
        const btnH = Math.min(44, (panelH - 130) / btns.length - 4);
        const startY = py - panelH / 2 + 102;

        this.btnObjects = btns.map((b, i) => {
            const by = startY + i * (btnH + 5) + btnH / 2;
            const bg = this.add.rectangle(px, by, btnW, btnH, b.bg).setStrokeStyle(1, 0x1a5a3a, 1).setInteractive({ useHandCursor: true });
            const hintStr = gp?.connected ? b.gHint : b.kHint;
            const hint = this.add.text(px - btnW / 2 + 12, by, '[' + hintStr + ']', { fontSize: this._fs(10), color: '#2a6a4a', fontFamily: 'monospace' }).setOrigin(0, 0.5);
            const lbl = this.add.text(px - btnW / 2 + 58, by, b.label, { fontSize: this._fs(15), color: b.color, fontFamily: 'monospace' }).setOrigin(0, 0.5);
            C.add(bg); C.add(hint); C.add(lbl);
            bg.on('pointerover', () => { bg.setFillStyle(0x0c3028); lbl.setColor('#ffffff'); });
            bg.on('pointerout', () => { bg.setFillStyle(i === this._sel ? 0x0c3028 : b.bg); lbl.setColor(b.color); });
            bg.on('pointerdown', () => b.action());
            this.input.keyboard.on('keydown-' + b.kHint, () => b.action());
            return { bg, lbl, action: b.action, color: b.color, bgColor: b.bg };
        });
        this._highlight(0);

        // Controller back hint
        if (gp?.connected) {
            C.add(this.add.text(px, py + panelH / 2 - 18,
                `🎮  ↕ navigate   ${gp.buttonLabel(GP.CROSS)} confirm   ${gp.buttonLabel(GP.OPTIONS)} resume   ← back`,
                { fontSize: this._fs(10), color: '#1a4a3a', fontFamily: 'monospace' }).setOrigin(0.5));
        } else {
            C.add(this.add.text(px, py + panelH / 2 - 18,
                'ESC resume  R restart  M menu  L levels  S settings',
                { fontSize: this._fs(9), color: '#1a3a2a', fontFamily: 'monospace' }).setOrigin(0.5));
        }
    }

    // ── LEVELS TAB ───────────────────────────────────────────────
    _buildLevelsTab() {
        const SW = this.scale.width, SH = this.scale.height;
        const C = this._container;
        const panelW = Math.min(540, SW - 30), panelH = Math.min(490, SH - 60);
        const px = SW / 2, py = SH / 2;

        C.add(this.add.rectangle(px, py, panelW, panelH, 0x03121a, 1.0).setStrokeStyle(1.5, 0x1a6a5a, 1));
        C.add(this.add.text(px, py - panelH / 2 + 28, '📊  LEVELS', {
            fontSize: this._fs(22), color: '#00ffcc', fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 10, fill: true }
        }).setOrigin(0.5));
        C.add(this.add.text(px, py - panelH / 2 + 52, 'Jump level · Score resets to 0', {
            fontSize: this._fs(10), color: '#1a4a3a', fontFamily: 'monospace'
        }).setOrigin(0.5));

        const defs = [
            { lvl: 0, name: 'Training Dive', desc: 'Tutorial  ·  no creatures' },
            { lvl: 1, name: 'The Shallows', desc: '3 creatures  ·  Easy' },
            { lvl: 2, name: 'The Corridor', desc: '4 creatures  ·  Medium' },
            { lvl: 3, name: 'The Labyrinth', desc: '5 creatures  ·  Hard' },
            { lvl: 4, name: 'The Deep', desc: '6 creatures  ·  Very Hard' },
            { lvl: 5, name: '⚠  THE ABYSS', desc: '8 creatures  ·  BOSS' },
        ];
        const mob = this._mob, colW = mob ? panelW - 40 : (panelW - 50) / 2;
        const rowH = mob ? 46 : 56, cols = mob ? 1 : 2;
        const startY = py - panelH / 2 + 72;

        defs.forEach((ld, i) => {
            const col = mob ? 0 : i % 2, row = mob ? i : Math.floor(i / 2);
            const bx = mob ? px : (col === 0 ? px - colW / 2 - 8 : px + colW / 2 + 8);
            const by = startY + row * rowH + rowH / 2;
            const done = this._completedLevels.has(ld.lvl);
            const acc = this._accessibleLevels.has(ld.lvl);
            const boss = ld.lvl === 5, cur = ld.lvl === this.currentLevel;
            const fc = cur ? 0x103a28 : boss ? 0x2a0a00 : done ? 0x0c2520 : 0x0d1f28;
            const sk = cur ? 0x00ffcc : boss ? 0xaa3300 : done ? 0x00cc88 : 0x1a6a5a;
            const nc = cur ? '#00ffcc' : boss ? '#ff5522' : done ? '#00ffcc' : acc ? '#3a9a72' : '#2a3a3a';
            const st = done ? '✓' : cur ? '▶' : acc ? '·' : '🔒';

            const bb = this.add.rectangle(bx, by, colW, rowH - 6, fc).setStrokeStyle(1.5, sk, 1).setInteractive({ useHandCursor: acc });
            C.add(bb);
            C.add(this.add.text(bx - colW / 2 + 12, by - 7, st, { fontSize: this._fs(13), color: done ? '#00ffcc' : '#2a6a4a', fontFamily: 'monospace' }).setOrigin(0, 0.5));
            C.add(this.add.text(bx - colW / 2 + 32, by - 7, ld.name, { fontSize: this._fs(13), color: nc, fontFamily: 'monospace' }).setOrigin(0, 0.5));
            C.add(this.add.text(bx - colW / 2 + 32, by + 10, ld.desc, { fontSize: this._fs(10), color: '#1a5a3a', fontFamily: 'monospace' }).setOrigin(0, 0.5));
            if (acc) {
                bb.on('pointerover', () => bb.setFillStyle(0x0c3028));
                bb.on('pointerout', () => bb.setFillStyle(fc));
                bb.on('pointerdown', () => this.goToLevel(ld.lvl));
            }
        });

        this._addBackBtn(py + panelH / 2 - 26, panelW);
        this.input.keyboard.once('keydown-L', () => { this._tab = 'main'; this._rebuild(); });
    }

    // ── SETTINGS TAB ─────────────────────────────────────────────
    _buildSettingsTab() {
        const SW = this.scale.width, SH = this.scale.height;
        const C = this._container;
        const panelW = Math.min(430, SW - 40), panelH = Math.min(390, SH - 80);
        const px = SW / 2, py = SH / 2;

        C.add(this.add.rectangle(px, py, panelW, panelH, 0x03121a, 1.0).setStrokeStyle(1.5, 0x1a6a5a, 1));
        C.add(this.add.text(px, py - panelH / 2 + 28, '🔊  SETTINGS', {
            fontSize: this._fs(22), color: '#00ffcc', fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 10, fill: true }
        }).setOrigin(0.5));

        const sliders = [
            { label: 'Master Volume', key: 'abyss_master_vol', val: parseFloat(localStorage.getItem('abyss_master_vol') ?? '0.8') },
            { label: 'Music Volume', key: 'abyss_music_vol', val: parseFloat(localStorage.getItem('abyss_music_vol') ?? '0.6') },
            { label: 'SFX Volume', key: 'abyss_sfx_vol', val: parseFloat(localStorage.getItem('abyss_sfx_vol') ?? '0.8') },
        ];
        const sliderW = Math.min(280, panelW - 90), startY = py - panelH / 2 + 72;

        sliders.forEach((s, i) => {
            const sy = startY + i * 76;
            const trackX = px - sliderW / 2;
            C.add(this.add.text(px, sy, s.label, { fontSize: this._fs(13), color: '#3a9a72', fontFamily: 'monospace' }).setOrigin(0.5));
            C.add(this.add.rectangle(px, sy + 22, sliderW, 4, 0x0a2a1a));
            const fill = this.add.rectangle(trackX, sy + 22, sliderW * s.val, 4, 0x00ffcc).setOrigin(0, 0.5);
            const thumb = this.add.circle(trackX + sliderW * s.val, sy + 22, 10, 0x00ffcc).setInteractive({ useHandCursor: true, draggable: true });
            const valTxt = this.add.text(px + sliderW / 2 + 18, sy + 22, Math.round(s.val * 100) + '%', { fontSize: this._fs(12), color: '#4ab890', fontFamily: 'monospace' }).setOrigin(0, 0.5);
            C.add(fill); C.add(thumb); C.add(valTxt);
            this.input.setDraggable(thumb);
            const update = (newX) => {
                const clamped = Phaser.Math.Clamp(newX, trackX, trackX + sliderW);
                const newVal = (clamped - trackX) / sliderW;
                thumb.x = clamped; fill.width = sliderW * newVal;
                valTxt.setText(Math.round(newVal * 100) + '%');
                localStorage.setItem(s.key, newVal.toFixed(2));
                try { const gs = this.scene.get('GameScene'); gs?.audio?.setVolumeAll?.(parseFloat(localStorage.getItem('abyss_master_vol') ?? '0.8')); } catch (e) { }
            };
            thumb.on('drag', (ptr) => update(ptr.x));
            const track = this.add.rectangle(px, sy + 22, sliderW, 24, 0, 0).setInteractive({ useHandCursor: true });
            C.add(track);
            track.on('pointerdown', (ptr) => update(ptr.x));
        });

        this._addBackBtn(py + panelH / 2 - 26, panelW);
        this.input.keyboard.once('keydown-S', () => { this._tab = 'main'; this._rebuild(); });
    }

    _addBackBtn(y, panelW) {
        const C = this._container;
        const px = this.scale.width / 2;
        const gp = window._gp;
        const hint = gp?.connected ? (gp.isPS5() ? '○ / ← back' : 'B / ← back') : 'ESC / ← back';
        const bb = this.add.rectangle(px, y, 200, 34, 0x08201a).setStrokeStyle(1, 0x1a5a3a, 1).setInteractive({ useHandCursor: true });
        const bt = this.add.text(px, y, '← BACK  [' + hint + ']', { fontSize: this._fs(12), color: '#4ab890', fontFamily: 'monospace' }).setOrigin(0.5);
        C.add(bb); C.add(bt);
        bb.on('pointerover', () => bb.setFillStyle(0x0c3028));
        bb.on('pointerout', () => bb.setFillStyle(0x08201a));
        bb.on('pointerdown', () => { this._tab = 'main'; this._rebuild(); });
    }

    _highlight(i) {
        this._sel = i;
        if (!this.btnObjects) return;
        this.btnObjects.forEach((b, idx) => {
            if (!b?.bg?.active) return;
            b.bg.setFillStyle(idx === i ? 0x0c3028 : b.bgColor);
            b.lbl.setColor(idx === i ? '#ffffff' : b.color);
        });
    }

    _loadCompleted() {
        try { return new Set(JSON.parse(localStorage.getItem('abyss_completed') || '[]')); } catch { return new Set(); }
    }

    static markLevelCompleted(level) {
        try {
            const d = JSON.parse(localStorage.getItem('abyss_completed') || '[]');
            if (!d.includes(level)) { d.push(level); localStorage.setItem('abyss_completed', JSON.stringify(d)); }
        } catch { }
    }

    goToLevel(level) {
        const gs = this.scene.get('GameScene');
        if (gs?.textures?.exists('fog')) gs.textures.remove('fog');
        try { gs?.audio?.stopMusic(); } catch (e) { }
        this.scene.stop('PauseScene');
        this.scene.stop('GameScene');
        this.scene.start(level === 0 ? 'GameScene' : 'LevelTransition', { level, score: 0 });
    }

    resume() {
        this.scene.stop('PauseScene');
        this.scene.resume('GameScene');
        try {
            const gs = this.scene.get('GameScene');
            if (gs && !gs.playerDead && !gs.levelComplete && !gs.isTutorial) gs.audio?.startMusic();
        } catch (e) { }
    }

    restart() {
        const gs = this.scene.get('GameScene');
        if (gs?.textures?.exists('fog')) gs.textures.remove('fog');
        try { gs?.audio?.stopMusic(); } catch (e) { }
        this.scene.stop('PauseScene');
        this.scene.stop('GameScene');
        this.scene.start('GameScene', { level: this.currentLevel, score: 0 });
    }

    menu() {
        const gs = this.scene.get('GameScene');
        if (gs?.textures?.exists('fog')) gs.textures.remove('fog');
        try { gs?.audio?.stopMusic(); } catch (e) { }
        this.scene.stop('PauseScene');
        this.scene.stop('GameScene');
        this.scene.start('MenuScene');
    }

    update() {
        const gp = window._gp;
        if (!gp?.connected) return;
        gp.poll();

        const stick = gp.leftStick(), dpad = gp.dpad();
        const ay = stick.y || dpad.y, ax = stick.x || dpad.x;

        if (!this._gpMoved && ay < -0.5) {
            this._gpMoved = true; this._highlight(Math.max(0, this._sel - 1));
        } else if (!this._gpMoved && ay > 0.5) {
            this._gpMoved = true; this._highlight(Math.min((this.btnObjects?.length ?? 1) - 1, this._sel + 1));
        } else if (Math.abs(ay) < 0.25) { this._gpMoved = false; }

        if (gp.isJust(GP.CROSS)) { this.btnObjects?.[this._sel]?.action?.(); }
        if (gp.isJust(GP.OPTIONS)) this.resume();
        // Circle or D-pad LEFT = back / resume
        if (gp.isJust(GP.CIRCLE) || gp.isJust(GP.DLEFT)) {
            if (this._tab !== 'main') { this._tab = 'main'; this._rebuild(); }
            else this.resume();
        }

        gp.endFrame();
    }
}