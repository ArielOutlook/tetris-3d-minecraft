import type { Command, Controller } from './controller';

/** Physical key codes (layout independent) → commands (REQ-E2). */
export const KEYMAP: Readonly<Record<string, Command>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'softDrop',
  Space: 'hardDrop',
  ArrowUp: 'rotCW',
  KeyX: 'rotCW',
  KeyZ: 'rotCCW',
  ControlLeft: 'rotCCW',
  ControlRight: 'rotCCW',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
  KeyA: 'hold',
  KeyC: 'camera',
  KeyM: 'mute',
  Escape: 'pause',
  KeyP: 'pause',
};

export function bindKeyboard(
  target: Window,
  controller: Controller,
  shouldHandle: (cmd: Command, e: KeyboardEvent) => boolean,
): () => void {
  const down = (e: KeyboardEvent) => {
    const cmd = KEYMAP[e.code];
    if (!cmd) return;
    if (!shouldHandle(cmd, e)) return;
    e.preventDefault();
    if (e.repeat) return;
    controller.press(cmd);
  };
  const up = (e: KeyboardEvent) => {
    const cmd = KEYMAP[e.code];
    if (cmd) controller.release(cmd);
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}
