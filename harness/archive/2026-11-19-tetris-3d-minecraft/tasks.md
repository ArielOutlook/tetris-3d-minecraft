# Tareas — tetris-3d-minecraft

Orden de ejecución; cada tarea referencia requisitos de `spec.md`.

## 0. Supuestos
- [x] 0.1 Confirmar preguntas de `research.md` §8 (o seguir con S1–S7)
- [x] 0.2 Proponer en `BACKLOG.md` "Modo pozo 3D real" como pendiente futuro

## 1. Scaffolding
- [x] 1.1 `package.json`, `vite.config.ts` (5190), `tsconfig.json`, `eslint.config.mjs`, Prettier
- [x] 1.2 `index.html` (`lang="es-MX"`), `src/main.ts`, `src/styles.css`, `src/config.ts`
- [x] 1.3 Detección de WebGL2 con mensaje en español (REQ-E4)
- [x] 1.4 Vitest + coverage + Playwright configurados

## 2. Dominio (`src/core`)
- [x] 2.1 `types.ts`, `rng.ts` (mulberry32)
- [x] 2.2 `bag.ts` + pruebas (REQ-G3)
- [x] 2.3 `pieces.ts`, `kicks.ts` + pruebas de rotación y kicks (REQ-G2, REQ-M2)
- [x] 2.4 `board.ts` + pruebas de colisión y limpieza 1–4 filas (REQ-G1, REQ-S2)
- [x] 2.5 `scoring.ts` + pruebas (REQ-S3, REQ-S4)
- [x] 2.6 `game.ts`: estados, step, gravedad paso fijo, hard/soft drop, hold, lock delay, spawn, game over (REQ-G4, REQ-M1–M6, REQ-S1, REQ-E1)
- [x] 2.7 Prueba de determinismo con distintos dt; cobertura ≥ 90 % (REQ-Q2)

## 3. Input
- [x] 3.1 `autorepeat.ts` + pruebas DAS/ARR (REQ-M5)
- [x] 3.2 `keyboard.ts` con mapa REQ-E2
- [x] 3.3 Pausa por `blur`/`visibilitychange` (REQ-E1)

## 4. Render
- [x] 4.1 `textures.ts` con 8 materiales procedurales (REQ-V1, REQ-V2)
- [x] 4.2 `scene.ts`: renderer, cámara encuadrada, luces, sombras, presets (REQ-C1, REQ-V6)
- [x] 4.3 `well.ts`: marco, rejilla, entorno (REQ-V4)
- [x] 4.4 `blocks.ts` instanciado + pieza activa
- [x] 4.5 `ghost.ts` (REQ-V3)
- [x] 4.6 `OrbitControls` acotado + `C` restablece (REQ-C2, REQ-C3)
- [x] 4.7 `preview.ts` siguiente ×3 y guardada (REQ-S5)

## 5. HUD, persistencia, audio
- [x] 5.1 `hud.ts`: paneles, menú, pausa, game over (REQ-S5, REQ-E3, REQ-Q4)
- [x] 5.2 `highscores.ts` + ajustes + pruebas con storage fallando (REQ-S6)
- [x] 5.3 `sfx.ts` sintetizado + mute `M` (REQ-A1)
- [x] 5.4 Manejo de `webglcontextlost`

## 6. Pulido
- [x] 6.1 `effects.ts`: destello, partículas, shake con `prefers-reduced-motion` (REQ-V5)
- [x] 6.2 Controles táctiles (REQ-E5)
- [x] 6.3 Overlay FPS y medición pozo lleno (REQ-Q1)
- [x] 6.4 Revisión de IP en `src/`, `index.html`, `dist/` (REQ-Q5)

## 7. Verificación
- [x] 7.1 E2E humo Playwright (carga, caída, pausa, game over)
- [x] 7.2 `typecheck`, `lint`, `test:coverage`, `build`, `test:e2e` en verde (REQ-Q3)
- [x] 7.3 `README.md` (cómo jugar, controles, scripts, créditos originales)

## Registro de verificación (fase IMPLEMENT, 2026-11-19)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK (0 errores, 0 avisos) |
| `npm run format:check` | OK |
| `npm run test:coverage` | 68 pruebas OK; cobertura 100 % líneas / 96.5 % ramas (`src/core`, `src/input/autorepeat.ts`, `src/storage`) |
| `npm run build` | OK → `dist/` (JS 590 KB, 150 KB gzip) |
| `npm run test:e2e` | 6 pruebas OK (carga sin errores, caída, DAS/ARR a la pared, pausa, fin de partida + récord persistente, táctil) |
| `vite preview` + Playwright | `dist/` carga y se juega sin errores de consola |
| FPS (REQ-Q1) | 60 FPS (tope vsync) a 1920×1080 con 175 bloques, calidad Alta y Baja, Chromium/Metal en Mac Apple Silicon |
| Revisión de IP (REQ-Q5) | `grep -rniE "tetris|minecraft" src index.html dist` → sin coincidencias |

Notas:
- 0.1: no hubo respuesta a las preguntas de `research.md` §8; se siguió con los supuestos S1–S7. Las preguntas quedan en `BACKLOG.md`.
- 6.3: el overlay de FPS se activa con `?fps=1`.

## 8. Correcciones tras el review FAIL (2026-11-19)
- [x] 8.1 §2.1 (bloqueante): `applyGravity` acota `gravityAcc` al intervalo vigente antes de sumar `dt` (`src/core/game.ts`). Al presionar `↓` a mitad de ciclo la pieza baja ≤ 1 fila y solo suma puntos por las filas recorridas
- [x] 8.2 Prueba unitaria de regresión (`tests/game.test.ts`): se acumulan 100/500/950/990 ms a gravedad normal y luego un paso con `softDrop` baja ≤ 1 fila; después sigue a 20× (10 filas en 500 ms). Otra prueba verifica que soltar `↓` regresa a la gravedad normal sin una fila extra. Se comprobó que falla sin la corrección y pasa con ella
- [x] 8.3 Prueba E2E de regresión (`e2e/smoke.spec.ts`): espera a que el acumulador esté entre 750 y 950 ms y mantiene `↓`. Sin la corrección baja 15 filas (falla); con ella, ≤ 3
- [x] 8.4 §2.3: con `webglcontextlost`, `src/main.ts` congela la simulación (no avanza pasos ni encola acciones) y bloquea reanudar (Enter, Esc/P, botón Continuar, táctil) o iniciar partida hasta `webglcontextrestored`. Tiene prueba E2E
- [x] 8.5 §2.2: se conserva `Ctrl` (lo pide REQ-E2) y se documenta en `README.md` el riesgo de los atajos del navegador, con `Z` como alternativa
- [x] 8.6 Nits §2.4: se simplifica `levelForLines` y se documenta el desempate de `qualifies` (un empate con el 5.º lugar no entra)

### Registro de verificación (corrección)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run format:check` | OK |
| `npm run test:coverage` | 70/70 OK · 100 % líneas, 96.5 % ramas |
| `npm run build` | OK → `dist/` (JS 590 KB / 150 KB gzip) |
| `npm run test:e2e` | 8/8 OK (6 previas + 2 de regresión) |
| Revisión de IP (`grep -rniE "tetris\|minecraft\|mojang" src index.html dist README.md`) | sin coincidencias |
