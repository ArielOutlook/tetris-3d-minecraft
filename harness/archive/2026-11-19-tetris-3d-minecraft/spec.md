# Especificación — Bloquecaída 3D (MVP)

Requisitos verificables derivados de `docs/intake-brief.md` y de los supuestos de `research.md` §4–§5. Formato: requisito (DEBE/DEBERÍA) + escenarios *Dado / Cuando / Entonces*.

## 1. Pozo y piezas

**REQ-G1** El pozo DEBE medir 10 columnas × 20 filas visibles, más 2 filas ocultas arriba para el aparecimiento de piezas.

**REQ-G2** DEBEN existir las 7 piezas de 4 celdas del género (formas I, O, T, S, Z, J, L), cada una con un material de bloque propio y distinguible.

**REQ-G3** El orden de piezas DEBE generarse con "bolsa de 7": cada tanda de 7 contiene una de cada forma en orden aleatorio. El generador DEBE aceptar semilla.

- *Escenario:* Dado un generador con semilla fija, cuando se piden 14 piezas, entonces cada bloque de 7 consecutivas contiene las 7 formas exactamente una vez, y dos generadores con la misma semilla producen la misma secuencia.

**REQ-G4** La pieza DEBE aparecer centrada horizontalmente en las filas ocultas. Si al aparecer colisiona con bloques fijos, la partida DEBE terminar (*game over*).

## 2. Movimiento y rotación

**REQ-M1** La pieza activa DEBE poder moverse a izquierda/derecha y bajar (caída suave), sin atravesar paredes, suelo ni bloques fijos.

**REQ-M2** La pieza DEBE poder rotar en sentido horario y antihorario. Si la rotación colisiona, DEBEN probarse desplazamientos de la tabla de *wall kicks*; si ninguno es válido, la rotación se descarta sin cambiar el estado.

- *Escenario:* Dado una pieza T pegada a la pared izquierda, cuando rota hacia la pared, entonces queda rotada y desplazada dentro del pozo, o no rota; nunca queda fuera de los límites.

**REQ-M3** La caída instantánea (*hard drop*) DEBE llevar la pieza a su posición más baja válida y fijarla de inmediato.

**REQ-M4** DEBE existir "guardar pieza" (*hold*): intercambia la pieza activa con la guardada (o con la siguiente si no hay); solo una vez por pieza hasta que se fije.

**REQ-M5** El movimiento lateral sostenido DEBE usar autorepetición propia: retardo inicial (DAS ≈ 170 ms) y tasa (ARR ≈ 50 ms), independiente de la autorepetición del sistema operativo.

**REQ-M6** Al tocar el suelo, la pieza DEBE fijarse tras un *lock delay* de 500 ms; mover o rotar con éxito reinicia el retardo hasta un máximo de 15 reinicios.

## 3. Gravedad, líneas, puntuación y niveles

**REQ-S1** La gravedad DEBE ejecutarse en un paso fijo independiente de los FPS del render.

- *Escenario:* Dado nivel 1, cuando la simulación avanza 10 s con 30 FPS o con 144 FPS, entonces la pieza bajó el mismo número de filas.

**REQ-S2** Al fijar una pieza, toda fila completa DEBE eliminarse y las filas superiores bajar.

**REQ-S3** Puntuación: 1/2/3/4 líneas = 100/300/500/800 × nivel; caída suave +1 por celda; caída instantánea +2 por celda.

**REQ-S4** El nivel DEBE subir cada 10 líneas y reducir el intervalo de gravedad según una curva definida en una tabla (nivel 1 ≈ 1000 ms/fila, mínimo ≈ 50 ms/fila).

**REQ-S5** El HUD DEBE mostrar puntuación, nivel, líneas, siguiente(s) 3 piezas y pieza guardada, en voxel 3D o en panel 2D.

**REQ-S6** El récord (top 5 puntuaciones con fecha) DEBE persistir en `localStorage`; si `localStorage` no está disponible, el juego sigue funcionando sin récords.

## 4. Escena 3D estilo bloques

**REQ-V1** Cada celda ocupada DEBE renderizarse como un cubo con textura pixel-art 16 × 16 con filtrado *nearest* (píxeles nítidos).

**REQ-V2** Las texturas DEBEN ser originales y generadas por código (sin imágenes de terceros). DEBE haber al menos 7 materiales de pieza + 1 material de marco del pozo.

**REQ-V3** DEBE mostrarse una pieza fantasma (posición de caída) semitransparente.

**REQ-V4** El pozo DEBE tener marco de bloques, fondo con rejilla tenue y un entorno decorativo (suelo de bloques, cielo con gradiente/nubes cúbicas) que no estorbe la lectura.

**REQ-V5** Al limpiar líneas DEBE haber una animación corta (≤ 300 ms) de destello/partículas de bloque; la lógica no espera a la animación para seguir siendo determinista.

**REQ-V6** DEBERÍA haber iluminación direccional con sombras suaves, desactivables en el preset de calidad Bajo.

## 5. Cámara

**REQ-C1** La cámara por defecto DEBE ver el pozo de frente con leve inclinación, encuadrando las 20 filas completas en relación 16:9 y 4:3.

**REQ-C2** El usuario DEBERÍA poder orbitar/zoom con ratón dentro de límites; la tecla `C` DEBE restablecer la vista por defecto.

**REQ-C3** La cámara NO DEBE moverse por sí sola durante la partida salvo un leve *shake* opcional al limpiar 4 líneas.

## 6. Estados de juego y controles

**REQ-E1** Estados: `menu`, `playing`, `paused`, `gameover`. `Esc`/`P` alterna pausa; al perder el foco de la ventana el juego DEBE pausarse.

**REQ-E2** Controles por defecto: `←`/`→` mover, `↓` caída suave, `Espacio` caída instantánea, `↑`/`X` rotar horario, `Z`/`Ctrl` rotar antihorario, `Shift`/`A` guardar, `C` restablecer cámara, `M` silencio, `Esc`/`P` pausa.

- *Escenario:* Dado una partida en curso, cuando el usuario mantiene `→` 1 s, entonces la pieza se desplaza hasta la pared derecha con DAS/ARR propios y no según la autorepetición del sistema.

**REQ-E3** Pantalla de *game over* con puntuación, nivel, líneas, si es récord, y botón "Jugar de nuevo".

**REQ-E4** Si WebGL2 no está disponible, DEBE mostrarse un mensaje claro en español en lugar de una pantalla en blanco.

**REQ-E5** DEBERÍA haber controles táctiles básicos (botones en pantalla) en dispositivos sin teclado.

## 7. Audio

**REQ-A1** DEBERÍA haber efectos de sonido sintetizados (mover, rotar, fijar, línea, 4 líneas, game over) con botón de silencio persistente. El audio inicia solo tras una interacción del usuario.

## 8. Calidad y no funcionales

**REQ-Q1** DEBE mantener ≥ 60 FPS en una laptop reciente con preset Alto a 1080p (pozo lleno).

**REQ-Q2** El dominio de juego DEBE ser TypeScript puro sin dependencias de Three.js ni DOM, con cobertura de pruebas ≥ 90 % de líneas.

**REQ-Q3** `npm run build` DEBE producir un sitio estático en `dist/` desplegable sin servidor.

**REQ-Q4** UI en español de México con tuteo; contraste de texto del HUD ≥ 4.5:1.

**REQ-Q5** No DEBEN aparecer las palabras "Tetris" ni "Minecraft" en la UI, metadatos ni assets publicados.

## 9. Fuera de alcance (MVP)

Pozo 3D real (opción B), multijugador, cuentas/servidor, música, modos alternos (sprint, maratón con meta), personalización de controles, *T-spins* con bonificación.
