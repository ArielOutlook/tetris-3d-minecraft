import { expect, test, type Page } from '@playwright/test';

interface DebugWindow {
  __game: {
    state: {
      status: string;
      score: number;
      gravityAcc: number;
      hold: string | null;
      active: { kind: string; rot: number; pos: { x: number; y: number } } | null;
    };
  };
  __blocks: () => number;
}

const status = (page: Page) => page.evaluate(() => (window as unknown as DebugWindow).__game.state.status);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function startGame(page: Page, query = '') {
  await page.goto(`/?test=1&seed=7${query}`);
  await expect(page.getByTestId('play')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => status(page)).toBe('playing');
}

test('carga sin errores, con canvas y título original', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?test=1');
  await expect(page).toHaveTitle('Bloquecaída 3D');
  await expect(page.locator('#scene')).toBeVisible();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  // Visible text + metadata (the dev server injects file paths that contain the repo name).
  const text = (
    await page.evaluate(() =>
      [
        document.title,
        document.body.innerText,
        ...[...document.querySelectorAll('meta, [aria-label], [title]')].map((el) =>
          ['content', 'aria-label', 'title'].map((a) => el.getAttribute(a) ?? '').join(' '),
        ),
      ].join(' '),
    )
  ).toLowerCase();
  expect(text).not.toContain('tetris');
  expect(text).not.toContain('minecraft');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('Espacio deja caer la pieza y suma puntos', async ({ page }) => {
  const errors = collectErrors(page);
  await startGame(page);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => (window as unknown as DebugWindow).__blocks())).toBe(8);
  await expect(page.getByTestId('score')).not.toHaveText('0');
  expect(errors).toEqual([]);
});

test('mantener → lleva la pieza hasta la pared derecha (DAS/ARR)', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  const posX = () => page.evaluate(() => (window as unknown as DebugWindow).__game.state.active!.pos.x);
  const atHold = await posX();
  // Already against the wall: one more tap must not move it.
  await page.keyboard.press('ArrowRight');
  expect(await posX()).toBe(atHold);
  expect(atHold).toBeGreaterThanOrEqual(6);
});

test('Esc pausa y reanuda', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toBeVisible();
  expect(await status(page)).toBe('paused');
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toBeHidden();
  expect(await status(page)).toBe('playing');
});

test('llenar el pozo termina la partida, guarda récord y permite jugar de nuevo', async ({ page }) => {
  await startGame(page);
  for (let i = 0; i < 80 && (await status(page)) === 'playing'; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(25);
  }
  await expect(page.locator('#gameover')).toBeVisible();
  const final = await page.getByTestId('final-score').textContent();
  // Mashing Space after losing must not restart the game.
  for (let i = 0; i < 10; i++) await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await expect(page.locator('#gameover')).toBeVisible();
  await expect(page.locator('#go-record')).toHaveText('¡Nuevo récord!');

  await page.getByTestId('play-again').click();
  await expect.poll(() => status(page)).toBe('playing');

  // Highscore persists across reloads.
  await page.reload();
  await expect(page.locator('#highscores li').first()).toContainText(final!.trim());
});

test('controles táctiles en pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 860 });
  await startGame(page, '&touch=1');
  await expect(page.locator('#touch')).toBeVisible();
  await page.locator('[data-cmd="hardDrop"]').dispatchEvent('pointerdown', { pointerId: 1 });
  await page.locator('[data-cmd="hardDrop"]').dispatchEvent('pointerup', { pointerId: 1 });
  await expect.poll(() => page.evaluate(() => (window as unknown as DebugWindow).__blocks())).toBe(8);
});

test('↓ a mitad del ciclo de gravedad no teletransporta la pieza (REQ-M1)', async ({ page }) => {
  await startGame(page);
  const probe = () =>
    page.evaluate(() => {
      const s = (window as unknown as DebugWindow).__game.state;
      return { acc: s.gravityAcc, y: s.active!.pos.y };
    });
  // Wait until most of the 1 s level-1 gravity cycle is banked.
  let before = await probe();
  for (let i = 0; i < 200 && !(before.acc >= 750 && before.acc <= 950); i++) {
    await page.waitForTimeout(10);
    before = await probe();
  }
  expect(before.acc).toBeGreaterThanOrEqual(750);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(40); // let a few frames apply the held key
  const dropped = before.y - (await probe()).y;
  await page.keyboard.up('ArrowDown');
  // Before the fix the banked time was spent at soft-drop speed (~15+ rows at once).
  expect(dropped).toBeLessThanOrEqual(3);
});

test('con el contexto WebGL perdido no se puede reanudar', async ({ page }) => {
  await startGame(page);
  const fire = (type: string) =>
    page.evaluate((t) => {
      document.getElementById('scene')!.dispatchEvent(new Event(t, { cancelable: true }));
    }, type);
  await fire('webglcontextlost');
  await expect(page.locator('#error')).toBeVisible();
  expect(await status(page)).toBe('paused');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  expect(await status(page)).toBe('paused');
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('#btn-resume')?.click());
  expect(await status(page)).toBe('paused');

  await fire('webglcontextrestored');
  await expect(page.locator('#error')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect.poll(() => status(page)).toBe('playing');
});
