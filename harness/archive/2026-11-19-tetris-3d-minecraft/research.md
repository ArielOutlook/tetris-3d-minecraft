# Investigación y supuestos — tetris-3d-minecraft

## 1. Fuente del pedido

`docs/intake-brief.md` (2026-11-19):

- **Objetivo:** "Haz el juego de Tetris pero en 3D con bloques de minecraft".
- **Stack:** Three.js.
- **Integraciones / restricciones:** no indicadas.
- **Tipo:** proyecto nuevo.

## 2. Estado actual del repositorio

| Elemento | Estado |
|---|---|
| Código | Ninguno. Solo `CLAUDE.md`, `BACKLOG.md`, `.gitignore`, `.claude/settings.json` (hooks de la fábrica) y `docs/intake-brief.md`. |
| Git | Un commit inicial (`chore: initial Agentic Software Factory workspace`). |
| Toolchain local | Node v23.11.0, npm 11.6.0. |
| `.gitignore` | Ya ignora `node_modules/`, `dist/`, `.env*`, `*.log`. |
| Convenciones de la fábrica | Pendientes en `BACKLOG.md` (`- [ ] Título — P/10`); cambios de producto en `openspec/changes/` (en esta fase se usa el harness nativo, documentos en `harness/tetris-3d-minecraft/`). No fijar `model` en `.claude/settings.json`. |

Proyectos hermanos en `factory-workspace/` (`ajedrez-3d`, `tetris`, `cubo-de-rubik`) usan Vite + TypeScript estricto + Vitest (+ Playwright), y separan el dominio puro de la capa de render. Se adopta el mismo patrón para no introducir convenciones nuevas.

## 3. Propiedad intelectual (restricción de diseño)

El pedido nombra dos marcas registradas. Para entregar un producto publicable y sin riesgo:

- Se construye un **juego original del género "bloques que caen"** (falling-block puzzle). Las mecánicas del género (pozo, piezas de 4 celdas, líneas que se limpian, gravedad creciente) no son protegibles; el **nombre "Tetris"**, su logotipo, música y presentación sí.
- La estética es **voxel / pixel-art de bloques**, inspirada en el estilo "mundo de cubos", con **texturas 100 % propias generadas por código** (canvas 16×16 procedural). **No** se usan texturas, nombres, sonidos, fuentes ni personajes de Minecraft.
- Título de trabajo del producto: **"Bloquecaída 3D"** (nombre del repo y del change se conservan; el nombre visible en la UI es configurable en una sola constante).
- Materiales genéricos del mundo real (tierra, piedra, madera, arena, ladrillo, hielo, oro, pasto) son válidos como inspiración de paleta; se dibujan con patrones propios.

## 4. Ambigüedad principal: ¿qué significa "en 3D"?

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A. Juego 2D en escena 3D** (recomendada para MVP) | Pozo clásico de 10 × 20, piezas de 4 celdas en un plano, renderizado como bloques voxel con profundidad, luz, sombras y cámara orbital. | Jugabilidad conocida e inmediata; controles simples; mismo motor testeable. | El "3D" es visual, no de juego. |
| B. Pozo 3D real | Pozo de p. ej. 5 × 5 × 12, piezas policubo que se mueven en X/Z y rotan en 3 ejes; se limpian capas completas. | Novedad real en 3D. | Curva de aprendizaje alta, controles complejos (6 rotaciones), cámara crítica para leer profundidad. |

**Supuesto S1:** MVP = opción A. El dominio se diseña con coordenadas 3D (`x, y, z`, con `z = 0` en modo A) para que la opción B sea una extensión, no una reescritura. La opción B queda como pendiente en `BACKLOG.md` (no se agrega en esta fase; se propone).

## 5. Otros supuestos

| Id | Supuesto | Razón |
|---|---|---|
| S1 | Jugabilidad 2D en escena 3D (ver §4). | Menor riesgo, mayor jugabilidad. |
| S2 | Solo frontend, sin backend ni cuentas. Récords en `localStorage`. | El brief no pide integraciones; Three.js es frontend. |
| S3 | Un jugador, escritorio con teclado como objetivo principal; controles táctiles básicos como DEBERÍA. | Género nacido para teclado. |
| S4 | UI en español de México (tuteo); código y comentarios en inglés. | Reglas de la fábrica. |
| S5 | Audio: efectos sintetizados con WebAudio (sin archivos de terceros); música fuera de alcance del MVP. | Evita licencias. |
| S6 | Navegadores: Chrome, Edge, Firefox y Safari recientes con WebGL2. | Three.js r16x+ requiere WebGL2. |
| S7 | Puerto de desarrollo **5190** (evita 3000/3001 Documentador, 3210/3211 fábrica, 5180/5181 ajedrez-3d). | Puertos ya ocupados en la máquina. |

## 6. Referencias técnicas

- **Three.js** (r17x actual): `WebGLRenderer`, `InstancedMesh` para muchos cubos con un solo draw call, `MeshLambertMaterial`/`MeshStandardMaterial`, `CanvasTexture` con `NearestFilter` para pixel-art nítido, `OrbitControls` (addons) para la cámara.
- **Loop de juego:** paso fijo (`fixed timestep`) desacoplado del render (`requestAnimationFrame`) para que la gravedad no dependa del FPS.
- **Generador de piezas:** "bolsa de 7" (las 7 formas barajadas por tanda) — convención del género que evita rachas injustas; RNG con semilla para pruebas deterministas.
- **Rotación:** rotación de matriz con tabla de *wall kicks* (patadas contra pared) para piezas generales y tabla aparte para la pieza recta de 4.
- **Bloqueo:** *lock delay* (~500 ms) con límite de reinicios para que el jugador pueda deslizar la pieza al tocar el suelo.

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Rendimiento con muchos cubos + sombras | FPS bajos en laptops | `InstancedMesh` por material, sombras con mapa pequeño y opcionales, preset de calidad Bajo/Alto. |
| Lectura confusa del pozo por la perspectiva | Jugabilidad | Cámara por defecto frontal casi ortogonal; pieza fantasma; rejilla del fondo; orbitar es opcional y se puede reiniciar con una tecla. |
| Input con autorepetición del SO poco fino | Control | Implementar DAS/ARR propios (retardo y tasa de autorepetición) ignorando `keydown` repetidos del navegador. |
| Riesgo de IP | Publicación | §3: nombre propio, texturas procedurales originales, sin assets de terceros. |
| Ambigüedad de "3D" | Expectativa del usuario | §4: confirmar S1; dominio preparado para modo pozo 3D. |

## 8. Preguntas abiertas para el usuario

1. ¿"En 3D" es visual (opción A) o quieres el pozo 3D real (opción B)? Si no hay respuesta, se sigue con A.
2. ¿Está bien el título de trabajo "Bloquecaída 3D" para la UI, o prefieres otro nombre original?
3. ¿Necesitas versión móvil táctil completa o basta con escritorio?
