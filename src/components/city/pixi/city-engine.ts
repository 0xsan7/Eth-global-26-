// Tool City game renderer (PixiJS, WebGL with canvas fallback).
// Draws procedurally — no external images or fonts. It only READS CityState:
// nothing here calls back into React, the API, the wallet or brief state.
// Walks, stamps and pulses are decoration that start from observed state changes.
import { Application, Container, Graphics, Text, type TextStyleFontWeight } from "pixi.js";
import type { CityState, QuestKind } from "../city-state";
import { isoGeometry, lerp, type IsoGeometry, type Pt } from "../iso-geometry";
import type { BuildingTag } from "../scene-labels";
import { BUILDINGS, PLAZA, VIEWBOX, type BuildingDef, type BuildingId } from "../scene-config";
import { easeInOut, pathLength, pointAlong, streetRoute, walkDurationMs } from "../walk-path";

export type MotionMode = "on" | "paused" | "off";

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const INK = 0x3b2f22;
const TAU = Math.PI * 2;
const ISLAND = { x: 12, y: 30, w: 616, h: 354, r: 52 };
const DOOR_MS = 900;
const POP_MS = 420;
const STAMP_MS = 520;

const TREES: Array<{ x: number; y: number; s: number; p: number }> = [
  { x: 40, y: 206, s: 1, p: 0 },
  { x: 250, y: 96, s: 0.9, p: 1.3 },
  { x: 604, y: 214, s: 1.1, p: 2.1 },
  { x: 590, y: 352, s: 0.95, p: 0.7 },
  { x: 236, y: 362, s: 1, p: 2.8 },
  { x: 420, y: 366, s: 0.85, p: 1.8 },
  { x: 36, y: 120, s: 0.9, p: 0.4 },
  { x: 600, y: 74, s: 0.85, p: 2.4 },
];
const LAMPS: Pt[] = [
  { x: 60, y: 226 },
  { x: 240, y: 226 },
  { x: 410, y: 270 },
  { x: 584, y: 226 },
];
const FOUNTAIN: Pt = { x: 362, y: 328 };
/** Where the worker stands for each building: on the street, clear of the nameplates. */
const STAND: Record<BuildingId, Pt> = {
  home: { x: 200, y: 247 },
  registry: { x: 214, y: 247 },
  treasury: { x: 330, y: 236 },
  studio: { x: 430, y: 247 },
  archive: { x: 556, y: 250 },
};

const TAG_COLORS: Record<BuildingTag["tone"], string> = {
  info: "#1f4f7a",
  ok: "#1d5a38",
  warn: "#6b3d00",
  muted: "#45413a",
};

function shade(color: string | number, f: number): number {
  const n = typeof color === "number" ? color : parseInt(color.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255);
}

/** Deterministic decoration placement (never used for state). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function text(s: string, size: number, fill: string, weight: TextStyleFontWeight = "700", halo = true): Text {
  const t = new Text({
    text: s,
    style: {
      fontFamily: FONT,
      fontSize: size,
      fontWeight: weight,
      fill,
      ...(halo ? { stroke: { color: "#faf6ec", width: 4, join: "round" as const } } : {}),
    },
  });
  t.anchor.set(0.5);
  return t;
}

const easeOutBack = (x: number) => {
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function winPts(a: Pt, b: Pt, t0: number, t1: number, lift: number, h = 12): Pt[] {
  const x0 = lerp(a.x, b.x, t0);
  const x1 = lerp(a.x, b.x, t1);
  const y0 = lerp(a.y, b.y, t0);
  const y1 = lerp(a.y, b.y, t1);
  return [
    { x: x0, y: y0 - lift - h },
    { x: x1, y: y1 - lift - h },
    { x: x1, y: y1 - lift },
    { x: x0, y: y0 - lift },
  ];
}

function inset(ps: Pt[], f: number): Pt[] {
  const c = ps.reduce((s, p) => ({ x: s.x + p.x / ps.length, y: s.y + p.y / ps.length }), { x: 0, y: 0 });
  return ps.map((p) => ({ x: lerp(p.x, c.x, f), y: lerp(p.y, c.y, f) }));
}

function dashedPoly(g: Graphics, ps: Pt[], dash: number, gap: number) {
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    const b = ps[(i + 1) % ps.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(len, d + dash);
      g.moveTo(lerp(a.x, b.x, d / len), lerp(a.y, b.y, d / len)).lineTo(lerp(a.x, b.x, e / len), lerp(a.y, b.y, e / len));
    }
  }
}

/** Dashed ellipse; `offset` (0..1) rotates the dashes, `upTo` (0..1) draws it in. */
function dashedEllipse(g: Graphics, cx: number, cy: number, rx: number, ry: number, offset: number, upTo: number) {
  const n = 36;
  for (let k = 0; k < n; k++) {
    if (k / n >= upTo) break;
    const a0 = (k / n + offset) * TAU;
    const a1 = a0 + (0.62 / n) * TAU;
    g.moveTo(cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
    for (let s = 1; s <= 3; s++) {
      const a = lerp(a0, a1, s / 3);
      g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
  }
}

interface BuildingView {
  def: BuildingDef;
  geo: IsoGeometry;
  index: number;
  root: Container;
  body: Container;
  shadow: Graphics;
  lit: Graphics[];
  door: Graphics;
  decor: Container;
  plate: Container;
  plateBg: Graphics;
  plateText: Text;
  tag: Text;
  hover: number;
  press: number;
  doorStart: number | null;
}

interface Decor {
  puffs: Graphics[];
  dish: Graphics | null;
  dataDots: Graphics[];
  amber: Graphics | null;
  emblem: Container | null;
  stamp: Container | null;
  stampOut: Graphics | null;
  orbit: Graphics | null;
  scan: Graphics | null;
  boxes: Container | null;
}

const emptyDecor = (): Decor => ({
  puffs: [],
  dish: null,
  dataDots: [],
  amber: null,
  emblem: null,
  stamp: null,
  stampOut: null,
  orbit: null,
  scan: null,
  boxes: null,
});

export class CityEngine {
  private app: Application;
  private world = new Container();
  private depth = new Container();
  private ground = new Container();
  private sky = new Container();
  private ui = new Container();
  private views = new Map<BuildingId, BuildingView>();
  private decor = emptyDecor();
  private mode: MotionMode = "on";
  private t = 0;
  private city: CityState | null = null;
  private selected: BuildingId | null = null;
  private selStart = -1e9;
  private hovered: BuildingId | null = null;
  private parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  private ripples: Array<{ g: Graphics; start: number }> = [];
  private stampStart = -1e9;
  private stampOutStart = -1e9;
  private scanStart = -1e9;
  private boxesStart = -1e9;
  private resizeObs: ResizeObserver | null = null;

  // scenery refs
  private waves: Array<{ g: Graphics; x: number; y: number; p: number }> = [];
  private foam!: Graphics;
  private trees: Array<{ c: Container; p: number }> = [];
  private glows: Graphics[] = [];
  private jet!: Graphics;
  private fountainRipples: Graphics[] = [];
  private shimmer!: Graphics;
  private clouds: Array<{ g: Graphics; speed: number; off: number }> = [];
  private birds!: Container;
  private birdWings: Graphics[] = [];
  private boat!: Container;
  private selRing = new Graphics();
  private quest = new Container();
  private questBg = new Graphics();
  private questText = text("!", 15, "#3d2c05", "800", false);

  // worker
  private worker = new Container();
  private wFace = new Container();
  private wBody = new Container();
  private wLegL = new Graphics();
  private wLegR = new Graphics();
  private wArmL = new Graphics();
  private wArmR = new Graphics();
  private wHead = new Container();
  private wCarry = new Container();
  private wAlert = new Container();
  private wWait = new Container();
  private wWaitDots: Graphics[] = [];
  private wPos: Pt = { ...PLAZA };
  private walk: { path: Pt[]; start: number; dur: number; len: number; to: BuildingId | null } | null = null;
  private stride = 0;

  private constructor(app: Application) {
    this.app = app;
  }

  static async create(host: HTMLElement): Promise<CityEngine> {
    const app = new Application();
    await app.init({
      width: VIEWBOX.w,
      height: VIEWBOX.h,
      antialias: true,
      backgroundAlpha: 0,
      autoDensity: false,
      preference: "webgl",
      resolution: CityEngine.resolutionFor(host),
    });
    const engine = new CityEngine(app);
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    engine.build();
    engine.resizeObs = new ResizeObserver(() =>
      app.renderer.resize(VIEWBOX.w, VIEWBOX.h, CityEngine.resolutionFor(host)),
    );
    engine.resizeObs.observe(host);
    app.ticker.add((tk) => engine.update(tk.deltaMS));
    return engine;
  }

  private static resolutionFor(host: HTMLElement): number {
    const w = host.clientWidth || VIEWBOX.w;
    return Math.min(3, Math.max(1, ((window.devicePixelRatio || 1) * w) / VIEWBOX.w));
  }

  destroy() {
    this.resizeObs?.disconnect();
    this.app.destroy({ removeView: true }, { children: true });
  }

  // ---------- public API (presentation only) ----------

  setMotion(mode: MotionMode) {
    this.mode = mode;
    if (mode === "on") {
      this.app.ticker.start();
    } else {
      this.app.ticker.stop();
      if (mode === "off") this.renderStatic();
    }
  }

  setState(city: CityState, tags: Record<BuildingId, BuildingTag | null>) {
    const prev = this.city;
    this.city = city;
    const animate = this.mode === "on";
    const sameBrief = prev !== null && city.briefId !== null && prev.briefId === city.briefId;

    const target = city.worker.building ? STAND[city.worker.building] : PLAZA;
    // First render, a different brief, or motion not running: jump, no travel or replay.
    if (!sameBrief || !animate) {
      this.walk = null;
      this.wPos = { ...target };
    } else if (Math.hypot(target.x - this.wPos.x, target.y - this.wPos.y) > 0.5) {
      const path = streetRoute(this.wPos, target);
      const len = pathLength(path);
      this.walk = { path, start: this.t, dur: walkDurationMs(len), len, to: city.worker.building };
    }

    if (sameBrief && animate && prev) {
      if (prev.release !== "approved" && city.release === "approved") this.stampStart = this.t;
      if (prev.release === "approved" && city.release !== "approved") this.stampOutStart = this.t;
      if (
        prev.registry === "live" &&
        city.registry === "live" &&
        city.registryObservedAt !== null &&
        prev.registryObservedAt !== city.registryObservedAt
      ) {
        this.scanStart = this.t;
      }
    }
    if (animate && prev && prev.briefId === null && city.briefId !== null) this.boxesStart = this.t;
    if (!animate) {
      this.stampStart = this.stampOutStart = this.scanStart = this.boxesStart = -1e9;
    }

    for (const v of this.views.values()) {
      const tag = tags[v.def.id];
      v.tag.visible = tag !== null;
      if (tag) {
        v.tag.text = tag.text;
        v.tag.style.fill = TAG_COLORS[tag.tone];
      }
    }
    this.buildDecor(city);
    this.drawWorkerProps(city);
    this.drawQuest(city.quest);
    this.renderStatic();
  }

  setSelected(id: BuildingId | null) {
    if (id === this.selected) return;
    this.selected = id;
    this.selStart = this.mode === "on" ? this.t : -1e9;
    for (const v of this.views.values()) this.drawPlate(v, v.def.id === id);
    this.renderStatic();
  }

  setHover(id: BuildingId | null) {
    this.hovered = id;
    this.renderStatic();
  }

  /** Click feedback: squash + ground ripple. Cosmetic only. */
  ping(id: BuildingId) {
    if (this.mode !== "on") return;
    const v = this.views.get(id);
    if (!v) return;
    v.press = 1;
    const g = new Graphics();
    this.ground.addChild(g);
    g.position.set(v.def.cx, v.def.cy + v.geo.hh * 0.55);
    this.ripples.push({ g, start: this.t });
  }

  setParallax(dx: number, dy: number) {
    this.parallax.tx = dx;
    this.parallax.ty = dy;
  }

  // ---------- scene construction ----------

  private build() {
    const stage = this.app.stage;
    stage.addChild(this.world);
    this.world.addChild(this.buildWater(), this.buildIsland(), this.ground, this.depth, this.sky, this.ui);
    this.depth.sortableChildren = true;
    this.buildStreets();
    this.buildProps();
    BUILDINGS.forEach((def, i) => this.buildBuilding(def, i));
    this.buildWorker();
    this.buildSky();
    this.ground.addChild(this.selRing);
    this.quest.addChild(this.questBg, this.questText);
    this.ui.addChild(this.quest);
  }

  private buildWater(): Container {
    const c = new Container();
    const g = new Graphics();
    g.rect(-40, -40, VIEWBOX.w + 80, VIEWBOX.h + 80).fill(0x4f9fbf);
    g.rect(-40, -40, VIEWBOX.w + 80, 70).fill({ color: 0x68b3cf, alpha: 0.6 });
    g.rect(-40, VIEWBOX.h - 24, VIEWBOX.w + 80, 70).fill({ color: 0x3f8db0, alpha: 0.7 });
    c.addChild(g);
    const r = seeded(7);
    for (let i = 0; i < 22; i++) {
      const bottom = i % 3 !== 0;
      const x = r() * VIEWBOX.w;
      const y = bottom ? VIEWBOX.h - 22 + r() * 22 : 4 + r() * 22;
      const w = new Graphics();
      w.moveTo(-6, 0).quadraticCurveTo(0, -3, 6, 0).stroke({ width: 1.5, color: 0xd9f1f8, alpha: 0.9, cap: "round" });
      w.position.set(x, y);
      c.addChild(w);
      this.waves.push({ g: w, x, y, p: r() });
    }
    return c;
  }

  private buildIsland(): Container {
    const c = new Container();
    const { x, y, w, h, r } = ISLAND;
    this.foam = new Graphics();
    this.foam.roundRect(x - 5, y + 20, w + 10, h + 10, r + 6).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
    const g = new Graphics();
    g.roundRect(x, y + 24, w, h, r).fill(0x5e4632);
    g.roundRect(x, y + 14, w, h, r).fill(0x8a6a48);
    g.roundRect(x + 6, y + 19, w - 12, h - 4, r).stroke({ width: 1.5, color: 0x6e5238, alpha: 0.6 });
    g.roundRect(x, y, w, h, r).fill(0x9db38a);
    g.roundRect(x, y, w, h, r).stroke({ width: 2.5, color: 0xb7cc9f, alpha: 0.9 });
    g.ellipse(110, 330, 120, 46).fill(0x8aa176);
    g.ellipse(560, 96, 60, 40).fill(0x8aa176);
    const rnd = seeded(11);
    for (let i = 0; i < 90; i++) {
      const px = x + 20 + rnd() * (w - 40);
      const py = y + 14 + rnd() * (h - 28);
      const onStreet = (py > 222 && py < 272) || (px > 296 && px < 348 && py > 104) || Math.hypot((px - 320) / 80, (py - 322) / 36) < 1;
      if (onStreet) continue;
      if (i % 9 === 0) {
        g.circle(px, py, 1.8).fill(i % 2 ? 0xf2d16b : 0xf4f0e6);
      } else {
        g.moveTo(px - 2, py).lineTo(px, py - 3.5).lineTo(px + 2, py).stroke({ width: 1, color: 0x6f8c5c, alpha: 0.75 });
      }
    }
    c.addChild(this.foam, g);
    return c;
  }

  private buildStreets() {
    const g = new Graphics();
    g.rect(ISLAND.x + 4, 228, ISLAND.w - 8, 38).fill(0xd9c39a);
    g.rect(300, 104, 44, 258).fill(0xd9c39a);
    g.ellipse(320, 322, 74, 31).fill(0xd9c39a).stroke({ width: 3, color: 0xbfa171 });
    g.rect(ISLAND.x + 4, 228, ISLAND.w - 8, 4).fill(0xbfa171);
    g.rect(ISLAND.x + 4, 262, ISLAND.w - 8, 4).fill(0xbfa171);
    g.rect(300, 104, 4, 124).fill(0xbfa171);
    g.rect(340, 104, 4, 124).fill(0xbfa171);
    g.rect(300, 266, 4, 30).fill(0xbfa171);
    g.rect(340, 266, 4, 30).fill(0xbfa171);
    for (let x = 30; x < 610; x += 22) {
      if (x > 296 && x < 348) continue;
      g.moveTo(x, 233).lineTo(x, 261).stroke({ width: 1, color: 0xb8996a, alpha: 0.35 });
    }
    for (let y = 112; y < 226; y += 18) g.moveTo(305, y).lineTo(339, y).stroke({ width: 1, color: 0xb8996a, alpha: 0.35 });
    this.ground.addChild(g);

    // fountain
    const f = new Container();
    f.position.set(FOUNTAIN.x, FOUNTAIN.y);
    for (let k = 0; k < 2; k++) {
      const rp = new Graphics();
      rp.ellipse(0, 0, 16, 6).stroke({ width: 1.2, color: 0xe8f4f7 });
      this.fountainRipples.push(rp);
      f.addChild(rp);
    }
    const basin = new Graphics();
    basin.ellipse(0, 2, 20, 8).fill(0x8f7b58);
    basin.ellipse(0, 0, 18, 7).fill(0xa89470);
    basin.ellipse(0, 0, 15, 5.5).fill(0x7fb6c4);
    this.shimmer = new Graphics();
    this.shimmer.ellipse(0, 0, 6, 1.6).fill(0xd8eef3);
    this.shimmer.position.set(-4, -1);
    this.jet = new Graphics();
    this.jet.roundRect(-1.6, -14, 3.2, 14, 1.6).fill(0xd8eef3);
    f.addChild(basin, this.shimmer, this.jet);
    this.ground.addChild(f);
  }

  private buildProps() {
    for (const t of TREES) {
      const c = new Container();
      c.position.set(t.x, t.y);
      c.scale.set(t.s);
      c.zIndex = t.y;
      const sh = new Graphics().ellipse(0, 0, 14, 5).fill({ color: 0x000000, alpha: 0.16 });
      const crown = new Container();
      const g = new Graphics();
      g.rect(-2.5, -16, 5, 16).fill(0x7a5a3a);
      g.circle(0, -27, 14).fill(0x4f7a40);
      g.circle(-7, -21, 9).fill(0x5f8a4e);
      g.circle(6, -31, 8).fill(0x6f9a5c);
      g.circle(-3, -34, 5).fill({ color: 0x8cbf72, alpha: 0.8 });
      crown.addChild(g);
      c.addChild(sh, crown);
      this.depth.addChild(c);
      this.trees.push({ c: crown, p: t.p });
    }
    for (const l of LAMPS) {
      const c = new Container();
      c.position.set(l.x, l.y);
      c.zIndex = l.y;
      const glow = new Graphics().circle(0, -24, 10).fill(0xffe7a3);
      const g = new Graphics();
      g.moveTo(0, 0).lineTo(0, -22).stroke({ width: 2, color: 0x4a4438 });
      g.circle(0, -24, 3.4).fill(0xfff4cc).stroke({ width: 1, color: 0x4a4438 });
      c.addChild(glow, g);
      this.glows.push(glow);
      this.depth.addChild(c);
    }
  }

  private buildBuilding(def: BuildingDef, index: number) {
    const geo = isoGeometry(def);
    const { cx, cy, hw, wallH, roof, roofColor } = def;
    const { hh, roofH, L, B, R, T, Lt, Bt, Rt, Tt, apex } = geo;
    const studio = def.id === "studio";
    const wallL = studio ? 0xe8f1ee : 0xf3e6cf;
    const wallR = studio ? 0xcfe0da : 0xe2cba4;

    const root = new Container();
    root.zIndex = B.y;
    const shadow = new Graphics().ellipse(0, 0, hw * 1.05, hh * 0.6).fill({ color: 0x000000, alpha: 0.16 });
    shadow.position.set(cx, cy + hh * 0.55);
    const body = new Container();
    body.pivot.set(cx, B.y);
    body.position.set(cx, B.y);

    const g = new Graphics();
    // walls with foundation band and plank hints
    g.poly([L, B, Bt, Lt]).fill(wallL).stroke({ width: 2, color: INK, join: "round" });
    g.poly([R, B, Bt, Rt]).fill(wallR).stroke({ width: 2, color: INK, join: "round" });
    const up = (p: Pt, d: number) => ({ x: p.x, y: p.y - d });
    g.poly([L, B, up(B, 6), up(L, 6)]).fill(shade(wallL, 0.78));
    g.poly([B, R, up(R, 6), up(B, 6)]).fill(shade(wallR, 0.78));
    for (const f of [0.33, 0.66]) {
      const a = { x: lerp(L.x, B.x, f), y: lerp(L.y, B.y, f) };
      const b = { x: lerp(R.x, B.x, f), y: lerp(R.y, B.y, f) };
      g.moveTo(a.x, a.y - 6).lineTo(a.x, a.y - wallH).stroke({ width: 1, color: INK, alpha: 0.12 });
      g.moveTo(b.x, b.y - 6).lineTo(b.x, b.y - wallH).stroke({ width: 1, color: INK, alpha: 0.12 });
    }
    g.moveTo(Lt.x, Lt.y).lineTo(Bt.x, Bt.y).lineTo(Rt.x, Rt.y).stroke({ width: 2, color: INK });

    // windows: frame, glass, mullion, sill
    const lift = wallH * 0.35;
    const wins = [
      winPts(L, B, 0.16, 0.38, lift),
      winPts(L, B, 0.58, 0.8, lift),
      winPts(R, B, 0.16, 0.36, lift),
      winPts(R, B, 0.62, 0.82, lift),
    ];
    const lit: Graphics[] = [];
    for (const w of wins) {
      g.poly(w).fill(0xfff4dc).stroke({ width: 1.2, color: INK, alpha: 0.8 });
      const glass = inset(w, 0.22);
      g.poly(glass).fill(0x3d5a6c);
      g.moveTo((glass[0].x + glass[1].x) / 2, (glass[0].y + glass[1].y) / 2)
        .lineTo((glass[2].x + glass[3].x) / 2, (glass[2].y + glass[3].y) / 2)
        .stroke({ width: 1, color: 0xfff4dc, alpha: 0.9 });
      g.moveTo(w[3].x - 1, w[3].y + 1.5).lineTo(w[2].x + 1, w[2].y + 1.5).stroke({ width: 2, color: 0x8a7a5c });
      const l = new Graphics().poly(glass).fill(0xf6d27a);
      l.alpha = 0;
      lit.push(l);
    }

    // door on the front-right wall, hinged on its left edge
    const dh = Math.min(18, wallH * 0.32);
    const p0 = { x: lerp(B.x, R.x, 0.42), y: lerp(B.y, R.y, 0.42) };
    const p1 = { x: lerp(B.x, R.x, 0.56), y: lerp(B.y, R.y, 0.56) };
    g.poly([p0, p1, up(p1, dh + 2), up(p0, dh + 2)]).fill(0x2f2a22);
    g.poly([{ x: p0.x - 2, y: p0.y + 2 }, { x: p1.x + 2, y: p1.y + 1 }, { x: p1.x + 4, y: p1.y + 4 }, { x: p0.x, y: p0.y + 5 }]).fill(0xb7a17c);
    const door = new Graphics();
    const rel = (p: Pt) => ({ x: p.x - p0.x, y: p.y - p0.y });
    door.poly([rel(p0), rel(p1), rel(up(p1, dh)), rel(up(p0, dh))]).fill(0x9a6a43).stroke({ width: 1, color: 0x5c3a22 });
    door.circle(rel(p1).x - 2.5, rel(p1).y - dh / 2, 1).fill(0xe8c33a);
    door.position.set(p0.x, p0.y);

    // roof
    const r = new Graphics();
    const eaveY = cy - wallH;
    const o = (p: Pt) => ({ x: cx + (p.x - cx) * 1.09, y: eaveY + (p.y - eaveY) * 1.09 + 1.5 });
    if (roof === "hip") {
      const [oL, oB, oR] = [o(Lt), o(Bt), o(Rt)];
      r.poly([apex, oL, oB]).fill(roofColor).stroke({ width: 2, color: INK, join: "round" });
      r.poly([apex, oB, oR]).fill(shade(roofColor, 0.84)).stroke({ width: 2, color: INK, join: "round" });
      for (const f of [0.22, 0.44, 0.66]) {
        for (const [a, b] of [
          [oL, oB],
          [oB, oR],
        ] as const) {
          r.moveTo(lerp(a.x, apex.x, f), lerp(a.y, apex.y, f))
            .lineTo(lerp(b.x, apex.x, f), lerp(b.y, apex.y, f))
            .stroke({ width: 1.2, color: 0x000000, alpha: 0.16 });
        }
      }
      r.moveTo(apex.x, apex.y).lineTo(oB.x, oB.y).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
      if (def.id === "home") {
        const x0 = cx + hw * 0.28;
        const top = apex.y + roofH * 0.25;
        r.rect(x0, top, 9, 26).fill(0x9a8a6c).stroke({ width: 1.5, color: INK });
        r.poly([{ x: x0 + 9, y: top }, { x: x0 + 14, y: top - 2.5 }, { x: x0 + 14, y: top + 23.5 }, { x: x0 + 9, y: top + 26 }])
          .fill(0x7d6f55)
          .stroke({ width: 1.5, color: INK });
        r.poly([{ x: x0, y: top }, { x: x0 + 5, y: top - 2.5 }, { x: x0 + 14, y: top - 2.5 }, { x: x0 + 9, y: top }]).fill(0x5c564a);
      }
    } else {
      // flat roof with a parapet (front faces are thin bands, not full walls)
      const lift6 = (p: Pt) => up(p, 6);
      r.poly([Lt, Bt, lift6(Bt), lift6(Lt)]).fill(shade(roofColor, 0.82)).stroke({ width: 1.5, color: INK });
      r.poly([Bt, Rt, lift6(Rt), lift6(Bt)]).fill(shade(roofColor, 0.7)).stroke({ width: 1.5, color: INK });
      r.poly([lift6(Lt), lift6(Tt), lift6(Rt), lift6(Bt)]).fill(roofColor).stroke({ width: 2, color: INK, join: "round" });
      r.poly(inset([lift6(Lt), lift6(Tt), lift6(Rt), lift6(Bt)], 0.14)).fill(shade(roofColor, 0.9));
      void T;
    }

    const decor = new Container();
    body.addChild(g, ...lit, door, r, decor);
    root.addChild(shadow, body);
    this.depth.addChild(root);

    const plate = new Container();
    plate.position.set(cx, cy + hh + 22);
    const plateBg = new Graphics();
    const plateText = text(def.name, 13, "#2e2a24", "700", false);
    plate.addChild(plateBg, plateText);
    const tag = text("", 12, TAG_COLORS.info);
    const tp = this.tagPos(def);
    tag.anchor.set(tp.ax, 0.5);
    tag.position.set(tp.x, tp.y);
    tag.visible = false;
    this.ui.addChild(plate, tag);

    const v: BuildingView = {
      def,
      geo,
      index,
      root,
      body,
      shadow,
      lit,
      door,
      decor,
      plate,
      plateBg,
      plateText,
      tag,
      hover: 0,
      press: 0,
      doorStart: null,
    };
    this.drawPlate(v, false);
    this.views.set(def.id, v);
  }

  private tagPos(def: BuildingDef): { x: number; y: number; ax: number } {
    if (def.id === "studio") return { x: def.cx, y: 30, ax: 0.5 };
    if (def.id === "registry") return { x: def.cx + 78, y: 10, ax: 1 };
    return { x: def.cx, y: 12, ax: 0.5 };
  }

  private drawPlate(v: BuildingView, selected: boolean) {
    const w = v.plateText.width + 18;
    v.plateBg.clear();
    v.plateBg.roundRect(-w / 2 + 2, -9, w, 20, 6).fill({ color: 0x000000, alpha: 0.18 });
    v.plateBg
      .roundRect(-w / 2, -11, w, 20, 6)
      .fill(selected ? 0x2e2a24 : 0xfffaf0)
      .stroke({ width: 1.5, color: selected ? 0xf2c14e : 0x6e5a3a });
    v.plateText.style.fill = selected ? "#ffffff" : "#2e2a24";
    v.plateText.y = -1;
  }

  private buildSky() {
    for (const [y, rx, ry, speed, off] of [
      [110, 90, 34, 9, 0.2],
      [300, 120, 40, 7, 0.65],
      [210, 70, 26, 11, 0.9],
    ] as const) {
      const g = new Graphics().ellipse(0, 0, rx, ry).fill({ color: 0x1d2b14, alpha: 0.08 });
      g.y = y;
      this.clouds.push({ g, speed, off });
      this.sky.addChild(g);
    }
    this.birds = new Container();
    for (let k = 0; k < 3; k++) {
      const b = new Graphics();
      b.moveTo(-5, 0).quadraticCurveTo(-2.5, -3, 0, 0).quadraticCurveTo(2.5, -3, 5, 0).stroke({ width: 1.4, color: 0x3a3a32, cap: "round" });
      b.position.set(k * 11, k === 1 ? -6 : 0);
      this.birdWings.push(b);
      this.birds.addChild(b);
    }
    this.boat = new Container();
    const hull = new Graphics();
    hull.poly([{ x: -14, y: 0 }, { x: 14, y: 0 }, { x: 9, y: 6 }, { x: -9, y: 6 }]).fill(0x9a6a43).stroke({ width: 1.5, color: INK });
    hull.moveTo(0, 0).lineTo(0, -20).stroke({ width: 1.5, color: INK });
    hull.poly([{ x: 1, y: -19 }, { x: 12, y: -3 }, { x: 1, y: -3 }]).fill(0xfaf6ec).stroke({ width: 1, color: INK });
    this.boat.addChild(hull);
    this.boat.y = VIEWBOX.h - 12;
    this.world.addChildAt(this.boat, 1);
    this.sky.addChild(this.birds);
  }

  private buildWorker() {
    const w = this.worker;
    const shadow = new Graphics().ellipse(0, 0, 11, 4.5).fill({ color: 0x000000, alpha: 0.28 });
    const leg = (g: Graphics) => g.roundRect(-2, 0, 4, 11, 2).fill(0x3b3226);
    leg(this.wLegL).position.set(-3, -11);
    leg(this.wLegR).position.set(3, -11);
    const arm = (g: Graphics) => g.roundRect(-1.8, 0, 3.6, 10, 1.8).fill(0x2d5b8a);
    arm(this.wArmL).position.set(-7.5, -23);
    arm(this.wArmR).position.set(7.5, -23);
    const torso = new Graphics();
    torso.roundRect(-7.5, -25, 15, 16, 5).fill(0x3d6fa8).stroke({ width: 1.5, color: 0x23405f });
    torso.rect(-7.5, -13, 15, 2.5).fill(0x6e4a2a);
    torso.circle(3, -18, 1.2).fill(0xf2c14e);
    const head = this.wHead;
    head.position.set(0, -31);
    const hg = new Graphics();
    hg.circle(0, 0, 6.5).fill(0xf0c49a).stroke({ width: 1.5, color: 0x8a5a3b });
    hg.circle(2.6, -0.5, 1).fill(0x2e2a24);
    hg.circle(-0.6, -0.5, 1).fill(0x2e2a24);
    hg.roundRect(-7, -8, 13, 5, 2.5).fill(0xe0b13a).stroke({ width: 1.2, color: 0x7a5c0e });
    hg.roundRect(3, -5, 7, 2.2, 1).fill(0xc99a26);
    head.addChild(hg);
    this.wCarry.position.set(9, -24);
    this.wBody.addChild(this.wArmL, torso, head, this.wCarry, this.wArmR);
    this.wFace.addChild(this.wLegL, this.wLegR, this.wBody);

    // unresolved: amber bubble (static, slow pulse)
    const ab = new Graphics();
    ab.circle(0, 0, 8.5).fill(0xe8a33a).stroke({ width: 1.5, color: 0x7a4d0e });
    this.wAlert.addChild(ab, text("!", 12, "#3d2c05", "800", false));
    this.wAlert.position.set(14, -46);
    // waiting: thought bubble with three dots
    const wb = new Graphics();
    wb.roundRect(-13, -8, 26, 15, 7).fill(0xffffff).stroke({ width: 1.2, color: 0x6b665c });
    wb.circle(-6, 10, 2).fill(0xffffff).stroke({ width: 1, color: 0x6b665c });
    this.wWait.addChild(wb);
    for (let k = 0; k < 3; k++) {
      const d = new Graphics().circle(-6 + k * 6, -0.5, 1.8).fill(0x1f4f7a);
      this.wWaitDots.push(d);
      this.wWait.addChild(d);
    }
    this.wWait.position.set(14, -48);
    w.addChild(shadow, this.wFace, this.wAlert, this.wWait);
    w.scale.set(1.12);
    this.depth.addChild(w);
  }

  private drawWorkerProps(city: CityState) {
    this.wCarry.removeChildren().forEach((c) => c.destroy());
    const carry = city.worker.carry;
    if (carry !== "none") {
      const g = new Graphics();
      g.roundRect(0, 0, 11, 14, 1.5).fill(0xfdfbf3).stroke({ width: 1.5, color: 0x5c564a });
      if (carry === "notes") {
        // private notes: lock icon only, never note text
        g.roundRect(2.5, 6.5, 6, 5, 1).fill(0x5c564a);
        g.moveTo(3.8, 6.5).lineTo(3.8, 4.8).arc(5.5, 4.8, 1.7, Math.PI, 0).lineTo(7.2, 6.5).stroke({ width: 1.2, color: 0x5c564a });
      } else {
        g.moveTo(2.5, 7).lineTo(5, 9.5).lineTo(9, 4.5).stroke({ width: 1.6, color: 0x1f7a4d, cap: "round" });
      }
      this.wCarry.addChild(g);
    }
    this.wAlert.visible = city.worker.unresolved;
    this.wWait.visible = city.worker.pose === "waiting";
  }

  private drawQuest(q: CityState["quest"]) {
    this.quest.visible = q !== null;
    if (!q) return;
    const colors: Record<QuestKind, [number, string, string]> = {
      action: [0xf2c14e, "#3d2c05", "!"],
      wait: [0x5b8fd6, "#ffffff", "…"],
      warn: [0xe8a33a, "#3d2c05", "!"],
    };
    const [bg, fg, sym] = colors[q.kind];
    this.questBg.clear();
    this.questBg.poly([{ x: -5, y: 9 }, { x: 5, y: 9 }, { x: 0, y: 16 }]).fill(bg).stroke({ width: 1.5, color: INK });
    this.questBg.roundRect(-10, -11, 20, 21, 7).fill(bg).stroke({ width: 1.8, color: INK });
    this.questText.text = sym;
    this.questText.style.fill = fg;
    this.questText.y = sym === "…" ? -4 : -0.5;
    const p = this.questPos(q.building);
    this.quest.position.set(p.x, p.y);
  }

  private questPos(id: BuildingId): Pt {
    const v = this.views.get(id)!;
    const { cx } = v.def;
    const apex = v.geo.apex;
    switch (id) {
      case "registry":
        return { x: cx - 34, y: apex.y - 6 };
      case "treasury":
        return { x: cx - 36, y: apex.y + 18 };
      case "studio":
        return { x: cx - 30, y: apex.y - 2 };
      case "home":
        return { x: cx - 40, y: apex.y + 8 };
      case "archive":
        return { x: cx, y: apex.y - 18 };
    }
  }

  private buildDecor(city: CityState) {
    for (const v of this.views.values()) v.decor.removeChildren().forEach((c) => c.destroy({ children: true }));
    const d = emptyDecor();

    // Planning Desk: chimney smoke + private parcel (lock icon only)
    {
      const v = this.views.get("home")!;
      const { def, geo } = v;
      const cxm = def.cx + def.hw * 0.28 + 5;
      const top = geo.apex.y + geo.roofH * 0.25 - 4;
      for (let k = 0; k < 3; k++) {
        const p = new Graphics().circle(0, 0, 4 + k).fill(0xeeeae2);
        p.position.set(cxm, top);
        d.puffs.push(p);
        v.decor.addChild(p);
      }
      if (city.planning.privateParcel) {
        const g = new Graphics();
        const x = geo.R.x + 2;
        const y = geo.R.y + 14;
        g.roundRect(x, y, 16, 12, 1.5).fill(0xc9a26b).stroke({ width: 1.2, color: 0x5c3a22 });
        g.roundRect(x + 4.5, y + 5, 7, 5.5, 1).fill(0x5c564a);
        g.moveTo(x + 6, y + 5).lineTo(x + 6, y + 3.4).arc(x + 8, y + 3.4, 2, Math.PI, 0).lineTo(x + 10, y + 5).stroke({ width: 1.2, color: 0x5c564a });
        v.decor.addChild(g);
      }
    }

    // AI Studio: dish, data dots while running, amber pulse when stalled
    {
      const v = this.views.get("studio")!;
      const { def, geo } = v;
      const base = new Graphics();
      const dx = geo.apex.x + 20;
      const dy = geo.apex.y + 14;
      base.moveTo(dx, dy).lineTo(dx, dy - 9).stroke({ width: 2, color: 0x4a4438 });
      const dish = new Graphics();
      dish.ellipse(0, 0, 8, 4.5).fill(0xe8f1ee).stroke({ width: 1.4, color: 0x4a4438 });
      dish.circle(0, 0, 1.4).fill(0x4a4438);
      dish.position.set(dx, dy - 12);
      v.decor.addChild(base, dish);
      d.dish = dish;
      if (city.studio === "running") {
        for (let k = 0; k < 5; k++) {
          const dot = new Graphics().roundRect(0, 0, k % 2 ? 4 : 2.5, 2, 1).fill(0x1f7a70);
          dot.position.set(geo.apex.x - 12 + k * 6, geo.apex.y - 4);
          d.dataDots.push(dot);
          v.decor.addChild(dot);
        }
      }
      if (city.studio === "failed" || city.studio === "interrupted") {
        const amber = new Graphics().ellipse(0, 0, def.hw * 1.1, geo.hh * 0.7).fill(0xe8a33a);
        amber.position.set(def.cx, def.cy + geo.hh * 0.55);
        v.root.addChildAt(amber, 1);
        d.amber = amber;
      }
    }
    // remove stale amber from earlier states
    {
      const studio = this.views.get("studio")!;
      for (const child of [...studio.root.children]) {
        if (child !== studio.shadow && child !== studio.body && child !== d.amber) child.destroy();
      }
    }

    // Release Desk: neutral approval emblem (document + check), stamp on approval
    {
      const v = this.views.get("treasury")!;
      const x = v.def.cx + 14;
      const y = 30;
      const post = new Graphics().moveTo(x + 8, y + 20).lineTo(x + 8, y + 27).stroke({ width: 2, color: 0x6e3a22 });
      const emblem = new Container();
      const e = new Graphics();
      e.roundRect(x, y, 16, 20, 2).fill(0xfdfbf3).stroke({ width: 1.5, color: 0x5c564a });
      e.moveTo(x + 3, y + 5).lineTo(x + 13, y + 5).stroke({ width: 1.2, color: 0x9a917f });
      e.moveTo(x + 4, y + 12).lineTo(x + 7, y + 15).lineTo(x + 12, y + 9).stroke({ width: 1.6, color: 0x5c564a, cap: "round" });
      emblem.addChild(e);
      v.decor.addChild(post, emblem);
      d.emblem = emblem;
      if (city.release === "approved") {
        const s = new Container();
        const sg = new Graphics();
        sg.circle(0, 0, 7.5).fill(0x2f8a57).stroke({ width: 1.5, color: 0x1d5a38 });
        sg.moveTo(-3.5, 0).lineTo(-1, 2.5).lineTo(3.5, -2.5).stroke({ width: 1.8, color: 0xffffff, cap: "round" });
        s.addChild(sg);
        s.position.set(x + 18, y + 2);
        v.decor.addChild(s);
        d.stamp = s;
      } else {
        const so = new Graphics().circle(0, 0, 7.5).fill(0x8a8a80);
        so.position.set(x + 18, y + 2);
        so.alpha = 0;
        v.decor.addChild(so);
        d.stampOut = so;
      }
    }

    // Registry Hall: antenna states
    {
      const v = this.views.get("registry")!;
      const { geo } = v;
      const ax = geo.apex.x;
      const top = geo.apex.y - 24;
      const r = city.registry;
      const hall = [geo.L, geo.B, geo.R, geo.Rt, geo.apex, geo.Lt];
      if (r === "expired") {
        const grey = new Graphics().poly(hall).fill(0x7d7d76);
        grey.alpha = 0.55;
        v.decor.addChild(grey);
      }
      if (r === "unavailable") {
        const m = new Graphics().poly(hall).fill({ color: 0xf3efe6, alpha: 0.6 });
        dashedPoly(m, hall, 5, 4);
        m.stroke({ width: 2, color: 0x6b665c });
        v.decor.addChild(m);
      }
      const mast = new Graphics().moveTo(ax, geo.apex.y).lineTo(ax, top + 4).stroke({ width: 2.5, color: 0x4a4438 });
      v.decor.addChild(mast);
      if (r === "pending") {
        const orbit = new Graphics();
        dashedEllipse(orbit, 0, 0, 10, 10, 0, 1);
        orbit.stroke({ width: 2, color: 0x1a5fb4, cap: "round" });
        orbit.position.set(ax, top);
        v.decor.addChild(orbit);
        d.orbit = orbit;
      }
      if (r === "live" || r === "stale") {
        const b = new Graphics();
        b.circle(0, 0, 9).fill({ color: 0x7fd6c4, alpha: 0.45 });
        b.circle(0, 0, 5).fill(r === "stale" ? 0x9a9a90 : 0x1f9d7a).stroke({ width: 1.2, color: 0x145c48 });
        b.position.set(ax, top);
        b.alpha = r === "stale" ? 0.45 : 1;
        v.decor.addChild(b);
      }
      if (r === "live") {
        const scan = new Graphics().circle(0, 0, 10).stroke({ width: 2, color: 0x1f9d7a });
        scan.position.set(ax, top);
        scan.alpha = 0;
        v.decor.addChild(scan);
        d.scan = scan;
      }
      if (r === "unavailable") {
        const u = new Graphics();
        dashedEllipse(u, ax, top, 5, 5, 0, 1);
        u.stroke({ width: 1.5, color: 0x6b665c });
        v.decor.addChild(u);
      }
      if (r === "expired") v.decor.addChild(new Graphics().circle(ax, top, 5).fill(0x9a9a90).stroke({ width: 1.2, color: 0x5c5a52 }));
      if (r === "closed") {
        const f = new Graphics();
        f.poly([{ x: ax + 1, y: geo.apex.y - 12 }, { x: ax + 15, y: geo.apex.y - 9 }, { x: ax + 1, y: geo.apex.y - 4 }]).fill(0xc96f4a).stroke({ width: 1, color: 0x6e3a22 });
        f.circle(ax, top + 3, 2.5).fill(0x4a4438);
        v.decor.addChild(f);
      }
    }

    // Archive: stack of boxes once a private brief exists
    if (city.archive.boxes) {
      const v = this.views.get("archive")!;
      const x = v.geo.R.x + 6;
      const y = v.geo.R.y + 26;
      const c = new Container();
      const box = (bx: number, by: number) => {
        const g = new Graphics();
        g.poly([{ x: 0, y: 0 }, { x: 8, y: -4 }, { x: 16, y: 0 }, { x: 8, y: 4 }]).fill(0xd8b98a).stroke({ width: 1, color: 0x6e5a3a });
        g.poly([{ x: 0, y: 0 }, { x: 8, y: 4 }, { x: 8, y: 12 }, { x: 0, y: 8 }]).fill(0xc39c66).stroke({ width: 1, color: 0x6e5a3a });
        g.poly([{ x: 16, y: 0 }, { x: 8, y: 4 }, { x: 8, y: 12 }, { x: 16, y: 8 }]).fill(0xa8824f).stroke({ width: 1, color: 0x6e5a3a });
        g.position.set(bx, by);
        c.addChild(g);
      };
      box(x, y);
      box(x + 14, y + 6);
      box(x + 6, y - 8);
      v.decor.addChild(c);
      d.boxes = c;
    }
    this.decor = d;
  }

  // ---------- frame update (writes display objects only) ----------

  private renderStatic() {
    if (this.mode === "on") return;
    this.update(0);
    this.app.render();
  }

  private update(dt: number) {
    const anim = this.mode === "on";
    if (anim) this.t += dt;
    const now = this.t;
    const t = now / 1000;
    const wave = (period: number, phase = 0) => (anim ? Math.sin((t / period + phase) * TAU) : 0);
    const loop = (period: number, phase = 0) => (anim ? (((t / period + phase) % 1) + 1) % 1 : 0);

    // parallax (eased)
    const px = this.parallax;
    px.x += (px.tx - px.x) * (anim ? 0.08 : 1);
    px.y += (px.ty - px.y) * (anim ? 0.08 : 1);
    this.sky.position.set(px.x * 5, px.y * 3);
    this.world.position.set(px.x * -1.5, px.y * -1);

    // A. ambient
    for (const w of this.waves) {
      w.g.x = w.x + wave(6, w.p) * 6;
      w.g.alpha = 0.35 + 0.45 * (anim ? (wave(3.4, w.p) + 1) / 2 : 0.5);
    }
    this.foam.alpha = 0.45 + 0.3 * (anim ? (wave(4.5) + 1) / 2 : 0.5);
    this.trees.forEach((tr) => {
      tr.c.skew.x = wave(5.5, tr.p / TAU) * 0.035;
    });
    this.glows.forEach((g, i) => {
      g.alpha = 0.22 + 0.2 * (anim ? (wave(4.2, i * 0.27) + 1) / 2 : 0.5);
    });
    this.jet.scale.y = anim ? 0.86 + 0.14 * wave(0.9) : 1;
    this.shimmer.x = -4 + wave(3.2) * 4;
    this.fountainRipples.forEach((r, k) => {
      const f = loop(2.6, k * 0.5);
      r.scale.set(0.5 + f);
      r.alpha = anim ? 0.8 * (1 - f) : 0;
    });
    this.clouds.forEach((c) => {
      c.g.x = -180 + (anim ? ((t / (100 / c.speed) + c.off) % 1) * 1000 : c.off * 1000);
      c.g.visible = anim;
    });
    const bf = loop(42, 0.3);
    this.birds.position.set(-60 + bf * 760, 70 - bf * 46);
    this.birds.visible = anim;
    this.birdWings.forEach((b, k) => {
      b.scale.y = anim ? 0.35 + 0.65 * Math.abs(Math.sin(t * 5 + k)) : 1;
    });
    const boatF = loop(70, 0.15);
    this.boat.x = anim ? -40 + boatF * 720 : 470;
    this.boat.y = VIEWBOX.h - 12 + wave(2.6) * 1.5;
    this.boat.rotation = wave(3.1) * 0.05;

    // C. building states
    const city = this.city;
    const d = this.decor;
    d.puffs.forEach((p, k) => {
      const f = loop(4.2, k / 3);
      p.position.set(this.views.get("home")!.def.cx + this.views.get("home")!.def.hw * 0.28 + 5 + f * 8, this.views.get("home")!.geo.apex.y + this.views.get("home")!.geo.roofH * 0.25 - 4 - f * 26);
      p.scale.set(0.6 + f * 0.9);
      p.alpha = anim ? (f < 0.15 ? (f / 0.15) * 0.75 : 0.75 * (1 - (f - 0.15) / 0.85)) : 0;
    });
    const running = city?.studio === "running";
    if (d.dish) d.dish.scale.x = running && anim ? Math.cos(t * 2.6) : 1;
    d.dataDots.forEach((dot, k) => {
      const f = loop(2.2, k / 5);
      dot.y = this.views.get("studio")!.geo.apex.y - 4 - f * 18;
      dot.alpha = anim ? (f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8) * 0.9 : 0.6;
    });
    if (d.amber) d.amber.alpha = 0.32 + 0.18 * wave(4.8);
    for (const v of this.views.values()) {
      const lit = v.def.id === "home" ? city?.planning.lit === true : false;
      v.lit.forEach((l, i) => {
        if (v.def.id === "studio" && running) l.alpha = anim ? 0.35 + 0.6 * ((wave(1.6, -i * 0.25) + 1) / 2) : 0.8;
        else l.alpha = lit ? 0.9 : 0;
      });
    }
    if (d.emblem) d.emblem.y = city?.release === "awaiting" ? wave(4.4) * -2.5 - (anim ? 1.25 : 0) : 0;
    if (d.stamp) {
      const f = clamp01((now - this.stampStart) / STAMP_MS);
      const s = f < 1 ? (f < 0.6 ? lerp(1.8, 0.92, f / 0.6) : lerp(0.92, 1, (f - 0.6) / 0.4)) : 1;
      d.stamp.scale.set(s);
      d.stamp.alpha = f < 1 ? Math.min(1, f / 0.6) : 1;
    }
    if (d.stampOut) d.stampOut.alpha = 0.8 * (1 - clamp01((now - this.stampOutStart) / 450));
    if (d.orbit) d.orbit.rotation = anim ? t * (TAU / 3.2) : 0;
    if (d.scan) {
      const f = clamp01((now - this.scanStart) / 1200);
      d.scan.scale.set(0.6 + f * 1.8);
      d.scan.alpha = f < 1 ? 0.8 * (1 - f) : 0;
    }
    if (d.boxes) {
      const f = clamp01((now - this.boxesStart) / 600);
      d.boxes.y = (1 - easeInOut(f)) * -12;
      d.boxes.alpha = f;
    }

    // D/E. hover, press, pop-in, doors
    for (const v of this.views.values()) {
      const target = this.hovered === v.def.id ? 1 : 0;
      v.hover += (target - v.hover) * (anim ? Math.min(1, dt / 90) : 1);
      v.press = anim ? Math.max(0, v.press - dt / 220) : 0;
      const popF = anim ? clamp01((now - v.index * 90) / POP_MS) : 1;
      const pop = popF >= 1 ? 1 : easeOutBack(popF);
      const p = Math.sin(v.press * Math.PI);
      v.body.scale.set((0.86 + 0.14 * pop) * (1 + 0.04 * p), (0.86 + 0.14 * pop) * (1 - 0.06 * p));
      v.body.y = v.geo.B.y - 4 * v.hover + (1 - pop) * 8;
      v.root.alpha = popF;
      v.shadow.scale.set(1 + 0.08 * v.hover);
      v.plate.alpha = popF * (0.9 + 0.1 * Math.max(v.hover, this.selected === v.def.id ? 1 : 0));
      v.plate.y = v.def.cy + v.geo.hh + 22 - 2 * v.hover;
      v.tag.alpha = popF;
      let open = 0;
      if (v.doorStart !== null) {
        const f = (now - v.doorStart) / DOOR_MS;
        open = f >= 1 ? 0 : f < 0.25 ? f / 0.25 : f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
        if (f >= 1) v.doorStart = null;
      }
      v.door.scale.x = 1 - 0.8 * open;
    }

    // selection ring: draw-in, then very slow rotation
    this.selRing.clear();
    if (this.selected) {
      const v = this.views.get(this.selected)!;
      const drawF = clamp01((now - this.selStart) / 650);
      dashedEllipse(this.selRing, v.def.cx, v.def.cy + v.geo.hh * 0.55, v.def.hw * 1.18, v.geo.hh * 0.78, anim ? t / 40 : 0, drawF);
      this.selRing.stroke({ width: 3, color: 0x1a5fb4, cap: "round" });
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      const f = (now - r.start) / 600;
      r.g.clear();
      if (f >= 1) {
        r.g.destroy();
        this.ripples.splice(i, 1);
        continue;
      }
      r.g.ellipse(0, 0, 30 + f * 60, 12 + f * 24).stroke({ width: 3, color: 0xffffff, alpha: 0.8 * (1 - f) });
    }

    // quest marker bounce
    if (this.quest.visible && city?.quest) {
      const base = this.questPos(city.quest.building);
      const bounce = city.quest.kind === "action" ? Math.abs(wave(1.4)) * 6 : wave(3) * 2;
      this.quest.y = base.y - bounce;
      this.quest.alpha = anim ? clamp01((now - 500) / 400) : 1;
    }

    this.updateWorker(dt, anim, t);
  }

  private updateWorker(dt: number, anim: boolean, t: number) {
    const city = this.city;
    let moving = false;
    if (this.walk) {
      const w = this.walk;
      const f = anim ? clamp01((this.t - w.start) / w.dur) : 1;
      const p = pointAlong(w.path, easeInOut(f));
      if (p.dx !== 0) this.wFace.scale.x = p.dx < 0 ? -1 : 1;
      const step = Math.hypot(p.x - this.wPos.x, p.y - this.wPos.y);
      this.stride += step;
      this.wPos = { x: p.x, y: p.y };
      moving = f < 1;
      if (f >= 1) {
        if (w.to && anim) this.views.get(w.to)!.doorStart = this.t;
        this.walk = null;
      }
    }
    this.worker.position.set(this.wPos.x, this.wPos.y);
    // Waypoints sit on the street behind front buildings; keep the worker visible.
    this.worker.zIndex = 10_000;
    void dt;

    const pose = city?.worker.pose ?? "idle";
    const stalled = pose === "stalled";
    if (moving) {
      const s = Math.sin(this.stride / 4.2);
      this.wLegL.rotation = s * 0.5;
      this.wLegR.rotation = -s * 0.5;
      this.wArmL.rotation = -s * 0.6;
      this.wArmR.rotation = s * 0.6;
      this.wBody.y = -Math.abs(Math.cos(this.stride / 4.2)) * 1.6;
      this.wBody.rotation = 0;
      this.wHead.x = 0;
    } else {
      this.wLegL.rotation = this.wLegR.rotation = 0;
      const breathe = anim && !stalled ? Math.sin(t * 2) * 0.6 : 0;
      this.wBody.y = breathe;
      this.wArmL.rotation = stalled ? 0.2 : 0.08;
      this.wArmR.rotation = stalled ? -0.2 : pose === "working" && anim ? -0.3 + Math.sin(t * 3) * 0.15 : -0.08;
      this.wBody.rotation = stalled ? -0.16 : 0;
      const look = anim && !stalled ? ((t % 9) / 9 > 0.78 ? Math.sin(((t % 9) - 7) * 3) * 1.6 : 0) : 0;
      this.wHead.x = look;
      this.wHead.y = stalled ? -29.5 : -31;
    }
    this.wAlert.alpha = 0.7 + 0.3 * (anim ? (Math.sin(t * 1.3) + 1) / 2 : 1);
    this.wWaitDots.forEach((dot, k) => {
      dot.alpha = anim ? 0.3 + 0.7 * clamp01(Math.sin(t * 4.2 - k * 0.9)) : 1;
    });
  }
}
