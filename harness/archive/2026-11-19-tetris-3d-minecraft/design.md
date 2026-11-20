# Diseño técnico — Bloquecaída 3D

## 1. Stack

| Capa | Elección | Motivo |
|---|---|---|
| Build/dev | Vite 6+ (puerto **5190**) | Estándar de los proyectos hermanos; HMR; salida estática. |
| Lenguaje | TypeScript estricto (`strict`, `noUncheckedIndexedAccess`) | Dominio con muchas matrices/índices. |
| Render | Three.js (vanilla, sin React) + `OrbitControls` de `three/addons` | Pedido del brief; un solo canvas no justifica framework. |
| UI/HUD | HTML + CSS sobre el canvas (DOM mínimo, sin framework) | Texto nítido y accesible; fácil de probar. |
| Pruebas | Vitest (dominio + lógica de input) y Playwright (humo E2E) | Igual que `ajedrez-3d` / `tetris`. |
| Calidad | ESLint 9 (flat) + Prettier | Convención del workspace. |

Sin backend. Despliegue = carpeta `dist/`.

## 2. Estructura de carpetas

```
tetris-3d-minecraft/
├─ index.html
├─ package.json            # scripts: dev, build, preview, test, test:coverage, test:e2e, lint, typecheck
├─ vite.config.ts          # server.port 5190, strictPort
├─ tsconfig.json
├─ eslint.config.mjs
├─ playwright.config.ts
├─ src/
│  ├─ main.ts              # bootstrap: detecta WebGL2, crea Game + Renderer + Input + HUD
│  ├─ config.ts            # GAME_TITLE, dimensiones, tiempos DAS/ARR/lock, tabla de gravedad
│  ├─ core/                # dominio puro (sin DOM, sin three)
│  │  ├─ types.ts          # Vec3, Cell, PieceKind, Rotation, GameState, GameEvent
│  │  ├─ rng.ts            # PRNG con semilla (mulberry32)
│  │  ├─ bag.ts            # generador bolsa de 7
│  │  ├─ pieces.ts         # formas y estados de rotación
│  │  ├─ kicks.ts          # tablas de wall kicks (general e I)
│  │  ├─ board.ts          # rejilla, colisión, fijar, limpiar filas
│  │  ├─ scoring.ts        # puntos, niveles, curva de gravedad
│  │  └─ game.ts           # máquina de estados + step(dt, inputs) → eventos
│  ├─ input/
│  │  ├─ keyboard.ts       # mapea teclas → acciones; ignora e.repeat
│  │  ├─ autorepeat.ts     # DAS/ARR puro (testeable)
│  │  └─ touch.ts          # botones en pantalla
│  ├─ render/
│  │  ├─ scene.ts          # renderer, cámara, luces, resize, calidad
│  │  ├─ textures.ts       # generación procedural 16×16 → CanvasTexture (NearestFilter)
│  │  ├─ blocks.ts         # InstancedMesh por material; sync con el board
│  │  ├─ well.ts           # marco, rejilla de fondo, entorno decorativo
│  │  ├─ ghost.ts          # pieza fantasma
│  │  ├─ effects.ts        # destello de filas, partículas, shake
│  │  └─ preview.ts        # mini-escenas para siguiente/guardada (o render a texturas)
│  ├─ audio/sfx.ts         # WebAudio sintetizado + mute persistente
│  ├─ ui/hud.ts            # puntuación, nivel, líneas, menús, game over, pausa
│  ├─ storage/highscores.ts# localStorage con try/catch
│  └─ styles.css
├─ tests/                  # Vitest (espejo de src/core e input)
└─ e2e/                    # Playwright
```

## 3. Modelo de dominio (`src/core`)

```ts
type Vec3 = { x: number; y: number; z: number };      // z = 0 en modo clásico
type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
type Rotation = 0 | 1 | 2 | 3;
type Cell = PieceKind | null;

interface ActivePiece { kind: PieceKind; rot: Rotation; pos: Vec3 }

interface GameState {
  status: 'menu' | 'playing' | 'paused' | 'gameover';
  board: Cell[][];            // [row][col], row 0 = abajo, alto 22 (20 + 2 ocultas)
  active: ActivePiece | null;
  hold: PieceKind | null;
  holdUsed: boolean;
  queue: PieceKind[];         // ≥ 3 visibles
  score: number; level: number; lines: number;
  gravityAcc: number;         // ms acumulados
  lockTimer: number | null; lockResets: number;
}

type Action = 'left' | 'right' | 'softDrop' | 'hardDrop' | 'rotCW' | 'rotCCW' | 'hold' | 'pause';

type GameEvent =
  | { type: 'moved' } | { type: 'rotated'; kicked: boolean }
  | { type: 'locked'; cells: Vec3[] }
  | { type: 'linesCleared'; rows: number[]; count: 1 | 2 | 3 | 4 }
  | { type: 'levelUp'; level: number }
  | { type: 'spawned'; kind: PieceKind }
  | { type: 'gameOver'; score: number };
```

- `Game.step(dtMs, actions): GameEvent[]` es **la única** puerta de mutación. Se llama desde un acumulador con paso fijo de **1000/120 ms**.
- El dominio no conoce tiempo real: recibe `dt`. Esto hace las pruebas deterministas (REQ-S1).
- Coordenadas con `Vec3` y `z` para que el modo pozo 3D futuro (opción B) agregue profundidad sin cambiar contratos de render.

## 4. Loop principal

```
rAF(now):
  frameDt = min(now - last, 250)        // evita espiral tras pestaña inactiva
  acc += frameDt
  actions = input.poll(frameDt)          // DAS/ARR producen acciones discretas
  while acc >= STEP: events.push(...game.step(STEP, actions)); actions = []; acc -= STEP
  renderer.sync(game.state, events)      // instancias + efectos
  hud.update(game.state, events); sfx.play(events)
  renderer.render()
```

`visibilitychange`/`blur` → `game.pause()` (REQ-E1).

## 5. Render

- **Instancing:** un `InstancedMesh` de `BoxGeometry(1,1,1)` por material (7 piezas + marco). Capacidad = 10×22 por material. En cada `locked`/`linesCleared` se reconstruyen matrices (barato: ≤ 220 instancias). La pieza activa y la fantasma son grupos pequeños aparte que se actualizan por frame.
- **Texturas procedurales** (`textures.ts`): función `makeTexture(palette, pattern, seed)` dibuja 16×16 en `OffscreenCanvas`/`canvas` con ruido por píxel, borde biselado (1 px claro arriba-izquierda, 1 px oscuro abajo-derecha) y patrón por material:
  | Pieza | Material (original) | Patrón |
  |---|---|---|
  | I | Hielo cian | vetas diagonales |
  | O | Oro | lingote con brillo |
  | T | Amatista | facetas |
  | S | Pasto | franja verde sobre tierra |
  | Z | Ladrillo rojo | hiladas |
  | J | Lapislázuli | moteado |
  | L | Madera | anillos/tablones |
  | Marco | Piedra gris | ruido + grietas |
  `magFilter = minFilter = NearestFilter`, `generateMipmaps = false`, `colorSpace = SRGBColorSpace`.
- **Luces:** `HemisphereLight` + `DirectionalLight` con `castShadow` (mapa 1024 en Alto, sin sombras en Bajo).
- **Cámara:** `PerspectiveCamera` fov 35°, posición calculada para encuadrar 20 filas + margen según aspect (REQ-C1). `OrbitControls` con `minPolarAngle/maxPolarAngle`, `min/maxAzimuthAngle` ±45°, `enablePan=false`. `C` → `resetCamera()` con interpolación 300 ms.
- **Fantasma:** mismo material, `transparent`, `opacity 0.3`, `depthWrite=false`.
- **Efectos:** filas limpiadas → destello blanco 120 ms + 4–6 partículas cúbicas por celda con gravedad, pool reutilizable; 4 líneas → shake de 200 ms (opcional, respetando `prefers-reduced-motion`).
- **Previews:** siguiente/guardada se dibujan con el mismo renderer usando `setScissor`/`setViewport` en rectángulos laterales (no un segundo `WebGLRenderer`), para no abrir varios contextos WebGL.
- **Calidad:** `pixelRatio = min(devicePixelRatio, 2)` en Alto, `1` en Bajo; preset en `localStorage`.
- **WebGL2 ausente:** `main.ts` verifica `canvas.getContext('webgl2')` antes de crear el renderer y muestra aviso (REQ-E4). `webglcontextlost` → pausa y mensaje.

## 6. Input

- `keyboard.ts` mantiene un set de teclas presionadas (por `code`, no `key`, para layouts no-US) e ignora `event.repeat`. `preventDefault` en flechas/espacio para no desplazar la página.
- `autorepeat.ts` (puro): `update(dt, held)` → acciones; DAS 170 ms, ARR 50 ms; caída suave a 20× gravedad.
- `touch.ts`: botones en pantalla con `pointerdown/up`, visible solo si `matchMedia('(pointer: coarse)')`.

## 7. HUD y pantallas

DOM superpuesto (`position: absolute`), fuente del sistema con estilo pixel vía CSS (sin fuentes de terceros salvo una CC0/OFL si se agrega). Paneles: puntuación/nivel/líneas, récords, controles. Pantallas: menú (Jugar, Récords, Calidad, Sonido), pausa, game over. Todo el texto en español de México; título desde `config.GAME_TITLE`.

## 8. Persistencia

`highscores.ts`: clave `bloquecaida3d:highscores` → `[{ score, level, lines, date }]` top 5; `bloquecaida3d:settings` → `{ muted, quality }`. Todo envuelto en `try/catch` (REQ-S6).

## 9. Audio

`sfx.ts` con `AudioContext` creado en la primera interacción; cada evento → oscilador corto (square/triangle) con envolvente. Sin archivos de audio (REQ-A1, IP).

## 10. Pruebas

| Nivel | Qué | Herramienta |
|---|---|---|
| Unidad | bolsa de 7, rotaciones, kicks, colisión, limpiar 1–4 filas, puntuación, niveles, lock delay y reinicios, hold, game over, determinismo con dt distintos | Vitest |
| Unidad | DAS/ARR | Vitest |
| Unidad | highscores con `localStorage` falso y lanzando error | Vitest (jsdom) |
| E2E humo | carga sin errores de consola, canvas presente, `Espacio` deja caer, pausa con `Esc`, game over al llenar el pozo (vía hook de prueba `window.__game` solo en modo test) | Playwright |
| Manual | FPS ≥ 60 con pozo lleno (overlay de FPS opcional `?fps=1`) | navegador |

Cobertura de `src/core` ≥ 90 % (REQ-Q2).

## 11. Decisiones descartadas

- **React/R3F:** sobra para un canvas único y agrega peso.
- **Física (cannon/rapier):** innecesaria; las partículas usan integración simple.
- **Texturas PNG dibujadas a mano:** posibles en el futuro, pero procedurales eliminan riesgo de IP y archivos binarios.
- **Pozo 3D real en MVP:** ver `research.md` §4.

## 12. Notas de implementación (desviaciones respecto a este diseño)

| Tema | Diseño original | Implementado | Motivo |
|---|---|---|---|
| Vistas previas siguiente/guardada | `setScissor` en el mismo renderer | Canvas 2D con las mismas texturas procedurales (`render/preview.ts`) | REQ-S5 permite panel 2D; evita acoplar rectángulos DOM con viewports GL y sigue usando un solo contexto WebGL. |
| Material de la pieza S | "Pasto: franja verde sobre tierra" | "Musgo": moteado verde en todas las caras | La combinación pasto-sobre-tierra es la imagen icónica de un juego concreto; se evita para mantener la estética original. |
| Render de bloques | Reconstruir matrices solo en `locked`/`linesCleared` | Se reconstruyen cada frame (tablero + pieza activa en los mismos `InstancedMesh`) | ≤ 224 instancias: costo despreciable y código más simple; 60 FPS medidos con el pozo lleno. |
| Fin de partida | Solo colisión al aparecer (REQ-G4) | Además *lock out*: si una pieza se fija entera sobre las 20 filas visibles | Evita seguir jugando con bloques invisibles en las filas ocultas. |
| Paso fijo | Acumulador en el loop de `main.ts` | `core/stepper.ts` (`FixedStepper`), usado por `main.ts` | Permite probar REQ-S1 (30 vs 144 FPS) en Vitest. |
| Eventos | Lista mínima | Se agregan `held`, `hardDropped`, `paused`, `resumed`, `started`; `linesCleared` incluye `kinds` | Sonidos y partículas del color correcto. |
| Foco en pausa / fin de partida | — | Se enfoca el título del diálogo, no un botón; además 600 ms de guarda tras perder | Evita reiniciar sin querer al seguir presionando `Espacio`. |
| Mensaje de récord | "si es récord" | "¡Nuevo récord!" si es el 1.º; "¡Entraste a los mejores! Lugar N" si entra al top 5 | Mensaje preciso. |
| Pantallas verticales | — | Con aspecto < 0.9 la cámara deja margen arriba (HUD) y abajo (botones táctiles); paneles compactos | Legibilidad en móvil. |
| Vitest | pool por defecto (`forks`) | `pool: 'threads'` | El pool `forks` falla cuando se hereda `WATCH_REPORT_DEPENDENCIES` de un `node --watch` padre (caso de la fábrica). |
| Playwright | última versión | fijado en `1.64.1` | Reutiliza los navegadores ya instalados en la máquina (revisión 1248). |
| Puertos | dev 5190 | dev 5190, preview 5191 | `strictPort` en ambos. |
