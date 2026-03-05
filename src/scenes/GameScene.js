import Phaser from 'phaser';
import { C } from '../Constants.js';
import Creature from '../entities/Creature.js';
import Player from '../entities/Player.js';
import Pathfinder from '../systems/pathfinder.js';
import Audio from '../systems/Audio.js';
import MobileControls from '../systems/MobileControls.js';
import PowerUp, { POWERUP_TYPES } from '../systems/PowerUp.js';
import { GP } from '../systems/GamepadManager.js';
import { createPlayerSprites, createCreatureSprites } from '../systems/SpriteFactory.js';
import PauseScene from './PauseScene.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.SPAWN_X = 1600;
        this.SPAWN_Y = 1200;
        this.WW = 3200;
        this.WH = 2400;
        this.AREA_LEFT = this.SPAWN_X - 1200;
        this.AREA_TOP = this.SPAWN_Y - 900;
    }

    init(data) {
        this.level = data.level ?? 0;
        this.totalScore = data.score ?? 0;
    }

    getLevelConfig() {
        return ({
            0: { speedMult: 0.32, oxyDrain: 0.3, aura: 190 },
            1: { speedMult: 1.00, oxyDrain: 1.8, aura: 65 },
            2: { speedMult: 1.10, oxyDrain: 2.2, aura: 65 },
            3: { speedMult: 1.22, oxyDrain: 2.6, aura: 65 },
            4: { speedMult: 1.35, oxyDrain: 3.0, aura: 65 },
            5: { speedMult: 1.55, oxyDrain: 3.8, aura: 65 },
        })[this.level] || { speedMult: 1.0, oxyDrain: 1.8, aura: 65 };
    }

    create() {
        const SW = this.scale.width;
        const SH = this.scale.height;
        const cfg = this.getLevelConfig();
        // Responsive text scale
        this._sc = SW < 640 ? 0.8 : (SW > 1400 ? 1.2 : 1.0);
        const sc = this._sc;
        const fs = (n) => Math.round(n * sc) + 'px';

        // ── Generate sprites (idempotent — skips if already exist) ──
        createPlayerSprites(this);
        createCreatureSprites(this);

        this.reveals = [];
        this.playerDead = false;
        this.levelComplete = false;
        this.oxygen = 100;
        this.pingCount = 0;
        this.creatures = [];
        this.wallVisuals = [];
        this.powerUps = [];
        this.lowOxyPulse = false;
        this.lastGrowl = 0;
        this.lastPingTime = 0;
        this.lastWarning = 0;
        this.startTime = Date.now();
        this.oxyDrain = cfg.oxyDrain;
        this.playerAura = cfg.aura;
        this._invulnerable = false; // Add invulnerability state
        this.isTutorial = this.level === 0;
        this.tutStep = 0;
        this.tutPrompts = [];
        this.tutPinged = false;
        this.tutTankGot = false;
        this._gpSonarHeld = false;

        this.activePowerUps = {
            BOOST: { active: false, timer: null },
            SHIELD: { active: false, timer: null },
            PULSE: { active: false, ready: false },
        };

        this.audio = new Audio();

        this.physics.world.setBounds(0, 0, this.WW, this.WH);
        this.cameras.main.setBounds(0, 0, this.WW, this.WH);
        this.add.rectangle(this.WW / 2, this.WH / 2, this.WW, this.WH, 0x050d15).setDepth(0);
        this.drawGrid();

        this.pathfinder = new Pathfinder(this.AREA_LEFT, this.AREA_TOP, 2400, 1800);
        this.walls = this.physics.add.staticGroup();
        this.buildLevelLayout();

        // ── Player (sprite-based entity) ──
        this.player = new Player(this, this.SPAWN_X, this.SPAWN_Y);
        this.physics.add.collider(this.player.physCircle, this.walls);
        this.cameras.main.startFollow(this.player.physCircle, true, 1, 1);

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.input.keyboard.once('keydown', () => {
            if (!this.isTutorial) this.audio.startMusic();
        });

        this.mobile = new MobileControls(this);
        this.mobile.create();

        // Fog canvas
        if (this.textures.exists('fog')) this.textures.remove('fog');
        this.fogTex = this.textures.createCanvas('fog', SW, SH);
        this.fogCtx = this.fogTex.getContext();
        this.add.image(0, 0, 'fog').setOrigin(0, 0).setScrollFactor(0).setDepth(10);

        // Creature spawns
        this.creatureSpawns.forEach(([x, y, o]) => this.spawnCreature(x, y, o, cfg.speedMult));
        this.tankSpawns.forEach(([x, y]) => this.spawnOxyTank(x, y));
        if (!this.isTutorial)
            this.powerUpSpawns.forEach(([x, y, t]) => this.spawnPowerUp(x, y, t));

        // Exit
        this.exit = this.add.rectangle(this.exitX, this.exitY, 40, 40, 0x00ff88).setDepth(3);
        this.physics.add.existing(this.exit, true);
        this.physics.add.overlap(this.player.physCircle, this.exit, () => this.onLevelComplete());
        this.tweens.add({
            targets: this.exit, alpha: { from: 1, to: 0.15 },
            duration: 900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });

        // Arrow (hidden in tutorial)
        this.arrowGraphic = this.add.graphics().setScrollFactor(0).setDepth(22);
        this.arrowDist = this.add.text(0, 0, '', {
            fontSize: '11px', color: '#00ff88', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(22).setAlpha(0);

        // ── HUD ──
        this.add.rectangle(18, 18, 208, 22, 0x0a1a2a).setOrigin(0, 0).setScrollFactor(0).setDepth(20);
        this.oxyBar = this.add.rectangle(20, 20, 204, 18, 0x00aaff).setOrigin(0, 0).setScrollFactor(0).setDepth(21);
        this.add.text(20, 44, 'OXYGEN', {
            fontSize: '10px', color: '#5ab8d0', fontFamily: 'monospace'
        }).setScrollFactor(0).setDepth(21);

        this.shieldRing = this.add.circle(SW / 2, SH / 2, 22, 0xff6600, 0).setScrollFactor(0).setDepth(19);
        this.shieldRing.setStrokeStyle(2, 0xff6600, 0);

        this.pingText = this.add.text(SW - 20, 20, 'PINGS: 0', {
            fontSize: '13px', color: '#5a8899', fontFamily: 'monospace'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(21);

        const levelLabel = this.isTutorial ? 'TRAINING DIVE' : this.level === 5 ? '⚠ THE ABYSS' : `LEVEL ${this.level}`;
        const levelColor = this.level === 5 ? '#cc4422' : '#4ab890';
        this.add.text(SW / 2, 20, levelLabel, {
            fontSize: '13px', color: levelColor, fontFamily: 'monospace'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(21);

        this.dangerText = this.add.text(SW / 2, 44, '', {
            fontSize: '13px', color: '#ff4422', fontFamily: 'monospace'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(21).setAlpha(0);

        this.powerUpBar = this.add.text(20, SH - 48, '', {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffdd44'
        }).setScrollFactor(0).setDepth(21);

        const gp = window._gp;
        this.add.text(SW - 20, 44, gp?.connected ? 'ESC/OPTIONS — Pause' : 'ESC — Pause', {
            fontSize: '10px', color: '#3a6655', fontFamily: 'monospace'
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(21);

        const bottomHint = this.isTutorial
            ? 'WASD — Swim   SPACE — Sonar   Reach the GREEN exit'
            : 'WASD — Swim   SPACE — Sonar   BLUE = oxygen   Pickups = power-ups';
        this.add.text(SW / 2, SH - 18, bottomHint, {
            fontSize: '10px', color: '#3a6655', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

        if (gp?.connected)
            this.add.circle(SW - 12, 12, 5, 0x00ffcc, 0.8).setScrollFactor(0).setDepth(21);

        if (this.isTutorial) this.buildTutorialPrompts();
    }

    // ── TUTORIAL ──────────────────────────────────────────────────
    buildTutorialPrompts() {
        const SW = this.scale.width, SH = this.scale.height;
        const gp = window._gp;
        const pingKey = gp?.connected ? (gp.isPS5() ? '✕ (Cross)' : 'A button') : 'SPACE';
        this.showTutPrompt('WASD / L-Stick to swim   ' + pingKey + ' to sonar ping', SW / 2, SH / 2 - 100, 0x00ffcc);
    }

    showTutPrompt(msg, x, y, color) {
        const hex = '#' + color.toString(16).padStart(6, '0');
        this.tutPrompts.forEach(t => { try { t.destroy(); } catch (e) { } });
        this.tutPrompts = [];
        const bg = this.add.rectangle(x, y, msg.length * 7.8 + 32, 30, 0x000810, 0.88)
            .setScrollFactor(0).setDepth(29).setStrokeStyle(1, color, 0.6);
        const txt = this.add.text(x, y, msg, {
            fontSize: '13px', color: hex, fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.tweens.add({ targets: [bg, txt], alpha: { from: 0, to: 1 }, duration: 350 });
        this.tutPrompts.push(bg, txt);
    }

    updateTutorial() {
        const SW = this.scale.width, SH = this.scale.height;
        if (this.tutStep === 0 && this.tutPinged) {
            this.tutStep = 1;
            this.showTutPrompt('Your ping woke something — AVOID IT', SW / 2, SH / 2 - 100, 0xff4422);
        }
        if (this.tutStep <= 1 && this.tutTankGot) {
            this.tutStep = 2;
            this.showTutPrompt('Oxygen refilled!  Now reach the GREEN EXIT', SW / 2, SH / 2 - 100, 0x00ff88);

            // Add a temporary arrow pointing to the oxygen bar
            const arrow = this.add.text(120, 60, '↑ OXYGEN LEVEL', {
                fontSize: '12px', color: '#00aaff', fontFamily: 'monospace', fontWeight: 'bold'
            }).setScrollFactor(0).setDepth(30);
            this.tweens.add({
                targets: arrow, y: 50, duration: 400, yoyo: true, repeat: 7,
                onComplete: () => arrow.destroy()
            });
        }
        const minDist = this.creatures.reduce((min, c) =>
            Math.min(min, Phaser.Math.Distance.Between(this.player.x, this.player.y, c.physCircle.x, c.physCircle.y)), Infinity);
        if (this.tutStep < 3 && minDist < 190) {
            this.tutStep = 3;
            this.showTutPrompt('RUN — reach the EXIT!', SW / 2, SH / 2 - 100, 0xff0000);
        }
    }

    // ── LEVEL LAYOUTS ─────────────────────────────────────────────
    buildLevelLayout() {
        ([
            () => this.buildTutorial(),
            () => this.buildLevel1(),
            () => this.buildLevel2(),
            () => this.buildLevel3(),
            () => this.buildLevel4(),
            () => this.buildLevel5Boss(),
        ])[this.level]?.();
    }

    buildTutorial() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        this.exitX = cx - 150; this.exitY = cy - 290;
        this.creatureSpawns = [[cx - 280, cy - 130, 0]];
        this.tankSpawns = [[cx + 180, cy + 70]];
        this.powerUpSpawns = [];
        this.addWall(cx - 450, cy - 330, 900, 20); this.addWall(cx - 450, cy + 310, 900, 20);
        this.addWall(cx - 450, cy - 330, 20, 660); this.addWall(cx + 430, cy - 330, 20, 660);
        this.addWall(cx - 360, cy - 70, 500, 20); this.addWall(cx - 60, cy + 80, 480, 20);
    }

    buildLevel1() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        this.exitX = cx - 900; this.exitY = cy - 700;
        this.creatureSpawns = [[cx - 300, cy - 400, 0], [cx - 650, cy - 150, 170], [cx + 200, cy + 350, 340]];
        this.tankSpawns = [[cx - 200, cy - 150], [cx - 550, cy - 450], [cx + 300, cy - 300], [cx - 800, cy - 600], [cx + 100, cy + 500]];
        this.powerUpSpawns = [[cx - 400, cy + 100, 'BOOST'], [cx + 300, cy - 600, 'SHIELD'], [cx - 700, cy + 400, 'PULSE']];
        this._buildBorderWalls();
        this.addWall(cx - 1100, cy - 600, 400, 24); this.addWall(cx - 550, cy - 600, 350, 24); this.addWall(cx + 50, cy - 600, 400, 24); this.addWall(cx + 600, cy - 600, 350, 24);
        this.addWall(cx - 1100, cy - 250, 300, 24); this.addWall(cx - 650, cy - 250, 400, 24); this.addWall(cx + 100, cy - 250, 350, 24); this.addWall(cx + 600, cy - 250, 300, 24);
        this.addWall(cx - 1000, cy + 100, 350, 24); this.addWall(cx - 500, cy + 100, 400, 24); this.addWall(cx + 50, cy + 100, 350, 24); this.addWall(cx + 550, cy + 100, 350, 24);
        this.addWall(cx - 1100, cy + 450, 400, 24); this.addWall(cx - 550, cy + 450, 350, 24); this.addWall(cx + 50, cy + 450, 400, 24); this.addWall(cx + 600, cy + 450, 300, 24);
        this.addWall(cx - 900, cy + 700, 300, 24); this.addWall(cx - 450, cy + 700, 400, 24); this.addWall(cx + 100, cy + 700, 350, 24); this.addWall(cx + 600, cy + 700, 300, 24);
        this.addWall(cx - 750, cy - 870, 24, 300); this.addWall(cx - 200, cy - 870, 24, 350); this.addWall(cx + 350, cy - 870, 24, 300); this.addWall(cx + 900, cy - 870, 24, 350);
        this.addWall(cx - 1050, cy - 580, 24, 350); this.addWall(cx - 550, cy - 580, 24, 300); this.addWall(cx + 0, cy - 580, 24, 350); this.addWall(cx + 500, cy - 580, 24, 300); this.addWall(cx + 950, cy - 580, 24, 350);
        this.addWall(cx - 900, cy - 230, 24, 350); this.addWall(cx - 400, cy - 230, 24, 300); this.addWall(cx + 150, cy - 230, 24, 350); this.addWall(cx + 650, cy - 230, 24, 300); this.addWall(cx + 1100, cy - 230, 24, 350);
        this.addWall(cx - 1050, cy + 120, 24, 350); this.addWall(cx - 500, cy + 120, 24, 300); this.addWall(cx + 50, cy + 120, 24, 350); this.addWall(cx + 550, cy + 120, 24, 300); this.addWall(cx + 950, cy + 120, 24, 350);
        this.addWall(cx - 800, cy + 470, 24, 300); this.addWall(cx - 300, cy + 470, 24, 350); this.addWall(cx + 200, cy + 470, 24, 300); this.addWall(cx + 700, cy + 470, 24, 350);
    }

    buildLevel2() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        this.exitX = cx + 950; this.exitY = cy - 750;
        this.creatureSpawns = [[cx + 400, cy - 300, 0], [cx - 400, cy + 200, 200], [cx + 700, cy + 400, 400], [cx - 700, cy - 500, 600]];
        this.tankSpawns = [[cx + 150, cy - 200], [cx - 300, cy - 500], [cx + 600, cy + 200], [cx - 600, cy + 400], [cx + 900, cy - 400]];
        this.powerUpSpawns = [[cx - 200, cy + 300, 'BOOST'], [cx + 500, cy - 400, 'SHIELD'], [cx - 800, cy - 200, 'PULSE']];
        this._buildBorderWalls();
        this.addWall(cx - 1100, cy - 700, 400, 22); this.addWall(cx - 500, cy - 700, 800, 22); this.addWall(cx + 500, cy - 700, 500, 22);
        this.addWall(cx - 1000, cy - 500, 600, 22); this.addWall(cx - 200, cy - 500, 700, 22);
        this.addWall(cx - 1100, cy - 300, 300, 22); this.addWall(cx - 600, cy - 300, 500, 22); this.addWall(cx + 100, cy - 300, 700, 22);
        this.addWall(cx - 900, cy - 100, 800, 22); this.addWall(cx + 100, cy - 100, 800, 22);

        this.addWall(cx - 1100, cy + 100, 400, 22); this.addWall(cx - 500, cy + 100, 500, 22); this.addWall(cx + 200, cy + 100, 600, 22);
        this.addWall(cx - 1000, cy + 300, 500, 22); this.addWall(cx - 300, cy + 300, 700, 22); this.addWall(cx + 600, cy + 300, 300, 22);
        this.addWall(cx - 1100, cy + 500, 600, 22); this.addWall(cx - 300, cy + 500, 800, 22);
        this.addWall(cx - 900, cy + 700, 700, 22); this.addWall(cx + 0, cy + 700, 800, 22);

        this.addWall(cx - 700, cy - 880, 22, 500); this.addWall(cx - 100, cy - 880, 22, 300); this.addWall(cx + 500, cy - 880, 22, 400);
        this.addWall(cx - 900, cy - 680, 22, 400); this.addWall(cx - 300, cy - 680, 22, 500); this.addWall(cx + 300, cy - 680, 22, 400);

        this.addWall(cx - 1050, cy - 80, 22, 600); this.addWall(cx - 400, cy - 80, 22, 400); this.addWall(cx + 200, cy - 80, 22, 500); this.addWall(cx + 800, cy - 80, 22, 600);
        this.addWall(cx - 800, cy + 120, 22, 500); this.addWall(cx - 100, cy + 120, 22, 600); this.addWall(cx + 500, cy + 120, 22, 400);
    }

    buildLevel3() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        this.exitX = cx - 1000; this.exitY = cy + 750;
        this.creatureSpawns = [[cx + 300, cy - 600, 0], [cx - 500, cy - 300, 180], [cx + 700, cy + 200, 360], [cx - 200, cy + 600, 540], [cx + 900, cy - 400, 720]];
        this.tankSpawns = [[cx - 100, cy - 400], [cx + 500, cy - 700], [cx - 700, cy + 100], [cx + 300, cy + 500], [cx - 400, cy + 750]];
        this.powerUpSpawns = [[cx + 600, cy - 100, 'BOOST'], [cx - 300, cy + 300, 'SHIELD'], [cx + 100, cy - 700, 'PULSE']];
        this._buildBorderWalls();
        this.addWall(cx - 1100, cy - 800, 500, 22); this.addWall(cx - 400, cy - 800, 800, 22); this.addWall(cx + 600, cy - 800, 500, 22);
        this.addWall(cx - 1100, cy - 650, 22, 170); this.addWall(cx - 600, cy - 650, 22, 170); this.addWall(cx - 200, cy - 650, 22, 170); this.addWall(cx + 400, cy - 650, 22, 170); this.addWall(cx + 1100, cy - 650, 22, 170);
        this.addWall(cx - 1100, cy - 500, 800, 22); this.addWall(cx - 100, cy - 500, 400, 22); this.addWall(cx + 500, cy - 500, 600, 22);
        this.addWall(cx - 1100, cy - 350, 22, 300); this.addWall(cx - 800, cy - 350, 600, 22); this.addWall(cx - 800, cy - 350, 22, 300); this.addWall(cx - 800, cy - 50, 600, 22);
        this.addWall(cx - 200, cy - 350, 22, 180); this.addWall(cx + 0, cy - 350, 400, 22); this.addWall(cx + 400, cy - 350, 22, 300); this.addWall(cx + 0, cy - 50, 400, 22);
        this.addWall(cx + 600, cy - 350, 500, 22); this.addWall(cx + 600, cy - 350, 22, 300); this.addWall(cx + 1100, cy - 350, 22, 300); this.addWall(cx + 600, cy - 50, 500, 22);
        this.addWall(cx - 1100, cy + 100, 300, 22); this.addWall(cx - 600, cy + 100, 22, 300); this.addWall(cx - 600, cy + 100, 400, 22); this.addWall(cx - 600, cy + 400, 400, 22);
        this.addWall(cx - 200, cy + 100, 22, 180); this.addWall(cx + 100, cy + 100, 500, 22); this.addWall(cx + 100, cy + 100, 22, 300); this.addWall(cx + 100, cy + 400, 500, 22);
        this.addWall(cx + 600, cy + 100, 22, 180); this.addWall(cx + 800, cy + 100, 300, 22); this.addWall(cx + 800, cy + 100, 22, 300); this.addWall(cx + 800, cy + 400, 300, 22);
        this.addWall(cx - 1100, cy + 450, 700, 22); this.addWall(cx - 200, cy + 450, 400, 22); this.addWall(cx + 400, cy + 450, 700, 22);
        this.addWall(cx - 1100, cy + 450, 22, 300); this.addWall(cx - 400, cy + 600, 22, 180); this.addWall(cx - 400, cy + 450, 22, 170); this.addWall(cx + 200, cy + 450, 22, 300);
        this.addWall(cx - 1100, cy + 700, 400, 22); this.addWall(cx - 500, cy + 700, 300, 22); this.addWall(cx + 0, cy + 700, 400, 22); this.addWall(cx + 600, cy + 700, 500, 22);
    }

    buildLevel4() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        this.exitX = cx + 1000; this.exitY = cy + 700;
        this.creatureSpawns = [[cx - 600, cy - 600, 0], [cx + 600, cy - 600, 150], [cx - 600, cy + 600, 300], [cx + 600, cy + 600, 450], [cx, cy - 400, 600], [cx, cy + 200, 750]];
        this.tankSpawns = [[cx - 600, cy], [cx + 600, cy], [cx, cy - 700], [cx, cy + 700], [cx + 900, cy + 300]];
        this.powerUpSpawns = [[cx - 800, cy - 200, 'BOOST'], [cx + 800, cy + 200, 'SHIELD'], [cx, cy + 500, 'PULSE']];
        this._buildBorderWalls();
        this.addWall(cx - 1180, cy - 300, 460, 22); this.addWall(cx - 580, cy - 300, 120, 22); this.addWall(cx - 340, cy - 300, 340, 22); this.addWall(cx + 120, cy - 300, 340, 22); this.addWall(cx + 580, cy - 300, 500, 22);
        this.addWall(cx - 1180, cy + 300, 460, 22); this.addWall(cx - 580, cy + 300, 340, 22); this.addWall(cx - 120, cy + 300, 340, 22); this.addWall(cx + 460, cy + 300, 120, 22); this.addWall(cx + 580, cy + 300, 500, 22); // Fixed trapped box opening
        this.addWall(cx - 400, cy - 880, 22, 460); this.addWall(cx - 400, cy - 300, 22, 120); this.addWall(cx - 400, cy - 60, 22, 360); this.addWall(cx - 400, cy + 300, 22, 460);
        this.addWall(cx + 400, cy - 880, 22, 460); this.addWall(cx + 400, cy - 300, 22, 360); this.addWall(cx + 400, cy + 60, 22, 120); this.addWall(cx + 400, cy + 300, 22, 460);
        this.addWall(cx - 900, cy - 700, 200, 22); this.addWall(cx - 900, cy - 500, 22, 200); this.addWall(cx - 700, cy - 700, 22, 200);
        this.addWall(cx + 700, cy - 700, 200, 22); this.addWall(cx + 900, cy - 500, 22, 200);
        this.addWall(cx - 900, cy + 500, 22, 200); this.addWall(cx - 700, cy + 700, 22, 200); this.addWall(cx - 900, cy + 700, 200, 22);
        this.addWall(cx + 700, cy + 500, 200, 22); this.addWall(cx + 900, cy + 500, 22, 200); this.addWall(cx + 700, cy + 700, 200, 22);
        this.addWall(cx - 150, cy - 150, 22, 300); /* Removed trapped right wall */ this.addWall(cx - 150, cy - 150, 280, 22); /* Removed trapped bottom wall to allow exit */
    }

    buildLevel5Boss() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        this.exitX = cx - 1100; this.exitY = cy - 820;
        this.creatureSpawns = [
            [cx + 600, cy - 600, 0], [cx - 600, cy - 600, 110], [cx + 600, cy + 600, 220], [cx - 600, cy + 600, 330],
            [cx, cy - 500, 440], [cx, cy + 500, 550], [cx + 900, cy, 660], [cx - 900, cy, 770],
        ];
        this.tankSpawns = [[cx - 300, cy - 300], [cx + 300, cy - 300], [cx - 300, cy + 300], [cx + 300, cy + 300], [cx, cy], [cx - 800, cy - 300], [cx + 800, cy + 300]];
        this.powerUpSpawns = [[cx - 500, cy + 600, 'BOOST'], [cx + 500, cy - 600, 'SHIELD'], [cx + 700, cy + 600, 'PULSE'], [cx - 700, cy - 600, 'BOOST']];
        this._buildBorderWalls();
        const cellW = 380, cellH = 340;
        const startX = cx - 1100, startY = cy - 850;
        for (let col = 0; col < 6; col++) {
            for (let row = 0; row < 5; row++) {
                const rx = startX + col * cellW, ry = startY + row * cellH;
                if (col < 5) {
                    const gapY = ry + (row % 2 === 0 ? cellH * 0.3 : cellH * 0.6);
                    this.addWall(rx + cellW, ry, 22, Math.max(10, Math.round(gapY - ry - 30)));
                    this.addWall(rx + cellW, gapY + 30, 22, Math.max(10, Math.round(ry + cellH - gapY - 30)));
                }
                if (row < 4) {
                    const gapX = rx + (col % 2 === 0 ? cellW * 0.6 : cellW * 0.3);
                    this.addWall(rx, ry + cellH, Math.max(10, Math.round(gapX - rx - 30)), 22);
                    this.addWall(gapX + 30, ry + cellH, Math.max(10, Math.round(rx + cellW - gapX - 30)), 22);
                }
            }
        }
    }

    _buildBorderWalls() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        this.addWall(cx - 1200, cy - 900, 2400, 20); this.addWall(cx - 1200, cy + 880, 2400, 20);
        this.addWall(cx - 1200, cy - 900, 20, 1800); this.addWall(cx + 1180, cy - 900, 20, 1800);
    }

    // ── HELPERS ────────────────────────────────────────────────────
    addWall(left, top, w, h) {
        const cx = left + w / 2, cy = top + h / 2;
        const v = this.add.rectangle(cx, cy, w, h, 0x070f18).setDepth(2);
        v.setStrokeStyle(1, 0x0d1f2d, 1);
        this.physics.add.existing(v, true);
        this.walls.add(v);
        this.pathfinder.blockRect(left, top, w, h);
        this.wallVisuals.push({ rect: v, lit: false });
    }

    spawnCreature(x, y, pathOffset = 0, speedMult = 1.0) {
        const c = new Creature(this, x, y, this.pathfinder);
        c.pathTimer = pathOffset; c.speedMult = speedMult;
        this.physics.add.collider(c.physCircle, this.walls);
        this.physics.add.overlap(this.player.physCircle, c.physCircle, () => this.onCreatureContact());
        this.creatures.push(c);
    }

    spawnOxyTank(x, y) {
        const tank = this.add.circle(x, y, 10, 0x0088ff).setDepth(3);
        const glow = this.add.circle(x, y, 20, 0x0044aa, 0.25).setDepth(2);
        this.tweens.add({
            targets: [tank, glow], alpha: { from: 1, to: 0.3 },
            scaleX: { from: 1, to: 1.25 }, scaleY: { from: 1, to: 1.25 },
            duration: 1000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });
        this.physics.add.existing(tank, true);
        this.physics.add.overlap(this.player.physCircle, tank, () => {
            if (!tank.active) return;
            tank.destroy(); glow.destroy();
            this.oxygen = Math.min(100, this.oxygen + 40);
            this.audio.oxygen();
            this.cameras.main.flash(200, 0, 100, 255);
            this._showPickupText('+40 OXYGEN', 0x00aaff);
            if (this.isTutorial) this.tutTankGot = true;
        });
    }

    spawnPowerUp(x, y, type) {
        const pu = new PowerUp(this, x, y, type);
        this.physics.add.overlap(this.player.physCircle, pu.body, () => {
            if (!pu.active) return;
            pu.destroy();
            this.powerUps = this.powerUps.filter(p => p !== pu);
            this.activatePowerUp(type);
        });
        this.powerUps.push(pu);
    }

    activatePowerUp(type) {
        const def = POWERUP_TYPES[type];
        const r = (def.color >> 16) & 0xff, g = (def.color >> 8) & 0xff, b = def.color & 0xff;
        this.cameras.main.flash(250, r, g, b);
        this._showPickupText(def.symbol + ' ' + def.label + '!', def.color);
        this.audio.oxygen();
        if (type === 'BOOST') {
            const s = this.activePowerUps.BOOST; s.active = true; clearTimeout(s.timer);
            s.timer = setTimeout(() => { s.active = false; this._showPickupText('SPEED FADING', 0x886600); }, def.duration);
        } else if (type === 'SHIELD') {
            const s = this.activePowerUps.SHIELD; s.active = true;
            this.tweens.add({ targets: this.shieldRing, alpha: { from: 0, to: 1 }, duration: 300 });
            this.shieldRing.setStrokeStyle(2, 0xff6600, 1);
            clearTimeout(s.timer);
            s.timer = setTimeout(() => {
                s.active = false;
                this.tweens.add({ targets: this.shieldRing, alpha: 0, duration: 600 });
                this._showPickupText('SHIELD GONE', 0x883300);
            }, def.duration);
        } else if (type === 'PULSE') {
            this.activePowerUps.PULSE.ready = true;
        }
    }

    onCreatureContact() {
        if (this._invulnerable) return; // Do nothing if in post-shield invulnerability

        if (this.activePowerUps.SHIELD.active) {
            this.activePowerUps.SHIELD.active = false;
            clearTimeout(this.activePowerUps.SHIELD.timer);
            this.tweens.add({ targets: this.shieldRing, alpha: 0, duration: 300 });
            this.cameras.main.shake(200, 0.015);
            this.cameras.main.flash(300, 255, 100, 0);
            this._showPickupText('SHIELD BROKE!', 0xff6600);

            // Give brief invulnerability to avoid double-hit instant death
            this._invulnerable = true;
            this.player.sprite.setAlpha(0.5);
            this.time.delayedCall(1500, () => {
                this._invulnerable = false;
                if (!this.playerDead && this.player?.sprite?.active) this.player.sprite.setAlpha(1);
            });
        } else {
            this.onPlayerDeath();
        }
    }

    _showPickupText(msg, color) {
        const SW = this.scale.width, SH = this.scale.height;
        const hex = '#' + color.toString(16).padStart(6, '0');
        const txt = this.add.text(SW / 2, SH / 2 - 60, msg, {
            fontSize: '20px', color: hex, fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: hex, blur: 10, fill: true }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.tweens.add({ targets: txt, y: txt.y - 50, alpha: 0, duration: 1400, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });
    }

    updatePowerUpHUD() {
        const parts = [];
        if (this.activePowerUps.BOOST.active) parts.push('▶▶ SPEED');
        if (this.activePowerUps.SHIELD.active) parts.push('◈ SHIELD');
        if (this.activePowerUps.PULSE.ready) parts.push('◎ MEGA PING READY');
        this.powerUpBar.setText(parts.join('   '));
    }

    // ── SONAR ──────────────────────────────────────────────────────
    pingWalls(pingX, pingY, radius) {
        this.wallVisuals.forEach(w => {
            const dx = w.rect.x - pingX, dy = w.rect.y - pingY;
            if (Math.sqrt(dx * dx + dy * dy) < radius * 1.1 && !w.lit) {
                w.lit = true;
                this.tweens.killTweensOf(w.rect);
                w.rect.setFillStyle(0x1a3a4a); w.rect.setStrokeStyle(1, 0x2a5a6a, 0.8);
                this.tweens.add({
                    targets: w.rect, alpha: { from: 1, to: 0.35 }, duration: 200, ease: 'Sine.easeInOut', yoyo: true, repeat: 1,
                    onComplete: () => {
                        this.time.delayedCall(C.SONAR_DURATION * 0.5, () => {
                            if (!w.rect?.active) return;
                            this.tweens.add({
                                targets: w.rect, alpha: 1, duration: 400,
                                onComplete: () => {
                                    if (!w.rect?.active) return;
                                    w.rect.setFillStyle(0x070f18); w.rect.setStrokeStyle(1, 0x0d1f2d, 1);
                                    w.rect.setAlpha(1); w.lit = false;
                                }
                            });
                        });
                    }
                });
            }
        });
    }

    fireSonar() {
        const now = this.time.now;
        if (now - this.lastPingTime < C.SONAR_COOLDOWN) return;
        this.lastPingTime = now;
        this.pingCount++;
        this.pingText.setText('PINGS: ' + this.pingCount);
        const x = this.player.x, y = this.player.y;
        this.audio.sonar();
        if (this.isTutorial) this.tutPinged = true;

        const radius = this.activePowerUps.PULSE.ready ? C.SONAR_RADIUS * 2 : C.SONAR_RADIUS;
        if (this.activePowerUps.PULSE.ready) { this.activePowerUps.PULSE.ready = false; this._showPickupText('◎ MEGA PING', 0xff00ff); }

        const ring = this.add.circle(x, y, 4, 0x00ffcc, 0).setDepth(9);
        ring.setStrokeStyle(2, 0x00ffcc, 1);
        this.tweens.add({ targets: ring, scaleX: radius / 4, scaleY: radius / 4, alpha: { from: 1, to: 0 }, duration: (radius / C.SONAR_RING_SPEED) * 1000, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        const ring2 = this.add.circle(x, y, 4, 0x00ffcc, 0).setDepth(9);
        ring2.setStrokeStyle(1, 0x00ffcc, 0.3);
        this.tweens.add({ targets: ring2, scaleX: (radius * 1.6) / 4, scaleY: (radius * 1.6) / 4, alpha: { from: 0.3, to: 0 }, duration: (radius / C.SONAR_RING_SPEED) * 1600, ease: 'Quad.easeOut', onComplete: () => ring2.destroy() });

        this.reveals.push({ x, y, elapsed: 0, duration: C.SONAR_DURATION, radius });
        this.creatures.forEach(c => c.onPing(x, y));
        this.pingWalls(x, y, radius);
    }

    // ── OXYGEN ─────────────────────────────────────────────────────
    updateOxygen(delta) {
        this.oxygen -= this.oxyDrain * (delta / 1000);
        if (this.oxygen <= 0) { this.oxygen = 0; this.onPlayerDeath(); return; }
        const pct = this.oxygen / 100;
        this.oxyBar.width = 204 * pct;
        if (pct < 0.25) this.oxyBar.setFillStyle(0xff2200);
        else if (pct < 0.55) this.oxyBar.setFillStyle(0xffaa00);
        else this.oxyBar.setFillStyle(0x00aaff);
        if (pct < 0.25 && !this.lowOxyPulse) {
            this.lowOxyPulse = true;
            this.tweens.add({ targets: this.oxyBar, alpha: { from: 1, to: 0.15 }, duration: 350, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
        } else if (pct >= 0.25 && this.lowOxyPulse) {
            this.lowOxyPulse = false;
            this.tweens.killTweensOf(this.oxyBar);
            this.oxyBar.setAlpha(1);
        }
    }

    // ── DANGER ─────────────────────────────────────────────────────
    updateDanger(now) {
        let minDist = Infinity, anyChasing = false;
        this.creatures.forEach(c => {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.physCircle.x, c.physCircle.y);
            if (d < minDist) minDist = d;
            if (c.state === 'CHASE') anyChasing = true;
        });
        if (!this.isTutorial) this.audio.setDanger(minDist, C.DANGER_DISTANCE, C.HEARTBEAT_DISTANCE);
        if (anyChasing && now - this.lastGrowl > 1800) { this.lastGrowl = now; this.audio.growl(); }
        if (minDist < C.DANGER_DISTANCE) {
            this.dangerText.setText('⚠  CREATURE CLOSE  ⚠').setAlpha(1);
            if (now - this.lastWarning > 2600) { this.lastWarning = now; this.audio.warning(); }
        } else if (minDist < C.HEARTBEAT_DISTANCE) {
            this.dangerText.setText('· · ·').setAlpha(0.6);
        } else {
            this.dangerText.setAlpha(0);
        }
    }

    // ── ARROW ──────────────────────────────────────────────────────
    updateArrow() {
        if (this.isTutorial) { this.arrowGraphic.clear(); this.arrowDist.setAlpha(0); return; }
        const SW = this.scale.width, SH = this.scale.height;
        const g = this.arrowGraphic;
        g.clear();
        const dx = this.exitX - this.player.x, dy = this.exitY - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const cam = this.cameras.main;
        const onScreen = this.exitX > cam.worldView.x + 60 && this.exitX < cam.worldView.right - 60 && this.exitY > cam.worldView.y + 60 && this.exitY < cam.worldView.bottom - 60;
        if (onScreen) { this.arrowDist.setAlpha(0); return; }
        const orbitR = Math.min(SW, SH) * 0.38;
        const ax = SW / 2 + Math.cos(angle) * orbitR;
        const ay = SH / 2 + Math.sin(angle) * orbitR;
        const pulse = 0.6 + Math.sin(this.time.now / 300) * 0.4;
        const size = 14;
        g.fillStyle(0x00ff88, pulse);
        g.beginPath();
        g.moveTo(ax + Math.cos(angle) * size, ay + Math.sin(angle) * size);
        g.lineTo(ax + Math.cos(angle + 2.4) * size, ay + Math.sin(angle + 2.4) * size);
        g.lineTo(ax + Math.cos(angle - 2.4) * size, ay + Math.sin(angle - 2.4) * size);
        g.closePath(); g.fillPath();
        this.arrowDist.setText('EXIT ' + Math.round(dist / 16) + 'm').setPosition(ax + Math.cos(angle + Math.PI) * 30, ay + Math.sin(angle + Math.PI) * 30).setAlpha(pulse * 0.8);
    }

    // ── SCORE ──────────────────────────────────────────────────────
    calcScore() {
        const timeBonus = Math.max(0, 300 - Math.floor((Date.now() - this.startTime) / 1000));
        const oxyBonus = Math.floor(this.oxygen * 2);
        const pingPenalty = this.pingCount * 5;
        return Math.max(0, timeBonus + oxyBonus - pingPenalty) * Math.max(1, this.level);
    }

    saveScore(total, level) {
        try {
            const scores = JSON.parse(localStorage.getItem('abyss_scores') || '[]');
            const now = new Date();
            scores.push({ score: total, level, date: (now.getMonth() + 1) + '/' + now.getDate() });
            scores.sort((a, b) => b.score - a.score);
            localStorage.setItem('abyss_scores', JSON.stringify(scores.slice(0, 10)));
        } catch { }
    }

    // ── END STATES ─────────────────────────────────────────────────
    onPlayerDeath() {
        if (this.playerDead) return;
        this.playerDead = true;
        if (!this.isTutorial) this.saveScore(this.totalScore, this.level);
        this.audio.stopMusic(); this.audio.lose();
        this.player.playDeath();
        this.cameras.main.shake(600, 0.03);
        this.cameras.main.flash(500, 255, 0, 0);
        const SW = this.scale.width, SH = this.scale.height;

        const titleTxt = this.isTutorial ? 'TRAINING FAILED' : 'YOU DIED';
        const titleColor = '#ff2200';
        this.add.text(SW / 2, SH / 2 - 45, titleTxt, {
            fontSize: this.isTutorial ? '42px' : '56px', color: titleColor, fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: '#ff0000', blur: 24, fill: true }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);

        if (!this.isTutorial) {
            this.add.text(SW / 2, SH / 2 + 16, 'FINAL SCORE: ' + this.totalScore, {
                fontSize: '22px', color: '#aa4422', fontFamily: 'monospace'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
            this.add.text(SW / 2, SH / 2 + 50, 'REACHED LEVEL ' + this.level, {
                fontSize: '14px', color: '#883322', fontFamily: 'monospace'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        }
        this.add.text(SW / 2, SH / 2 + (this.isTutorial ? 24 : 82), 'R — Retry   M — Menu', {
            fontSize: '16px', color: '#aa4422', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this._bindEndKeys(this.level, 0); // Changed to restart at current level instead of level 1
    }

    onLevelComplete() {
        if (this.playerDead || this.levelComplete) return;
        this.levelComplete = true;
        this.audio.stopMusic(); this.audio.win();
        this.cameras.main.flash(800, 0, 255, 136);
        this.cameras.main.shake(300, 0.01);
        const SW = this.scale.width, SH = this.scale.height;
        const levelScore = this.calcScore();
        const newTotal = this.totalScore + levelScore;
        const nextLevel = this.level + 1;
        const hasNext = nextLevel <= 5;
        const isBoss = this.level === 5;

        if (isBoss) this.saveScore(newTotal, this.level);
        PauseScene.markLevelCompleted(this.level);

        const gp = window._gp;
        const crossLbl = gp?.connected ? (gp.isPS5() ? '✕' : 'A') : 'SPACE';

        if (this.isTutorial) {
            this.tutPrompts.forEach(t => { try { t.destroy(); } catch (e) { } });
            this.add.text(SW / 2, SH / 2 - 30, 'TRAINING COMPLETE', {
                fontSize: '38px', color: '#00ff88', fontFamily: 'monospace',
                shadow: { offsetX: 0, offsetY: 0, color: '#00ff88', blur: 20, fill: true }
            }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
            this.add.text(SW / 2, SH / 2 + 22, '"I remember this now. The real descent begins."', {
                fontSize: '13px', color: '#4ab890', fontFamily: 'monospace'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
            this.add.text(SW / 2, SH / 2 + 50, crossLbl + ' — Begin   M — Menu', {
                fontSize: '14px', color: '#3a8a6a', fontFamily: 'monospace'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(30);

            const doTutContinue = () => {
                if (this._tutContinued) return; this._tutContinued = true;
                if (this.textures.exists('fog')) this.textures.remove('fog');
                this.scene.start('StoryScene', { beat: 0, nextLevel: 1, score: 0 });
            };
            this.input.keyboard.once('keydown-SPACE', doTutContinue);
            this.input.keyboard.once('keydown-M', () => {
                if (this.textures.exists('fog')) this.textures.remove('fog');
                this.scene.start('MenuScene');
            });
            // Gamepad X to continue
            if (gp?.connected) {
                this._endGpPoll = this.time.addEvent({
                    delay: 80, loop: true, callback: () => {
                        gp.poll();
                        if (gp.isJust(GP.CROSS)) { this._endGpPoll?.remove(); doTutContinue(); }
                        gp.endFrame();
                    }
                });
            }
            return;
        }

        this.add.text(SW / 2, SH / 2 - 75, isBoss ? '⚠  BEACON ACTIVATED' : 'LEVEL CLEAR', {
            fontSize: isBoss ? '44px' : '52px', color: isBoss ? '#ff8844' : '#00ff88', fontFamily: 'monospace',
            shadow: { offsetX: 0, offsetY: 0, color: isBoss ? '#ff4422' : '#00ff88', blur: 24, fill: true }
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.add.text(SW / 2, SH / 2 - 15, 'LEVEL SCORE: +' + levelScore, {
            fontSize: '20px', color: '#4ab890', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.add.text(SW / 2, SH / 2 + 20, 'TOTAL SCORE: ' + newTotal, {
            fontSize: '18px', color: '#3a9a72', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.add.text(SW / 2, SH / 2 + 52, 'PINGS: ' + this.pingCount + '   OXYGEN: ' + Math.floor(this.oxygen) + '%', {
            fontSize: '13px', color: '#5a8899', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
        this.add.text(SW / 2, SH / 2 + 82,
            isBoss ? (crossLbl + ' — The Ending   M — Menu') : (crossLbl + ' — Continue   M — Menu'), {
            fontSize: '15px', color: '#3a8a6a', fontFamily: 'monospace'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);

        const doLevelContinue = () => {
            if (this._lvlContinued) return; this._lvlContinued = true;
            if (this.textures.exists('fog')) this.textures.remove('fog');
            if (isBoss) {
                this.scene.start('OutroScene', { score: newTotal });
            } else {
                this.scene.start('StoryScene', { beat: this.level, nextLevel, score: newTotal });
            }
        };
        this.input.keyboard.once('keydown-SPACE', doLevelContinue);
        this.input.keyboard.once('keydown-M', () => {
            if (this.textures.exists('fog')) this.textures.remove('fog');
            this.scene.start('MenuScene');
        });
        // Gamepad X to continue
        if (gp?.connected) {
            this._endGpPoll = this.time.addEvent({
                delay: 80, loop: true, callback: () => {
                    gp.poll();
                    if (gp.isJust(GP.CROSS)) { this._endGpPoll?.remove(); doLevelContinue(); }
                    gp.endFrame();
                }
            });
        }
    }

    _bindEndKeys(restartLevel, restartScore) {
        this.input.keyboard.once('keydown-R', () => {
            if (this.textures.exists('fog')) this.textures.remove('fog');
            this.scene.restart({ level: restartLevel, score: restartScore });
        });
        this.input.keyboard.once('keydown-M', () => {
            if (this.textures.exists('fog')) this.textures.remove('fog');
            this.scene.start('MenuScene');
        });
    }

    // ── FOG ────────────────────────────────────────────────────────
    updateFog() {
        const SW = this.scale.width, SH = this.scale.height;
        const cam = this.cameras.main, ctx = this.fogCtx;
        ctx.clearRect(0, 0, SW, SH);
        ctx.fillStyle = 'rgba(5,13,21,0.97)';
        ctx.fillRect(0, 0, SW, SH);
        ctx.globalCompositeOperation = 'destination-out';
        const ar = this.playerAura;
        const aura = ctx.createRadialGradient(SW / 2, SH / 2, 0, SW / 2, SH / 2, ar);
        aura.addColorStop(0, 'rgba(255,255,255,1)');
        aura.addColorStop(0.6, 'rgba(255,255,255,0.9)');
        aura.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(SW / 2, SH / 2, ar, 0, Math.PI * 2); ctx.fill();
        this.reveals.forEach(r => {
            const fadeStart = r.duration * 0.55;
            let alpha = r.elapsed > fadeStart ? Math.max(0, 1 - (r.elapsed - fadeStart) / (r.duration - fadeStart)) : 1;
            const sx = r.x - cam.worldView.x, sy = r.y - cam.worldView.y;
            const rad = r.radius || C.SONAR_RADIUS;
            const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
            grd.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
            grd.addColorStop(0.6, 'rgba(255,255,255,' + (alpha * 0.8) + ')');
            grd.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
        if (this.fogTex?.refresh) {
            try { this.fogTex.refresh(); } catch (e) { } // prevent transitioning errors
        }
    }

    // ── MAIN LOOP ──────────────────────────────────────────────────
    update(time, delta) {
        const gp = window._gp;
        if (gp?.connected) gp.poll();

        // Pause
        const escJust = Phaser.Input.Keyboard.JustDown(this.escKey);
        const gpPause = gp?.connected && gp.isJust(GP.OPTIONS);
        const mobilePause = this.mobile.isPauseJustPressed?.() || false;
        if ((escJust || gpPause || mobilePause) && !this.playerDead && !this.levelComplete) {
            if (!this.isTutorial) this.audio.stopMusic();
            // Fully hide GameScene camera so PauseScene renders cleanly with no bleed-through
            this.cameras.main.setAlpha(0);
            this.scene.pause('GameScene');
            this.scene.launch('PauseScene', { level: this.level, score: this.totalScore });
            if (gp?.connected) gp.endFrame();
            return;
        }

        if (this.playerDead || this.levelComplete) {
            if (gp?.connected) {
                if (gp.isJust(GP.CROSS)) {
                    if (this.textures.exists('fog')) this.textures.remove('fog');
                    this.scene.restart({ level: this.playerDead ? this.level : this.level + 1, score: 0 }); // Fixed controller restarting
                }
                gp.endFrame();
            }
            return;
        }

        // Movement
        let vx = 0, vy = 0;
        const mv = this.mobile.getVelocity(C.PLAYER_SPEED);
        if (mv) {
            vx = mv.vx; vy = mv.vy;
        } else if (gp?.connected) {
            const stick = gp.leftStick(), dpad = gp.dpad();
            const ax = stick.x || dpad.x, ay = stick.y || dpad.y;
            if (Math.abs(ax) > 0 || Math.abs(ay) > 0) {
                const len = Math.sqrt(ax * ax + ay * ay);
                vx = (ax / Math.max(len, 1)) * C.PLAYER_SPEED;
                vy = (ay / Math.max(len, 1)) * C.PLAYER_SPEED;
            }
        } else {
            if (this.wasd.A.isDown || this.cursors.left.isDown) vx = -C.PLAYER_SPEED;
            else if (this.wasd.D.isDown || this.cursors.right.isDown) vx = C.PLAYER_SPEED;
            if (this.wasd.W.isDown || this.cursors.up.isDown) vy = -C.PLAYER_SPEED;
            else if (this.wasd.S.isDown || this.cursors.down.isDown) vy = C.PLAYER_SPEED;
            if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
        }

        const boost = this.activePowerUps.BOOST.active;
        if (boost) { vx *= 1.55; vy *= 1.55; }

        // Apply velocity to physics body
        this.player.setVelocity(vx, vy);
        // Update player entity (animations, trail, glow)
        this.player.update(vx, vy, boost);

        // Sonar
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.fireSonar();
        if (gp?.connected) {
            const held = gp.isHeld(GP.CROSS) || gp.isHeld(GP.R1);
            if (held && !this._gpSonarHeld) { this._gpSonarHeld = true; this.fireSonar(); }
            else if (!held) this._gpSonarHeld = false;
        }

        // Reveals decay
        for (let i = this.reveals.length - 1; i >= 0; i--) {
            this.reveals[i].elapsed += delta;
            if (this.reveals[i].elapsed >= this.reveals[i].duration) this.reveals.splice(i, 1);
        }

        this.creatures.forEach(c => c.update(delta, this.player));
        this.updateOxygen(delta);
        this.updateDanger(time);
        this.updateArrow();
        if (!this.isTutorial) this.updatePowerUpHUD();
        if (this.isTutorial) this.updateTutorial();

        if (this.textures?.exists('fog') && this.fogTex?.context) {
            try { this.updateFog(); } catch (e) { }
        }

        if (gp?.connected) gp.endFrame();
    }

    drawGrid() {
        const cx = this.SPAWN_X, cy = this.SPAWN_Y;
        const x0 = cx - 1200, y0 = cy - 900, x1 = cx + 1200, y1 = cy + 900;
        const g = this.add.graphics().setDepth(1);
        g.lineStyle(1, 0x080f18, 1);
        for (let x = x0; x <= x1; x += C.TILE_SIZE) g.lineBetween(x, y0, x, y1);
        for (let y = y0; y <= y1; y += C.TILE_SIZE) g.lineBetween(x0, y, x1, y);
    }
}