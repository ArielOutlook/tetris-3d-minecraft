import './styles.css';
import { Sfx } from './audio/sfx';
import { BOARD_HEIGHT, BOARD_WIDTH } from './config';
import { Game } from './core/game';
import { FixedStepper } from './core/stepper';
import type { Action, GameEvent } from './core/types';
import { Controller } from './input/controller';
import { bindKeyboard } from './input/keyboard';
import { bindTouch } from './input/touch';
import { BlockLayer } from './render/blocks';
import { Effects } from './render/effects';
import { GhostLayer } from './render/ghost';
import { SceneView } from './render/scene';
import { Well } from './render/well';
import {
  addHighscore,
  loadHighscores,
  loadSettings,
  safeStorage,
  saveSettings,
  type Settings,
} from './storage/highscores';
import { Hud } from './ui/hud';

const params = new URLSearchParams(location.search);

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

function boot(): void {
  const storage = safeStorage();
  const settings: Settings = loadSettings(storage);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const seedParam = params.get('seed');
  const game = new Game(seedParam ? { seed: Number(seedParam) >>> 0 } : {});
  const sfx = new Sfx(settings.muted);

  let view: SceneView | null = null;
  let blocks: BlockLayer | null = null;
  let ghost: GhostLayer | null = null;
  let effects: Effects | null = null;
  let well: Well | null = null;

  const persist = () => saveSettings(storage, settings);
  const stepper = new FixedStepper();
  const pending: Action[] = [];
  /** Guards against an accidental restart from a key still held when the game ends. */
  let gameOverAt = 0;
  const GAME_OVER_GUARD_MS = 600;
  /** While the WebGL context is lost nothing is drawn: the game must stay frozen. */
  let contextLost = false;

  const refreshHighscores = (highlight = -1) => {
    const list = loadHighscores(storage);
    hud.setHighscores(list, highlight);
    hud.setBest(list[0]?.score ?? 0);
  };

  const controller = new Controller((cmd) => {
    if (cmd === 'camera') view?.resetCamera();
    if (cmd === 'mute') toggleMute();
  });

  const resumeGame = () => {
    if (!contextLost) handle(game.resume());
  };

  const startGame = () => {
    if (contextLost) return;
    if (game.state.status === 'gameover' && performance.now() - gameOverAt < GAME_OVER_GUARD_MS) return;
    sfx.unlock();
    controller.releaseAll();
    pending.length = 0;
    stepper.reset();
    handle(game.start());
    hud.show('playing');
    view?.canvas.focus({ preventScroll: true });
  };

  const toggleMute = () => {
    settings.muted = !settings.muted;
    sfx.muted = settings.muted;
    hud.setMuted(settings.muted);
    persist();
  };

  const hud = new Hud({
    play: startGame,
    restart: startGame,
    resume: resumeGame,
    pause: () => handle(game.pause()),
    toMenu: () => {
      game.toMenu();
      controller.releaseAll();
      refreshHighscores();
      hud.show('menu');
    },
    toggleMute,
    toggleQuality: () => {
      settings.quality = settings.quality === 'alto' ? 'bajo' : 'alto';
      view?.setQuality(settings.quality);
      hud.setQuality(settings.quality);
      persist();
    },
    resetCamera: () => view?.resetCamera(),
  });
  hud.setMuted(settings.muted);
  hud.setQuality(settings.quality);
  refreshHighscores();
  hud.show('menu');

  if (!hasWebGL2()) {
    hud.showError();
    return;
  }

  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  canvas.tabIndex = -1;
  try {
    view = new SceneView(canvas, settings.quality);
  } catch (err) {
    console.error(err);
    hud.showError('No se pudo iniciar el render 3D. Recarga la página o prueba con otro navegador.');
    return;
  }
  well = new Well();
  blocks = new BlockLayer(BOARD_WIDTH, BOARD_HEIGHT);
  ghost = new GhostLayer(BOARD_WIDTH);
  effects = new Effects(BOARD_WIDTH);
  view.scene.add(well.group, blocks.group, ghost.mesh, effects.group);
  view.setQuality(settings.quality); // propagate shadow flags to freshly added meshes

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    controller.releaseAll();
    pending.length = 0;
    handle(game.pause());
    hud.showError('Se perdió el contexto gráfico. Espera un momento o recarga la página.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    stepper.reset();
    hud.hideError();
  });

  function handle(events: GameEvent[]): void {
    if (events.length === 0) return;
    sfx.play(events);
    for (const e of events) {
      switch (e.type) {
        case 'paused':
          controller.releaseAll();
          hud.show('paused');
          break;
        case 'resumed':
          hud.show('playing');
          break;
        case 'linesCleared':
          effects?.lineClear(e.rows, e.kinds, reducedMotion);
          if (e.count === 4 && !reducedMotion) view?.startShake();
          break;
        case 'gameOver': {
          gameOverAt = performance.now();
          controller.releaseAll();
          const { rank } = addHighscore(storage, {
            score: e.score,
            level: e.level,
            lines: e.lines,
            date: new Date().toISOString(),
          });
          refreshHighscores(rank);
          hud.showGameOver(e, rank);
          break;
        }
        default:
          break;
      }
    }
  }

  // Keyboard: game commands only while playing/paused; Enter drives menus.
  bindKeyboard(window, controller, (cmd) => {
    sfx.unlock();
    const status = game.state.status;
    if (cmd === 'mute' || cmd === 'camera') return true;
    if (status === 'playing') return true;
    if (status === 'paused') return cmd === 'pause' && !contextLost;
    return false;
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
    const status = game.state.status;
    if (status === 'menu' || status === 'gameover') {
      e.preventDefault();
      startGame();
    } else if (status === 'paused') {
      e.preventDefault();
      resumeGame();
    }
  });

  const touchRoot = document.getElementById('touch') as HTMLElement;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || params.has('touch');
  if (coarse) document.body.classList.add('is-touch');
  bindTouch(touchRoot, controller, () => sfx.unlock());

  const pauseIfPlaying = () => handle(game.pause());
  window.addEventListener('blur', pauseIfPlaying);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseIfPlaying();
  });
  window.addEventListener('resize', () => view?.resize());

  if (params.has('test')) {
    (window as unknown as { __game: Game; __blocks: () => number }).__game = game;
    (window as unknown as { __blocks: () => number }).__blocks = () => blocks?.total ?? 0;
  }

  const showFps = params.get('fps') === '1';
  let fpsFrames = 0;
  let fpsTime = 0;
  let last = performance.now();

  const frame = (now: number) => {
    const dt = now - last;
    last = now;
    const input = controller.poll(dt);
    if (contextLost) pending.length = 0;
    else pending.push(...input.actions);
    const steps = contextLost ? 0 : stepper.advance(dt);
    for (let i = 0; i < steps; i++) {
      handle(game.step(stepper.step, { actions: pending.splice(0), softDrop: input.softDrop }));
    }
    if (game.state.status !== 'playing' && game.state.status !== 'paused') pending.length = 0;

    const s = game.state;
    touchRoot.hidden = !(coarse && s.status === 'playing');
    if (s.status !== 'menu') hud.update(s, game.preview());
    blocks?.sync(s.board, s.active);
    ghost?.sync(s.active, game.ghost());
    effects?.update(dt);
    well?.update(dt, reducedMotion);
    view?.update(dt);
    view?.render();

    if (showFps) {
      fpsFrames++;
      fpsTime += dt;
      if (fpsTime >= 500) {
        hud.setFps(`${Math.round((fpsFrames * 1000) / fpsTime)} FPS · ${blocks?.total ?? 0} bloques`);
        fpsFrames = 0;
        fpsTime = 0;
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
