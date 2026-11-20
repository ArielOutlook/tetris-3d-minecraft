# Revisión — tetris-3d-minecraft (Bloquecaída 3D) · 2.ª ronda

**Verdict: PASS.** Se corrigió el bloqueante de la ronda anterior (la caída suave teletransportaba la pieza; §2.1 de la 1.ª revisión). Comprobé que la prueba de regresión **falla sin la corrección y pasa con ella**. También quedaron resueltos los hallazgos menores §2.2–§2.4. Pasan typecheck, lint, formato, 70/70 pruebas unitarias (100 % de líneas en el dominio), build y 8/8 E2E. Encontré un caso borde nuevo en el *lock delay* (§2.1 de este documento): con cierta forma del montón, un *kick* hacia arriba permite posponer el fijado sin límite. Rompe la letra de REQ-M6, pero es poco probable, solo beneficia al jugador, no da puntos y no afecta la estabilidad. Por eso no bloquea y queda en `BACKLOG.md`.

Fecha: 2026-11-19 · Alcance: `src/`, `tests/`, `e2e/`, `index.html`, `README.md` y configuración, contra `harness/tetris-3d-minecraft/spec.md`. Hice una relectura completa, no solo de lo que cambió.

## 1. Verificación ejecutada (independiente)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm run format:check` | OK |
| `npm run test:coverage` | 70/70 OK · 100 % líneas, 96.5 % ramas (`src/core`, `autorepeat`, `storage`) |
| `npm run build` | OK → `dist/` (JS 590 KB / 150 KB gzip) |
| `npx playwright test` | 8/8 OK (6 previas + 2 de regresión) |
| Mutación: revertir la corrección en `game.ts:316` a `s.gravityAcc += dtMs` | `tests/game.test.ts` → **1 falla** (la regresión la detecta); el archivo se restauró y se verificó con `cmp` |
| `grep -rniE "tetris\|minecraft\|mojang" src index.html dist README.md` | sin coincidencias (REQ-Q5 OK) |
| `npm audit --omit=dev` | 0 vulnerabilidades en dependencias de producción |
| Simulación `vite-node` del *lock delay* (ver §2.1) | reproduce la pieza sin fijarse durante 120 s |

## 2. Hallazgos

### 2.1 [MEDIA · no bloqueante] Un *kick* hacia arriba reinicia el *lock delay* aunque ya se gastaron los 15 reinicios — `src/core/game.ts:221-232, 328-337`

`commit` respeta el tope `MAX_LOCK_RESETS`, pero `updateLock` pone `lockTimer = null` cada vez que la pieza deja de estar apoyada. Cuando una rotación con *kick* sube la pieza y la deja en el aire, la pieza vuelve a caer a una fila que **no** es más baja que `lowestY`. Así, el contador no se reinicia, pero el temporizador arranca de nuevo en 0. Repetir el truco da otros 500 ms cada vez, sin límite.

Reproducción (semilla 1, montón pseudoaleatorio en las filas 0–5; T en `rot 1`, `x 5`, apoyada en `y 3`):

```
rotCW con kick → y 5 (en el aire) → cae a y 4 (≥ lowestY 3)
política "rotar cuando lockTimer > 450 ms", con lockResets = 15:
{ locked: false, simulatedSeconds: '120.0', rotations: 120, lockResets: 15, lowestY: 3, distinctStates: 4 }
```

- **Impacto:** rompe la letra de REQ-M6 ("hasta un máximo de 15 reinicios"). Para que pase, hace falta una forma específica del montón y rotar a propósito y de forma repetida. Solo beneficia al jugador (puede "congelar" la pieza), no da puntos y no rompe el determinismo ni la estabilidad. Un jugador normal no lo nota. Por eso no bloquea el envío.
- **Por qué no lo detectan las pruebas:** `tests/game.test.ts:271` ("successful moves reset the delay up to MAX_LOCK_RESETS times") solo usa movimientos laterales en el suelo plano. Ninguna prueba combina reinicios agotados con una rotación que deje la pieza en el aire.
- **Corrección sugerida:** cuando la pieza vuelve a apoyarse sin haber llegado a una fila nueva más baja, conservar el tiempo acumulado en lugar de reiniciarlo. Otra opción, como en la convención del género: si `lockResets >= MAX_LOCK_RESETS`, fijar de inmediato al tocar. Agregar una prueba con la configuración de arriba. Queda en `BACKLOG.md`.

### 2.2 [BAJA] Cobertura de ramas sin ejercer — `src/core/game.ts:79, 236, 246, 263, 342`

Son ramas defensivas (`if (!active) return …`, semilla por defecto). No cambian el comportamiento observable y la cobertura de líneas está en 100 %. Solo lo dejo registrado.

### 2.3 Verificación de los hallazgos de la 1.ª ronda

| Hallazgo previo | Estado | Evidencia |
|---|---|---|
| §2.1 caída suave teletransporta (ALTA) | **Corregido** | `game.ts:316` acota `gravityAcc` a `interval` antes de sumar `dt`. Pruebas en `tests/game.test.ts:142` (100/500/950/990 ms acumulados → ≤ 1 fila; los puntos coinciden con las filas recorridas; luego sigue a 20×) y `:161` (al soltar `↓` no se gana una fila extra). E2E en `e2e/smoke.spec.ts:122`. Mutación: la prueba falla sin la corrección |
| §2.2 `Ctrl` expone atajos del navegador (BAJA) | **Documentado** | Se conserva por REQ-E2; nota en `README.md:25` con `Z` como alternativa. Aceptable |
| §2.3 reanudar con el contexto WebGL perdido (BAJA) | **Corregido** | `main.ts:57, 70-76, 139-151, 194, 235-237`: se bloquean `resume` (Enter, botón Continuar), `start`, Esc/P (`shouldHandle`) y las acciones táctiles (se descartan de `pending`), y no se avanzan pasos. E2E en `e2e/smoke.spec.ts:144` |
| §2.4 nits (`levelForLines`, desempate de `qualifies`) | **Corregido** | `scoring.ts:13-15` simplificado; `highscores.ts:77` documenta el desempate |

Revisé también si la corrección de la gravedad tiene efectos laterales:

- Con gravedad normal, el `Math.min` no hace nada, porque tras el bucle `gravityAcc < interval`.
- Al subir de nivel, el acumulador se acota al nuevo intervalo, más corto. Eso evita también un salto equivalente al acelerar la gravedad.
- En niveles altos (intervalo de 50 ms → 2.5 ms con caída suave), un paso de 8.3 ms baja 3 filas. Es correcto: equivale a 20×.
- La prueba de determinismo con varios `dt` sigue pasando.

## 3. Cumplimiento de la especificación

| Requisito | Estado | Nota |
|---|---|---|
| REQ-G1–G4 (pozo 10×20+2, 7 piezas, bolsa de 7 con semilla, aparecimiento y game over) | OK | Aparecen en las filas 20–21 (I, T y O revisadas a mano); *block out* y *lock out* con pruebas |
| REQ-M1 movimiento / caída suave | OK | Corregido (§2.3) |
| REQ-M2 rotación + *wall kicks* | OK | Tablas JLSTZ e I revisadas contra la convención estándar (y hacia arriba) |
| REQ-M3 caída instantánea, REQ-M4 guardar | OK | Guardar una vez por pieza; se reinicia al fijar |
| REQ-M5 DAS 170 / ARR 50 propios | OK | Ignora `e.repeat` y el *auto-repeat* (`held`); E2E de la pared derecha |
| REQ-M6 *lock delay* 500 ms, 15 reinicios | OK con desviación | Caso borde §2.1 (no bloqueante) |
| REQ-S1 paso fijo | OK | `FixedStepper` a 120 Hz con tope de 250 ms por cuadro |
| REQ-S2–S4 líneas, puntuación, niveles | OK | Los puntos de caída suave ya no se inflan |
| REQ-S5 HUD, REQ-S6 récords con *fallback* | OK | `safeStorage` con sondeo; validación con `isEntry` |
| REQ-V1–V6 texturas, fantasma, marco, efectos ≤ 300 ms, sombras | OK | Destello de 180 ms y partículas de 300 ms; posición del destello alineada con `cellToWorld` |
| REQ-C1–C3 cámara | OK | *Shake* solo con 4 líneas y si no hay `prefers-reduced-motion` |
| REQ-E1–E5 estados, controles, game over, WebGL2, táctil | OK | Pausa por `blur`/`visibilitychange`; aviso de contexto perdido ya no se puede saltar |
| REQ-A1 audio sintetizado + silencio persistente | OK | `sfx.unlock()` solo tras un gesto del usuario |
| REQ-Q1 ≥ 60 FPS | No verificado aquí | Se acepta la medición de IMPLEMENT (60 FPS a 1080p, 175 bloques) |
| REQ-Q2–Q5 dominio puro + cobertura, build estático, es-MX, sin marcas | OK | El contraste ≥ 4.5:1 no se midió con herramienta |

## 4. Seguridad

No encontré riesgos relevantes:

- No hay `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval` ni `new Function`. El HUD usa `textContent` y `replaceChildren`.
- Lo que se lee de `localStorage` pasa por `JSON.parse` dentro de `try/catch`, se valida con tipos (`isEntry`, `loadSettings`) y se recorta a 5 entradas. Una fecha inválida no rompe nada (el `RangeError` de `Intl` se atrapa).
- `?seed` se normaliza con `>>> 0`. `?test` solo expone `window.__game` y `__blocks` en un sitio estático sin servidor ni datos de otros usuarios.
- Producción: 0 vulnerabilidades (`npm audit --omit=dev`). Las alertas de desarrollo de Vitest ya están en `BACKLOG.md`.

## 5. Casos borde revisados sin hallazgos

- `↓` presionada con el acumulador en 100/500/950/990 ms · soltar `↓` a mitad de ciclo · subir de nivel con tiempo acumulado.
- Contexto WebGL perdido en `menu`, `playing`, `paused` y `gameover` (no se puede iniciar ni reanudar; Menú sí funciona) · acciones táctiles encoladas mientras el contexto está perdido (se descartan).
- Enter sobre el botón Jugar enfocado (el `preventDefault` evita un doble inicio) · Espacio sostenido en game over (guardia de 600 ms y el foco está en el título).
- Guardar cuando el aparecimiento choca (game over) · caída instantánea que fija y hace aparecer la siguiente pieza en el mismo paso.
- Acciones pendientes con 0 pasos por cuadro (a 144 Hz) · teclas atoradas tras `blur` (`releaseAll`).
- Índices de partículas por fila limpiada (`kinds[ri * width + x]`, siempre filas completas) · tope de 480 partículas.

## 6. Recomendaciones posteriores (no bloquean)

1. Corregir §2.1 (*lock delay* infinito por *kick* hacia arriba) con su prueba. Queda en `BACKLOG.md` como 5/10.
2. Medir el contraste del HUD con una herramienta (axe o Lighthouse) para cerrar REQ-Q4 con evidencia.

## Verdict

Verdict: PASS

El bloqueante de la 1.ª ronda (caída suave, REQ-M1) está corregido y protegido por pruebas unitarias y E2E que, como comprobé, fallan sin la corrección. También se atendieron los hallazgos menores. Todas las verificaciones pasan de forma independiente. El único hallazgo nuevo (§2.1, *lock delay* sin límite con un *kick* hacia arriba) es un caso borde poco probable, que favorece al jugador y no afecta la estabilidad ni la puntuación. Queda en `BACKLOG.md` para una iteración posterior. Se puede publicar.
