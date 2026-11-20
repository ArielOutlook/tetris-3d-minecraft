import { GAME_TITLE } from '../config';
import type { GameState } from '../core/game';
import type { PieceKind } from '../core/types';
import { drawPiecePreview } from '../render/preview';
import type { HighscoreEntry, Quality } from '../storage/highscores';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const fmt = new Intl.NumberFormat('es-MX');
const dateFmt = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

export type Screen = 'menu' | 'playing' | 'paused' | 'gameover';

export interface HudHandlers {
  play(): void;
  resume(): void;
  restart(): void;
  toMenu(): void;
  toggleMute(): void;
  toggleQuality(): void;
  resetCamera(): void;
  pause(): void;
}

/** DOM overlay: stats panels, previews and menu/pause/game-over screens (Spanish UI). */
export class Hud {
  private readonly el = {
    hud: $('hud'),
    menu: $('menu'),
    pause: $('pause'),
    gameover: $('gameover'),
    error: $('error'),
    errorText: $('error-text'),
    score: $('score'),
    level: $('level'),
    lines: $('lines'),
    best: $('best'),
    hold: $<HTMLCanvasElement>('hold-preview'),
    next: $<HTMLCanvasElement>('next-preview'),
    highscores: $('highscores'),
    goScore: $('go-score'),
    goLevel: $('go-level'),
    goLines: $('go-lines'),
    goRecord: $('go-record'),
    btnSound: $('btn-sound'),
    btnSoundMenu: $('btn-sound-menu'),
    btnQuality: $('btn-quality'),
    fps: $('fps'),
  };
  // Sentinels force the first draw (an undrawn canvas defaults to 300×150).
  private last = { score: -1, level: -1, lines: -1, hold: '?', next: '?', holdUsed: false, cell: 0 };
  private screen: Screen | null = null;

  constructor(h: HudHandlers) {
    document.title = GAME_TITLE;
    document.querySelectorAll('[data-title]').forEach((n) => (n.textContent = GAME_TITLE));
    const on = (id: string, fn: () => void) => $(id).addEventListener('click', fn);
    on('btn-play', h.play);
    on('btn-resume', h.resume);
    on('btn-restart', h.restart);
    on('btn-menu', h.toMenu);
    on('btn-again', h.restart);
    on('btn-go-menu', h.toMenu);
    on('btn-sound', h.toggleMute);
    on('btn-sound-menu', h.toggleMute);
    on('btn-quality', h.toggleQuality);
    on('btn-camera', h.resetCamera);
    on('btn-pause', h.pause);
  }

  show(screen: Screen): void {
    if (screen === this.screen) return;
    this.screen = screen;
    this.el.menu.hidden = screen !== 'menu';
    this.el.pause.hidden = screen !== 'paused';
    this.el.gameover.hidden = screen !== 'gameover';
    this.el.hud.hidden = screen === 'menu';
    // Pause/game-over focus the dialog title, not a button: a held Space/Enter must not trigger it.
    const focusId = { menu: 'btn-play', paused: 'pause-title', gameover: 'go-title', playing: null }[screen];
    if (focusId) $(focusId).focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur?.();
  }

  get current(): Screen | null {
    return this.screen;
  }

  update(state: GameState, preview: readonly PieceKind[]): void {
    const l = this.last;
    if (state.score !== l.score) this.el.score.textContent = fmt.format((l.score = state.score));
    if (state.level !== l.level) this.el.level.textContent = String((l.level = state.level));
    if (state.lines !== l.lines) this.el.lines.textContent = String((l.lines = state.lines));
    const cell = window.innerWidth < 760 || window.innerWidth < window.innerHeight ? 12 : 18;
    const resized = cell !== l.cell;
    l.cell = cell;
    const holdKey = `${state.hold ?? ''}`;
    if (resized || holdKey !== l.hold || state.holdUsed !== l.holdUsed) {
      l.hold = holdKey;
      l.holdUsed = state.holdUsed;
      drawPiecePreview(this.el.hold, [state.hold], { dim: state.holdUsed, cell });
    }
    const nextKey = preview.join('');
    if (resized || nextKey !== l.next) {
      l.next = nextKey;
      drawPiecePreview(this.el.next, preview, { cell });
    }
  }

  setBest(score: number): void {
    this.el.best.textContent = fmt.format(score);
  }

  setHighscores(list: readonly HighscoreEntry[], highlight = -1): void {
    const ol = this.el.highscores;
    ol.replaceChildren();
    if (list.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Aún no hay récords. ¡Juega una partida!';
      ol.append(li);
      return;
    }
    list.forEach((e, i) => {
      const li = document.createElement('li');
      if (i === highlight) li.classList.add('is-new');
      const left = document.createElement('span');
      left.textContent = `${i + 1}. ${fmt.format(e.score)}`;
      const right = document.createElement('span');
      let when = '';
      try {
        when = dateFmt.format(new Date(e.date));
      } catch {
        when = '';
      }
      right.textContent = `Nv ${e.level} · ${when}`;
      li.append(left, right);
      ol.append(li);
    });
  }

  /** `rank` is the 0-based position in the top list, or -1. */
  showGameOver(stats: { score: number; level: number; lines: number }, rank: number): void {
    this.el.goScore.textContent = fmt.format(stats.score);
    this.el.goLevel.textContent = String(stats.level);
    this.el.goLines.textContent = String(stats.lines);
    this.el.goRecord.hidden = rank < 0;
    this.el.goRecord.textContent =
      rank === 0 ? '¡Nuevo récord!' : `¡Entraste a los mejores! Lugar ${rank + 1}`;
    this.show('gameover');
  }

  setMuted(muted: boolean): void {
    this.el.btnSound.textContent = muted ? '🔇' : '🔊';
    this.el.btnSound.setAttribute('aria-pressed', String(muted));
    this.el.btnSound.setAttribute('aria-label', muted ? 'Activar sonido (M)' : 'Silenciar (M)');
    this.el.btnSoundMenu.textContent = `Sonido: ${muted ? 'No' : 'Sí'}`;
  }

  setQuality(q: Quality): void {
    this.el.btnQuality.textContent = `Calidad: ${q === 'alto' ? 'Alta' : 'Baja'}`;
  }

  showError(message?: string): void {
    if (message) this.el.errorText.textContent = message;
    this.el.error.hidden = false;
  }

  hideError(): void {
    this.el.error.hidden = true;
  }

  setFps(text: string | null): void {
    this.el.fps.hidden = text === null;
    if (text !== null) this.el.fps.textContent = text;
  }
}
