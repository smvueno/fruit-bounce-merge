
import * as PIXI from 'pixi.js';
import { FruitDef, FruitTier, Difficulty, GameSettings, GameStats } from '../types';
import { FRUIT_DEFS, DIFFICULTY_CONFIG, SUBSTEPS, WALL_DAMPING, FLOOR_DAMPING, FRICTION_SLIDE, FRICTION_LOCK, DANGER_TIME_MS, DANGER_Y_PERCENT, SPAWN_Y_PERCENT, SCORE_BASE_MERGE, FEVER_THRESHOLD, FEVER_DURATION_MS, JUICE_MAX } from '../constants';
import { MusicEngine } from './MusicEngine';

// --- Virtual Resolution ---
const V_WIDTH = 600;
const V_HEIGHT = 900; 

// --- Physics Types ---
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  tier: FruitTier;
  id: number;
  isStatic: boolean = false; // "Static" means waiting to be dropped
  
  // State flags
  ignoreCollisions: boolean = false; 
  isCaught: boolean = false; 
  contactCount: number = 0; // Number of distinct bodies (or floor) this particle is touching
  stability: number = 0; // 0.0 = Unstable/Free, 1.0 = Stable/Locked. Used for mass weighting.
  cooldownTimer: number = 0; 
  
  rotation: number = 0;
  angularVelocity: number = 0;
  
  // Visuals
  scaleX: number = 1;
  scaleY: number = 1;
  alpha: number = 1;
  
  // Animation State
  blinkTimer: number = Math.random() * 200;
  isBlinking: boolean = false;
  
  constructor(x: number, y: number, def: FruitDef, id: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = def.radius;
    this.mass = 1.0; // Enforce equal mass for stability
    this.tier = def.tier;
    this.id = id;
  }
}

class TomatoEffect {
  tomatoId: number;
  x: number;
  y: number;
  timer: number;
  maxTime: number;
  targetTier: FruitTier;
  capturedIds: number[] = [];

  constructor(id: number, x: number, y: number, targetTier: FruitTier) {
    this.tomatoId = id;
    this.x = x;
    this.y = y;
    this.targetTier = targetTier;
    this.maxTime = 3.5;
    this.timer = this.maxTime; 
  }
}

class EffectParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string | number;
    life: number;
    type: 'circle' | 'star' | 'suck'; // Added 'suck' type for active tomato particles
    targetId?: number; // For suck particles to know which tomato to orbit
    
    constructor(x: number, y: number, color: string | number, type: 'circle' | 'star' | 'suck' = 'circle') {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.color = color;
        this.type = type;
        this.size = type === 'star' ? 10 + Math.random() * 10 : 3 + Math.random() * 5;
        this.life = 1.0;
        this.alpha = 1.0;
    }
}

// --- Engine ---
export class GameEngine {
  app: PIXI.Application | undefined;
  container: PIXI.Container;
  effectContainer: PIXI.Container; 
  effectGraphics: PIXI.Graphics;
  floorGraphics: PIXI.Graphics;
  
  fruits: Particle[] = [];
  nextId: number = 0;
  canvasElement: HTMLCanvasElement;
  
  width: number = V_WIDTH;
  height: number = V_HEIGHT;
  scaleFactor: number = 1;

  difficulty: Difficulty;
  settings: GameSettings;
  destroyed: boolean = false;
  initializing: boolean = false;
  paused: boolean = false;
  
  currentFruit: Particle | null = null;
  nextFruitTier: FruitTier = FruitTier.CHERRY;
  isAiming: boolean = false;
  canDrop: boolean = true;
  aimX: number = 0;
  dragAnchorX: number = 0;
  dragAnchorY: number = 0;
  
  activeTomatoes: TomatoEffect[] = [];
  visualParticles: EffectParticle[] = []; 
  
  audio: MusicEngine;
  
  onScore: (amount: number, total: number) => void = () => {};
  onGameOver: (stats: GameStats) => void = () => {};
  onCombo: (count: number) => void = () => {};
  onFeverStart: () => void = () => {};
  onFeverEnd: () => void = () => {};
  onDanger: (active: boolean, remainingMs: number) => void = () => {};
  onJuiceUpdate: (current: number, max: number) => void = () => {};
  onNextFruit: (tier: FruitTier) => void = () => {};
  onMaxFruit: (tier: FruitTier) => void = () => {};
  onTimeUpdate: (ms: number) => void = () => {};

  score: number = 0;
  stats: GameStats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };
  
  comboChain: number = 0; 
  didMergeThisTurn: boolean = false; 

  feverActive: boolean = false;
  feverTimer: number = 0;
  juice: number = 0;
  
  dangerTimer: number = 0; 
  dangerActive: boolean = false;
  dangerAccumulator: number = 0;
  readonly DANGER_TRIGGER_DELAY: number = 3000;
  
  fruitSprites: Map<number, PIXI.Container> = new Map();
  textures: Map<FruitTier, PIXI.Texture> = new Map();
  dangerLine: PIXI.Graphics;
  pointerHistory: {x: number, y: number, time: number}[] = [];

  constructor(
    canvas: HTMLCanvasElement, 
    difficulty: Difficulty, 
    settings: GameSettings,
    callbacks: any
  ) {
    this.canvasElement = canvas;
    this.difficulty = difficulty;
    this.settings = settings;
    Object.assign(this, callbacks);

    this.container = new PIXI.Container();
    this.effectContainer = new PIXI.Container();
    this.effectGraphics = new PIXI.Graphics();
    this.effectContainer.addChild(this.effectGraphics);
    this.floorGraphics = new PIXI.Graphics();
    this.dangerLine = new PIXI.Graphics();
    this.audio = new MusicEngine(this.settings.musicEnabled, this.settings.sfxEnabled);
  }

  setPaused(paused: boolean) {
      this.paused = paused;
      if (paused) {
          this.audio.stop();
      } else {
          this.audio.resume();
      }
  }

  updateSettings(settings: GameSettings) {
      this.settings = settings;
      this.audio.setMusicEnabled(settings.musicEnabled);
      this.audio.setSfxEnabled(settings.sfxEnabled);
  }

  async initialize() {
    if (this.destroyed) return;
    this.initializing = true;
    this.app = new PIXI.Application();

    try {
      await this.app.init({
        canvas: this.canvasElement,
        backgroundAlpha: 0,
        width: this.canvasElement.clientWidth,
        height: this.canvasElement.clientHeight,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: 'webgl', 
        resizeTo: this.canvasElement 
      });
    } catch (e) {
      console.error(`[GameEngine] PIXI Init Error:`, e);
      this.initializing = false;
      return;
    }
    
    this.initializing = false;
    if (this.destroyed) {
      if (this.app) this.app.destroy({ removeView: false });
      return;
    }
    if (!this.app.renderer) return;

    const actualW = this.app.screen.width;
    const actualH = this.app.screen.height;
    this.scaleFactor = Math.min(actualW / V_WIDTH, actualH / V_HEIGHT);
    this.container.scale.set(this.scaleFactor);
    this.effectContainer.scale.set(this.scaleFactor);

    const virtualHeightScaled = V_HEIGHT * this.scaleFactor;
    if (actualH > virtualHeightScaled) {
        const yOffset = (actualH - virtualHeightScaled) / 2;
        this.container.position.y = yOffset;
        this.effectContainer.position.y = yOffset;
    }

    this.app.stage.addChild(this.effectContainer);
    this.app.stage.addChild(this.container);
    this.container.addChild(this.floorGraphics);
    this.container.addChild(this.dangerLine);

    this.initTextures();
    this.drawFloor();
    this.spawnNextFruit();
    
    this.app.ticker.add(this.update.bind(this));
    
    this.app.stage.eventMode = 'static';
    if (this.app.screen) this.app.stage.hitArea = this.app.screen;
    
    this.app.stage.on('pointerdown', this.onPointerDown.bind(this));
    this.app.stage.on('pointermove', this.onPointerMove.bind(this));
    this.app.stage.on('pointerup', this.onPointerUp.bind(this));
    this.app.stage.on('pointerupoutside', this.onPointerUp.bind(this));
  }

  reset() {
      // 1. Cleanup ALL fruit sprites to prevent ghosting
      this.fruitSprites.forEach((sprite) => {
          if (sprite && sprite.parent) {
              sprite.parent.removeChild(sprite);
              sprite.destroy({ children: true });
          }
      });
      this.fruitSprites.clear();
      
      // Explicitly clear arrays
      this.fruits = [];
      this.activeTomatoes = [];
      this.visualParticles = [];
      
      // Cleanup current fruit if it exists
      if (this.currentFruit) {
         this.currentFruit = null;
      }

      // 2. Clear Graphics
      this.effectGraphics.clear();
      
      // 3. Reset Game State
      this.score = 0;
      this.stats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };
      this.comboChain = 0;
      this.didMergeThisTurn = false; 
      this.feverActive = false;
      this.feverTimer = 0;
      this.juice = 0;
      this.dangerTimer = 0;
      this.dangerActive = false;
      this.dangerAccumulator = 0;
      this.nextId = 0;
      this.isAiming = false;
      this.canDrop = true;
      
      // 4. Update UI via callbacks
      this.onScore(0, 0);
      this.onCombo(0);
      this.onFeverEnd();
      this.audio.setFrenzy(false); // Reset frenzy audio
      this.onJuiceUpdate(0, JUICE_MAX);
      this.onDanger(false, 0);
      this.onTimeUpdate(0);
      
      // 5. Restart Gameplay
      this.setPaused(false);
      this.spawnNextFruit();
      
      if (this.settings.musicEnabled || this.settings.sfxEnabled) {
          this.audio.resume();
      }
  }
  
  getFloorY(x: number) {
      const baseY = this.height - 60;
      return baseY + Math.sin(x * 0.015) * 10 + Math.cos(x * 0.04) * 5;
  }
  
  drawFloor() {
      this.floorGraphics.clear();
      const bottomY = this.height + 200; 
      const step = 5;
      this.floorGraphics.moveTo(0, bottomY);
      this.floorGraphics.lineTo(0, this.getFloorY(0));
      for(let x = 0; x <= this.width; x += step) {
          this.floorGraphics.lineTo(x, this.getFloorY(x));
      }
      this.floorGraphics.lineTo(this.width, this.getFloorY(this.width));
      this.floorGraphics.lineTo(this.width, bottomY);
      this.floorGraphics.closePath();
      this.floorGraphics.fill({ color: 0x76C043 }); 
      this.floorGraphics.stroke({ width: 6, color: 0x2E5A1C, alignment: 0 }); 
      this.floorGraphics.circle(50, this.height, 15);
      this.floorGraphics.circle(80, this.height + 20, 20);
      this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
      this.floorGraphics.circle(this.width - 100, this.height, 25);
      this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
  }

  initTextures() {
    if (!this.app?.renderer) return;
    Object.values(FRUIT_DEFS).forEach(def => {
      const container = new PIXI.Container();
      const r = def.radius;
      const visual = new PIXI.Graphics();
      const pColor = def.patternColor;
      
      visual.circle(0, 0, r);
      visual.fill({ color: def.color });
      if (def.tier !== FruitTier.TOMATO) {
        visual.stroke({ width: 4, color: pColor, alignment: 0 }); 
      }

      switch (def.tier) {
        case FruitTier.CHERRY:
          visual.circle(r*0.3, -r*0.3, r*0.2);
          visual.fill({ color: 0xFFFFFF, alpha: 0.3 });
          break;
        case FruitTier.STRAWBERRY:
          for(let i=0; i<6; i++) {
              visual.circle((Math.random()-0.5)*r*1.2, (Math.random()-0.5)*r*1.2, 2);
              visual.fill({ color: pColor });
          }
          break;
        case FruitTier.CLEMENTINE:
          visual.ellipse(0, 0, r*0.9, r*0.8);
          visual.fill({ color: 0xFFFFFF, alpha: 0.1 });
          break;
        case FruitTier.ORANGE:
          visual.stroke({ width: 4, color: pColor, alpha: 0.5, alignment: 1 });
          break;
        case FruitTier.APPLE:
          visual.ellipse(-r*0.3, -r*0.3, r*0.2, r*0.3);
          visual.fill({ color: 0xFFFFFF, alpha: 0.2 });
          break;
        case FruitTier.PINEAPPLE:
          visual.moveTo(-r*0.7, -r*0.7);
          visual.lineTo(r*0.7, r*0.7);
          visual.stroke({ width: 2, color: pColor, alpha: 0.5 });
          visual.moveTo(r*0.7, -r*0.7);
          visual.lineTo(-r*0.7, r*0.7);
          visual.stroke({ width: 2, color: pColor, alpha: 0.5 });
          break;
        case FruitTier.COCONUT:
          visual.stroke({ width: 4, color: pColor, alignment: 1 });
          break;
        case FruitTier.PUMPKIN:
          visual.ellipse(0, 0, r*0.5, r);
          visual.stroke({ width: 2, color: pColor, alpha: 0.3 });
          break;
        case FruitTier.WATERMELON:
          visual.arc(0, 0, r*0.9, 0, Math.PI*2);
          visual.stroke({ width: 6, color: pColor });
          break;
        case FruitTier.TOMATO:
           visual.circle(r*0.3, -r*0.3, r*0.35);
           visual.fill({ color: 0xFFFFFF, alpha: 0.4 });
           break;
      }
      const deco = new PIXI.Graphics();
      if (def.tier === FruitTier.APPLE) {
          deco.moveTo(0, -r*0.8);
          deco.quadraticCurveTo(r*0.2, -r*1.1, r*0.4, -r*0.9);
          deco.stroke({ width: 3, color: 0x33691E });
      } else if (def.tier === FruitTier.PINEAPPLE) {
          deco.poly([-10, -r*0.9, 0, -r*1.2, 10, -r*0.9]);
          deco.fill({ color: 0x4CAF50 });
      } else if (def.tier === FruitTier.TOMATO) {
          deco.star(0, -r*0.85, 5, r*0.35, r*0.15, 0);
          deco.fill({ color: 0x2E7D32 });
      }
      container.addChild(visual);
      container.addChild(deco);
      const texture = this.app!.renderer.generateTexture({ target: container });
      this.textures.set(def.tier, texture);
      container.destroy({ children: true });
    });
  }
  
  createFace(tier: FruitTier, radius: number): PIXI.Container {
      const face = new PIXI.Container();
      const eyes = new PIXI.Graphics();
      const mouth = new PIXI.Graphics();
      eyes.label = "eyes";
      mouth.label = "mouth";
      const eyeColor = 0x221111;
      const mouthColor = 0x221111;
      
      const drawEye = (g: PIXI.Graphics, x: number, y: number, r: number, style: 'dot'|'happy'|'wink'|'star'|'derp'|'line' = 'dot') => {
          if (style === 'dot') {
              g.circle(x, y, r);
              g.fill({ color: eyeColor });
              g.circle(x - r*0.3, y - r*0.3, r*0.3); // shine
              g.fill({ color: 0xFFFFFF });
          } else if (style === 'happy') {
              g.arc(x, y, r, Math.PI, 0); // Arch
              g.stroke({ width: r/2, color: eyeColor, cap: 'round' });
          } else if (style === 'wink') {
              g.moveTo(x-r, y);
              g.lineTo(x+r, y);
              g.stroke({ width: r/2, color: eyeColor, cap: 'round' });
          } else if (style === 'line') {
              g.moveTo(x-r, y);
              g.lineTo(x+r, y);
              g.stroke({ width: r/2, color: eyeColor, cap: 'round' });
          } else if (style === 'star') {
              g.poly([x, y-r, x+r*0.3, y-r*0.3, x+r, y, x+r*0.3, y+r*0.3, x, y+r, x-r*0.3, y+r*0.3, x-r, y, x-r*0.3, y-r*0.3]);
              g.fill({ color: 0xFFD700 }); 
              g.stroke({ width: 1, color: eyeColor });
          } else if (style === 'derp') {
               g.circle(x, y, r);
               g.fill({ color: 0xFFFFFF });
               g.circle(x, y, r*0.4);
               g.fill({ color: eyeColor });
          }
      };

      const yEye = -radius * 0.1;
      const xEye = radius * 0.35; 
      const rEye = Math.max(3, radius * 0.18); 

      switch(tier) {
          case FruitTier.CHERRY: 
             drawEye(eyes, -xEye, yEye, rEye, 'dot');
             drawEye(eyes, xEye, yEye, rEye, 'dot');
             mouth.arc(0, yEye + rEye, rEye, 0.2, Math.PI - 0.2);
             mouth.stroke({ width: 2, color: mouthColor, cap: 'round' });
             break;
          case FruitTier.STRAWBERRY: 
             drawEye(eyes, -xEye, yEye, rEye*1.2, 'happy');
             drawEye(eyes, xEye, yEye, rEye*1.2, 'happy');
             mouth.moveTo(-rEye, yEye + rEye*2);
             mouth.quadraticCurveTo(0, yEye + rEye*3, rEye, yEye + rEye*2);
             mouth.stroke({ width: 2, color: mouthColor, cap: 'round' });
             break;
          case FruitTier.GRAPE: 
             drawEye(eyes, -xEye, yEye, rEye, 'dot');
             drawEye(eyes, xEye, yEye, rEye, 'dot');
             mouth.circle(0, yEye + rEye*2, rEye*0.5); // 'o'
             mouth.stroke({ width: 2, color: mouthColor });
             break;
          case FruitTier.CLEMENTINE: 
             drawEye(eyes, -xEye, yEye, rEye, 'wink');
             drawEye(eyes, xEye, yEye, rEye, 'dot');
             mouth.arc(0, yEye + rEye*1.5, rEye, 0, Math.PI);
             mouth.fill({ color: mouthColor });
             break;
          case FruitTier.ORANGE: 
             drawEye(eyes, -xEye, yEye, rEye, 'line');
             drawEye(eyes, xEye, yEye, rEye, 'line');
             mouth.moveTo(-rEye, yEye + rEye*2.5);
             mouth.lineTo(rEye, yEye + rEye*2.5); 
             mouth.stroke({ width: 3, color: mouthColor, cap: 'round' });
             break;
          case FruitTier.APPLE: 
             drawEye(eyes, -xEye, yEye, rEye, 'happy');
             drawEye(eyes, xEye, yEye, rEye, 'happy');
             mouth.arc(0, yEye + rEye*1.5, rEye*0.8, 0.2, Math.PI-0.2);
             mouth.stroke({ width: 3, color: mouthColor, cap: 'round' });
             break;
          case FruitTier.PINEAPPLE: 
             eyes.rect(-xEye-rEye*1.5, yEye-rEye*0.5, rEye*3, rEye*1.5);
             eyes.rect(xEye-rEye*1.5, yEye-rEye*0.5, rEye*3, rEye*1.5);
             eyes.moveTo(-xEye, yEye);
             eyes.lineTo(xEye, yEye);
             eyes.fill({ color: 0x111111 });
             mouth.arc(0, yEye + rEye*2, rEye, 0.2, Math.PI-0.2);
             mouth.stroke({ width: 3, color: mouthColor, cap: 'round' });
             break;
          case FruitTier.COCONUT: 
             drawEye(eyes, -xEye, yEye, rEye, 'wink');
             drawEye(eyes, xEye, yEye, rEye, 'wink');
             mouth.circle(0, yEye + rEye*2.5, rEye*0.5); 
             mouth.stroke({ width: 2, color: mouthColor });
             break;
          case FruitTier.PUMPKIN: 
             eyes.poly([-xEye, yEye-rEye, -xEye-rEye, yEye+rEye, -xEye+rEye, yEye+rEye]);
             eyes.poly([xEye, yEye-rEye, xEye-rEye, yEye+rEye, xEye+rEye, yEye+rEye]);
             eyes.fill({ color: mouthColor });
             mouth.poly([-rEye*2, yEye+rEye*2, -rEye, yEye+rEye*3, 0, yEye+rEye*2, rEye, yEye+rEye*3, rEye*2, yEye+rEye*2]);
             mouth.stroke({ width: 3, color: mouthColor, join: 'round' });
             break;
          case FruitTier.WATERMELON: 
             drawEye(eyes, -xEye, yEye, rEye*1.8, 'star');
             drawEye(eyes, xEye, yEye, rEye*1.8, 'star');
             mouth.moveTo(-rEye*1.5, yEye+rEye*2);
             mouth.quadraticCurveTo(0, yEye+rEye*5, rEye*1.5, yEye+rEye*2);
             mouth.lineTo(-rEye*1.5, yEye+rEye*2);
             mouth.fill({ color: 0x660000 });
             mouth.arc(0, yEye+rEye*3.5, rEye*0.8, 0, Math.PI);
             mouth.fill({ color: 0xFF6666 });
             break;
          case FruitTier.TOMATO: 
             drawEye(eyes, -xEye, yEye, rEye*1.5, 'wink');
             drawEye(eyes, xEye, yEye, rEye*1.5, 'wink');
             mouth.moveTo(-rEye, yEye + rEye*2);
             mouth.quadraticCurveTo(0, yEye + rEye*3, rEye, yEye + rEye*2); 
             mouth.stroke({ width: 2, color: mouthColor });
             break;
      }
      face.addChild(eyes);
      face.addChild(mouth);
      return face;
  }
  
  spawnNextFruit() {
    if (!this.canDrop) return;
    let maxTier = FruitTier.CHERRY;
    for (const p of this.fruits) {
        if (!p.isStatic && p.tier !== FruitTier.TOMATO) {
            if (p.tier > maxTier) maxTier = p.tier;
        }
    }
    this.onMaxFruit(maxTier);
    if (maxTier > this.stats.maxTier) {
        this.stats.maxTier = maxTier;
    }
    
    const limit = Math.min(FruitTier.COCONUT, Math.max(FruitTier.CHERRY, maxTier - 2));
    const possibleTiers: FruitTier[] = [];
    for (let i = 0; i <= limit; i++) {
        possibleTiers.push(i);
    }
    const isTomato = Math.random() < 0.015;
    const tier = isTomato ? FruitTier.TOMATO : possibleTiers[Math.floor(Math.random() * possibleTiers.length)];
    this.nextFruitTier = tier;
    this.onNextFruit(tier);
    this.currentFruit = new Particle(
        this.width / 2, 
        this.height * SPAWN_Y_PERCENT, 
        FRUIT_DEFS[tier], 
        this.nextId++
    );
    this.currentFruit.isStatic = true; 
    this.dragAnchorX = this.width / 2;
    this.dragAnchorY = this.height * SPAWN_Y_PERCENT;
    this.createSprite(this.currentFruit);
  }

  forceCurrentFruit(tier: FruitTier) {
    if (!this.currentFruit) return;

    // Cleanup existing sprite
    const oldSprite = this.fruitSprites.get(this.currentFruit.id);
    if (oldSprite) {
        this.container.removeChild(oldSprite);
        oldSprite.destroy({ children: true });
        this.fruitSprites.delete(this.currentFruit.id);
    }

    this.nextFruitTier = tier;
    this.onNextFruit(tier);

    // Create new particle at same position
    this.currentFruit = new Particle(
        this.currentFruit.x,
        this.currentFruit.y,
        FRUIT_DEFS[tier],
        this.nextId++
    );
    this.currentFruit.isStatic = true;

    this.createSprite(this.currentFruit);
  }
  
  createSprite(p: Particle) {
    if (!this.textures.has(p.tier)) return;
    const tex = this.textures.get(p.tier)!;
    const sprite = new PIXI.Container();
    const body = new PIXI.Sprite(tex);
    body.anchor.set(0.5);
    sprite.addChild(body);
    const face = this.createFace(p.tier, p.radius);
    face.label = "face";
    sprite.addChild(face);
    this.fruitSprites.set(p.id, sprite);
    this.container.addChild(sprite);
  }

  getVirtualPos(globalX: number, globalY: number) {
      if (!this.app || !this.app.stage) return { x: globalX / this.scaleFactor, y: globalY / this.scaleFactor };
      const containerY = this.container.position.y;
      return {
          x: globalX / this.scaleFactor,
          y: (globalY - containerY) / this.scaleFactor
      };
  }

  onPointerDown(e: PIXI.FederatedPointerEvent) {
    if (this.paused) return;
    this.audio.resume(); 
    if (!this.currentFruit || !this.canDrop) return;
    this.isAiming = true;
    const p = this.getVirtualPos(e.global.x, e.global.y);
    this.updateAim(p.x, p.y);
    this.pointerHistory = [];
  }

  onPointerMove(e: PIXI.FederatedPointerEvent) {
    if (this.paused) return;
    if (!this.isAiming) return;
    const p = this.getVirtualPos(e.global.x, e.global.y);
    this.updateAim(p.x, p.y);
    const now = performance.now();
    this.pointerHistory.push({ x: p.x, y: p.y, time: now });
    if (this.pointerHistory.length > 8) this.pointerHistory.shift();
  }

  updateAim(x: number, y: number) {
    const r = this.currentFruit ? this.currentFruit.radius : 20;
    this.aimX = Math.max(r, Math.min(this.width - r, x));
    this.dragAnchorX = this.aimX;
    this.dragAnchorY = (this.height * SPAWN_Y_PERCENT) + (Math.min(y, this.height * 0.4) - this.height * 0.2) * 0.1;
  }

  onPointerUp(e: PIXI.FederatedPointerEvent) {
    if (this.paused) return;
    if (!this.isAiming || !this.currentFruit) return;
    this.isAiming = false;
    let vx = 0;
    let vy = 0;
    if (this.pointerHistory.length >= 2) {
      const newest = this.pointerHistory[this.pointerHistory.length - 1];
      const oldest = this.pointerHistory[0];
      const dt = newest.time - oldest.time;
      if (dt > 0) {
        // BOOSTED THROW POWER! (Was 15)
        vx = (newest.x - oldest.x) / dt * 22; 
        vy = (newest.y - oldest.y) / dt * 22;
      }
    }
    const maxSpeed = 40; // INCREASED MAX SPEED (Was 25)
    const len = Math.sqrt(vx*vx + vy*vy);
    if (len > maxSpeed) {
      vx = (vx/len) * maxSpeed;
      vy = (vy/len) * maxSpeed;
    }
    if (vy < -15) vy = -15; 

    // --- CHAIN COMBO LOGIC RESET ---
    // If the previous turn (drop) resulted in NO merges, reset the combo chain.
    if (!this.didMergeThisTurn) {
        this.comboChain = 0;
        this.onCombo(0);
    }
    // Reset flags for the upcoming turn
    this.didMergeThisTurn = false;

    this.currentFruit.isStatic = false;
    this.currentFruit.vx = vx;
    this.currentFruit.vy = vy;
    this.currentFruit.angularVelocity = vx * 0.05;
    this.fruits.push(this.currentFruit);
    this.currentFruit = null;
    this.canDrop = false;
    const config = DIFFICULTY_CONFIG[this.difficulty];
    setTimeout(() => {
        this.canDrop = true;
        this.spawnNextFruit();
    }, config.spawnDelay);
  }

  update(ticker: PIXI.Ticker) {
    if (this.paused) return;
    const dt = 1/60; 
    this.updateGameLogic(dt * 1000); 
    this.updatePhysics(dt);
    this.updateVisualEffects(dt);
    this.audio.update();
    this.drawDangerLine();
    this.renderSync();
  }
  
  spawnPassiveTomatoParticle(x: number, y: number, radius: number) {
      if (Math.random() < 0.3) {
          const angle = Math.random() * Math.PI * 2;
          const r = radius * (0.8 + Math.random() * 0.3);
          const sx = x + Math.cos(angle) * r;
          const sy = y + Math.sin(angle) * r;
          
          const part = new EffectParticle(sx, sy, 0xFF6347, 'circle');
          // Slow drift away
          part.vx = Math.cos(angle) * 0.3; 
          part.vy = Math.sin(angle) * 0.3 - 0.2; // Slight updrift
          part.life = 1.2;
          part.size = 2 + Math.random() * 2;
          part.alpha = 0.5;
          this.visualParticles.push(part);
      }
  }

  updateVisualEffects(dt: number) {
    this.effectGraphics.clear();
    const activeTomatoes = this.activeTomatoes;
    const hasActive = activeTomatoes.length > 0;

    // 1. SPAWN PARTICLES

    // A. Active Tomato "Event Horizon" Spawning
    if (hasActive) {
        if (this.visualParticles.filter(p => p.type === 'suck').length < 300) {
            for (const t of activeTomatoes) {
                 for(let i=0; i<3; i++) {
                     // Spawn on a large ring (180-220px radius)
                     const angle = Math.random() * Math.PI * 2;
                     const spawnR = 180 + Math.random() * 40; 
                     const px = t.x + Math.cos(angle) * spawnR;
                     const py = t.y + Math.sin(angle) * spawnR;
                     
                     const p = new EffectParticle(px, py, 0xFF4444, 'suck');
                     p.targetId = t.tomatoId;
                     p.life = 1.0; 
                     p.size = 3 + Math.random() * 3;
                     p.alpha = 0; // Fade in
                     this.visualParticles.push(p);
                 }
            }
        }
    }

    // B. Passive Tomato Particles (Existing, Current, Next)
    // 1. Existing Fruits
    for(const p of this.fruits) {
        if (p.tier === FruitTier.TOMATO) {
            const isActive = this.activeTomatoes.some(t => t.tomatoId === p.id);
            if (!isActive) {
                 this.spawnPassiveTomatoParticle(p.x, p.y, p.radius);
            }
        }
    }
    // 2. Currently Held Fruit
    if (this.currentFruit && this.currentFruit.tier === FruitTier.TOMATO) {
        this.spawnPassiveTomatoParticle(this.currentFruit.x, this.currentFruit.y, this.currentFruit.radius);
    }
    // 3. Next Preview Fruit (Top Right)
    // Coordinate approx: Width - 50, Top 70 (Based on UI layout)
    if (this.nextFruitTier === FruitTier.TOMATO) {
        this.spawnPassiveTomatoParticle(this.width - 55, 75, 45);
    }

    // C. Fever Particles (Stars)
    if (this.feverActive) {
        if (Math.random() < 0.3) { 
             const sparkle = new EffectParticle(Math.random() * this.width, this.height + 20, 0xFFD700, 'star');
             sparkle.vy = -Math.random() * 2 - 2; 
             sparkle.vx = (Math.random() - 0.5) * 1;
             this.visualParticles.push(sparkle);
        }
    }

    // 2. UPDATE & RENDER PARTICLES
    for (let i = this.visualParticles.length - 1; i >= 0; i--) {
        const p = this.visualParticles[i];
        
        let targetTomato: TomatoEffect | null = null;
        
        // Find associated tomato for 'suck' particles
        if (p.type === 'suck' && hasActive && p.targetId !== undefined) {
             targetTomato = activeTomatoes.find(t => t.tomatoId === p.targetId) || null;
             // If target tomato is gone, kill particle
             if (!targetTomato) {
                 this.visualParticles.splice(i, 1);
                 continue;
             }
        }

        if (targetTomato) {
            // --- EVENT HORIZON MODE (Spiral Inward) ---
            const dx = p.x - targetTomato.x;
            const dy = p.y - targetTomato.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const currentAngle = Math.atan2(dy, dx);

            // Reached center?
            if (dist < 20) {
                this.visualParticles.splice(i, 1);
                continue;
            }

            // Move Inward
            const radialSpeed = 3 + (200 / (dist + 10)); // Gets faster as it gets closer
            const tangentialSpeed = 0.15; // Constant rotation

            const nextAngle = currentAngle + tangentialSpeed;
            const nextRadius = dist - radialSpeed;

            p.x = targetTomato.x + Math.cos(nextAngle) * nextRadius;
            p.y = targetTomato.y + Math.sin(nextAngle) * nextRadius;

            p.color = 0xFF0000;
            // Fade in then stay solid
            if (p.alpha < 1.0) p.alpha += 0.05;
            
            // Draw
            this.effectGraphics.circle(p.x, p.y, p.size);
            this.effectGraphics.fill({ color: p.color, alpha: p.alpha });

        } else {
            // --- PASSIVE / STANDARD MODE ---
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.015; // Decay
            
            if (p.type === 'circle') {
                p.alpha = Math.min(0.6, p.life);
                p.vx *= 0.96; // Friction
                p.vy *= 0.96;
            } else {
                p.alpha = Math.min(1, p.life);
            }

            if (p.type === 'star') {
                this.effectGraphics.star(p.x, p.y, 5, p.size, p.size/2, p.life * 5); 
                this.effectGraphics.fill({ color: p.color, alpha: p.alpha });
            } else {
                 this.effectGraphics.circle(p.x, p.y, p.size);
                 this.effectGraphics.fill({ color: p.color, alpha: p.alpha });
            }
            
            // Bounds/Life Check
            if (p.life <= 0 || p.y < -50 || p.y > this.height + 50 || p.x < -50 || p.x > this.width + 50) {
                this.visualParticles.splice(i, 1);
            }
        }
    }
  }

  createMergeEffect(x: number, y: number, color: string) {
      for(let i=0; i<15; i++) {
          const p = new EffectParticle(x, y, color, Math.random() > 0.5 ? 'circle' : 'star');
          const angle = Math.random() * Math.PI * 2;
          const force = Math.random() * 10 + 5;
          p.vx = Math.cos(angle) * force;
          p.vy = Math.sin(angle) * force;
          this.visualParticles.push(p);
      }
  }

  updateGameLogic(dtMs: number) {
    this.stats.timePlayed += dtMs;
    this.onTimeUpdate(this.stats.timePlayed);

    for (let i = this.activeTomatoes.length - 1; i >= 0; i--) {
        const t = this.activeTomatoes[i];
        t.timer -= dtMs / 1000;
        const tomatoParticle = this.fruits.find(p => p.id === t.tomatoId);
        if (tomatoParticle) {
            t.x = tomatoParticle.x;
            t.y = tomatoParticle.y;
            const progress = 1 - (t.timer / t.maxTime); 
            tomatoParticle.scaleX = 1 + (progress * 0.3);
            tomatoParticle.scaleY = 1 + (progress * 0.3);
            tomatoParticle.alpha = 1 - (progress * 0.4);
            tomatoParticle.rotation += 0.05;
        }
        if (t.timer <= 0) {
            this.concludeTomatoEffect(t);
            this.activeTomatoes.splice(i, 1);
        }
    }
    for(const p of this.fruits) {
        if (p.cooldownTimer > 0) p.cooldownTimer -= dtMs / 1000;
    }
    // Removed old combo decay logic. Combo now controlled by drop chain.

    if (this.feverActive) {
        this.feverTimer -= dtMs;
        if (this.feverTimer <= 0) {
            this.feverActive = false;
            this.audio.setFrenzy(false); // Music normal
            this.juice = 0;
            this.onJuiceUpdate(0, JUICE_MAX);
            this.onFeverEnd();
        }
    } else {
        if (this.juice >= JUICE_MAX && !this.feverActive) {
            this.feverActive = true;
            this.audio.setFrenzy(true); // Music frenzy
            this.feverTimer = FEVER_DURATION_MS;
            this.stats.feverCount++;
            this.onFeverStart();
        }
    }
    const dangerY = this.height * DANGER_Y_PERCENT;
    let inDangerZone = false;
    for (const f of this.fruits) {
        if (!f.isStatic && f.y - f.radius < dangerY) {
             inDangerZone = true;
             break;
        }
    }
    if (inDangerZone) {
        this.dangerAccumulator += dtMs;
        if (this.dangerAccumulator > this.DANGER_TRIGGER_DELAY) {
            if (!this.dangerActive) {
                this.dangerActive = true;
                this.dangerTimer = DANGER_TIME_MS;
            }
        }
    } else {
        this.dangerAccumulator = 0;
        this.dangerActive = false;
        this.onDanger(false, 0);
    }
    if (this.dangerActive) {
        this.dangerTimer -= dtMs;
        this.onDanger(true, this.dangerTimer);
        if (this.dangerTimer <= 0) {
            this.gameOver();
        }
    }
  }

  // --- REFACTORED PHYSICS LOOP ---
  updatePhysics(dt: number) {
    const config = DIFFICULTY_CONFIG[this.difficulty];
    const gravity = config.gravity; 
    const friction = config.friction;
    
    // 1. Reset Collision Flags
    for (const p of this.fruits) {
        if (!p.isCaught) p.ignoreCollisions = false;
    }

    // 2. Integration & Aiming
    if (this.currentFruit && this.isAiming) {
        const k = 0.1;
        const ax = this.dragAnchorX - this.currentFruit.x;
        const ay = this.dragAnchorY - this.currentFruit.y;
        this.currentFruit.vx += ax * k;
        this.currentFruit.vy += ay * k;
        this.currentFruit.vx *= 0.8;
        this.currentFruit.vy *= 0.8;
        this.currentFruit.x += this.currentFruit.vx;
        this.currentFruit.y += this.currentFruit.vy;
    }

    for (const p of this.fruits) {
        if (p.isStatic) continue;

        if (!p.isCaught) {
            p.vy += gravity;
            p.vx *= friction;
            p.vy *= friction;
        }

        // Apply Velocity
        p.x += p.vx;
        p.y += p.vy;
        
        // Rotation
        p.rotation += p.angularVelocity;
        p.angularVelocity *= 0.95; // Strong rotational drag
        
        p.blinkTimer -= 1;
        if (p.blinkTimer <= 0) {
            p.isBlinking = !p.isBlinking;
            p.blinkTimer = p.isBlinking ? 10 : 200 + Math.random() * 300;
        }
    }
    
    // 3. Tomato Logic (Tractor)
    this.updateTomatoPhysics();

    // 4. Solver Loop (Substeps)
    for (let s = 0; s < SUBSTEPS; s++) {
        this.updateContactCounts(); // NEW: Count contacts before resolving
        
        // --- GLOBAL LOCKING FRICTION ---
        // If a particle is touching > 1 things, we dampen it heavily here.
        // This stops sliding when wedged, regardless of collision angle.
        for (const p of this.fruits) {
            if (p.isStatic || p.isCaught) continue;
            
            if (p.contactCount > 1) {
                // LOCK IT DOWN
                p.vx *= FRICTION_LOCK;
                p.vy *= FRICTION_LOCK;
                p.angularVelocity *= 0.5; // Kill rotation
            }
        }

        this.resolveCollisions();
        this.resolveWalls();
    }
  }

  updateContactCounts() {
      // Reset counts
      for (const p of this.fruits) {
          p.contactCount = 0;
      }
      
      // Check floor
      for (const p of this.fruits) {
          if (p.isStatic || p.isCaught) continue;
          // Check if touching floor
          const groundY = this.getFloorY(p.x);
          if (p.y + p.radius >= groundY - 2) { // 2px epsilon
              p.contactCount++;
          }
      }

      // Check pairs
      for (let i = 0; i < this.fruits.length; i++) {
        for (let j = i + 1; j < this.fruits.length; j++) {
            const p1 = this.fruits[i];
            const p2 = this.fruits[j];
            if (p1.ignoreCollisions || p2.ignoreCollisions || p1.isStatic || p2.isStatic) continue;

             const dx = p1.x - p2.x;
             const dy = p1.y - p2.y;
             const distSq = dx*dx + dy*dy;
             const radSum = p1.radius + p2.radius;
             if (distSq < radSum * radSum) {
                 p1.contactCount++;
                 p2.contactCount++;
             }
        }
      }

      // Calculate Stability (Inertia)
      // > 1 Contact = Stable (Massive inertia)
      // <= 1 Contact = Unstable (Normal mass)
      for (const p of this.fruits) {
          if (p.contactCount > 1) {
              p.stability = 1.0;
          } else {
              p.stability = 0.0;
          }
      }
  }

  updateTomatoPhysics() {
    for (const t of this.activeTomatoes) {
        const tomato = this.fruits.find(p => p.id === t.tomatoId);
        if (!tomato) continue;

        for (const p of this.fruits) {
            if (p.id === t.tomatoId || p === this.currentFruit || p.isStatic) continue;
            
            if (p.tier === t.targetTier) {
                p.isCaught = true;
                p.ignoreCollisions = true;
                if (!t.capturedIds.includes(p.id)) t.capturedIds.push(p.id);

                const dx = tomato.x - p.x;
                const dy = tomato.y - p.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const angle = Math.atan2(dy, dx) + (Math.PI / 9); 
                const speed = 15 + (1000 / (dist + 50)); 
                
                p.vx = p.vx * 0.85 + Math.cos(angle) * speed * 0.15;
                p.vy = p.vy * 0.85 + Math.sin(angle) * speed * 0.15;

                const suckRadius = tomato.radius * 4;
                if (dist < suckRadius) {
                    const scale = Math.max(0.1, dist / suckRadius);
                    p.scaleX = scale;
                    p.scaleY = scale;
                    p.alpha = scale; 
                    p.rotation += 0.3; 
                }
            }
        }
    }
  }

  resolveWalls() {
    const width = this.width;
    for (const p of this.fruits) {
        if (p.isStatic || p.isCaught) continue;
        
        const groundY = this.getFloorY(p.x);
        
        // Strict Floor Clamp
        if (p.y + p.radius > groundY) {
            p.y = groundY - p.radius; // HARD RESET
            p.vy *= -FLOOR_DAMPING; // Bounce (Uses constant for bounciness)
            p.vx *= 0.85; // Floor Friction
            
            // Push out of slope if needed (simplified)
            // Just ensuring y is correct fixes 90% of tunneling
        }

        // Walls
        if (p.x - p.radius < 0) {
            p.x = p.radius;
            p.vx *= -WALL_DAMPING; // Bounce
        }
        if (p.x + p.radius > width) {
            p.x = width - p.radius;
            p.vx *= -WALL_DAMPING; // Bounce
        }
    }
  }

  resolveCollisions() {
    for (let i = 0; i < this.fruits.length; i++) {
        for (let j = i + 1; j < this.fruits.length; j++) {
            const p1 = this.fruits[i];
            const p2 = this.fruits[j];

            if (p1.ignoreCollisions || p2.ignoreCollisions) continue;
            if (p1.isStatic && p2.isStatic) continue;

            // Tomato Logic Pass-through
            const tEffect = this.activeTomatoes.find(t => t.tomatoId === p1.id || t.tomatoId === p2.id);
            if (tEffect) {
                 const other = p1.id === tEffect.tomatoId ? p2 : p1;
                 if (other.tier === tEffect.targetTier) continue; 
            }
            
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx*dx + dy*dy;
            const radSum = p1.radius + p2.radius;
            
            if (distSq < radSum * radSum) {
                const dist = Math.sqrt(distSq);
                
                // --- MERGE LOGIC ---
                if (p1.tier === p2.tier && p1.tier !== FruitTier.WATERMELON && p1.tier !== FruitTier.TOMATO && p2.tier !== FruitTier.TOMATO) {
                    if (p1.cooldownTimer <= 0 && p2.cooldownTimer <= 0) {
                        this.merge(p1, p2);
                        i--; 
                        break;
                    }
                }
                
                if (p1.tier === FruitTier.TOMATO || p2.tier === FruitTier.TOMATO) {
                    this.handleTomatoCollision(p1, p2);
                    return;
                }

                if (dist === 0) continue;

                // --- PHYSICS RESOLUTION (Weighted by Stability) ---
                
                const overlap = radSum - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                
                // 1. Separate Particles (Position Projection)
                // Use stability to make established stacks "heavier" (harder to push)
                // Stable fruits effectively have 11x mass
                const im1 = 1 / (p1.mass * (1 + p1.stability * 10)); 
                const im2 = 1 / (p2.mass * (1 + p2.stability * 10));
                const totalIm = im1 + im2;

                const r1 = p1.isStatic ? 0 : (im1 / totalIm);
                const r2 = p2.isStatic ? 0 : (im2 / totalIm);

                if (!p1.isStatic) {
                    p1.x += nx * overlap * r1;
                    p1.y += ny * overlap * r1;
                }
                if (!p2.isStatic) {
                    p2.x -= nx * overlap * r2;
                    p2.y -= ny * overlap * r2;
                }

                // 2. Velocity Handling (Impulse)
                // Calculate relative velocity
                const dvx = p1.vx - p2.vx;
                const dvy = p1.vy - p2.vy;
                const dot = dvx * nx + dvy * ny;

                if (dot < 0) {
                    // Only apply impulse if moving towards each other
                    // Simple Bounce
                    const restitution = 0.4; // BOOSTED BOUNCINESS (Was 0.2)
                    const j = -(1 + restitution) * dot;
                    
                    p1.vx += j * nx * r1;
                    p1.vy += j * ny * r1;
                    p2.vx -= j * nx * r2;
                    p2.vy -= j * ny * r2;

                    // 3. SLIDING FRICTION (Only applied if NOT locked)
                    // If contactCount > 1, we already handled friction globally via locking.
                    // If contactCount <= 1, we apply smooth sliding friction here.
                    if (p1.contactCount <= 1) {
                         p1.vx *= FRICTION_SLIDE;
                         p1.vy *= FRICTION_SLIDE;
                    }
                    if (p2.contactCount <= 1) {
                         p2.vx *= FRICTION_SLIDE;
                         p2.vy *= FRICTION_SLIDE;
                    }
                }
            }
        }
    }
  }

  merge(p1: Particle, p2: Particle) {
    // Scoring: strictly integers. Exponential based on Resulting Tier.
    // Cherry (0) + Cherry (0) -> Strawberry (1). Points = Base * 2^1
    const nextTier = p1.tier + 1;
    const basePoints = SCORE_BASE_MERGE * Math.pow(2, nextTier);
    
    // Chain Combo Logic
    this.comboChain++;
    this.didMergeThisTurn = true;

    const comboMult = 1 + Math.min(this.comboChain, 10); // Cap multiplier reasonable
    const feverMult = this.feverActive ? 2 : 1;
    
    const totalPoints = basePoints * comboMult * feverMult;
    
    this.addScore(totalPoints);
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.comboChain);
    this.onCombo(this.comboChain);
    
    if (nextTier > this.stats.maxTier) {
        this.stats.maxTier = nextTier;
    }

    if (!this.feverActive) {
        this.juice = Math.min(JUICE_MAX, this.juice + 50);
        this.onJuiceUpdate(this.juice, JUICE_MAX);
    }
    this.removeParticle(p1);
    this.removeParticle(p2);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const nextDef = FRUIT_DEFS[nextTier as FruitTier];
    const newP = new Particle(midX, midY, nextDef, this.nextId++);
    this.fruits.push(newP);
    this.createSprite(newP);
    this.createMergeEffect(midX, midY, nextDef.color);
    this.audio.playMergeSound(nextTier); // Trigger Pop Sound
    this.applyShockwave(midX, midY, 150, 5);
    if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(20);
  }

  handleTomatoCollision(p1: Particle, p2: Particle) {
    const tomato = p1.tier === FruitTier.TOMATO ? p1 : p2;
    const victim = p1.tier === FruitTier.TOMATO ? p2 : p1;
    if (victim.tier === FruitTier.TOMATO) return; 
    if (tomato.cooldownTimer > 0) return;
    const existing = this.activeTomatoes.find(t => t.tomatoId === tomato.id);
    if (existing) return;
    const effect = new TomatoEffect(tomato.id, tomato.x, tomato.y, victim.tier);
    this.activeTomatoes.push(effect);
    tomato.isStatic = true; 
    tomato.vx = 0;
    tomato.vy = 0;
    tomato.y = Math.max(tomato.radius, tomato.y - 50);
    const sprite = this.fruitSprites.get(tomato.id);
    if (sprite) {
        sprite.alpha = 1; 
    }
  }

  concludeTomatoEffect(effect: TomatoEffect) {
    const tomato = this.fruits.find(p => p.id === effect.tomatoId);
    let releaseX = effect.x;
    let releaseY = effect.y;
    if (tomato) {
        releaseX = tomato.x;
        releaseY = tomato.y;
        this.removeParticle(tomato);
        this.stats.tomatoUses++;
    }
    for (const id of effect.capturedIds) {
        const p = this.fruits.find(f => f.id === id);
        if (p) {
            p.isCaught = false;
            p.ignoreCollisions = false;
            p.scaleX = 1;
            p.scaleY = 1;
            p.alpha = 1; 
            p.cooldownTimer = 0.8; 
            p.x = releaseX + (Math.random() - 0.5) * 5;
            p.y = releaseY + (Math.random() - 0.5) * 5;
            const angle = Math.random() * Math.PI * 2;
            const force = 5;
            p.vx = Math.cos(angle) * force;
            p.vy = Math.sin(angle) * force - 3; 
        }
    }
    // Explosive visual release
    this.createMergeEffect(releaseX, releaseY, "#FF4444");
    this.applyShockwave(releaseX, releaseY, 600, 40);
    if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 50]);
  }

  applyShockwave(x: number, y: number, radius: number, force: number) {
    for (const p of this.fruits) {
        const dx = p.x - x;
        const dy = p.y - y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < radius && d > 0) {
            const factor = 1 - d/radius;
            p.vx += (dx/d) * force * factor;
            p.vy += (dy/d) * force * factor;
        }
    }
  }

  removeParticle(p: Particle) {
    const idx = this.fruits.indexOf(p);
    if (idx >= 0) this.fruits.splice(idx, 1);
    const sprite = this.fruitSprites.get(p.id);
    if (sprite) {
        this.container.removeChild(sprite);
        sprite.destroy();
        this.fruitSprites.delete(p.id);
    }
  }

  addScore(amt: number) {
    this.score += Math.floor(amt);
    this.stats.score = this.score;
    this.onScore(Math.floor(amt), this.score);
  }

  gameOver() {
    this.canDrop = false;
    this.app?.ticker.stop();
    this.audio.stop();
    this.onGameOver(this.stats);
  }

  drawDangerLine() {
    this.dangerLine.clear();
    const y = this.height * DANGER_Y_PERCENT;
    const width = this.width;
    this.dangerLine.moveTo(0, y);
    this.dangerLine.lineTo(width, y);
    if (this.dangerActive) {
        this.dangerLine.stroke({ width: 6, color: 0xFF0000, alpha: 0.8 + Math.sin(Date.now() * 0.01) * 0.2 });
    } else {
        this.dangerLine.stroke({ width: 3, color: 0x000000, alpha: 0.2 });
    }
  }

  renderSync() {
    let rhythmicScaleX = 1;
    let rhythmicScaleY = 1;
    if (this.feverActive) {
        const time = Date.now();
        const pulse = Math.sin((time / 250) * Math.PI) * 0.05; 
        rhythmicScaleX = 1 + pulse;
        rhythmicScaleY = 1 - pulse; 
    }
    if (this.currentFruit) {
        const sprite = this.fruitSprites.get(this.currentFruit.id);
        if (sprite) {
            sprite.x = this.currentFruit.x;
            sprite.y = this.currentFruit.y;
            sprite.rotation = this.currentFruit.rotation;
        }
    }
    for (const p of this.fruits) {
        const sprite = this.fruitSprites.get(p.id);
        if (sprite) {
            sprite.x = p.x;
            sprite.y = p.y;
            sprite.rotation = p.rotation;
            sprite.alpha = p.alpha;
            sprite.scale.set(
                p.scaleX * rhythmicScaleX, 
                p.scaleY * rhythmicScaleY
            );
            const face = sprite.getChildByLabel("face") as PIXI.Container;
            if (face) {
                const eyes = face.getChildByLabel("eyes");
                if (eyes) {
                    if (p.isBlinking) {
                         eyes.scale.y = 0.1;
                    } else {
                         eyes.scale.y = 1;
                    }
                }
                const lookX = Math.min(10, Math.max(-10, p.vx));
                const lookY = Math.min(10, Math.max(-10, p.vy));
                face.position.set(lookX * 0.5, lookY * 0.5);
            }
        }
    }
  }

  cleanup() {
    this.destroyed = true;
    this.audio.stop();
    if (!this.initializing && this.app) {
        try {
            this.app.destroy({ removeView: false });
        } catch(e) {
            console.warn(`[GameEngine] Error destroying Pixi app`, e);
        }
    }
  }
}
