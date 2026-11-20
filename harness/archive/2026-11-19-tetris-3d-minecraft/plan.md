# Plan de implementación — tetris-3d-minecraft

## Objetivo y alcance

Construir un **juego web original del género "bloques que caen" en 3D**, con estética voxel tipo bloques (texturas pixel-art propias generadas por código), usando **Three.js**, a partir de `docs/intake-brief.md`. Título visible de trabajo: **"Bloquecaída 3D"** (sin usar las marcas "Tetris" ni "Minecraft"; ver `research.md` §3).

MVP: pozo 10 × 20 renderizado en 3D, 7 piezas con bolsa de 7, rotación con *wall kicks*, hold, pieza fantasma, caída suave/instantánea, lock delay, niveles, puntuación, récords locales, pausa, efectos visuales y de sonido sintetizados. Solo frontend, salida estática.

Documentos: supuestos y riesgos en `research.md`, requisitos verificables en `spec.md`, arquitectura y contratos en `design.md`, lista de tareas en `tasks.md`.

## Decisiones de base

- Proyecto único (sin monorepo): Vite + TypeScript estricto + Three.js vanilla; puerto **5190**.
- Dominio puro en `src/core` (sin DOM ni three), probado con Vitest; render, input, HUD y audio como adaptadores.
- Loop con paso fijo (1000/120 ms) desacoplado de `requestAnimationFrame`.
- `InstancedMesh` por material + texturas `CanvasTexture` 16×16 con `NearestFilter`.
- Playwright para humo E2E; ESLint + Prettier.
- Sin backend; récords y ajustes en `localStorage`.

## Paso 0: confirmar supuestos (bloqueante ligero)

1. Confirmar con el usuario las preguntas de `research.md` §8 (3D visual vs pozo 3D real, nombre, móvil).
2. Si no hay respuesta, seguir con S1–S7. Proponer en `BACKLOG.md` (sin marcar nada) el pendiente "Modo pozo 3D real" como iniciativa futura.

## Paso 1: scaffolding

1. `package.json` con scripts `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:coverage`, `test:e2e`; dependencias `three`, `@types/three`, `vite`, `typescript`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@playwright/test`, `eslint`, `typescript-eslint`, `prettier`.
2. `vite.config.ts` (puerto 5190, `strictPort`), `tsconfig.json` estricto, `eslint.config.mjs`, `index.html` con `lang="es-MX"`.
3. `src/main.ts` con detección de WebGL2 y escena vacía.
4. Verificar: `npm run dev` muestra un canvas con fondo y `npm run build` genera `dist/`.

**Entregable:** base que arranca con un comando.

## Paso 2: dominio de juego (`src/core`)

1. `rng.ts` + `bag.ts` (REQ-G3).
2. `pieces.ts` + `kicks.ts` (REQ-G2, REQ-M2).
3. `board.ts`: colisión, fijar, limpiar filas (REQ-G1, REQ-S2).
4. `scoring.ts`: puntos, niveles, curva de gravedad (REQ-S3, REQ-S4).
5. `game.ts`: máquina de estados, `step(dt, actions)`, hold, lock delay con reinicios, aparecimiento y game over (REQ-G4, REQ-M1–M6, REQ-E1).
6. Pruebas unitarias de cada módulo; cobertura ≥ 90 % (REQ-Q2), incluida la prueba de determinismo con distintos FPS (REQ-S1).

**Entregable:** juego completo jugable "en consola" vía pruebas.

## Paso 3: input

1. `autorepeat.ts` puro con pruebas DAS/ARR (REQ-M5).
2. `keyboard.ts` con mapa de REQ-E2, `code` en vez de `key`, `preventDefault`, ignorar `repeat`.
3. Pausa automática en `blur`/`visibilitychange`.

## Paso 4: render voxel

1. `textures.ts`: 8 materiales procedurales originales (REQ-V1, REQ-V2).
2. `scene.ts`: renderer sRGB, cámara encuadrada por aspect, luces, sombras, resize, presets Alto/Bajo (REQ-C1, REQ-V6).
3. `well.ts`: marco, rejilla, entorno decorativo (REQ-V4).
4. `blocks.ts` + pieza activa + `ghost.ts` (REQ-V3).
5. `OrbitControls` acotado + `C` para restablecer (REQ-C2, REQ-C3).
6. Previews de siguiente/guardada con `setScissor` (REQ-S5).

**Entregable:** partida completa jugable en el navegador.

## Paso 5: HUD, pantallas, persistencia y audio

1. `hud.ts`: paneles y pantallas menú/pausa/game over en español (REQ-S5, REQ-E1, REQ-E3, REQ-Q4).
2. `highscores.ts` y ajustes persistentes (REQ-S6).
3. `sfx.ts` con mute `M` persistente (REQ-A1).
4. Mensajes de error WebGL2 / contexto perdido (REQ-E4).

## Paso 6: pulido

1. `effects.ts`: destello, partículas, shake con `prefers-reduced-motion` (REQ-V5).
2. Controles táctiles básicos (REQ-E5).
3. Overlay de FPS `?fps=1`; medir pozo lleno a 1080p (REQ-Q1).
4. Revisión de IP: buscar "Tetris"/"Minecraft" en `src/`, `index.html`, `dist/` (REQ-Q5).

## Paso 7: verificación y documentación

1. `npm run typecheck && npm run lint && npm run test:coverage && npm run build && npm run test:e2e` en verde.
2. `README.md` con cómo jugar, controles, scripts y créditos (todo original).
3. Actualizar `BACKLOG.md` solo con pendientes nuevos detectados (sin marcar la iniciativa; lo hace la fábrica tras PASS).

## Criterios de aceptación

- Todos los REQ con DEBE de `spec.md` cumplidos y verificados por prueba automática o checklist manual documentado.
- Partida completa de menú → juego → game over → récord → jugar de nuevo sin errores de consola.
- Ningún asset ni texto de terceros.

## Riesgos principales

Ver `research.md` §7: rendimiento de sombras, lectura del pozo en perspectiva, input fino, IP y ambigüedad de "3D".
