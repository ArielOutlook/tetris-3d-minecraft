# Bloquecaída 3D

Juego **original** de bloques que caen, en 3D y con estética voxel / pixel-art, hecho con **Three.js**.
Pozo de 10 × 20, siete piezas de 4 bloques, cada una con su propio material (hielo, oro, amatista,
musgo, ladrillo, lapislázuli y madera). Todas las texturas y sonidos se generan por código.

## Cómo jugar

Completa filas horizontales para eliminarlas. Cada 10 líneas subes de nivel y las piezas caen más rápido.
La partida termina cuando una pieza nueva ya no cabe.

| Tecla | Acción |
|---|---|
| `←` `→` | Mover (con autorepetición propia: 170 ms de retardo, 50 ms de tasa) |
| `↓` | Caída suave (+1 punto por celda) |
| `Espacio` | Caída instantánea (+2 puntos por celda) |
| `↑` / `X` | Girar a la derecha |
| `Z` / `Ctrl` | Girar a la izquierda |
| `Shift` / `A` | Guardar pieza (una vez por pieza) |
| `C` | Restablecer la cámara (arrastra con el ratón para orbitar; rueda para zoom) |
| `M` | Silencio |
| `Esc` / `P` | Pausa |
| `Enter` | Jugar / jugar de nuevo / continuar |

> **Nota sobre `Ctrl`:** mientras sostienes `Ctrl`, el navegador sigue recibiendo sus atajos (`Ctrl+W` cierra la pestaña, `Ctrl+R` recarga) y el juego no puede bloquearlos. Si prefieres no arriesgarte, gira a la izquierda con `Z`.

En pantallas táctiles aparecen botones en pantalla (también puedes forzarlos con `?touch=1`).

Puntuación: 1/2/3/4 líneas = 100/300/500/800 × nivel. Los 5 mejores puntajes se guardan en tu navegador.

## Desarrollo

Requisitos: Node 20+.

```bash
npm install
npm run dev          # http://127.0.0.1:5190
npm run build        # sitio estático en dist/ (se puede abrir desde cualquier hosting estático)
npm run preview      # sirve dist/ en http://127.0.0.1:5191
```

| Script | Qué hace |
|---|---|
| `npm run typecheck` | TypeScript estricto |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:coverage` | Pruebas con cobertura (umbral 90 % en el dominio) |
| `npm run test:e2e` | Humo E2E con Playwright (levanta el dev server) |

Parámetros de URL útiles: `?fps=1` (contador de FPS), `?seed=123` (secuencia de piezas fija),
`?test=1` (expone `window.__game` para pruebas).

## Arquitectura

```
src/
  config.ts        constantes (título, dimensiones, tiempos, curva de gravedad)
  core/            dominio puro, sin DOM ni Three.js: piezas, giros con patadas de pared,
                   bolsa de 7, tablero, puntuación, máquina de estados y paso fijo
  input/           teclado, botones táctiles y autorepetición DAS/ARR
  render/          escena, texturas procedurales 16×16, pozo y paisaje, bloques instanciados,
                   pieza fantasma, efectos y vistas previas 2D
  audio/sfx.ts     efectos sintetizados con WebAudio
  ui/hud.ts        paneles y pantallas (menú, pausa, fin de partida)
  storage/         récords y ajustes en localStorage (tolerante a fallos)
```

La simulación avanza en pasos fijos de 1000/120 ms, independiente de los FPS del render.

## Créditos

Todo el código, las texturas (generadas por código), los sonidos (sintetizados) y el diseño son originales
de este proyecto. No se usan imágenes, sonidos, fuentes ni nombres de terceros.
