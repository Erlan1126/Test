import Phaser from "phaser";
import { aimError, findCapture, orbitPoint, rayDistance, spinFromApproach, tangent, type Planet, type Spin, type Vec } from "../logic/orbit";
import { createRng } from "../logic/rng";
import { difficulty, WORLD_W, WorldGen, type Asteroid, type Star } from "../logic/world";
import { addBackdrop } from "./backdrop";
import { RING_COLORS } from "./BootScene";
import type { GameServices } from "../main";

/** Extra reach of a planet's pull beyond its orbit, px. */
const CAPTURE_MARGIN = 14;
/** A launch within this angle of the next planet's center counts as perfect (radians). */
const PERFECT_AIM = 0.1;
/** Flying longer than this without reaching a planet means you drifted off into space. */
const MAX_FLIGHT = 2.6;
const PLAYER_R = 10;

interface PlanetView {
  glow: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
}

export interface RunResult {
  hops: number;
  stars: number;
  bestCombo: number;
  reason: string;
}

export class GameScene extends Phaser.Scene {
  private gen!: WorldGen;
  private planets: Planet[] = [];
  private stars: Star[] = [];
  private asteroids: Asteroid[] = [];
  private planetViews = new Map<number, PlanetView>();
  private starViews = new Map<number, Phaser.GameObjects.Image>();
  private rockViews = new Map<number, Phaser.GameObjects.Image>();

  private player!: Phaser.GameObjects.Image;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private hopsText!: Phaser.GameObjects.Text;
  private starsText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private updateBackdrop!: (scrollY: number) => void;

  // Player state: circling `current`, or flying in a straight line.
  private mode: "orbit" | "fly" | "dead" = "orbit";
  private current!: Planet;
  private angle = 0;
  private spin: Spin = 1;
  private radius = 0;
  private pos: Vec = { x: 0, y: 0 };
  private vel: Vec = { x: 0, y: 0 };
  private leftId = -1;
  private flight = 0;
  private elapsed = 0;

  private hops = 0;
  private reached = 0; // highest planet index reached
  private combo = 0;
  private bestCombo = 0;
  private starsTaken = 0;
  private aimedPerfect = false;

  constructor() {
    super("Game");
  }

  private get services(): GameServices {
    return this.registry.get("services") as GameServices;
  }

  create(): void {
    this.planets = []; this.stars = []; this.asteroids = [];
    this.planetViews.clear(); this.starViews.clear(); this.rockViews.clear();
    this.hops = 0; this.reached = 0; this.combo = 0; this.bestCombo = 0; this.starsTaken = 0;
    this.elapsed = 0; this.flight = 0; this.mode = "orbit";

    this.updateBackdrop = addBackdrop(this);
    this.gen = new WorldGen(createRng((Math.random() * 2 ** 31) | 0));
    const first = this.gen.first();
    this.addPlanet(first);
    while (this.planets.length < 5) this.spawnNext();

    this.current = first;
    this.angle = -Math.PI / 2;
    this.spin = 1;
    this.radius = first.orbitR;
    this.pos = orbitPoint(first, this.radius, this.angle);

    this.aimGuide = this.add.graphics().setDepth(5);
    this.trail = this.add.particles(0, 0, "spark", {
      lifespan: 420,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [0x9fe8ff, 0xffffff, 0x8ab4ff],
      frequency: 14,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(6);
    this.player = this.add.image(this.pos.x, this.pos.y, "comet").setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.trail.startFollow(this.player);

    // Center the world horizontally on screens wider than it, and start with the
    // first planet in the same spot whatever the screen height.
    const { width: sw, height: sh } = this.scale;
    this.cameras.main.scrollX = (WORLD_W - sw) / 2;
    this.cameras.main.scrollY = first.y - sh * 0.62;

    const font = "system-ui, -apple-system, 'Segoe UI', sans-serif";
    this.hopsText = this.add.text(sw / 2, 70, "0", { fontFamily: font, fontSize: "88px", fontStyle: "900", color: "#ffffff" })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(50).setShadow(0, 6, "rgba(0,0,0,0.35)", 12);
    this.add.image(sw - 150, 62, "star").setScrollFactor(0).setDepth(50).setScale(0.8);
    this.starsText = this.add.text(sw - 124, 62, "0", { fontFamily: font, fontSize: "34px", fontStyle: "800", color: "#ffe28a" })
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(50);
    this.hintText = this.add.text(sw / 2, sh - 150, "Tap to launch toward the next planet", {
      fontFamily: font, fontSize: "30px", fontStyle: "700", color: "#ffffff", align: "center",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50).setAlpha(this.services.save.games < 3 ? 0.9 : 0);

    this.input.on("pointerdown", () => this.launch());
    this.input.keyboard?.on("keydown-SPACE", () => this.launch());

    if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __game: GameScene }).__game = this;
  }

  // ---------- World ----------
  private addPlanet(p: Planet): void {
    this.planets.push(p);
    const scale = (p.r * 2) / 240;
    const glow = this.add.image(p.x, p.y, "glow").setScale((p.orbitR * 2.2) / 128).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD).setTint(RING_COLORS[p.look]);
    const body = this.add.image(p.x, p.y, `planet-${p.look}`).setScale(scale).setDepth(2);
    const ring = this.add.graphics().setDepth(1);
    this.drawRing(ring, p, false);
    this.planetViews.set(p.id, { glow, body, ring });
  }

  private drawRing(g: Phaser.GameObjects.Graphics, p: Planet, active: boolean): void {
    g.clear();
    g.lineStyle(active ? 4 : 3, RING_COLORS[p.look], active ? 0.55 : 0.28);
    const dashes = Math.round(p.orbitR / 6);
    for (let i = 0; i < dashes; i++) {
      const a0 = (i / dashes) * Math.PI * 2;
      g.beginPath();
      g.arc(0, 0, p.orbitR, a0, a0 + (Math.PI / dashes) * 1.1);
      g.strokePath();
    }
  }

  private spawnNext(): void {
    const prev = this.planets[this.planets.length - 1];
    const seg = this.gen.next(prev, this.planets.length);
    this.addPlanet(seg.planet);
    for (const s of seg.stars) {
      this.stars.push(s);
      const img = this.add.image(s.x, s.y, "star").setDepth(3);
      this.tweens.add({ targets: img, scale: 1.15, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.starViews.set(s.id, img);
    }
    for (const a of seg.asteroids) {
      this.asteroids.push(a);
      this.rockViews.set(a.id, this.add.image(a.x, a.y, "rock").setDepth(4).setScale((a.r * 2) / 52));
    }
  }

  private nextPlanet(): Planet | undefined {
    return this.planets[this.planets.indexOf(this.current) + 1];
  }

  // ---------- Input ----------
  private launch(): void {
    this.services.sfx.unlock();
    if (this.mode !== "orbit") return;
    const speed = difficulty(this.reached).launchSpeed;
    const dir = tangent(this.angle, this.spin);
    this.vel = { x: dir.x * speed, y: dir.y * speed };
    const next = this.nextPlanet();
    this.aimedPerfect = !!next && aimError(this.pos, this.vel, next) < PERFECT_AIM;
    this.leftId = this.current.id;
    this.mode = "fly";
    this.flight = 0;
    this.drawRing(this.planetViews.get(this.current.id)!.ring, this.current, false);
    this.services.sfx.launch();
    this.hintText.setAlpha(0);
  }

  // ---------- Loop ----------
  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.elapsed += dt;

    for (const p of this.planets) {
      if (p.sway) p.x = p.baseX + Math.sin(this.elapsed * p.swaySpeed + p.swayPhase) * p.sway;
      const v = this.planetViews.get(p.id);
      if (v) { v.glow.x = v.body.x = v.ring.x = p.x; v.glow.y = v.body.y = v.ring.y = p.y; v.body.rotation += dt * 0.15; }
    }
    for (const a of this.asteroids) {
      a.x += a.vx * dt;
      if (a.x < a.minX || a.x > a.maxX) { a.vx *= -1; a.x = Phaser.Math.Clamp(a.x, a.minX, a.maxX); }
      const img = this.rockViews.get(a.id);
      if (img) { img.x = a.x; img.rotation += dt * 1.2; }
    }

    if (this.mode === "orbit") this.stepOrbit(dt);
    else if (this.mode === "fly") this.stepFlight(dt);

    this.player.setPosition(this.pos.x, this.pos.y);
    this.drawAim();
    this.followCamera(dt);
    this.updateBackdrop(this.cameras.main.scrollY);
    this.recycle();
  }

  private stepOrbit(dt: number): void {
    const p = this.current;
    this.radius = Phaser.Math.Linear(this.radius, p.orbitR, Math.min(1, dt * 8));
    this.angle += (this.spin * difficulty(this.reached).orbitSpeed * dt) / this.radius;
    this.pos = orbitPoint(p, this.radius, this.angle);
  }

  private stepFlight(dt: number): void {
    this.flight += dt;
    this.pos = { x: this.pos.x + this.vel.x * dt, y: this.pos.y + this.vel.y * dt };

    // Once clear of the planet just left, its pull can catch you again.
    const left = this.planets.find(p => p.id === this.leftId);
    if (left && Math.hypot(this.pos.x - left.x, this.pos.y - left.y) > left.orbitR + CAPTURE_MARGIN + 4) this.leftId = -1;

    const hit = findCapture(this.pos, this.planets, this.leftId, CAPTURE_MARGIN);
    if (hit) { this.capture(hit); return; }

    for (const s of this.stars) {
      if (Math.hypot(this.pos.x - s.x, this.pos.y - s.y) < 34) this.takeStar(s);
    }
    for (const a of this.asteroids) {
      if (Math.hypot(this.pos.x - a.x, this.pos.y - a.y) < a.r + PLAYER_R) { this.fail("Hit an asteroid"); return; }
    }
    const cam = this.cameras.main;
    const off = this.pos.x < cam.scrollX - 30 || this.pos.x > cam.scrollX + cam.width + 30 || this.pos.y > cam.scrollY + cam.height + 40;
    if (off || this.flight > MAX_FLIGHT) this.fail("Lost in space");
  }

  private capture(p: Planet): void {
    const rel = { x: this.pos.x - p.x, y: this.pos.y - p.y };
    this.spin = spinFromApproach(rel, this.vel);
    this.angle = Math.atan2(rel.y, rel.x);
    this.radius = Math.hypot(rel.x, rel.y);
    this.current = p;
    this.mode = "orbit";
    this.drawRing(this.planetViews.get(p.id)!.ring, p, true);

    const index = this.planets.indexOf(p);
    if (index <= this.reached) return; // drifted back to an old planet: no score
    const gained = index - this.reached;
    this.reached = index;
    this.hops += gained;
    if (this.aimedPerfect && gained === 1) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.hops += this.combo; // perfect launches pay a growing bonus
      this.popup(`PERFECT +${this.combo}`, p, "#ffe28a");
      this.services.sfx.perfect();
      this.cameras.main.flash(120, 255, 240, 200, false);
    } else {
      this.combo = 0;
    }
    this.services.sfx.capture(this.combo);
    this.hopsText.setText(String(this.hops));
    this.tweens.add({ targets: this.hopsText, scale: { from: 1.18, to: 1 }, duration: 220 });
    this.pulse(p);
    try { navigator.vibrate?.(this.combo ? 25 : 12); } catch { /* not supported */ }
    while (this.planets.length - index < 5) this.spawnNext();
  }

  private takeStar(s: Star): void {
    this.stars = this.stars.filter(x => x !== s);
    const img = this.starViews.get(s.id);
    this.starViews.delete(s.id);
    if (img) {
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, scale: 1.8, alpha: 0, y: img.y - 30, duration: 260, onComplete: () => img.destroy() });
    }
    this.starsTaken++;
    this.starsText.setText(String(this.starsTaken));
    this.services.sfx.star();
  }

  private fail(reason: string): void {
    if (this.mode === "dead") return;
    this.mode = "dead";
    this.trail.stop();
    this.services.sfx.fail();
    this.cameras.main.shake(260, 0.012);
    this.tweens.add({ targets: this.player, alpha: 0, scale: 2.4, duration: 400 });
    try { navigator.vibrate?.([40, 40, 80]); } catch { /* not supported */ }
    const result: RunResult = { hops: this.hops, stars: this.starsTaken, bestCombo: this.bestCombo, reason };
    this.services.recordRun(result);
    // Let the crash play out briefly, then freeze the world under the results.
    this.time.delayedCall(450, () => {
      this.scene.pause();
      this.scene.launch("GameOver", result);
    });
  }

  // ---------- Presentation ----------
  private drawAim(): void {
    const g = this.aimGuide;
    g.clear();
    if (this.mode !== "orbit") return;
    const dir = tangent(this.angle, this.spin);
    const next = this.nextPlanet();
    // While learning, the guide turns gold when a launch now would reach the next planet.
    const learning = this.services.save.games < 3 && this.hops < 4;
    const onTarget = learning && !!next && rayDistance(this.pos, dir, next) < next.orbitR * 0.8;
    const color = onTarget ? 0xffd75e : 0xffffff;
    for (let i = 1; i <= 6; i++) {
      g.fillStyle(color, (onTarget ? 0.9 : 0.5) * (1 - i / 7));
      g.fillCircle(this.pos.x + dir.x * i * 22, this.pos.y + dir.y * i * 22, onTarget ? 4 : 3);
    }
  }

  private followCamera(dt: number): void {
    const cam = this.cameras.main;
    const focus = this.mode === "orbit" ? this.current.y : this.pos.y;
    const target = focus - cam.height * 0.62;
    // Never scroll back down past where you've been, so falling feels like falling.
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, Math.min(target, cam.scrollY + 40), Math.min(1, dt * 3));
  }

  /** Remove things that have scrolled far below the screen. */
  private recycle(): void {
    // Measured from the scroll position: worldView isn't filled in until the first render.
    const cam = this.cameras.main;
    const limit = cam.scrollY + cam.height + 500;
    for (const p of this.planets) {
      if (p.y - p.orbitR > limit && p !== this.current) {
        const v = this.planetViews.get(p.id);
        v?.glow.destroy(); v?.body.destroy(); v?.ring.destroy();
        this.planetViews.delete(p.id);
      }
    }
    for (const s of this.stars) if (s.y > limit) { this.starViews.get(s.id)?.destroy(); this.starViews.delete(s.id); }
    this.stars = this.stars.filter(s => s.y <= limit);
    for (const a of this.asteroids) if (a.y > limit) { this.rockViews.get(a.id)?.destroy(); this.rockViews.delete(a.id); }
    this.asteroids = this.asteroids.filter(a => a.y <= limit);
  }

  private pulse(p: Planet): void {
    const ring = this.add.image(p.x, p.y, "glow-gold").setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setScale((p.orbitR * 2) / 128).setAlpha(0.6);
    this.tweens.add({ targets: ring, scale: ring.scale * 1.5, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }

  private popup(text: string, p: Planet, color: string): void {
    const t = this.add.text(p.x, p.y - p.orbitR - 20, text, {
      fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "40px", fontStyle: "900", color,
    }).setOrigin(0.5).setDepth(40).setStroke("#1a0f3a", 8);
    this.tweens.add({ targets: t, y: t.y - 70, alpha: 0, duration: 900, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }
}
