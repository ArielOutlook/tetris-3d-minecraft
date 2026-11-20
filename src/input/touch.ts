import type { Command, Controller } from './controller';

/** On-screen buttons: elements with data-cmd="left|right|…" inside `root` (REQ-E5). */
export function bindTouch(root: HTMLElement, controller: Controller, onFirstTouch: () => void): void {
  root.querySelectorAll<HTMLElement>('[data-cmd]').forEach((btn) => {
    const cmd = btn.dataset.cmd as Command;
    const release = () => {
      btn.classList.remove('is-down');
      controller.release(cmd);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onFirstTouch();
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('is-down');
      controller.press(cmd);
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}
