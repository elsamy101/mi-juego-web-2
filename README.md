# 🌻 Jardín vs Zombis 🧟

Videojuego web de defensa de jardín inspirado en *Plants vs. Zombies*, desarrollado
como proyecto académico con apoyo de herramientas de inteligencia artificial.
Todo está hecho con **HTML, CSS y JavaScript puro** (Canvas 2D), sin frameworks,
sin servidores y sin recursos externos.

## 📖 Descripción del proyecto

El jugador administra un sustento económico sobre el que decide qué plantas colocar,
frente a oleadas progresivas de zombis que avanzan de derecha a izquierda por un
jardín de **5 carriles y 9 columnas**. Cada planta tiene un coste, una vida y una
función específica; los zombis avanzan, atacan las plantas con las que tropiezan y
si alguno cruza el borde izquierdo del jardín, la partida se pierde.

## 🎯 Objetivo y reglas

- **Objetivo:** sobrevivir a las 3 oleadas de zombis eliminándolos a todos.
- **Victoria:** todas las oleadas han aparecido y no queda ningún zombi en el jardín.
- **Derrota:** un zombi llega al extremo izquierdo (a tu casa).
- Los soles ☀ son la moneda: toca los que caen del cielo y los que generan los girasoles.
- Coloca plantas en casillas libres pagando su coste; cada tarjeta tiene recarga.
- Aparecen zombis normales 🧟, con cono 🚧 (más vida) y con cubo 🪣 (mucho más vida).

## 🌱 Unidades disponibles

| Planta | Coste | Vida | Función |
|---|---|---|---|
| 🌻 Girasol | 50 | 80 | Produce 25 de sol cada 7 s |
| 🫛 Lanzaguisantes | 100 | 100 | Dispara guisantes (20 de daño) a su carril |
| 🥜 Nuez mural | 50 | 350 | Muro resistente; si la mastican, ralentiza al zombi (45 % de velocidad, 3 s) |
| 🫛 Repetidora | 175 | 100 | Dispara dos guisantes por ráfaga |
| 🍒 Petacereza | 150 | 60 | Explota y daña en área (900 de daño, radio grande) |

## 🛠 Tecnologías utilizadas

- **HTML5** para la estructura (HUD, tarjetas, pantallas superpuestas).
- **CSS3** para el diseño, animaciones y diseño adaptable (media queries).
- **JavaScript (ES6)** para toda la lógica del juego, renderizado con **Canvas 2D**.
- **WebAudio API** para efectos de sonido generados por código (sin archivos).
- Todos los gráficos son dibujados por código: **cero imágenes externas**.

## ▶️ Instrucciones para jugar

1. Abre `index.html` en cualquier navegador moderno.
2. Pulsa **Comenzar a jugar**.
3. Toca los soles ☀ para recogerlos (cada uno vale 25).
4. Elige una planta en la barra superior y haz clic en una casilla libre del jardín.
5. Detén las oleadas sin que un zombi llegue a la izquierda.

### Controles

| Acción | Teclado | Ratón / táctil |
|---|---|---|
| Elegir planta | `1` a `5` | Clic en la tarjeta |
| Colocar planta | — | Clic en una casilla libre |
| Pala (retirar planta) | `S` | Clic en el botón de la pala, luego en la planta |
| Pausar / reanudar | `P` | Botón ⏸ |
| Sonido sí/no | — | Botón 🔊 |
| Deselegir | `Esc` | — |

## 🧪 Consejos de estrategia

- Empieza con 2–3 girasoles para asegurar el sustento económico.
- Coloca la nuez en los carriles por los que vienen más zombis para frenarlos
  mientras tus lanzaguisantes los derriban.
- Guarda una petacereza para la ¡HORDA FINAL! de la oleada 3.

## 🌐 Cómo activar GitHub Pages

1. En tu repositorio, entra en **Settings** (Configuración).
2. Ve a la sección **Pages** (menú lateral izquierdo).
3. En **Source**, elige **Deploy from a branch**.
4. Selecciona la rama **main** y la carpeta **/ (root)**, y pulsa **Save**.
5. Espera 1–3 minutos: GitHub te mostrará la URL del juego
   (`https://tu-usuario.github.io/jardin-vs-zombis/`).

🔗 **Enlace al juego publicado:** *file:///C:/Users/Usuario/Desktop/Python/jardin-vs-zombis/index.html*

## 🗂 Estructura del proyecto

```
jardin-vs-zombis/
├── index.html    ← estructura y pantallas (abre este archivo)
├── style.css     ← estilos y animaciones
├── game.js       ← toda la lógica del juego (comentada por secciones)
└── README.md     ← esta documentación
```

El código de `game.js` está organizado en 9 secciones comentadas en español;
los valores de equilibrado (costes, vidas, oleadas…) están todos al principio
para que sean fáciles de modificar.
