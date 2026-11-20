# BACKLOG

> Pendientes y mejoras futuras. Formato: `- [ ] Título — P/10` (prioridad 1–10)
> con una explicación en lenguaje claro indentada (2 espacios) debajo,
> ordenado de mayor a menor prioridad (10 → 1). Nunca solo en conversación
> ni disperso en otros .md. La Agentic Software Factory lo lee y lo muestra
> en su columna Backlog.

## Iniciativas

- [x] Tetris 3d Minecraft — 8/10
  Haz el juego de Tetris pero en 3D con bloques de minecraft
  Stack: Three.js
  Origen: wizard de intake → docs/intake-brief.md

## Pendientes

- [ ] Corregir salto de la caída suave (acumulador de gravedad) — 9/10
  Bloqueante de la revisión (`harness/tetris-3d-minecraft/review.md` §2.1): al presionar `↓`, `applyGravity`
  en `src/core/game.ts` consume el `gravityAcc` acumulado con el intervalo rápido y la pieza baja hasta 19 filas
  en un paso. Acotar `gravityAcc` a `interval` y agregar una prueba de regresión.
  Estado (2026-11-19): corregido en IMPLEMENT con pruebas unitaria y E2E de regresión; espera el nuevo review.
  Re-review (2026-11-19): verificado — la prueba de regresión falla sin la corrección y pasa con ella (`review.md` 2.ª ronda §2.3).

- [ ] Detalles menores de la revisión (Ctrl + atajos del navegador, reanudar sin contexto WebGL) — 2/10
  Ver `harness/tetris-3d-minecraft/review.md` §2.2–§2.3.
  Estado (2026-11-19): §2.2 documentado en `README.md` (se conserva `Ctrl` por REQ-E2); §2.3 corregido
  (no se reanuda ni se inicia partida con el contexto perdido) con prueba E2E; espera el nuevo review.
  Re-review (2026-11-19): verificado (`review.md` 2.ª ronda §2.3).

- [ ] Confirmar alcance y nombre del juego con el usuario — 6/10
  Preguntas abiertas de `harness/tetris-3d-minecraft/research.md` §8: ¿"en 3D" es solo visual
  (implementado) o se quiere el pozo 3D real?, ¿se queda el título "Bloquecaída 3D"?, ¿hace falta
  versión móvil táctil completa o basta con escritorio?

- [ ] Lock delay sin límite con un kick hacia arriba — 5/10
  Hallazgo de la 2.ª revisión (`harness/tetris-3d-minecraft/review.md` §2.1, no bloqueante): en `src/core/game.ts`,
  `updateLock` pone `lockTimer = null` cuando la pieza queda en el aire; si una rotación con kick la sube y vuelve
  a caer a una fila que no es nueva (≥ `lowestY`), el temporizador reinicia aunque ya se gastaron los 15 reinicios
  y la pieza puede no fijarse nunca (reproducido: 120 s sin fijar). Conservar el tiempo acumulado o fijar de
  inmediato al tocar con `lockResets >= MAX_LOCK_RESETS`, con prueba de regresión.

- [ ] Modo pozo 3D real — 5/10
  Variante con pozo de p. ej. 5 × 5 × 12, piezas que se mueven en X/Z y giran en 3 ejes, y capas
  completas que se limpian. El dominio ya usa coordenadas `x, y, z` para que sea una extensión.

- [ ] Probar en dispositivos reales (Safari iOS, Android, Firefox) — 4/10
  Solo se verificó en Chromium de escritorio (Mac). Revisar controles táctiles, audio tras el primer
  toque y rendimiento en calidad Baja.

- [ ] Actualizar Vitest a una versión sin alertas de `npm audit` — 3/10
  `npm audit` reporta vulnerabilidades en `tinypool` (dependencia solo de desarrollo de Vitest 3).
  No afecta al juego publicado; actualizar cuando se pueda migrar a Vitest 4.

- [ ] Reducir el tamaño del bundle — 2/10
  El JS de producción pesa ~590 KB (150 KB gzip), casi todo Three.js. Se podría importar por
  módulos o dividir en chunks para acelerar la primera carga.

