import Phaser from 'phaser';
import { C } from '../Constants.js';

/**
 * Creature — only activates via sonar ping. Once alerted, pursues until
 * player escapes an extreme distance. No proximity vision detection.
 */
export default class Creature {
  constructor(scene, x, y, pathfinder) {
    this.scene = scene;
    this.pathfinder = pathfinder;
    this.state = 'PATROL';
    this.targetX = x;
    this.targetY = y;
    this.investigateTimer = 0;
    this.waypointIndex = 0;
    this.path = [];
    this.pathIndex = 0;
    this.pathTimer = 0;
    this.PATH_RECALC_INTERVAL = 900;
    this.speedMult = 1.0;
    this._lastState = '';
    this._alerted = false; // set true on first ping — never resets to false (unless far)

    this.waypoints = [
      { x, y },
      { x: x - 380, y },
      { x: x - 380, y: y - 280 },
      { x: x + 380, y: y - 280 },
      { x: x + 380, y: y + 280 },
      { x, y: y + 280 },
    ];

    // Physics circle (invisible)
    this.physCircle = scene.add.circle(x, y, 17, 0x000000, 0).setDepth(0);
    scene.physics.add.existing(this.physCircle);
    this.physCircle.body.setCircle(17);
    this.physBody = this.physCircle.body;

    // Sprite visual
    this.sprite = scene.add.sprite(x, y, 'creature', 0).setDepth(14).setScale(1.2);
    this.sprite.play('creature_patrol');

    // Outer glow
    this.glow = scene.add.circle(x, y, 38, 0x440088, 0.32).setDepth(13);
    scene.tweens.add({
      targets: this.glow,
      scaleX: 1.6, scaleY: 1.6,
      alpha: { from: 0.32, to: 0.06 },
      duration: 1400, ease: 'Sine.easeInOut', yoyo: true, repeat: -1
    });
  }

  get body() { return this.physCircle; }

  /** Called when player fires sonar within aggro range */
  onPing(pingX, pingY) {
    const dist = Phaser.Math.Distance.Between(
      this.physCircle.x, this.physCircle.y, pingX, pingY
    );
    if (dist < C.SONAR_AGGRO_RANGE) {
      this._alerted = true;
      this.targetX = pingX;
      this.targetY = pingY;
      this.setState('INVESTIGATE');
      this.investigateTimer = C.CREATURE_INVESTIGATE_TIMEOUT;
      this.recalcPath();
    }
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s; this.path = []; this.pathIndex = 0;
  }

  getSpeed() {
    const m = this.speedMult;
    if (this.state === 'CHASE') return C.CREATURE_CHASE_SPEED * m;
    if (this.state === 'INVESTIGATE') return C.CREATURE_INVESTIGATE_SPEED * m;
    return C.CREATURE_PATROL_SPEED * m;
  }

  recalcPath() {
    const cx = this.physCircle.x, cy = this.physCircle.y;
    const tx = this.state === 'PATROL' ? this.waypoints[this.waypointIndex].x : this.targetX;
    const ty = this.state === 'PATROL' ? this.waypoints[this.waypointIndex].y : this.targetY;
    const p = this.pathfinder.findPath(cx, cy, tx, ty);
    if (p.length > 0) { this.path = p; this.pathIndex = 0; }
  }

  update(delta, player) {
    const cx = this.physCircle.x;
    const cy = this.physCircle.y;
    const distToPlayer = Phaser.Math.Distance.Between(cx, cy, player.x, player.y);

    // ── STATE MACHINE ─────────────────────────────────────────
    // NOTE: creatures do NOT detect player by proximity — only by ping.
    // Once _alerted, they switch to CHASE when they get close enough
    // to the investigate point (meaning player is probably there).
    if (this._alerted && this.state === 'INVESTIGATE' && distToPlayer < 180) {
      this.setState('CHASE');
    }
    if (this._alerted && this.state === 'CHASE') {
      // Update chase target to player's current pos
      this.targetX = player.x;
      this.targetY = player.y;
      // Only stop chasing if player escapes to extreme distance
      if (distToPlayer > 1800) {
        this._alerted = false;
        this.setState('PATROL');
      }
    }
    if (this.state === 'INVESTIGATE') {
      this.investigateTimer -= delta;
      if (this.investigateTimer <= 0) {
        if (this._alerted && distToPlayer < 400) {
          // Still close after investigation — transition to chase
          this.setState('CHASE');
        } else {
          this._alerted = false;
          this.setState('PATROL');
        }
      }
    }

    // ── ANIMATION + GLOW ──────────────────────────────────────
    if (this.state !== this._lastState) {
      this._lastState = this.state;
      if (this.state === 'CHASE') {
        this.sprite.play('creature_chase');
        this.glow.setFillStyle(0x550000, 0.5);
      } else if (this.state === 'INVESTIGATE') {
        this.sprite.play('creature_patrol');
        this.glow.setFillStyle(0x330022, 0.45);
      } else {
        this.sprite.play('creature_patrol');
        this.glow.setFillStyle(0x440088, 0.32);
      }
    }

    // Flip sprite based on movement direction
    if (this.physBody.velocity.x < -15) this.sprite.setFlipX(true);
    else if (this.physBody.velocity.x > 15) this.sprite.setFlipX(false);

    // Path recalc
    this.pathTimer += delta;
    if (this.pathTimer >= this.PATH_RECALC_INTERVAL) { this.pathTimer = 0; this.recalcPath(); }

    // Advance waypoint (patrol)
    if (this.state === 'PATROL') {
      const wp = this.waypoints[this.waypointIndex];
      if (Phaser.Math.Distance.Between(cx, cy, wp.x, wp.y) < 24) {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        this.recalcPath();
      }
    }

    // Move along path
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      const node = this.path[this.pathIndex];
      if (Phaser.Math.Distance.Between(cx, cy, node.x, node.y) < 20) this.pathIndex++;
      if (this.pathIndex < this.path.length) {
        const tgt = this.path[this.pathIndex];
        const angle = Math.atan2(tgt.y - cy, tgt.x - cx);
        const spd = this.getSpeed();
        this.physBody.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
      } else {
        this.physBody.setVelocity(0, 0);
      }
    } else {
      if (this.state !== 'PATROL') {
        const angle = Math.atan2(this.targetY - cy, this.targetX - cx);
        const spd = this.getSpeed() * 0.5;
        this.physBody.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
      } else {
        this.physBody.setVelocity(0, 0);
      }
    }

    // Sync visuals
    this.sprite.setPosition(this.physCircle.x, this.physCircle.y);
    this.glow.setPosition(this.physCircle.x, this.physCircle.y);
  }

  destroy() {
    try { this.sprite.destroy(); } catch (e) { }
    try { this.glow.destroy(); } catch (e) { }
    try { this.physCircle.destroy(); } catch (e) { }
  }
}