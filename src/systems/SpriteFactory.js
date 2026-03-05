/**
 * SpriteFactory — generates all sprites via Canvas 2D at runtime.
 * No image files needed. Registers frames correctly with Phaser's texture system.
 *
 * Player spritesheet: 11 frames, each PW×PH px
 *   0-1   idle bob
 *   2-5   swim right
 *   6-9   swim left (mirrored from right)
 *   10    death
 *
 * Creature spritesheet: 8 frames, each CW×CH px
 *   0-3   patrol (purple, calm tentacles)
 *   4-7   chase  (red, aggressive)
 */

const PW = 32, PH = 48;   // player frame dims (bigger = clearer)
const CW = 56, CH = 56;   // creature frame dims
const P_FRAMES = 11;
const C_FRAMES = 8;

// ─────────────────────────────────────────────────────────────
//  PLAYER FRAME DRAW
// ─────────────────────────────────────────────────────────────
function drawPlayerFrame(ctx, destX, destY, frameIndex, flipX) {
    // Use an offscreen temp canvas so flipping is clean
    const tmp = document.createElement('canvas');
    tmp.width = PW; tmp.height = PH;
    const c = tmp.getContext('2d');

    const cx = PW / 2;
    const bob = Math.sin(frameIndex * Math.PI * 0.5) * 2;
    const arm = Math.sin(frameIndex * Math.PI * 0.5) * 5;
    const leg = Math.cos(frameIndex * Math.PI * 0.5) * 4;

    c.clearRect(0, 0, PW, PH);

    // Tank glow
    const tg = c.createRadialGradient(cx - 5, 18 + bob, 0, cx - 5, 18 + bob, 12);
    tg.addColorStop(0, 'rgba(0,255,204,0.28)');
    tg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = tg; c.fillRect(0, 0, PW, PH);

    // Tank
    c.fillStyle = '#1a3a4a';
    c.beginPath(); c.roundRect(cx - 11, 13 + bob, 5, 14, 2); c.fill();
    c.fillStyle = '#00ffcc';
    c.beginPath(); c.arc(cx - 9, 14 + bob, 2, 0, Math.PI * 2); c.fill();

    // Left arm
    c.fillStyle = '#0e1d2c';
    c.save(); c.translate(cx - 8, 18 + bob); c.rotate(-0.4 + arm * 0.05);
    c.fillRect(-2, 0, 5, 10); c.fillStyle = '#081420';
    c.fillRect(-2, 9, 5, 3); c.restore();

    // Right arm
    c.fillStyle = '#0e1d2c';
    c.save(); c.translate(cx + 8, 18 + bob); c.rotate(0.4 - arm * 0.05);
    c.fillRect(-3, 0, 5, 10); c.fillStyle = '#081420';
    c.fillRect(-3, 9, 5, 3); c.restore();

    // Torso
    c.fillStyle = '#0c1b29';
    c.beginPath(); c.roundRect(cx - 7, 14 + bob, 14, 19, 4); c.fill();
    c.fillStyle = '#1a3a50';
    c.fillRect(cx - 3, 17 + bob, 6, 12);

    // Left leg
    c.fillStyle = '#0b1928';
    c.save(); c.translate(cx - 4, 31 + bob); c.rotate(-leg * 0.07);
    c.fillRect(-3, 0, 5, 12);
    c.fillStyle = '#091522';
    c.beginPath(); c.moveTo(-4, 11); c.lineTo(-8, 15); c.lineTo(4, 15); c.closePath(); c.fill();
    c.restore();

    // Right leg
    c.fillStyle = '#0b1928';
    c.save(); c.translate(cx + 4, 31 + bob); c.rotate(leg * 0.07);
    c.fillRect(-2, 0, 5, 12);
    c.fillStyle = '#091522';
    c.beginPath(); c.moveTo(-3, 11); c.lineTo(2, 15); c.lineTo(7, 15); c.closePath(); c.fill();
    c.restore();

    // Helmet
    c.fillStyle = '#0a1520';
    c.beginPath(); c.arc(cx, 10 + bob, 10, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1a3545'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, 10 + bob, 10, 0, Math.PI * 2); c.stroke();

    // Visor glow
    const vg = c.createRadialGradient(cx + 2, 9 + bob, 0, cx + 2, 9 + bob, 6);
    vg.addColorStop(0, 'rgba(0,255,204,0.95)');
    vg.addColorStop(0.6, 'rgba(0,200,160,0.7)');
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = vg;
    c.beginPath(); c.arc(cx + 2, 9 + bob, 6, 0, Math.PI * 2); c.fill();

    // Visor reflection
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath(); c.arc(cx, 7 + bob, 2.5, 0, Math.PI * 2); c.fill();

    // Death tint
    if (frameIndex === 10) {
        c.fillStyle = 'rgba(255,40,0,0.55)';
        c.beginPath(); c.arc(cx, PH / 2, PW, 0, Math.PI * 2); c.fill();
    }

    // Blit to main canvas (with optional flip)
    ctx.save();
    if (flipX) {
        ctx.translate(destX + PW, destY);
        ctx.scale(-1, 1);
        ctx.drawImage(tmp, 0, 0);
    } else {
        ctx.drawImage(tmp, destX, destY);
    }
    ctx.restore();
}

export function createPlayerSprites(scene) {
    if (scene.textures.exists('player')) return;

    const canvas = document.createElement('canvas');
    canvas.width = PW * P_FRAMES;
    canvas.height = PH;
    const ctx = canvas.getContext('2d');

    // Frame 0-1: idle
    drawPlayerFrame(ctx, 0 * PW, 0, 0, false);
    drawPlayerFrame(ctx, 1 * PW, 0, 2, false);

    // Frame 2-5: swim right
    for (let i = 0; i < 4; i++) {
        drawPlayerFrame(ctx, (2 + i) * PW, 0, i, false);
    }

    // Frame 6-9: swim left (mirror of 2-5)
    for (let i = 0; i < 4; i++) {
        drawPlayerFrame(ctx, (6 + i) * PW, 0, i, true);
    }

    // Frame 10: death
    drawPlayerFrame(ctx, 10 * PW, 0, 10, false);

    // Register texture + frames
    scene.textures.addCanvas('player', canvas);
    const tex = scene.textures.get('player');
    for (let i = 0; i < P_FRAMES; i++) {
        tex.add(i, 0, i * PW, 0, PW, PH);
    }

    // Register animations
    const anims = scene.anims;
    if (!anims.exists('player_idle')) {
        anims.create({ key: 'player_idle', frames: [{ key: 'player', frame: 0 }, { key: 'player', frame: 1 }], frameRate: 2, repeat: -1 });
        anims.create({ key: 'player_swim_right', frames: [{ key: 'player', frame: 2 }, { key: 'player', frame: 3 }, { key: 'player', frame: 4 }, { key: 'player', frame: 5 }], frameRate: 10, repeat: -1 });
        anims.create({ key: 'player_swim_left', frames: [{ key: 'player', frame: 6 }, { key: 'player', frame: 7 }, { key: 'player', frame: 8 }, { key: 'player', frame: 9 }], frameRate: 10, repeat: -1 });
        anims.create({ key: 'player_death', frames: [{ key: 'player', frame: 10 }], frameRate: 1, repeat: 0 });
    }
}

// ─────────────────────────────────────────────────────────────
//  CREATURE FRAME DRAW
// ─────────────────────────────────────────────────────────────
function drawCreatureFrame(ctx, destX, destY, frameIndex, isChase) {
    const tmp = document.createElement('canvas');
    tmp.width = CW; tmp.height = CH;
    const c = tmp.getContext('2d');

    const cx = CW / 2, cy = CH / 2;
    const t = frameIndex * Math.PI * 0.5;
    const bs = isChase ? 1.25 : 1.0;

    const bodyCol = isChase ? '#4a0000' : '#2a0055';
    const eyeCol = isChase ? '#ff2200' : '#cc0044';
    const tentCol = isChase ? '#3a0000' : '#1a0044';
    const tipCol = isChase ? '#ff4400' : '#aa00cc';
    const gColor = isChase ? 'rgba(200,0,0,0.22)' : 'rgba(100,0,180,0.18)';

    // Outer glow
    const og = c.createRadialGradient(cx, cy, 0, cx, cy, 25);
    og.addColorStop(0, gColor); og.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = og; c.fillRect(0, 0, CW, CH);

    // Tentacles
    for (let i = 0; i < 6; i++) {
        const baseAngle = (i / 6) * Math.PI * 2;
        const wave = Math.sin(t + i * 0.8) * (isChase ? 8 : 5);
        const spread = 15;
        const tx1 = cx + Math.cos(baseAngle) * spread;
        const ty1 = cy + Math.sin(baseAngle) * spread * bs;
        const tx2 = tx1 + Math.cos(baseAngle + wave * 0.06) * 12;
        const ty2 = ty1 + Math.sin(baseAngle + wave * 0.06) * 12;

        c.strokeStyle = tentCol; c.lineWidth = 2.5; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(cx + Math.cos(baseAngle) * 9, cy + Math.sin(baseAngle) * 9);
        c.quadraticCurveTo(tx1, ty1, tx2, ty2);
        c.stroke();

        const tipG = c.createRadialGradient(tx2, ty2, 0, tx2, ty2, 3.5);
        tipG.addColorStop(0, tipCol); tipG.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = tipG;
        c.beginPath(); c.arc(tx2, ty2, 3.5, 0, Math.PI * 2); c.fill();
    }

    // Body
    c.fillStyle = bodyCol;
    c.beginPath(); c.ellipse(cx, cy, 14, 17 * bs, 0, 0, Math.PI * 2); c.fill();

    // Body shimmer
    const sh = c.createLinearGradient(cx - 14, cy, cx + 14, cy);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(0.35, isChase ? 'rgba(255,50,0,0.14)' : 'rgba(160,0,255,0.10)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh;
    c.beginPath(); c.ellipse(cx, cy, 14, 17 * bs, 0, 0, Math.PI * 2); c.fill();

    // Eye
    const eyeR = isChase ? 9 : 7;
    const eg = c.createRadialGradient(cx + 2, cy, 0, cx, cy, eyeR);
    eg.addColorStop(0, isChase ? '#ff5500' : '#ff0055');
    eg.addColorStop(0.5, eyeCol);
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = eg;
    c.beginPath(); c.arc(cx, cy, eyeR, 0, Math.PI * 2); c.fill();

    // Eye highlight
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.beginPath(); c.arc(cx - 2, cy - 2, 2.5, 0, Math.PI * 2); c.fill();

    // Chase pulse ring
    if (isChase) {
        c.strokeStyle = 'rgba(255,60,0,' + (0.4 + Math.sin(t) * 0.3) + ')';
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(cx, cy, 17 + Math.sin(t) * 2, 0, Math.PI * 2); c.stroke();
    }

    ctx.drawImage(tmp, destX, destY);
}

export function createCreatureSprites(scene) {
    if (scene.textures.exists('creature')) return;

    const canvas = document.createElement('canvas');
    canvas.width = CW * C_FRAMES;
    canvas.height = CH;
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < 4; i++) drawCreatureFrame(ctx, i * CW, 0, i, false);
    for (let i = 0; i < 4; i++) drawCreatureFrame(ctx, (4 + i) * CW, 0, i, true);

    // Register texture + frames
    scene.textures.addCanvas('creature', canvas);
    const tex = scene.textures.get('creature');
    for (let i = 0; i < C_FRAMES; i++) {
        tex.add(i, 0, i * CW, 0, CW, CH);
    }

    const anims = scene.anims;
    if (!anims.exists('creature_patrol')) {
        anims.create({ key: 'creature_patrol', frames: [{ key: 'creature', frame: 0 }, { key: 'creature', frame: 1 }, { key: 'creature', frame: 2 }, { key: 'creature', frame: 3 }], frameRate: 5, repeat: -1 });
        anims.create({ key: 'creature_chase', frames: [{ key: 'creature', frame: 4 }, { key: 'creature', frame: 5 }, { key: 'creature', frame: 6 }, { key: 'creature', frame: 7 }], frameRate: 10, repeat: -1 });
    }
}