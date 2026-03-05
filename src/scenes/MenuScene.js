import Phaser from 'phaser';
import { GP } from '../systems/GamepadManager.js';

/**
 * MenuScene — fully responsive.
 * Big clear buttons. Controller hints when connected.
 * About overlay with nihad.codes link.
 */
export default class MenuScene extends Phaser.Scene {
    constructor() { super({ key: 'MenuScene' }); }

    create() {
        const SW = this.scale.width;
        const SH = this.scale.height;
        const mob = SW < 640;
        const sc = mob ? 0.78 : (SW > 1200 ? 1.15 : 1.0);
        this._starting = false;
        this._sc = sc;
        this._mob = mob;
        this.aboutOverlay = null;

        // BG
        this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000810);
        const g = this.add.graphics();
        g.lineStyle(1, 0x0a1f1a, 1);
        for (let x = 0; x <= SW; x += 32) g.lineBetween(x, 0, x, SH);
        for (let y = 0; y <= SH; y += 32) g.lineBetween(0, y, SW, y);

        // Sonar rings
        this.time.addEvent({ delay: 2200, loop: true, callback: this.spawnRing, callbackScope: this });
        this.spawnRing();

        // Title
        const titleY = mob ? SH * 0.12 : SH * 0.18;
        this.add.text(SW / 2, titleY, 'ABYSS', {
            fontSize: Math.round((mob ? 64 : 90) * sc) + 'px',
            color: '#00ffcc', fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 30, fill: true }
        }).setOrigin(0.5);

        this.add.text(SW / 2, titleY + Math.round((mob ? 48 : 60) * sc), 'something is down here with you', {
            fontSize: Math.round((mob ? 13 : 16) * sc) + 'px', color: '#4ab890', fontFamily: 'monospace'
        }).setOrigin(0.5);

        this.add.text(SW / 2, titleY + Math.round((mob ? 66 : 82) * sc), 'Find the beacon. Survive the dark. Uncover the truth.', {
            fontSize: Math.round((mob ? 10 : 12) * sc) + 'px', color: '#2a6655', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // ── MAIN BUTTONS ──────────────────────────────────────────────
        const gp = window._gp;
        const btnW = Math.min(360, SW - 40);
        const btnH = Math.round((mob ? 46 : 52) * sc);
        const btnGap = btnH + 8;
        const btnStartY = mob ? SH * 0.38 : SH * 0.44;

        const buttons = [
            { label: '▶  BEGIN NEW DIVE', hint: 'SPACE', gpHint: gp?.connected ? gp.buttonLabel(GP.CROSS) : null, color: '#00ffcc', bgColor: 0x052218, strokeColor: 0x00ffcc, action: () => this.startGame() },
            { label: '📊  LEVEL SELECT', hint: 'L', gpHint: gp?.connected ? '△' : null, color: '#4ab890', bgColor: 0x051814, strokeColor: 0x1a6a4a, action: () => this.showLevelSelect() },
            { label: '⁉  ABOUT', hint: 'A', gpHint: gp?.connected ? '○' : null, color: '#3a9a72', bgColor: 0x041210, strokeColor: 0x155533, action: () => this.showAbout() },
        ];

        this._menuBtns = buttons.map((b, i) => {
            const by = btnStartY + i * btnGap;
            const bg = this.add.rectangle(SW / 2, by, btnW, btnH, b.bgColor)
                .setStrokeStyle(1.5, b.strokeColor, 1)
                .setInteractive({ useHandCursor: true });

            // Key hint (left side)
            const keyHint = this.add.text(SW / 2 - btnW / 2 + 14, by, '[' + b.hint + ']', {
                fontSize: Math.round(10 * sc) + 'px', color: '#1a5a3a', fontFamily: 'monospace'
            }).setOrigin(0, 0.5);

            // Label (center-left)
            const lbl = this.add.text(SW / 2 - btnW / 2 + (mob ? 48 : 62), by, b.label, {
                fontSize: Math.round((mob ? 15 : 18) * sc) + 'px', color: b.color, fontFamily: 'monospace',
                shadow: i === 0 ? { offsetX: 0, offsetY: 0, color: b.color, blur: 8, fill: true } : undefined,
            }).setOrigin(0, 0.5);

            // Controller hint (right side)
            if (b.gpHint && gp?.connected) {
                this.add.text(SW / 2 + btnW / 2 - 14, by, b.gpHint, {
                    fontSize: Math.round(13 * sc) + 'px', color: '#1a5a4a', fontFamily: 'monospace'
                }).setOrigin(1, 0.5);
            }

            bg.on('pointerover', () => { bg.setFillStyle(0x0a3028); lbl.setColor('#ffffff'); });
            bg.on('pointerout', () => { bg.setFillStyle(b.bgColor); lbl.setColor(b.color); });
            bg.on('pointerdown', () => b.action());

            return { bg, lbl, action: b.action, bgColor: b.bgColor, color: b.color };
        });

        // SPACE key
        this.input.keyboard.once('keydown-SPACE', () => this.startGame());
        this.input.keyboard.on('keydown-L', () => this.showLevelSelect());
        this.input.keyboard.on('keydown-A', () => this.showAbout());

        // ── PICKUPS LEGEND ────────────────────────────────────────────
        const legendY = btnStartY + 3 * btnGap + 12;
        if (!mob || SH > 600) {
            this.add.text(SW / 2, legendY, 'PICKUPS', {
                fontSize: Math.round(10 * sc) + 'px', color: '#2a6a4a', fontFamily: 'monospace'
            }).setOrigin(0.5);
            [
                { s: '▶▶', c: '#ffcc00', t: 'SPEED BOOST (5s)' },
                { s: '◈', c: '#ff6600', t: 'SHIELD – 1 hit (8s)' },
                { s: '◎', c: '#ff00ff', t: 'MEGA PING – 2× radius' },
            ].forEach((p, i) => {
                const py2 = legendY + 16 + i * Math.round(16 * sc);
                this.add.text(SW / 2 - 90, py2, p.s, { fontSize: Math.round(12 * sc) + 'px', color: p.c, fontFamily: 'monospace' }).setOrigin(0.5);
                this.add.text(SW / 2 - 72, py2, p.t, { fontSize: Math.round(11 * sc) + 'px', color: '#3a7a62', fontFamily: 'monospace' }).setOrigin(0, 0.5);
            });
        }

        // ── CONTROLS LEGEND (live — updates on controller connect/disconnect) ─
        const ctrlY = mob ? SH - 62 : SH - 54;
        // Controls text — will update dynamically
        this._ctrlsTxt = this.add.text(SW / 2, ctrlY, '', {
            fontSize: Math.round((mob ? 10 : 12) * sc) + 'px', color: '#2a6a4a', fontFamily: 'monospace'
        }).setOrigin(0.5);
        this.gpStatusTxt = this.add.text(SW / 2, ctrlY + Math.round(14 * sc), '', {
            fontSize: Math.round(10 * sc) + 'px', color: '#00ffcc', fontFamily: 'monospace'
        }).setOrigin(0.5);

        const updateCtrlHints = () => {
            if (!this._ctrlsTxt?.active) return;
            const gpNow = window._gp;
            if (gpNow?.connected) {
                const ps5 = gpNow.isPS5();
                const cross = ps5 ? '✕' : 'A', opt = ps5 ? 'OPTIONS' : 'START', tri = ps5 ? '△' : 'Y', cir = ps5 ? '○' : 'B';
                this._ctrlsTxt.setText(`🎮  Left Stick Swim   ${cross} Sonar   ${opt} Pause   ${tri} Levels   ${cir} About`);
                this.gpStatusTxt.setText((ps5 ? '✅  PS5 DualSense' : '✅  Controller') + ' connected');
                this.gpStatusTxt.setColor('#00ffcc');
                // Update button display on each menu button
                this._rebuildBtnGpHints(gpNow);
            } else {
                this._ctrlsTxt.setText('WASD – Swim   SPACE – Sonar   ESC – Pause   L – Levels   A – About');
                this.gpStatusTxt.setText('');
            }
        };

        if (gp) {
            gp.onConnect = updateCtrlHints;
            gp.onDisconnect = updateCtrlHints;
        }
        updateCtrlHints();
        // Poll for connect/disconnect events even if already connected
        this._ctrlPoll = this.time.addEvent({ delay: 500, loop: true, callback: updateCtrlHints });

        // ── HIGH SCORES ───────────────────────────────────────────────
        const scores = this._loadScores();
        const scoresY = ctrlY - Math.round((mob ? 44 : 56) * sc);
        this.add.text(SW / 2, scoresY, '— BEST RUNS —', {
            fontSize: Math.round(10 * sc) + 'px', color: '#1a5a3a', fontFamily: 'monospace'
        }).setOrigin(0.5);
        if (scores.length > 0) {
            scores.slice(0, 3).forEach((s, i) => {
                const medal = ['🥇', '🥈', '🥉'][i];
                this.add.text(SW / 2, scoresY + 14 + i * Math.round(13 * sc),
                    medal + '  ' + String(s.score).padStart(6, '0') + '  LV' + s.level + '  ' + s.date, {
                    fontSize: Math.round(10 * sc) + 'px', color: '#2a6655', fontFamily: 'monospace'
                }).setOrigin(0.5);
            });
        } else {
            this.add.text(SW / 2, scoresY + 14, 'No runs yet — dare to descend.', {
                fontSize: Math.round(10 * sc) + 'px', color: '#1a3a2a', fontFamily: 'monospace'
            }).setOrigin(0.5);
        }

        // Footer
        this.add.text(SW / 2, SH - 14, 'Campfire Dubai × HackClub  —  Theme: Beneath the Surface', {
            fontSize: Math.round(9 * sc) + 'px', color: '#0f2a1a', fontFamily: 'monospace'
        }).setOrigin(0.5);

        // ── GAMEPAD NAVIGATION ────────────────────────────────────────
        this._gpSel = 0;
        if (gp?.connected) {
            this._highlightBtn(0);
            this._gpPoll = this.time.addEvent({
                delay: 80, loop: true, callback: () => {
                    gp.poll();
                    const stick = gp.leftStick(), dpad = gp.dpad();
                    const ay = stick.y || dpad.y;

                    if (!this._gpMoved && ay < -0.5) {
                        this._gpMoved = true;
                        this._gpSel = Math.max(0, this._gpSel - 1);
                        this._highlightBtn(this._gpSel);
                    } else if (!this._gpMoved && ay > 0.5) {
                        this._gpMoved = true;
                        this._gpSel = Math.min(this._menuBtns.length - 1, this._gpSel + 1);
                        this._highlightBtn(this._gpSel);
                    } else if (Math.abs(ay) < 0.25) {
                        this._gpMoved = false;
                    }

                    if (gp.isJust(GP.CROSS)) this.startGame();
                    if (gp.isJust(GP.TRIANGLE)) this.showLevelSelect();
                    if (gp.isJust(GP.CIRCLE)) this.showAbout();

                    gp.endFrame();
                }
            });
        }
    }

    _highlightBtn(i) {
        if (!this._menuBtns) return;
        this._menuBtns.forEach((b, idx) => {
            if (!b?.bg?.active) return;
            b.bg.setFillStyle(idx === i ? 0x0a3028 : b.bgColor);
            b.lbl.setColor(idx === i ? '#ffffff' : b.color);
        });
    }

    startGame() {
        if (this._starting) return;
        this._starting = true;
        this.cameras.main.fadeOut(700, 0, 8, 16);
        this.time.delayedCall(720, () => this.scene.start('IntroScene'));
    }

    showLevelSelect() {
        if (this.aboutOverlay) return;
        const SW = this.scale.width, SH = this.scale.height;
        const mob = SW < 640, sc = this._sc;
        const items = [];

        const completedLevels = this._loadCompleted();
        const bg = this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000810, 0.96).setDepth(50); // Keep slightly dark
        const panel = this.add.rectangle(SW / 2, SH / 2, Math.min(560, SW - 24), Math.min(520, SH - 40), 0x03121a, 1.0).setDepth(51).setStrokeStyle(1.5, 0x1a6a5a, 1);
        items.push(bg, panel);
        items.push(this.add.text(SW / 2, SH / 2 - Math.min(230, SH / 2 - 30), '📊  SELECT LEVEL', { fontSize: Math.round(20 * sc) + 'px', color: '#00ffcc', fontFamily: 'monospace', shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 12, fill: true } }).setOrigin(0.5).setDepth(52));
        items.push(this.add.text(SW / 2, SH / 2 - Math.min(210, SH / 2 - 50), 'Jump to any accessible level. Score resets.', { fontSize: Math.round(10 * sc) + 'px', color: '#1a4a3a', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(52));

        const levelDefs = [
            { lvl: 0, name: 'Training Dive', desc: 'Tutorial' },
            { lvl: 1, name: 'The Shallows', desc: '3 creatures' },
            { lvl: 2, name: 'The Corridor', desc: '4 creatures' },
            { lvl: 3, name: 'The Labyrinth', desc: '5 creatures' },
            { lvl: 4, name: 'The Deep', desc: '6 creatures' },
            { lvl: 5, name: '⚠ THE ABYSS', desc: 'BOSS: 8 creatures' },
        ];

        const panelW = Math.min(520, SW - 30);
        const colW = mob ? panelW - 40 : (panelW - 50) / 2;
        const rowH = mob ? 48 : 56;
        const startY = SH / 2 - Math.min(180, SH * 0.32);
        const cols = mob ? 1 : 2;
        const accessibleLevels = new Set([0, 1]);
        completedLevels.forEach(l => { accessibleLevels.add(l); accessibleLevels.add(l + 1); });

        levelDefs.forEach((ld, i) => {
            const col = mob ? 0 : i % 2;
            const row = mob ? i : Math.floor(i / 2);
            const bx = mob ? SW / 2 : (col === 0 ? SW / 2 - colW / 2 - 8 : SW / 2 + colW / 2 + 8);
            const by = startY + row * rowH + rowH / 2;
            const done = completedLevels.has(ld.lvl);
            const access = accessibleLevels.has(ld.lvl);
            const boss = ld.lvl === 5;
            const fc = boss ? 0x2a0a00 : done ? 0x0c2520 : access ? 0x0d1f28 : 0x0d1822;
            const sk = boss && access ? 0xaa3300 : done ? 0x00cc88 : 0x1a6a5a;
            const nc = boss ? '#ff5522' : (done ? '#00ffcc' : access ? '#3a9a72' : '#2a3a3a');
            const status = done ? '✓' : (access ? '·' : '🔒');

            const bb = this.add.rectangle(bx, by, colW, rowH - 8, fc).setStrokeStyle(1.5, sk, 1).setDepth(52).setInteractive({ useHandCursor: access });
            const st = this.add.text(bx - colW / 2 + 12, by, status, { fontSize: Math.round(13 * sc) + 'px', color: done ? '#00ffcc' : '#2a6a4a', fontFamily: 'monospace' }).setOrigin(0, 0.5).setDepth(53);
            const nm = this.add.text(bx - colW / 2 + 32, by - 7, ld.name, { fontSize: Math.round(13 * sc) + 'px', color: nc, fontFamily: 'monospace' }).setOrigin(0, 0.5).setDepth(53);
            const dc = this.add.text(bx - colW / 2 + 32, by + 9, ld.desc, { fontSize: Math.round(10 * sc) + 'px', color: '#1a5a3a', fontFamily: 'monospace' }).setOrigin(0, 0.5).setDepth(53);
            items.push(bb, st, nm, dc);

            if (access) {
                bb.on('pointerover', () => bb.setFillStyle(0x0c3028));
                bb.on('pointerout', () => bb.setFillStyle(fc));
                bb.on('pointerdown', () => {
                    close();
                    this.cameras.main.fadeOut(400, 0, 8, 16);
                    this.time.delayedCall(420, () => {
                        if (ld.lvl === 0) this.scene.start('IntroScene');
                        else this.scene.start('LevelTransition', { level: ld.lvl, score: 0 });
                    });
                });
            }
        });

        const closeBtn = this.add.text(SW / 2, Math.min(SH / 2 + 220, SH - 30), '[ CLOSE — ESC ]', { fontSize: Math.round(13 * sc) + 'px', color: '#1a6a4a', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });
        items.push(closeBtn);
        closeBtn.on('pointerover', () => closeBtn.setColor('#00ffcc'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#1a6a4a'));

        const close = () => { items.forEach(o => { try { o.destroy(); } catch (e) { } }); this.aboutOverlay = null; this.input.keyboard.off('keydown-ESC', close); };
        closeBtn.on('pointerdown', close);
        this.input.keyboard.once('keydown-ESC', close);
        this.aboutOverlay = bg;
    }

    showAbout() {
        if (this.aboutOverlay) return;
        const SW = this.scale.width, SH = this.scale.height;
        const mob = SW < 640, sc = this._sc;
        const items = [];

        const bg = this.add.rectangle(SW / 2, SH / 2, SW, SH, 0x000810, 0.96).setDepth(50); // Keep slightly dark
        const panel = this.add.rectangle(SW / 2, SH / 2, Math.min(560, SW - 24), Math.min(500, SH - 40), 0x03121a, 1.0).setDepth(51).setStrokeStyle(1.5, 0x1a6a5a, 1);
        items.push(bg, panel);
        items.push(this.add.text(SW / 2, SH / 2 - Math.min(215, SH / 2 - 32), '— ABOUT ABYSS —', { fontSize: Math.round(20 * sc) + 'px', color: '#00ffcc', fontFamily: 'monospace', shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 12, fill: true } }).setOrigin(0.5).setDepth(52));

        const lines = [
            { t: 'A sonar-based deep-sea horror survival game.', c: '#5ac8a0', s: 14 },
            { t: "Dr. Nihad's submarine crashed at 8,400 meters.", c: '#4ab890', s: 13 },
            { t: 'Navigate 5 levels to activate the rescue beacon.', c: '#4ab890', s: 13 },
            { t: 'The creatures are the least of your worries.', c: '#cc8844', s: 13 },
            { t: '', c: '#000', s: 6 },
            { t: '— CONTROLS —', c: '#00ffcc', s: 14 },
            { t: 'WASD / Stick  —  Swim', c: '#4ab890', s: 12 },
            { t: 'SPACE / Cross  —  Sonar Ping', c: '#4ab890', s: 12 },
            { t: 'ESC / OPTIONS  —  Pause', c: '#4ab890', s: 12 },
            { t: '', c: '#000', s: 6 },
            { t: '— LEVELS —', c: '#00ffcc', s: 14 },
            { t: 'Tutorial  ▸  Shallows  ▸  Corridor  ▸  Labyrinth', c: '#4ab890', s: 12 },
            { t: 'The Deep  ▸  ⚠ BOSS: The Abyss (8 creatures)', c: '#cc6622', s: 12 },
        ];

        let ly = SH / 2 - Math.min(180, SH * 0.35);
        lines.forEach(l => {
            if (l.t) {
                items.push(this.add.text(SW / 2, ly, l.t, { fontSize: Math.round(l.s * sc) + 'px', color: l.c, fontFamily: 'monospace' }).setOrigin(0.5).setDepth(52));
            }
            ly += l.t ? Math.round((l.s + 4) * sc) : l.s;
        });

        // Credits with clickable website
        ly += 6;
        items.push(this.add.text(SW / 2, ly, '— CREDITS —', { fontSize: Math.round(14 * sc) + 'px', color: '#00ffcc', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(52));
        ly += Math.round(18 * sc);

        // Clickable link
        const linkTxt = this.add.text(SW / 2, ly, 'nihad.codes', {
            fontSize: Math.round(14 * sc) + 'px', color: '#00ffcc', fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 8, fill: true }
        }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });
        linkTxt.on('pointerover', () => linkTxt.setColor('#ffffff'));
        linkTxt.on('pointerout', () => linkTxt.setColor('#00ffcc'));
        linkTxt.on('pointerdown', () => window.open('https://nihad.codes', '_blank'));
        items.push(linkTxt);
        items.push(this.add.text(SW / 2, ly + Math.round(16 * sc), '↑ click to visit', { fontSize: Math.round(9 * sc) + 'px', color: '#1a5a3a', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(52));
        ly += Math.round(32 * sc);

        items.push(this.add.text(SW / 2, ly, 'Campfire Dubai × HackClub  |  Phaser.js  |  Web Audio API', { fontSize: Math.round(10 * sc) + 'px', color: '#3a7a62', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(52));

        const closeY = Math.min(SH / 2 + 222, SH - 28);
        const closeBtn = this.add.text(SW / 2, closeY, '[ CLOSE — ESC ]', { fontSize: Math.round(13 * sc) + 'px', color: '#1a6a4a', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(52).setInteractive({ useHandCursor: true });
        items.push(closeBtn);
        closeBtn.on('pointerover', () => closeBtn.setColor('#00ffcc'));
        closeBtn.on('pointerout', () => closeBtn.setColor('#1a6a4a'));

        const close = () => { items.forEach(o => { try { o.destroy(); } catch (e) { } }); this.aboutOverlay = null; this.input.keyboard.off('keydown-ESC', close); };
        closeBtn.on('pointerdown', close);
        this.input.keyboard.once('keydown-ESC', close);
        this.aboutOverlay = bg;
    }

    _loadScores() {
        try { return JSON.parse(localStorage.getItem('abyss_scores') || '[]'); } catch { return []; }
    }
    _loadCompleted() {
        try { return new Set(JSON.parse(localStorage.getItem('abyss_completed') || '[]')); } catch { return new Set(); }
    }

    _rebuildBtnGpHints(gp) {
        // No-op: hint text is baked into each button at create time.
        // The live controller hint line covers the full mapping.
    }

    spawnRing() {
        const SW = this.scale.width, SH = this.scale.height;
        const ring = this.add.circle(SW / 2, SH / 2, 4, 0x00ffcc, 0);
        ring.setStrokeStyle(1.5, 0x00ffcc, 0.5);
        this.tweens.add({ targets: ring, scaleX: 60, scaleY: 60, alpha: { from: 0.5, to: 0 }, duration: 3500, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
}