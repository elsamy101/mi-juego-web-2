'use strict';
/* =========================================================
   JARDÍN VS ZOMBIS — juego tipo "Plants vs. Zombies"
   HTML + CSS + JavaScript puro con Canvas 2D.

   Organización del archivo:
   1. Configuración y datos de plantas / zombis / oleadas
   2. Utilidades
   3. Sonido (WebAudio, sin archivos externos)
   4. Estado del juego y reinicio
   5. Lógica (colocar plantas, zombis, guisantes, soles...)
   6. Bucle de actualización  (update)
   7. Dibujo (render + sprites caricaturescos)
   8. Interfaz (HUD, tarjetas, pantallas)
   9. Entradas del jugador y arranque
   ========================================================= */

/* =========================================================
   1. CONFIGURACIÓN
   Cambia estos números para equilibrar el juego.
   ========================================================= */
const CFG = {
  COLS: 9, ROWS: 5,          // rejilla del jardín
  CXA: 90,                   // ancho de casilla (px lógicos)
  CYA: 100,                  // alto de casilla
  COL0: 250,                 // x donde empieza el césped (tras casa + acera)
  ROW0: 60,                  // y donde empieza el césped (debajo de la valla)
  LW: 1200, LH: 570,         // tamaño lógico del lienzo (250+9*90 ... 60+5*100)
  SOL_INICIAL: 150,
  VALOR_SOL: 25,
  SOL_CIELO_CADA: 7.5,       // segundos entre soles que caen del cielo
  GIRASOL_CADA: 7,           // segundos entre soles de cada girasol
  VEL_GUISANTE: 250,         // velocidad de los guisantes (px/s)
  DANO_GUISANTE: 20,
  X_DERROTA: 205,            // un zombi que cruza esta x (la casa) gana (tú pierdes)
  COR_X: 208,                // posición de reposo de cada cortacésped (centro)
  COR_ACTIVAR: 216,          // un zombi que cruza aquí dispara la cortacésped
  COR_VEL: 430,              // velocidad de la cortacésped activada (px/s)
  RADIO_EXPLOSION: 165,
  DANO_EXPLOSION: 900,
  FUSA: 1.1,                 // segundos hasta que explota la petacereza
};

/* Modos de dificultad: cambian cuántos zombis salen, su velocidad y el sol */
const MODOS = {
  facil: {
    nombre: 'Fácil', sun: 250, solCielo: 6.0, vel: 0.85, recorte: true, extras: null,
    desc: 'Menos zombis, más lentos y 250 de sol inicial',
  },
  normal: {
    nombre: 'Normal', sun: 150, solCielo: 7.5, vel: 1.0, recorte: false, extras: null,
    desc: 'La aventura clásica: 28 zombis en 3 oleadas',
  },
  dificil: {
    nombre: 'Difícil', sun: 100, solCielo: 8.0, vel: 1.18, recorte: false,
    // [oleada, segundo, tipo]: zombis adicionales intercalados
    extras: [[0, 26, 'normal'], [0, 47, 'cono'], [1, 97, 'normal'], [1, 121, 'cono'],
             [1, 149, 'cubo'], [2, 171, 'normal'], [2, 199, 'cono'], [2, 221, 'cubo'],
             [2, 245, 'cono']],
    desc: '37 zombis (con conos y cubos extra) y veloces',
  },
};

/* Plantas: coste, vida, recarga (cd), función especial.
   Los dibujos están en la sección 7. */
const PLANTAS = {
  girasol:    { nombre: 'Girasol',        coste: 50,  vida: 80,  cd: 6,
                desc: 'Produce 25 de sol cada 7 s' },
  guisante:   { nombre: 'Lanzaguisantes', coste: 100, vida: 100, cd: 6,
                desc: 'Dispara guisantes (20 de daño) a los zombis de su carril',
                cadencia: 1.5 },
  nuez:       { nombre: 'Nuez mural',     coste: 50,  vida: 350, cd: 18,
                desc: 'Mucha resistencia. Si la mastican, el zombi se ralentiza' },
  repetidora: { nombre: 'Repetidora',     coste: 175, vida: 100, cd: 6,
                desc: 'Dispara dos guisantes por ráfaga', cadencia: 1.9 },
  cereza:     { nombre: 'Petacereza',     coste: 150, vida: 60,  cd: 20,
                desc: 'Explota al poco de colocarse y daña en área' },
};
const ORDEN_TARJETAS = ['girasol', 'guisante', 'nuez', 'repetidora', 'cereza'];

/* Zombis: vida, velocidad (px/s hacia la izquierda) y daño al morder */
const ZOMBIS = {
  normal: { nombre: 'Zombi',        vida: 100, vel: 16, dano: 26 },
  cono:   { nombre: 'Zombi cono',   vida: 190, vel: 13, dano: 26 },
  cubo:   { nombre: 'Zombi cubo',   vida: 320, vel: 11, dano: 30 },
};

/* Plan de oleadas: [segundo, tipo]. 28 zombis en total.
   Cada oleada es más grande y con zombis más fuertes. */
const PLAN_OLEADAS = [
  { nombre: '¡Oleada 1!',
    eventos: [[20,'normal'],[31,'normal'],[42,'normal'],[53,'normal'],[64,'normal'],[75,'normal']] },
  { nombre: '¡Oleada 2!',
    eventos: [[92,'normal'],[101,'normal'],[110,'cono'],[119,'normal'],[128,'cono'],
              [137,'normal'],[146,'cono'],[153,'normal']] },
  { nombre: '¡HORDA FINAL!',
    eventos: [[168,'normal'],[174,'cono'],[180,'normal'],[186,'cono'],[192,'cubo'],
              [198,'normal'],[204,'cono'],[210,'normal'],[216,'cubo'],[222,'cono'],
              [228,'normal'],[233,'cubo'],[238,'cono'],[242,'cubo']] },
];

/* =========================================================
   2. UTILIDADES
   ========================================================= */
const HAS_DOM = (typeof document !== 'undefined');

function aleatorio(a, b) { return a + Math.random() * (b - a); }
function aleatorioEnt(a, b) { return Math.floor(aleatorio(a, b + 1)); }
function limitar(v, a, b) { return Math.max(a, Math.min(b, v)); }

function celdaX(c) { return CFG.COL0 + c * CFG.CXA + CFG.CXA / 2; }   // centro x de casilla
function sueloY(r) { return CFG.ROW0 + r * CFG.CYA + CFG.CYA - 10; }  // "suelo" de una fila

/* Rectángulo redondeado (compatible con todos los navegadores) */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function elipse(ctx, x, y, rx, ry, rot) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  ctx.closePath();
}

/* =========================================================
   3. SONIDO — pequeños efectos con WebAudio (nada externo)
   ========================================================= */
const Sonido = {
  ctx: null, activo: true,
  asegurar() {
    if (!HAS_DOM) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* sin sonido */ }
  },
  tono(f0, f1, dur, tipo, vol, retraso) {
    if (!this.ctx || !this.activo) return;
    try {
      const t0 = this.ctx.currentTime + (retraso || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = tipo;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignorar */ }
  },
  ruido(dur, vol) {
    if (!this.ctx || !this.activo) return;
    try {
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      const t0 = this.ctx.currentTime;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(g).connect(this.ctx.destination);
      src.start(t0);
    } catch (e) { /* ignorar */ }
  },
  /* Efectos por nombre: 'sol', 'plantar', 'disparo', 'golpe', ... */
  play(n) {
    switch (n) {
      case 'sol':      this.tono(760, 1240, 0.12, 'sine', 0.22);
                       this.tono(1240, 1560, 0.10, 'sine', 0.15, 0.06); break;
      case 'plantar':  this.ruido(0.08, 0.15); this.tono(180, 90, 0.14, 'triangle', 0.22); break;
      case 'disparo':  this.tono(360, 540, 0.07, 'square', 0.10); break;
      case 'golpe':    this.ruido(0.05, 0.12); this.tono(150, 80, 0.09, 'sawtooth', 0.10); break;
      case 'mordida':  this.ruido(0.05, 0.09); break;
      case 'explosion':this.ruido(0.5, 0.5); this.tono(200, 30, 0.45, 'sawtooth', 0.35); break;
      case 'corte':    this.ruido(0.45, 0.3); this.tono(110, 250, 0.4, 'sawtooth', 0.22);
                       this.tono(240, 120, 0.3, 'square', 0.14, 0.05); break;
      case 'muerte':   this.tono(200, 90, 0.25, 'sawtooth', 0.16); break;
      case 'pala':     this.ruido(0.1, 0.15); this.tono(300, 140, 0.12, 'triangle', 0.18); break;
      case 'no':       this.tono(200, 120, 0.12, 'square', 0.13); break;
      case 'oleada':   this.tono(392, 392, 0.15, 'square', 0.16);
                       this.tono(494, 494, 0.15, 'square', 0.16, 0.15); break;
      case 'gana':     [523, 659, 784, 1046].forEach((f, i) => this.tono(f, f, 0.18, 'triangle', 0.22, i * 0.12)); break;
      case 'pierde':   [392, 330, 262, 196].forEach((f, i) => this.tono(f, f * 0.9, 0.25, 'sawtooth', 0.2, i * 0.16)); break;
    }
  },
};

/* =========================================================
   4. ESTADO DEL JUEGO
   ========================================================= */
const estado = {
  fase: 'menu',            // menu | jugando | pausa | ganado | perdido
  modo: 'normal',          // facil | normal | dificil
  sol: CFG.SOL_INICIAL,
  t: 0,                    // tiempo total de partida (s)
  rejilla: [],             // planta por casilla [fila][columna]
  zombis: [], guisantes: [], soles: [], particulas: [], textos: [], manchas: [],
  cortadoras: [],          // defend if... (5 cortacéspedes, uno por carril)
  calendario: [], si: 0,   // lista plana de apariciones y puntero
  oleadaActual: 0,
  cieloTimer: 1.5,
  sel: null, pala: false,  // tarjeta elegida / pala activada
  hover: false, hc: -1, hr: -1,
  sacudida: 0, boom: null, // efectos globales
  cd: {},                  // recarga por tipo de planta
  stats: { muertos: 0, soles: 0, sembradas: 0 },
  listo: false,            // true cuando la interfaz ya está lista
};

/* Construye la lista plana de apariciones según el modo elegido.
   - fácil: salta algunos zombis de las primeras oleadas
   - normal: el plan completo
   - difícil: añade zombis extra intercalados */
function construirCalendario(modo) {
  const m = MODOS[modo || 'normal'];
  const eventos = [];
  PLAN_OLEADAS.forEach((ola, i) => {
    ola.eventos.forEach((ev, k) => {
      if (m.recorte && i < PLAN_OLEADAS.length - 1 && k % 3 === 2) return;
      eventos.push({ t: ev[0], tipo: ev[1], oleada: i });
    });
    if (m.extras) {
      m.extras.forEach(e => {
        if (e[0] === i) eventos.push({ t: e[1], tipo: e[2], oleada: i });
      });
    }
  });
  eventos.sort((a, b) => a.t - b.t);
  return eventos;
}
let calendario = construirCalendario('normal');

/* Devuelve la partida a su estado inicial */
function reset() {
  estado.fase = 'menu';
  estado.sol = MODOS[estado.modo].sun;
  estado.t = 0;
  estado.rejilla = [];
  for (let r = 0; r < CFG.ROWS; r++) estado.rejilla.push(new Array(CFG.COLS).fill(null));
  estado.cortadoras = [];
  for (let r = 0; r < CFG.ROWS; r++) {
    estado.cortadoras.push({ r, presente: true, activa: false, x: CFG.COR_X, t: 0 });
  }
  estado.zombis = []; estado.guisantes = []; estado.soles = [];
  estado.particulas = []; estado.textos = []; estado.manchas = [];
  estado.calendario = calendario; estado.si = 0;
  estado.oleadaActual = 0;
  estado.cieloTimer = 1.5;
  estado.sel = null; estado.pala = false;
  estado.hover = false; estado.hc = -1; estado.hr = -1;
  estado.sacudida = 0; estado.boom = null;
  estado.cd = {};
  ORDEN_TARJETAS.forEach(k => { estado.cd[k] = 0; });
  estado.stats = { muertos: 0, soles: 0, sembradas: 0 };
}

/* =========================================================
   5. LÓGICA DEL JUEGO
   ========================================================= */

/* ---- Crear entidades ---- */
function crearPlantaObj(tipo, r, c) {
  return {
    tipo, r, c,
    x: celdaX(c), y: sueloY(r),
    hp: PLANTAS[tipo].vida, vidaMax: PLANTAS[tipo].vida,
    t: 0,            // edad (para animaciones)
    tDis: 0.6,       // temporizador de disparo (precargada)
    tSol: 4,         // primer sol del girasol llega pronto
    doble: null,     // segunda ráfaga de la repetidora
    fusa: 0,         // cuenta atrás de la petacereza
    flash: 0, vibr: 0, brillo: 0, recoil: 0,
  };
}

function crearZombi(tipo, r, x) {
  const cfg = ZOMBIS[tipo];
  return {
    tipo, r: (r === undefined ? aleatorioEnt(0, CFG.ROWS - 1) : r),
    x: (x === undefined ? CFG.LW + 26 : x),
    hp: cfg.vida, vidaMax: cfg.vida,
    vel: cfg.vel * MODOS[estado.modo].vel * aleatorio(0.92, 1.08), dano: cfg.dano,
    paso: aleatorio(0, 6), t: aleatorio(0, 6),
    flash: 0, lento: 0, comiendo: null,
    muriendo: false, tMuerte: 0,
  };
}

/* ---- Soles ---- */
function crearSolCielo() {
  const c = aleatorioEnt(0, CFG.COLS - 1);
  estado.soles.push({
    tipo: 'cielo', valor: CFG.VALOR_SOL,
    x: celdaX(c) + aleatorio(-25, 25), y: -20,
    sueloY: sueloY(aleatorioEnt(0, CFG.ROWS - 1)) + aleatorio(-10, 20),
    vy: aleatorio(28, 40), suelo: false,
    vida: 12, t: aleatorio(0, 6),
  });
}

function crearSolFlor(p) {
  estado.soles.push({
    tipo: 'flor', valor: CFG.VALOR_SOL,
    x: p.x + aleatorio(-10, 10), y: p.y - 52,
    sueloY: p.y - aleatorio(4, 26),
    vy: aleatorio(-90, -50), vx: aleatorio(-30, 30),
    suelo: false, vida: 10, t: aleatorio(0, 6),
  });
}

/* Recoger un sol (lo usa el clic y las pruebas) */
function recogerSol(sol) {
  const i = estado.soles.indexOf(sol);
  if (i === -1) return false;
  estado.soles.splice(i, 1);
  estado.sol += sol.valor;
  estado.stats.soles += sol.valor;
  soltarTexto(sol.x, sol.y - 14, '+' + sol.valor);
  chispas(sol.x, sol.y, '#ffe27a', 8);
  Sonido.play('sol');
  return true;
}

/* Recoger el sol más cercano a (x,y) dentro de un radio */
function recogerSolClick(x, y) {
  let mejor = null, mejorD = 34 * 34;
  for (const s of estado.soles) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < mejorD) { mejorD = d; mejor = s; }
  }
  return mejor ? recogerSol(mejor) : false;
}

/* ---- Partículas y avisos flotantes ---- */
function particula(x, y, vx, vy, vida, tam, color, g) {
  estado.particulas.push({ x, y, vx, vy, vida, vidaMax: vida, tam, color, g: g || 0 });
}
function chispas(x, y, color, n, fuerza) {
  for (let i = 0; i < n; i++) {
    particula(x, y, aleatorio(-1, 1) * (fuerza || 90), aleatorio(-1, -0.2) * (fuerza || 90),
      aleatorio(0.25, 0.5), aleatorio(2, 5), color, 260);
  }
}
function soltarTexto(x, y, str) { estado.textos.push({ x, y, str, t: 0 }); }

/* ---- Colocar / quitar plantas ---- */
function puedeColocar(r, c, tipo) {
  if (estado.fase !== 'jugando') return false;
  if (r < 0 || c < 0 || r >= CFG.ROWS || c >= CFG.COLS) return false;
  if (estado.rejilla[r][c]) return false;
  if (!PLANTAS[tipo]) return false;
  return estado.sol >= PLANTAS[tipo].coste && estado.cd[tipo] <= 0;
}

function colocarPlanta(r, c, tipo) {
  if (!puedeColocar(r, c, tipo)) return false;
  const cfg = PLANTAS[tipo];
  estado.sol -= cfg.coste;
  estado.cd[tipo] = cfg.cd;
  estado.rejilla[r][c] = crearPlantaObj(tipo, r, c);
  estado.stats.sembradas++;
  chispas(celdaX(c), sueloY(r) - 8, '#cbb27b', 7, 60);
  estado.sel = null;               // tras colocar, se suelta la tarjeta
  Sonido.play('plantar');
  return true;
}

function quitarPlanta(r, c) {
  const p = estado.rejilla[r][c];
  if (!p) return false;
  estado.rejilla[r][c] = null;
  chispas(p.x, p.y - 20, '#88b04b', 10);
  chispas(p.x, p.y - 10, '#cbb27b', 8, 60);
  estado.pala = false;             // la pala se suelta tras usarse
  Sonido.play('pala');
  return true;
}

/* ---- Combate ---- */
function crearGuisante(p) {
  estado.guisantes.push({ r: p.r, x: p.x + 26, y: p.y - 46, dano: CFG.DANO_GUISANTE });
}

function disparar(p) {
  crearGuisante(p);
  p.recoil = 1;
  Sonido.play('disparo');
  if (p.tipo === 'repetidora') p.doble = 0.13;   // segunda ráfaga
}

function daniarZombi(z, d) {
  if (z.muriendo) return;
  z.hp -= d;
  z.flash = 1;
  chispas(z.x, sueloY(z.r) - 60, '#7ac34f', 5, 70);
  Sonido.play('golpe');
  if (z.hp <= 0) {
    z.muriendo = true; z.tMuerte = 0; z.comiendo = null;
    estado.stats.muertos++;
    // caída de partículas + cabecita rebotona
    particula(z.x, sueloY(z.r) - 78, aleatorio(-40, 40), -160, 0.9, 10, '#a9c38a', 420);
    chispas(z.x, sueloY(z.r) - 55, '#5e8f4a', 10);
    chispas(z.x, sueloY(z.r) - 60, '#8fbf6f', 6, 110);
    Sonido.play('muerte');
  }
}

function explotar(x, y) {
  Sonido.play('explosion');
  estado.sacudida = 0.5;
  estado.boom = { x, y, t: 0 };
  for (let i = 0; i < 26; i++) {
    particula(x, y, aleatorio(-1, 1) * 220, aleatorio(-1, 1) * 220,
      aleatorio(0.3, 0.7), aleatorio(4, 9),
      ['#ff7a3c', '#ffd166', '#ff5722', '#3b2b20'][aleatorioEnt(0, 3)], 220);
  }
  estado.manchas.push({ x, y, t: 9 });
  const R2 = CFG.RADIO_EXPLOSION * CFG.RADIO_EXPLOSION;
  for (const z of estado.zombis) {
    if (z.muriendo) continue;
    const dx = z.x - x, dy = (sueloY(z.r) - 46) - y;
    if (dx * dx + dy * dy <= R2) daniarZombi(z, CFG.DANO_EXPLOSION);
  }
}

/* ---- Fin de partida ---- */
function perder() {
  if (estado.fase !== 'jugando') return;
  estado.fase = 'perdido';
  Sonido.play('pierde');
  uiFin(false);
}

function ganar() {
  if (estado.fase !== 'jugando') return;
  estado.fase = 'ganado';
  Sonido.play('gana');
  uiFin(true);
}

/* =========================================================
   6. BUCLE DE ACTUALIZACIÓN
   Se ejecuta una vez por fotograma con dt (delta de tiempo).
   ========================================================= */
function update(dt) {
  estado.t += dt;

  /* 1) Aparición de zombis según el calendario */
  while (estado.si < estado.calendario.length &&
         estado.t >= estado.calendario[estado.si].t) {
    const ev = estado.calendario[estado.si];
    if (ev.oleada !== estado.oleadaActual) {
      estado.oleadaActual = ev.oleada;
      uiBanner(PLAN_OLEADAS[ev.oleada].nombre, ev.oleada === 2);
      Sonido.play('oleada');
    }
    estado.zombis.push(crearZombi(ev.tipo));
    estado.si++;
  }

  /* 2) Soles que caen del cielo (intervalo según la dificultad) */
  estado.cieloTimer -= dt;
  if (estado.cieloTimer <= 0) {
    crearSolCielo();
    estado.cieloTimer = MODOS[estado.modo].solCielo + aleatorio(-1.5, 1.5);
  }

  /* 3) Recargas de las tarjetas */
  for (const k in estado.cd) estado.cd[k] = Math.max(0, estado.cd[k] - dt);

  /* 4) Plantas */
  for (let r = 0; r < CFG.ROWS; r++) {
    for (let c = 0; c < CFG.COLS; c++) {
      const p = estado.rejilla[r][c];
      if (!p) continue;
      p.t += dt;
      p.flash = Math.max(0, p.flash - dt * 3);
      p.vibr = Math.max(0, p.vibr - dt);
      p.brillo = Math.max(0, p.brillo - dt);
      p.recoil = Math.max(0, p.recoil - dt * 5);

      if (p.tipo === 'girasol') {
        p.tSol -= dt;
        if (p.tSol <= 0) {
          p.tSol = CFG.GIRASOL_CADA;
          p.brillo = 0.6;
          crearSolFlor(p);
        }
      } else if (p.tipo === 'guisante' || p.tipo === 'repetidora') {
        // hay zombi por delante en este carril?
        let hay = false;
        for (const z of estado.zombis) {
          if (!z.muriendo && z.r === r && z.x > p.x - 16) { hay = true; break; }
        }
        if (p.doble !== null) {                 // segunda guisante en camino
          p.doble -= dt;
          if (p.doble <= 0) { crearGuisante(p); p.doble = null; }
        }
        p.tDis = Math.max(0, p.tDis - dt);      // siempre se recarga (precargada)
        if (hay && p.tDis <= 0) {
          disparar(p);
          p.tDis = PLANTAS[p.tipo].cadencia;
        }
      } else if (p.tipo === 'cereza') {
        p.fusa += dt / CFG.FUSA;                // la mecha arde...
        if (p.fusa >= 1) {
          const x = p.x, y = p.y - 30;
          estado.rejilla[r][c] = null;
          explotar(x, y);
        }
      }
      // la nuez no necesita más que su vida (muro)
    }
  }

  /* 5) Zombis (avanzar, comer, morir) */
  for (let i = estado.zombis.length - 1; i >= 0; i--) {
    const z = estado.zombis[i];
    if (z.muriendo) {                    // animación de caída ~1.1 s
      z.tMuerte += dt;
      if (z.tMuerte > 1.1) estado.zombis.splice(i, 1);
      continue;
    }
    z.t += dt;
    z.flash = Math.max(0, z.flash - dt * 4);
    z.lento = Math.max(0, z.lento - dt);

    // planta que hay en la casilla donde está el zombi
    const col = limitar(Math.floor((z.x - CFG.COL0) / CFG.CXA), 0, CFG.COLS - 1);
    const p = estado.rejilla[z.r][col];

    if (p && z.x <= p.x + 48) {
      /* La planta está a su alcance: ¡a comer! */
      z.comiendo = p;
      p.vibr = 0.25;
      p.hp -= z.dano * dt;
      if (Math.random() < dt * 2) Sonido.play('mordida');
      if (p.hp <= 0) {
        quitarPlantaSilenciosa(z.r, col);
        // La nuez "marea" al zombi: se vuelve lento 3 s
        if (p.tipo === 'nuez') z.lento = 3;
        z.comiendo = null;
      }
    } else {
      /* Avanza hacia la izquierda (más lento si está mareado) */
      z.comiendo = null;
      const mult = z.lento > 0 ? 0.45 : 1;
      z.x -= z.vel * mult * dt;
      if (mult === 1) z.paso += dt * 6;
      else z.paso += dt * 2.7;
    }

    if (z.x <= CFG.COR_ACTIVAR) {
      /* El zombi llega hasta el bordillo izquierdo: si hay cortacésped,
         salta y arrasa el carril (solo una vez, como el original);
         si ya se usó... ¡la casa queda indefensa! */
      const cor = estado.cortadoras[z.r];
      if (cor && cor.presente && !cor.activa) {
        cor.activa = true;
        Sonido.play('corte');
      } else if (z.x <= CFG.X_DERROTA) {
        perder();
        return;
      }
    }
  }

  /* 5b) Cortacéspedes activados: arrasan a los zombis de su carril */
  for (const cor of estado.cortadoras) {
    if (!cor.presente || !cor.activa) continue;
    cor.t += dt;
    cor.x += CFG.COR_VEL * dt;
    if (Math.random() < dt * 24) {          // humo del motor
      particula(cor.x - 24, sueloY(cor.r) - 30, aleatorio(-36, -8), aleatorio(-52, -16),
        aleatorio(0.3, 0.6), aleatorio(3, 7), '#8b8b8b', 40);
    }
    for (const z of estado.zombis) {
      if (z.r === cor.r && !z.muriendo && z.x <= cor.x + 38) daniarZombi(z, 9999);
    }
    if (cor.x > CFG.LW + 60) cor.presente = false;   // salió del jardín
  }

  /* 6) Guisantes: vuelo y colisión con zombis */
  for (let i = estado.guisantes.length - 1; i >= 0; i--) {
    const g = estado.guisantes[i];
    g.x += CFG.VEL_GUISANTE * dt;
    // el zombi vivo más cercano a la izquierda alcanzable
    let objetivo = null;
    for (const z of estado.zombis) {
      if (z.muriendo || z.r !== g.r) continue;
      if (z.x - 26 <= g.x && (!objetivo || z.x < objetivo.x)) objetivo = z;
    }
    if (objetivo) {
      daniarZombi(objetivo, g.dano);
      estado.guisantes.splice(i, 1);
    } else if (g.x > CFG.LW + 40) {
      estado.guisantes.splice(i, 1);
    }
  }

  /* 7) Soles: caen, saltan y caducan */
  for (let i = estado.soles.length - 1; i >= 0; i--) {
    const s = estado.soles[i];
    if (!s.suelo) {
      if (s.tipo === 'cielo') {
        s.y += s.vy * dt;
        if (s.y >= s.sueloY) s.suelo = true;
      } else {
        s.vy += 300 * dt;              // física con gravedad
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.vy > 0 && s.y >= s.sueloY) s.suelo = true;
      }
    }
    s.vida -= dt;
    if (s.vida <= 0) estado.soles.splice(i, 1);
  }

  /* 8) Efectos: partículas, textos, manchas, sacudida, explosión */
  for (let i = estado.particulas.length - 1; i >= 0; i--) {
    const q = estado.particulas[i];
    q.vida -= dt;
    if (q.vida <= 0) { estado.particulas.splice(i, 1); continue; }
    q.vy += (q.g || 0) * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
  }
  for (let i = estado.textos.length - 1; i >= 0; i--) {
    const tx = estado.textos[i];
    tx.t += dt;
    if (tx.t > 0.9) estado.textos.splice(i, 1);
  }
  for (let i = estado.manchas.length - 1; i >= 0; i--) {
    const m = estado.manchas[i];
    m.t -= dt;
    if (m.t <= 0) estado.manchas.splice(i, 1);
  }
  estado.sacudida = Math.max(0, estado.sacudida - dt);
  if (estado.boom) {
    estado.boom.t += dt;
    if (estado.boom.t > 0.4) estado.boom = null;
  }

  /* 9) ¿Victoría? Todas las oleadas lanzadas y jardín limpio */
  if (estado.si >= estado.calendario.length && estado.zombis.length === 0) {
    ganar();
  }
}

/* Quita una planta sin efectos (la usan los zombis al comerse la última mordida) */
function quitarPlantaSilenciosa(r, c) {
  estado.rejilla[r][c] = null;
  chispas(celdaX(c), sueloY(r) - 16, '#88b04b', 8);
}

/* =========================================================
   7. DIBUJO — Canvas 2D, todo dibujado a mano (sin imágenes)
   ========================================================= */
let lienzoEl = null, ctx = null, dpr = 1;

/* ---- Fondo: casa a la izquierda, césped a franjas y calle a la derecha ----
   Composición inspirada en el jardín clásico (dibujo propio, sin imágenes) */
function dibujarFondo() {
  const RH = CFG.ROW0;                       // cota superior del césped (valla)
  const RB = CFG.LH;                         // borde inferior

  /* --- cielo (se ve entre la valla) --- */
  const g = ctx.createLinearGradient(0, 0, 0, RH);
  g.addColorStop(0, '#9fd9f2'); g.addColorStop(1, '#cdeef0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CFG.LW, RH);

  /* --- calle y acera de la derecha --- */
  dibujarCalle(RH, RB);

  /* --- capa base bajo el césped (por si hay bordes) --- */
  ctx.fillStyle = '#5d8f30';
  ctx.fillRect(CFG.COL0 - 14, RH - 6, CFG.CXA * CFG.COLS + 18, RB - RH + 14);

  /* --- casa y porche de la izquierda --- */
  dibujarCasa(RH, RB);

  /* --- césped: 9 franjas verticales alternas + texturas --- */
  dibujarCesped(RH);

  /* --- bordillo de piedra bajo el césped --- */
  dibujarBordePiedra(RB);

  /* --- valla de madera arriba --- */
  dibujarValla(RH);
}

/* Calle gris con línea discontinua y acera (como a la derecha del jardín) */
function dibujarCalle(topInf, bottomInf) {
  const X0 = CFG.COL0 + CFG.CXA * CFG.COLS;   // fin del césped = 1060
  // arcén de hierba oscura
  ctx.fillStyle = '#4e7d28';
  ctx.fillRect(X0 - 6, topInf - 4, 20, bottomInf - topInf + 10);
  // columna de hierba que cae sobre la calle
  for (let y = topInf - 6; y < bottomInf + 8; y += 13) {
    ctx.fillStyle = '#549230';
    ctx.beginPath();
    ctx.moveTo(X0 - 8, y);
    ctx.quadraticCurveTo(X0 + 2, y + 6, X0 - 6, y + 14);
    ctx.quadraticCurveTo(X0 - 14, y + 8, X0 - 8, y);
    ctx.fill();
  }
  // acera de piedra clara
  ctx.fillStyle = '#cfc9bb';
  ctx.fillRect(X0 + 8, topInf, 70, bottomInf - topInf + 8);
  ctx.strokeStyle = 'rgba(120,110,95,0.5)'; ctx.lineWidth = 2;
  for (let y = topInf + 18; y < bottomInf + 8; y += 26) {
    ctx.beginPath(); ctx.moveTo(X0 + 8, y); ctx.lineTo(X0 + 78, y - 4); ctx.stroke();
  }
  // asfalto
  const ag = ctx.createLinearGradient(X0 + 78, 0, CFG.LW, 0);
  ag.addColorStop(0, '#8e8f93'); ag.addColorStop(1, '#6f7175');
  ctx.fillStyle = ag; ctx.fillRect(X0 + 78, topInf, CFG.LW - X0 - 78, bottomInf - topInf + 10);
  // línea continua blanca (asfalto)
  ctx.strokeStyle = '#e9e9e9'; ctx.lineWidth = 12;
  ctx.setLineDash([34, 30]);
  ctx.beginPath();
  ctx.moveTo(X0 + 150, topInf - 10);
  ctx.quadraticCurveTo(X0 + 105, topInf + (bottomInf - topInf) / 2, X0 + 155, bottomInf + 12);
  ctx.stroke();
  ctx.setLineDash([]);
  // alcantarilla
  ctx.fillStyle = '#5b5d61';
  elipse(ctx, X0 + 128, topInf + 42, 15, 9); ctx.fill();
  ctx.strokeStyle = '#4a4c50'; ctx.lineWidth = 2;
  elipse(ctx, X0 + 128, topInf + 42, 15, 9); ctx.stroke();
}

/* Borde inferior de piedra (bajo el césped) */
function dibujarBordePiedra(bottomInf) {
  ctx.fillStyle = '#d9d2c2';
  ctx.fillRect(CFG.COL0 - 14, bottomInf - 14, CFG.CXA * CFG.COLS + 30, 30);
  ctx.strokeStyle = 'rgba(120,110,95,0.55)'; ctx.lineWidth = 2;
  for (let x = CFG.COL0 - 10; x < CFG.COL0 + CFG.CXA * CFG.COLS + 10; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, bottomInf - 14); ctx.lineTo(x + 14, bottomInf + 16);
    ctx.stroke();
  }
}

/* Césped: franjas alternas por columna + matas de trébol y flores */
function dibujarCesped(top) {
  const W = CFG.CXA, H = CFG.CYA;
  for (let c = 0; c < CFG.COLS; c++) {
    const x = CFG.COL0 + c * W;
    // franjas pares más claras (como el jardín original)
    ctx.fillStyle = c % 2 === 0 ? '#68bc3d' : '#5cb033';
    ctx.fillRect(x, top, W, CFG.ROWS * H);
    // leve franja con sombra a la derecha de cada casilla para dar relieve
    ctx.fillStyle = 'rgba(30,80,20,0.10)';
    ctx.fillRect(x + W - 8, top, 8, CFG.ROWS * H);
  }
  // textura con semilla fija (determinista)
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  };
  for (let i = 0; i < 240; i++) {
    const x = CFG.COL0 + azar() * CFG.CXA * CFG.COLS;
    const y = top + azar() * CFG.ROWS * CFG.CYA;
    const tipo = azar();
    if (tipo < 0.62) {
      // trébol
      ctx.fillStyle = 'rgba(40,110,25,0.55)';
      elipse(ctx, x, y, 4.5, 3, azar() * 3); ctx.fill();
      elipse(ctx, x - 4, y + 3, 3.5, 2.4, azar() * 3); ctx.fill();
      elipse(ctx, x + 4, y + 3, 3.5, 2.4, azar() * 3); ctx.fill();
    } else if (tipo < 0.78) {
      // matas de hierba
      ctx.strokeStyle = 'rgba(45,120,30,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 7);
      ctx.moveTo(x, y); ctx.lineTo(x, y - 8);
      ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 7);
      ctx.stroke();
    } else if (tipo < 0.92) {
      // florecitas amarillas / rojas
      ctx.fillStyle = tipo < 0.86 ? '#f2d24b' : '#e05a4c';
      elipse(ctx, x, y, 2.6, 2.6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      elipse(ctx, x, y - 1, 1, 1); ctx.fill();
    } else {
      // pegotes de luz solar (zonas amarillentas)
      const gg = ctx.createRadialGradient(x, y, 2, x, y, 42);
      gg.addColorStop(0, 'rgba(220,240,120,0.20)');
      gg.addColorStop(1, 'rgba(220,240,120,0)');
      ctx.fillStyle = gg;
      elipse(ctx, x, y, 42, 30); ctx.fill();
    }
  }
  // borde superior e inferior del césped con hierba despeinada
  ctx.strokeStyle = 'rgba(25,80,15,0.45)'; ctx.lineWidth = 2;
  for (let x = CFG.COL0; x < CFG.COL0 + CFG.CXA * CFG.COLS; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 4, top - 5);
    ctx.moveTo(x + 10, top + CFG.ROWS * CFG.CYA); ctx.lineTo(x + 14, top + CFG.ROWS * CFG.CYA + 6);
    ctx.stroke();
  }
}

/* Casa con tejado rojo, puerta arqueada y porche (izquierda) */
function dibujarCasa(top, bottomInf) {
  const W = CFG.COL0 - 40;         // pared hasta la acera
  // pared con estuco
  const pg = ctx.createLinearGradient(0, top, W, bottomInf);
  pg.addColorStop(0, '#f2ead9'); pg.addColorStop(1, '#e0d3bd');
  ctx.fillStyle = pg; ctx.fillRect(0, top - 70, W, bottomInf - top + 70);
  // textura de estuco
  ctx.fillStyle = 'rgba(160,140,110,0.12)';
  for (let i = 0; i < 60; i++) {
    const nx = (i * 137) % W, ny = top - 60 + ((i * 61) % (bottomInf - top));
    elipse(ctx, nx, ny, 3, 2); ctx.fill();
  }
  // tejado (esquina superior izquierda)
  ctx.fillStyle = '#b5502e';
  ctx.beginPath();
  ctx.moveTo(0, top - 70); ctx.lineTo(W, top - 70); ctx.lineTo(W, top - 10); ctx.lineTo(0, top - 34);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8f3d21';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(0, top - 70 + i * 12, W, 5);
  }
  // tubo de bajada
  ctx.fillStyle = '#cfc9bb';
  ctx.fillRect(W - 22, top - 30, 12, bottomInf - top + 28);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
  ctx.strokeRect(W - 22, top - 30, 12, bottomInf - top + 28);
  // ventana con cortinas
  ctx.fillStyle = '#6b7f92';
  ctx.fillRect(58, top + 40, 74, 92);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
  ctx.strokeRect(58, top + 40, 74, 92);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(58, top + 40, 74, 12);
  // faro / lámpara de pared
  ctx.fillStyle = '#5f5648';
  ctx.fillRect(150, top + 66, 8, 26);
  ctx.fillStyle = '#ffd94a';
  elipse(ctx, 154, top + 60, 8, 8); ctx.fill();
  // puerta arqueada marrón
  const dy = top + 210;
  ctx.fillStyle = '#7b4a26';
  ctx.beginPath();
  ctx.moveTo(70, bottomInf - 60);
  ctx.lineTo(70, dy);
  ctx.arc(105, dy, 35, Math.PI, 0);
  ctx.lineTo(140, bottomInf - 60);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5c3517'; ctx.lineWidth = 3;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(70 + i * 23, dy - 6); ctx.lineTo(70 + i * 23, bottomInf - 60);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8c24a';
  elipse(ctx, 133, dy + 40, 5, 5); ctx.fill();    // pomo
  // esterilla "BIENVENIDOS"
  ctx.save();
  ctx.translate(96, bottomInf - 40);
  ctx.rotate(-0.02);
  ctx.fillStyle = '#b4905d';
  ctx.fillRect(0, 0, 78, 26);
  ctx.strokeStyle = 'rgba(90,60,20,0.8)'; ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, 72, 20);
  ctx.fillStyle = '#402008';
  ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText('WELCOME', 39, 17);
  ctx.restore();
  // arbusto en maceta
  dibujarSeto(ctx, 178, dy - 60);
  // triciclo rosa y manguera (sad)
  dibujarTriciclo(ctx, 60, bottomInf - 18);
  ctx.strokeStyle = '#c9b83f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, bottomInf - 10);
  ctx.quadraticCurveTo(40, bottomInf + 2, 78, bottomInf - 8);
  ctx.stroke();
  ctx.fillStyle = '#3a7bc9';
  elipse(ctx, 82, bottomInf - 12, 9, 5, 0.4); ctx.fill();  // boquilla
}

function dibujarSeto(c, x, y) {
  c.fillStyle = '#8a5f33';
  c.beginPath(); c.moveTo(x - 12, y + 42); c.lineTo(x + 12, y + 42);
  c.lineTo(x + 8, y + 24); c.lineTo(x - 8, y + 24); c.closePath(); c.fill();
  c.fillStyle = '#4c8f2f';
  elipse(c, x, y + 4, 20, 24); c.fill();
  c.fillStyle = '#5fa63c';
  elipse(c, x - 7, y - 4, 12, 13); c.fill();
  elipse(c, x + 8, y - 1, 10, 12); c.fill();
}

function dibujarTriciclo(c, x, y) {
  c.strokeStyle = '#e07ba8'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(x + 8, y - 6); c.lineTo(x + 30, y - 22); c.stroke(); // manillar
  elipse(c, x + 4, y - 4, 9, 9); c.fillStyle = '#f3a7c6'; c.fill();           // rueda delantera
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
  elipse(c, x + 4, y - 4, 9, 9); c.stroke();
  c.fillStyle = '#f3a7c6';
  elipse(c, x + 40, y - 4, 6, 6); c.fill();                                   // rueda tracera
}

/* Valla de madera alta que cubre el fondo superior */
function dibujarValla(top) {
  const inicio = CFG.COL0 - 40, fin = CFG.COL0 + CFG.CXA * CFG.COLS + 6;
  for (let x = inicio; x < fin; x += 26) {
    const vari = eater(x) % 10;              // alturas que bailan
    const puntaY = top - 56 - vari;          // y de la punta del poste
    const baseY = top + 8;
    ctx.fillStyle = '#ece2cc';
    ctx.strokeStyle = 'rgba(150,125,85,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, puntaY + 10);              // poste con punta triangular
    ctx.lineTo(x + 11, puntaY);
    ctx.lineTo(x + 22, puntaY + 10);
    ctx.lineTo(x + 22, baseY);
    ctx.lineTo(x, baseY);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  // traviesas horizontales
  ctx.fillStyle = 'rgba(160,135,90,0.35)';
  ctx.fillRect(inicio, top - 30, fin - inicio, 8);
  ctx.fillRect(inicio, top - 4, fin - inicio, 7);
}

function eater(n) { return (n * 7309) % 100; }  // pseudo-variedad leve

/* Marco de resaltado de la casilla bajo el ratón */
function dibujarHover() {
  if (!estado.hover || estado.fase !== 'jugando') return;
  if (estado.hc < 0 || estado.hr < 0) return;
  const x = CFG.COL0 + estado.hc * CFG.CXA, y = CFG.ROW0 + estado.hr * CFG.CYA;
  const ocupada = !!estado.rejilla[estado.hr][estado.hc];
  let ok;
  if (estado.pala) ok = ocupada;
  else ok = estado.sel && !ocupada && puedeColocar(estado.hr, estado.hc, estado.sel);
  ctx.fillStyle = ok ? 'rgba(255,255,255,0.28)' : 'rgba(230,60,40,0.25)';
  ctx.fillRect(x, y, CFG.CXA, CFG.CYA);
  ctx.strokeStyle = ok ? '#ffffff' : '#ff5a4d';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, CFG.CXA - 4, CFG.CYA - 4);
}

/* =========================================================
   Sprites de plantas (x,y = punto del "suelo" de la casilla)
   Estilo clásico dibujado desde cero con Canvas.
   ========================================================= */
function dibujarPlanta(c2, tipo, x, y, p) {
  const t = p ? p.t : 0;
  const sway = Math.sin(t * 2 + x * 0.05) * 3;          // balanceo
  const pop = p ? limitar(p.t * 3, 0, 1) : 1;           // escala al aparecer
  c2.save();
  c2.translate(x, y);
  c2.scale(pop, pop);
  if (p && p.vibr > 0) c2.translate(Math.sin(t * 40) * 2.2, 0); // mordida

  /* --- tallo + hojas comunes --- */
  c2.strokeStyle = '#3e9d2e'; c2.lineWidth = 9; c2.lineCap = 'round';
  c2.beginPath(); c2.moveTo(-4, -2); c2.quadraticCurveTo(2, -18, sway * 0.4, -34); c2.stroke();
  talloHojas(c2, t);

  if (tipo === 'girasol') {
    const hx = sway * 0.5, hy = -56 + Math.sin(t * 2.4) * 2;
    // aura cuando está a punto de producir sol
    if (p && p.brillo > 0) halo(c2, hx, hy, 42, p.brillo * 0.45, '#ffe27a');
    // corola de pétalos (13) con dos tonos
    for (let i = 0; i < 13; i++) {
      const a = (i * Math.PI * 2) / 13 + t * 0.25;
      const px = hx + Math.cos(a) * 23, py = hy + Math.sin(a) * 23;
      c2.fillStyle = '#ffc428';
      elipse(c2, px, py, 11, 6, a); c2.fill();
      c2.fillStyle = '#f7d348';
      elipse(c2, px - Math.cos(a) * 4, py - Math.sin(a) * 4, 7, 3.6, a); c2.fill();
    }
    // disco central (cara)
    const dg = c2.createRadialGradient(hx - 4, hy - 5, 2, hx, hy, 17);
    dg.addColorStop(0, '#ffe98c'); dg.addColorStop(1, '#e8b21e');
    c2.fillStyle = dg; c2.strokeStyle = '#c98f12'; c2.lineWidth = 2;
    elipse(c2, hx, hy, 16, 16); c2.fill(); c2.stroke();
    caraFeliz(c2, hx, hy, 16, p ? 1 : 0.9);
  }

  else if (tipo === 'guisante' || tipo === 'repetidora') {
    const repet = tipo === 'repetidora';
    const rec = p ? p.recoil * 8 : 0;
    const hx = sway * 0.35 - rec, hy = -46;
    // brote en la cabeza
    c2.strokeStyle = '#2e7d20'; c2.lineWidth = 4; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(hx - 2, hy - 18); c2.quadraticCurveTo(hx - 6, hy - 30, hx - 12, hy - 32); c2.stroke();
    c2.fillStyle = '#57a832'; elipse(c2, hx - 13, hy - 33, 5, 3.4, -0.5); c2.fill();
    // cañón principal
    c2.fillStyle = '#79c142'; c2.strokeStyle = '#3e7d2c'; c2.lineWidth = 2.5;
    tronera(c2, hx + 14, hy + 2, 30, 17);
    if (repet) tronera(c2, hx - 4, hy - 12, 22, 13);    // segundo cañón (repetidora)
    // cabeza volumétrica
    const cg = c2.createRadialGradient(hx - 7, hy - 9, 3, hx, hy, 24);
    cg.addColorStop(0, '#a4dd70'); cg.addColorStop(0.55, '#6cbf3a'); cg.addColorStop(1, '#4e9c2b');
    c2.fillStyle = cg; c2.strokeStyle = '#3e7d2c';
    elipse(c2, hx, hy, 22, 21); c2.fill(); c2.stroke();
    // ojo grande
    c2.fillStyle = '#fff'; elipse(c2, hx + 3, hy - 7, 6.5, 7); c2.fill();
    c2.fillStyle = '#20301a'; elipse(c2, hx + 5, hy - 6.4, 3, 3.4); c2.fill();
    c2.fillStyle = 'rgba(255,255,255,0.85)'; elipse(c2, hx + 4, hy - 8.5, 1.3, 1.3); c2.fill();
  }

  else if (tipo === 'nuez') {
    const ratio = p ? p.hp / p.vidaMax : 1;
    const grad = c2.createLinearGradient(0, -70, 0, 0);
    grad.addColorStop(0, '#e0b768'); grad.addColorStop(0.55, '#c39146'); grad.addColorStop(1, '#96692c');
    c2.fillStyle = grad; c2.strokeStyle = '#76521e'; c2.lineWidth = 3;
    elipse(c2, 0, -36, 26, 36); c2.fill(); c2.stroke();
    // brillo superior
    c2.fillStyle = 'rgba(255,240,200,0.35)';
    elipse(c2, -8, -56, 10, 7, -0.5); c2.fill();
    // ojos grandes
    c2.fillStyle = '#fff';
    elipse(c2, -9, -44, 6, 8); c2.fill();
    elipse(c2, 9, -44, 6, 8); c2.fill();
    c2.fillStyle = '#3a2410';
    elipse(c2, ratio < 0.5 ? -7.2 : -8, -43, 3, 3.6); c2.fill();
    elipse(c2, ratio < 0.5 ? 10.8 : 10, -43, 3, 3.6); c2.fill();
    // cejas que se fruncen con el daño
    c2.strokeStyle = '#4a2c0e'; c2.lineWidth = 3; c2.lineCap = 'round';
    c2.beginPath();
    if (ratio > 0.66) { c2.moveTo(-16, -56); c2.lineTo(-4, -54); c2.moveTo(16, -56); c2.lineTo(4, -54); }
    else { c2.moveTo(-16, -58); c2.lineTo(-4, -54); c2.moveTo(16, -58); c2.lineTo(4, -54); }
    c2.stroke();
    // boca
    c2.beginPath();
    if (ratio > 0.33) c2.arc(0, -30, 6, 0.35, Math.PI - 0.35);
    else { c2.moveTo(-5, -27); c2.lineTo(5, -27); }
    c2.strokeStyle = '#4a2c0e'; c2.lineWidth = 2.6; c2.stroke();
    // grietas por nivel de daño
    c2.strokeStyle = '#6d4518'; c2.lineWidth = 2.4;
    if (ratio < 0.66) {
      c2.beginPath(); c2.moveTo(-16, -62); c2.lineTo(-10, -54); c2.lineTo(-15, -48); c2.lineTo(-9, -42); c2.stroke();
    }
    if (ratio < 0.33) {
      c2.beginPath(); c2.moveTo(14, -64); c2.lineTo(9, -56); c2.lineTo(15, -49); c2.lineTo(10, -40); c2.stroke();
      c2.beginPath(); c2.moveTo(3, -12); c2.lineTo(-2, -20); c2.lineTo(4, -26); c2.stroke();
    }
  }

  else if (tipo === 'cereza') {
    const fusa = p ? p.fusa : 0;
    const esc = 1 + fusa * 0.25;
    c2.scale(esc, esc);
    if (fusa > 0.3) halo(c2, 0, -34, 48, fusa * 0.5, '#ff6a3c');
    // tallos
    c2.strokeStyle = '#3f7a2c'; c2.lineWidth = 4.5; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(-12, -40); c2.quadraticCurveTo(-6, -56, 0, -60); c2.stroke();
    c2.beginPath(); c2.moveTo(10, -44); c2.quadraticCurveTo(5, -56, 0, -60); c2.stroke();
    c2.fillStyle = '#57a832'; elipse(c2, 8, -59, 9, 4.4, -0.5); c2.fill();
    // dos cerezas con brillo
    cereza(c2, -12, -28, 18, p);
    cereza(c2, 10, -32, 15, p);
  }

  c2.restore();

  // destello blanco cuando recibe daño
  if (p && p.flash > 0) halo(c2, x, y - 34, 40, p.flash * 0.5, '#ffffff');
}

/* Hojas en la base del tallo */
function talloHojas(c2, t) {
  const ala = Math.sin(t * 3) * 0.08;
  c2.save();
  c2.fillStyle = '#4fae3a'; c2.strokeStyle = '#357a26'; c2.lineWidth = 1.5;
  c2.translate(-16, -6); c2.rotate(-0.9 + ala);
  elipse(c2, 0, 0, 13, 5.5); c2.fill(); c2.stroke();
  c2.restore();
  c2.save();
  c2.fillStyle = '#4fae3a'; c2.strokeStyle = '#357a26';
  c2.translate(16, -4); c2.rotate(0.9 - ala);
  elipse(c2, 0, 0, 12, 5); c2.fill(); c2.stroke();
  c2.restore();
}

/* Cañón tipo trompa con la boca abierta y oscura */
function tronera(c2, x, y, larga, alta) {
  c2.fillStyle = '#86cd52';
  rr(c2, x, y - alta / 2, larga, alta, 9); c2.fill();
  c2.strokeStyle = '#3e7d2c'; c2.lineWidth = 2.5;
  rr(c2, x, y - alta / 2, larga, alta, 9); c2.stroke();
  // boca (elipse oscura al final)
  c2.fillStyle = '#254a15';
  elipse(c2, x + larga - 3, y, alta * 0.34, alta * 0.52); c2.fill();
  c2.fillStyle = '#4e9c2b';
  elipse(c2, x + larga - 4, y - alta * 0.30, alta * 0.3, alta * 0.2); c2.fill(); // labio superior
}

/* Carita sonriente dentro de un disco */
function caraFeliz(c2, cx, cy, r, subir) {
  c2.fillStyle = '#6b4d0d';
  elipse(c2, cx - 5.2, cy - 3, 2.4, 3.4); c2.fill();
  elipse(c2, cx + 5.2, cy - 3, 2.4, 3.4); c2.fill();
  c2.strokeStyle = '#6b4d0d'; c2.lineWidth = 2.6; c2.lineCap = 'round';
  c2.beginPath();
  c2.arc(cx, cy + (subir || 1), 8, 0.28, Math.PI - 0.28);
  c2.stroke();
}

/* Cereza individual con cara */
function cereza(c2, cx, cy, r, p) {
  const g = c2.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 2, cx, cy, r + 6);
  g.addColorStop(0, '#ff8d75'); g.addColorStop(0.5, '#e6403a'); g.addColorStop(1, '#a81c1c');
  c2.fillStyle = g; c2.strokeStyle = '#7e1212'; c2.lineWidth = 2.2;
  elipse(c2, cx, cy, r, r); c2.fill(); c2.stroke();
  c2.fillStyle = 'rgba(255,255,255,0.55)';
  elipse(c2, cx - r * 0.35, cy - r * 0.42, r * 0.3, r * 0.2, -0.6); c2.fill();
  // cara determinada
  c2.fillStyle = '#fff'; elipse(c2, cx - 4, cy - 1, 3.6, 4); c2.fill();
  elipse(c2, cx + 4, cy - 1, 3.6, 4); c2.fill();
  c2.fillStyle = '#30120f'; elipse(c2, cx - 3.6, cy - 0.6, 1.8, 2); c2.fill();
  elipse(c2, cx + 4.4, cy - 0.6, 1.8, 2); c2.fill();
  c2.strokeStyle = '#30120f'; c2.lineWidth = 2.2; c2.lineCap = 'round';
  c2.beginPath(); c2.moveTo(cx - 8, cy - 9); c2.lineTo(cx - 1, cy - 7); c2.stroke();
  c2.beginPath(); c2.moveTo(cx + 8, cy - 9); c2.lineTo(cx + 1, cy - 7); c2.stroke();
  c2.beginPath(); c2.moveTo(cx - 3, cy + 7); c2.lineTo(cx + 3, cy + 7); c2.stroke();
}

/* Aura suave de color (usada por brillos y destellos) */
function halo(c2, x, y, r, alfa, color) {
  c2.save();
  c2.globalAlpha = alfa;
  const g = c2.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
  c2.fillStyle = g;
  elipse(c2, x, y, r, r); c2.fill();
  c2.restore();
}

/* =========================================================
   Sprite de zombi (x,y = punto del suelo; avanza hacia la izquierda)
   Estilo clásico: traje marrón, corbata roja, brazos estirados.
   ========================================================= */
function dibujarZombi(c2, z) {
  const comiendo = !!z.comiendo;
  const pieY = sueloY(z.r);
  const ratio = z.hp / z.vidaMax;

  // sombra
  c2.save();
  c2.globalAlpha = 0.25; c2.fillStyle = '#000';
  elipse(c2, z.x, pieY, 26, 6); c2.fill();
  c2.restore();

  c2.save();
  c2.translate(z.x, pieY);

  // al morir: cae girando hacia adelante y se desvanece
  if (z.muriendo) {
    const prog = limitar(z.tMuerte / 1.1, 0, 1);
    c2.rotate(-prog * Math.PI * 0.52);
    c2.globalAlpha = 1 - prog;
  }

  const paso = z.paso;
  const bob = comiendo ? Math.sin(z.t * 10) * 2.4 : Math.sin(paso) * 2.4;

  /* --- piernas con zapatos --- */
  const angL = comiendo ? 0 : Math.sin(paso) * 0.4;
  const angR = comiendo ? 0 : Math.sin(paso + Math.PI) * 0.4;
  pierna(c2, -4, -36, angL);
  pierna(c2, 6, -36, angR);

  /* --- torso: chaqueta marrón + camisa + corbata roja --- */
  c2.fillStyle = '#5e5748'; c2.strokeStyle = '#453f33'; c2.lineWidth = 2;
  rr(c2, -16, -66 + bob * 0.4, 32, 34, 7); c2.fill(); c2.stroke();
  // jirones de camisa visibles
  c2.fillStyle = '#d8d2c2';
  c2.beginPath();
  c2.moveTo(-5, -66); c2.lineTo(5, -66); c2.lineTo(3, -54); c2.lineTo(-3, -54);
  c2.closePath(); c2.fill();
  // corbata
  c2.fillStyle = '#a03328';
  c2.beginPath();
  c2.moveTo(-2, -64); c2.lineTo(2, -64); c2.lineTo(1.5, -50); c2.lineTo(0, -47); c2.lineTo(-1.5, -50);
  c2.closePath(); c2.fill();
  // remiendo oscuro del traje
  c2.fillStyle = 'rgba(30,25,18,0.35)';
  elipse(c2, 8, -48, 6, 4, 0.4); c2.fill();

  /* --- brazos estirados hacia la izquierda (pose clásica) --- */
  const b1 = comiendo ? Math.sin(z.t * 12) * 5 : Math.sin(paso * 2) * 3;
  brazoZombi(c2, -8, -58 + bob * 0.4, b1 * 0.25);
  if (ratio > 0.5) brazoZombi(c2, -4, -50 + bob * 0.4, -b1 * 0.35); // a media vida se cae uno

  /* --- cabeza con mandíbula articulada --- */
  const headX = 1, headY = -82 + bob;
  c2.fillStyle = '#a2b77e'; c2.strokeStyle = '#7f9460'; c2.lineWidth = 2;
  elipse(c2, headX, headY, 15, 16); c2.fill(); c2.stroke();
  // nariz
  c2.beginPath();
  c2.moveTo(headX - 6, headY - 2); c2.quadraticCurveTo(headX - 13, headY + 2, headX - 6, headY + 5);
  c2.strokeStyle = '#7f9460'; c2.lineWidth = 2; c2.stroke();
  // ojo hundido
  c2.fillStyle = 'rgba(60,70,40,0.5)';
  elipse(c2, headX - 5, headY - 4, 4.5, 4.5); c2.fill();
  c2.fillStyle = '#fff'; elipse(c2, headX - 5, headY - 4, 2.8, 2.8); c2.fill();
  c2.fillStyle = '#1c1c14'; elipse(c2, headX - 6, headY - 4, 1.3, 1.4); c2.fill();
  // mandíbula (se abre al comer)
  c2.save();
  c2.translate(headX - 8, headY + 8);
  c2.rotate(comiendo ? 0.28 + Math.sin(z.t * 14) * 0.10 : 0.12);
  c2.fillStyle = '#a2b77e'; c2.strokeStyle = '#7f9460';
  elipse(c2, -4, 3, 8, 5); c2.fill(); c2.stroke();
  c2.fillStyle = '#4a3b33';
  elipse(c2, -6, 1, 4.2, 3); c2.fill(); // boca oscura
  c2.restore();
  // pelo despeinado
  c2.strokeStyle = '#55492f'; c2.lineWidth = 2.4; c2.lineCap = 'round';
  c2.beginPath(); c2.moveTo(headX - 2, headY - 15); c2.lineTo(headX - 5, headY - 20); c2.stroke();
  c2.beginPath(); c2.moveTo(headX + 4, headY - 15); c2.lineTo(headX + 7, headY - 21); c2.stroke();
  c2.beginPath(); c2.moveTo(headX + 1, headY - 16); c2.lineTo(headX + 1, headY - 22); c2.stroke();

  /* --- accesorios según el tipo (sobre la cabeza) --- */
  if (z.tipo === 'cono') {
    c2.save();
    c2.translate(headX, headY - 13);
    if (ratio < 0.5) c2.rotate(0.22);          // cono torcido a media vida
    c2.fillStyle = '#e2892f'; c2.strokeStyle = '#b96a1e'; c2.lineWidth = 2;
    c2.beginPath();
    c2.moveTo(-15, 0); c2.quadraticCurveTo(0, -34, 15, 0); c2.closePath();
    c2.fill(); c2.stroke();
    c2.fillStyle = 'rgba(255,255,255,0.8)';
    rr(c2, -11, -7, 22, 5, 2); c2.fill();
    c2.restore();
  } else if (z.tipo === 'cubo') {
    c2.save();
    c2.translate(headX, headY - 14);
    if (ratio < 0.5) c2.rotate(-0.18);         // cubo ladeado a media vida
    c2.fillStyle = '#9db0ba'; c2.strokeStyle = '#6d8089'; c2.lineWidth = 2;
    rr(c2, -15, -20, 30, 20, 3); c2.fill(); c2.stroke();
    elipse(c2, 0, -20, 15, 4.5); c2.fillStyle = '#c1d2dc'; c2.fill(); c2.stroke();
    c2.strokeStyle = 'rgba(255,255,255,0.65)'; c2.lineWidth = 2.5;
    c2.beginPath(); c2.moveTo(-9, -3); c2.lineTo(-9, -15); c2.stroke();
    c2.restore();
  }

  /* tintes: lento (azul) y daño (blanco) */
  if (z.lento > 0) halo(c2, 0, -55, 44, 0.3, '#7ab7ff');
  c2.restore();

  if (z.flash > 0 && !z.muriendo) halo(c2, z.x, pieY - 55, 42, z.flash * 0.45, '#ffffff');

  /* mini barra de vida si está herido */
  if (!z.muriendo && z.hp < z.vidaMax) {
    const bx = z.x - 17, by = pieY - 112;
    c2.fillStyle = 'rgba(0,0,0,0.5)'; c2.fillRect(bx, by, 34, 5);
    c2.fillStyle = ratio > 0.5 ? '#7cd35a' : '#ff5a4d';
    c2.fillRect(bx + 1, by + 1, 32 * limitar(ratio, 0, 1), 3);
  }
}

/* Brazo descolgado hacia delante con mano caída */
function brazoZombi(c2, hx, hy, fleja) {
  c2.save();
  c2.translate(hx, hy);
  c2.rotate(fleja);
  c2.strokeStyle = '#5e5748'; c2.lineWidth = 6; c2.lineCap = 'round';
  c2.beginPath(); c2.moveTo(0, 0); c2.lineTo(-16, 1); c2.stroke();   // manga
  c2.strokeStyle = '#a2b77e';
  c2.beginPath(); c2.moveTo(-14, 1); c2.lineTo(-30, 3 + Math.abs(fleja) * 6); c2.stroke();
  c2.fillStyle = '#a2b77e';
  elipse(c2, -32, 4 + Math.abs(fleja) * 6, 5, 4); c2.fill();
  c2.restore();
}

function pierna(c2, px, py, ang) {
  c2.save();
  c2.translate(px, py);
  c2.rotate(ang);
  c2.strokeStyle = '#4a463f'; c2.lineWidth = 9; c2.lineCap = 'round';
  c2.beginPath(); c2.moveTo(0, 0); c2.lineTo(0, 32); c2.stroke();
  c2.strokeStyle = '#2f2b24'; c2.lineWidth = 10;
  c2.beginPath(); c2.moveTo(0, 27); c2.lineTo(-7, 31); c2.stroke(); // zapato
  c2.restore();
}

/* =========================================================
   Sprite del cortacésped (rojo estilo clásico, cor.x = centro)
   ========================================================= */
function dibujarCortadora(c2, cor) {
  const y = sueloY(cor.r);          // fe de la rueda
  const girar = cor.activa ? cor.t * 22 : 0;   // ruedas girando si está corriendo
  c2.save();
  c2.translate(cor.x, y);

  // sombra
  c2.save();
  c2.globalAlpha = 0.22; c2.fillStyle = '#000';
  elipse(c2, 0, 0, 25, 5); c2.fill();
  c2.restore();

  // cuerpo rojo
  const g = c2.createLinearGradient(0, -44, 0, -14);
  g.addColorStop(0, '#e5564a'); g.addColorStop(1, '#a92e24');
  c2.fillStyle = g; c2.strokeStyle = '#7c1f16'; c2.lineWidth = 2;
  rr(c2, -21, -38, 42, 26, 7); c2.fill(); c2.stroke();
  // rejilla superior del motor
  c2.fillStyle = '#c8413a';
  rr(c2, -15, -42, 22, 8, 3); c2.fill();
  c2.strokeStyle = 'rgba(60,20,15,0.6)';
  c2.beginPath(); c2.moveTo(-12, -42); c2.lineTo(-10, -46); c2.stroke();
  c2.beginPath(); c2.moveTo(-5, -42); c2.lineTo(-3, -46); c2.stroke();
  // boca de la cuchilla (a la derecha)
  c2.fillStyle = '#3a3222';
  rr(c2, 15, -20, 12, 10, 3); c2.fill();
  // asidero hacia atrás
  c2.strokeStyle = '#e8e0cd'; c2.lineWidth = 4.5; c2.lineCap = 'round';
  c2.beginPath(); c2.moveTo(-18, -38); c2.lineTo(-34, -58); c2.lineTo(-42, -57); c2.stroke();
  // ruedas con radios giratorios
  rueda(c2, 13, -9, 8, girar);
  rueda(c2, -13, -9, 7, girar);
  c2.restore();

  // humecitos se dibujan como partículas (ya en update)
}

function rueda(c2, x, y, r, girar) {
  c2.fillStyle = '#22201c';
  elipse(c2, x, y, r, r); c2.fill();
  c2.fillStyle = '#6b6b6b';
  elipse(c2, x, y, r * 0.5, r * 0.5); c2.fill();
  c2.strokeStyle = '#3c3c3c'; c2.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = girar + (i * Math.PI) / 3;
    c2.beginPath();
    c2.moveTo(x - Math.cos(a) * r * 0.55, y - Math.sin(a) * r * 0.55);
    c2.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    c2.stroke();
  }
}
function dibujarSol(c2, s) {
  // parpadea para avisar de que va a desaparecer
  const alfa = s.vida < 3 ? 0.35 + 0.65 * Math.abs(Math.sin(s.vida * 7)) : 1;
  const pulso = 1 + Math.sin(s.t * 4) * 0.06;
  const r = 17 * pulso;
  c2.save();
  c2.globalAlpha = alfa;
  halo(c2, s.x, s.y, r * 2.2, 0.5, '#ffe98a');
  // rayos giratorios
  c2.save();
  c2.translate(s.x, s.y);
  c2.rotate(s.t * 0.8);
  c2.fillStyle = 'rgba(255,214,74,0.95)';
  for (let i = 0; i < 8; i++) {
    c2.rotate((Math.PI * 2) / 8);
    c2.beginPath();
    c2.moveTo(0, -r - 7); c2.lineTo(4.5, -r); c2.lineTo(-4.5, -r);
    c2.closePath(); c2.fill();
  }
  c2.restore();
  // círculo principal
  const g = c2.createRadialGradient(s.x - 5, s.y - 6, 2, s.x, s.y, r);
  g.addColorStop(0, '#fff4b8'); g.addColorStop(0.6, '#ffd94a'); g.addColorStop(1, '#f5b91d');
  c2.fillStyle = g; c2.strokeStyle = '#e29a12'; c2.lineWidth = 2;
  elipse(c2, s.x, s.y, r, r); c2.fill(); c2.stroke();
  c2.restore();
}

function dibujarGuisante(c2, g) {
  // estela
  for (let k = 1; k <= 3; k++) {
    c2.save(); c2.globalAlpha = 0.28 - k * 0.08;
    c2.fillStyle = '#7ed321';
    elipse(c2, g.x - k * 9, g.y, 6 - k, 6 - k); c2.fill();
    c2.restore();
  }
  const grd = c2.createRadialGradient(g.x - 3, g.y - 3, 1, g.x, g.y, 9);
  grd.addColorStop(0, '#c4f37c'); grd.addColorStop(1, '#5aa812');
  c2.fillStyle = grd; c2.strokeStyle = '#3f8f1f'; c2.lineWidth = 2;
  elipse(c2, g.x, g.y, 8, 8); c2.fill(); c2.stroke();
}

function dibujarParticulas(c2) {
  for (const q of estado.particulas) {
    c2.save();
    c2.globalAlpha = limitar(q.vida / q.vidaMax, 0, 1);
    c2.fillStyle = q.color;
    elipse(c2, q.x, q.y, q.tam, q.tam); c2.fill();
    c2.restore();
  }
}

function dibujarTextos(c2) {
  c2.save();
  c2.font = 'bold 19px "Segoe UI", Arial, sans-serif';
  c2.textAlign = 'center';
  for (const tx of estado.textos) {
    c2.globalAlpha = limitar(1 - tx.t / 0.9, 0, 1);
    c2.lineWidth = 3; c2.strokeStyle = 'rgba(60,40,0,0.8)';
    c2.strokeText(tx.str, tx.x, tx.y - tx.t * 34);
    c2.fillStyle = '#ffe27a';
    c2.fillText(tx.str, tx.x, tx.y - tx.t * 34);
  }
  c2.restore();
}

function dibujarManchas(c2) {
  for (const m of estado.manchas) {
    c2.save();
    c2.globalAlpha = limitar(m.t / 9, 0, 1) * 0.45;
    c2.fillStyle = '#241a10';
    elipse(c2, m.x, m.y + 22, 55, 22); c2.fill();
    c2.restore();
  }
}

/* =========================================================
   Render principal (reordena capas: suelo → plantas → zombis → efectos)
   ========================================================= */
function render() {
  if (!estado.listo || !ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CFG.LW, CFG.LH);

  // sacudida de pantalla (explosiones)
  if (estado.sacudida > 0) {
    const s = estado.sacudida * 10;
    ctx.translate(aleatorio(-s, s), aleatorio(-s, s));
  }

  dibujarFondo();
  dibujarManchas(ctx);
  dibujarHover(ctx);

  // plantas y zombis fila por fila para solapar bien (cortacéspedes detrás)
  for (let r = 0; r < CFG.ROWS; r++) {
    const cor = estado.cortadoras[r];
    if (cor && cor.presente) dibujarCortadora(ctx, cor);
    for (let c = 0; c < CFG.COLS; c++) {
      const p = estado.rejilla[r][c];
      if (p) dibujarPlanta(ctx, p.tipo, p.x, p.y, p);
    }
    for (const z of estado.zombis) {
      if (z.r === r) dibujarZombi(ctx, z);
    }
  }

  for (const g of estado.guisantes) dibujarGuisante(ctx, g);
  dibujarParticulas(ctx);

  // destello de la explosión
  if (estado.boom) {
    const b = estado.boom;
    ctx.save();
    ctx.globalAlpha = (1 - b.t / 0.4) * 0.85;
    ctx.fillStyle = '#ffd166';
    elipse(ctx, b.x, b.y, 30 + b.t * 420, 30 + b.t * 420 * 0.55); ctx.fill();
    ctx.restore();
  }

  for (const s of estado.soles) dibujarSol(ctx, s);
  dibujarTextos(ctx);

  actualizarHUD();
  actualizarTarjetas();
}

/* =========================================================
   8. INTERFAZ (HUD, tarjetas, pantallas)
   Todas las referencias al DOM se resuelven en init().
   ========================================================= */
const UI = {};   // elementos del DOM

function initUI() {
  ['solCaja', 'solCount', 'modoCaja', 'oleadaLabel', 'oleadaFill', 'btnPausa', 'btnSonido',
   'ovMenu', 'ovPausa', 'ovFin', 'finEmote', 'finTitulo', 'finTexto', 'finStats',
   'banner', 'btnComenzar', 'btnSeguir', 'btnReiniciarP', 'btnMenuP',
   'btnReiniciarF', 'btnMenuF', 'btnPala', 'pista']
  .forEach(id => { UI[id] = document.getElementById(id); });
  UI.canvas = document.getElementById('lienzo');
  UI.tarjetas = Array.from(document.querySelectorAll('#tarjetas .card[data-plant]'));
  UI.cartasPorTipo = {};
  UI.tarjetas.forEach(k => { UI.cartasPorTipo[k.dataset.plant] = k; });
  UI.botonesModo = Array.from(document.querySelectorAll('#ovMenu .btnModo'));
}

/* HUD: soles y progreso de oleadas */
function actualizarHUD() {
  if (!estado.listo) return;
  UI.solCount.textContent = estado.sol;
  const total = estado.calendario.length;
  UI.oleadaLabel.textContent =
    'Oleada ' + Math.min(estado.oleadaActual + 1, PLAN_OLEADAS.length) + ' / ' + PLAN_OLEADAS.length;
  UI.oleadaFill.style.width = Math.round((estado.si / total) * 100) + '%';
}

/* Tarjetas: recarga, selección y si se puede pagar */
function actualizarTarjetas() {
  if (!estado.listo) return;
  for (const tipo of ORDEN_TARJETAS) {
    const btn = UI.cartasPorTipo[tipo];
    const cfg = PLANTAS[tipo];
    const cd = estado.cd[tipo] || 0;
    btn.querySelector('.cd').style.height = Math.round((cd / cfg.cd) * 100) + '%';
    btn.classList.toggle('pobre', estado.sol < cfg.coste || cd > 0);
    btn.classList.toggle('sel', estado.sel === tipo);
  }
  UI.btnPala.classList.toggle('sel', estado.pala);
}

function uiBanner(texto, esFinal) {
  if (!estado.listo) return;
  UI.banner.textContent = texto;
  UI.banner.classList.toggle('final', !!esFinal);
  UI.banner.classList.remove('show');
  void UI.banner.offsetWidth;          // reinicia la animación CSS
  UI.banner.classList.add('show');
}

/* Muestra la pantalla de fin con estadísticas reales */
function uiFin(gano) {
  if (!estado.listo) return;
  const min = Math.floor(estado.t / 60), seg = Math.floor(estado.t % 60);
  const tiempo = min + ':' + String(seg).padStart(2, '0');
  UI.finEmote.textContent = gano ? '🏆' : '💀🧟';
  UI.finTitulo.textContent = gano ? '¡Jardín defendido!' : '¡Los zombis se comieron tu cerebro!';
  UI.finTexto.textContent = gano
    ? 'Repeliste todas las oleadas en modo ' + MODOS[estado.modo].nombre + '. ¡Estrategia de sobresaliente!'
    : 'Un zombi llegó a tu casa en la oleada '
      + Math.min(estado.oleadaActual + 1, PLAN_OLEADAS.length)
      + ' (modo ' + MODOS[estado.modo].nombre + '). ¡Inténtalo otra vez!';
  UI.finStats.innerHTML =
    '<span>⚑ Modo: <b>' + MODOS[estado.modo].nombre + '</b></span>' +
    '<span>⏱ Tiempo: <b>' + tiempo + '</b></span>' +
    '<span>🧟 Zombis eliminados: <b>' + estado.stats.muertos + '</b></span>' +
    '<span>🛺 Cortacéspedes intactos: <b>'
      + estado.cortadoras.filter(c => c.presente && !c.activa).length + '</b></span>' +
    '<span>☀ Soles recogidos: <b>' + estado.stats.soles + '</b></span>' +
    '<span>🌱 Plantas colocadas: <b>' + estado.stats.sembradas + '</b></span>';
  mostrarCapa('ovFin');
}

/* Cambia de fase y ajusta las pantallas visibles */
function cambiarFase(f) {
  estado.fase = f;
  estado.hover = false;
  if (estado.listo) {
    if (f === 'menu') mostrarCapa('ovMenu');
    else if (f === 'pausa') mostrarCapa('ovPausa');
    else mostrarCapa(null);
  }
  if (estado.listo) {
    UI.btnPausa.textContent = f === 'pausa' ? '▶' : '⏸';
  }
}

function mostrarCapa(id) {
  ['ovMenu', 'ovPausa', 'ovFin'].forEach(k => {
    UI[k].classList.toggle('oculta', k !== id);
  });
}

function alternarPausa() {
  Sonido.asegurar();
  if (estado.fase === 'jugando') cambiarFase('pausa');
  else if (estado.fase === 'pausa') cambiarFase('jugando');
}

/* Empezar / reiniciar una partida nueva (con el modo elegido) */
function comenzar() {
  Sonido.asegurar();
  calendario = construirCalendario(estado.modo);
  estado.calendario = calendario;
  reset();
  cambiarFase('jugando');
  if (estado.listo) {
    uiBanner('¡Prepara tu jardín!', false);
    UI.modoCaja.textContent = '⚑ ' + MODOS[estado.modo].nombre;
  }
}

/* =========================================================
   9. ENTRADAS Y ARRANQUE
   ========================================================= */
function coordenadas(e) {
  const r = UI.canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (CFG.LW / r.width),
    y: (e.clientY - r.top) * (CFG.LH / r.height),
  };
}

function celdaEn(x, y) {
  const c = Math.floor((x - CFG.COL0) / CFG.CXA);
  const r = Math.floor((y - CFG.ROW0) / CFG.CYA);
  return (c >= 0 && c < CFG.COLS && r >= 0 && r < CFG.ROWS) ? { r, c } : null;
}

function alClicLienzo(e) {
  Sonido.asegurar();
  if (estado.fase !== 'jugando') return;
  const { x, y } = coordenadas(e);

  // 1) recoger soles tiene prioridad
  if (recogerSolClick(x, y)) { bumpSuns(); return; }

  const cel = celdaEn(x, y);
  if (!cel) return;

  // 2) pala: quitar planta
  if (estado.pala) {
    if (estado.rejilla[cel.r][cel.c]) quitarPlanta(cel.r, cel.c);
    return;
  }

  // 3) colocar la planta elegida
  if (estado.sel) {
    const tipo = estado.sel, cfg = PLANTAS[tipo];
    if (estado.rejilla[cel.r][cel.c]) {
      Sonido.play('no');
      return;
    }
    if (!colocarPlanta(cel.r, cel.c, tipo)) {
      Sonido.play('no');
      avisoSinSol(cfg.coste);
    }
  }
}

function alMover(e) {
  if (estado.fase !== 'jugando') return;
  const { x, y } = coordenadas(e);
  const cel = celdaEn(x, y);
  estado.hover = !!cel;
  if (cel) { estado.hr = cel.r; estado.hc = cel.c; }
}

/* Animación del contador de soles */
function bumpSuns() {
  if (!estado.listo) return;
  UI.solCaja.classList.remove('bump');
  void UI.solCaja.offsetWidth;
  UI.solCaja.classList.add('bump');
}

/* Vista previa: muestra el sol inicial que tocaría en el modo elegido */
function actualizarSolInicial() {
  if (!estado.listo) return;
  UI.solCount.textContent = MODOS[estado.modo].sun;
  UI.modoCaja.textContent = '⚑ ' + MODOS[estado.modo].nombre;
}

/* Aviso visual al intentar pagar algo que no alcanza */
let avisoTimer = null;
function avisoSinSol(coste) {
  if (!estado.listo) return;
  UI.solCaja.classList.add('sin-sol');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => UI.solCaja.classList.remove('sin-sol'), 300);
}

function elegirTarjeta(tipo) {
  Sonido.asegurar();
  const cfg = PLANTAS[tipo];
  if (estado.cd[tipo] > 0 || estado.sol < cfg.coste) { Sonido.play('no'); return; }
  estado.pala = false;
  estado.sel = (estado.sel === tipo) ? null : tipo;
}

function initEventos() {
  UI.canvas.addEventListener('pointerdown', alClicLienzo);
  UI.canvas.addEventListener('pointermove', alMover);
  UI.canvas.addEventListener('pointerleave', () => { estado.hover = false; });
  UI.canvas.addEventListener('contextmenu', e => e.preventDefault());

  UI.tarjetas.forEach(btn => {
    btn.addEventListener('click', () => elegirTarjeta(btn.dataset.plant));
  });
  UI.btnPala.addEventListener('click', () => {
    Sonido.asegurar();
    estado.pala = !estado.pala;
    estado.sel = null;
  });
  UI.btnComenzar.addEventListener('click', comenzar);
  // selección de dificultad en el menú
  UI.botonesModo.forEach(btn => {
    btn.addEventListener('click', () => {
      Sonido.asegurar();
      estado.modo = btn.dataset.modo;
      UI.botonesModo.forEach(b => b.classList.toggle('sel', b === btn));
      actualizarSolInicial();            // vista previa en el HUD
    });
  });
  UI.btnSeguir.addEventListener('click', alternarPausa);
  UI.btnPausa.addEventListener('click', alternarPausa);
  UI.btnReiniciarP.addEventListener('click', comenzar);
  UI.btnReiniciarF.addEventListener('click', comenzar);
  UI.btnMenuP.addEventListener('click', () => { reset(); cambiarFase('menu'); });
  UI.btnMenuF.addEventListener('click', () => { reset(); cambiarFase('menu'); });
  UI.btnSonido.addEventListener('click', () => {
    Sonido.asegurar();
    Sonido.activo = !Sonido.activo;
    UI.btnSonido.textContent = Sonido.activo ? '🔊' : '🔇';
  });

  // atajos de teclado
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') {
      const tipo = ORDEN_TARJETAS[Number(k) - 1];
      if (tipo && (estado.fase === 'jugando')) elegirTarjeta(tipo);
    } else if (k === 'p') {
      if (estado.fase === 'jugando' || estado.fase === 'pausa') alternarPausa();
    } else if (k === 's') {
      if (estado.fase === 'jugando') { estado.pala = !estado.pala; estado.sel = null; }
    } else if (k === 'escape') {
      estado.sel = null; estado.pala = false;
    }
  });
}

/* Dibuja la miniatura de cada tarjeta con el mismo sprite del juego */
function pintarArteTarjetas() {
  UI.tarjetas.forEach(btn => {
    const tipo = btn.dataset.plant;
    const cv = btn.querySelector('.arte');
    const c2 = cv.getContext('2d');
    const s = window.devicePixelRatio || 1;
    cv.width = 76 * s; cv.height = 76 * s;
    c2.setTransform(s, 0, 0, s, 0, 0);
    c2.clearRect(0, 0, 76, 76);
    c2.save();
    c2.translate(38, 70);
    c2.scale(0.68, 0.68);
    dibujarPlanta(c2, tipo, 0, 0, null);
    c2.restore();
  });
}

/* Bucle principal: 60 fps aprox. */
let marcaTemporal = 0;
function bucle(ts) {
  requestAnimationFrame(bucle);
  const dt = limitar((ts - marcaTemporal) / 1000 || 0, 0, 0.05);
  marcaTemporal = ts;
  if (estado.fase === 'jugando') update(dt);
  render();
}

function init() {
  estado.listo = true;
  initUI();
  const s = window.devicePixelRatio || 1;
  dpr = s;
  UI.canvas.width = CFG.LW * s;
  UI.canvas.height = CFG.LH * s;
  ctx = UI.canvas.getContext('2d');
  pintarArteTarjetas();
  initEventos();
  reset();
  actualizarHUD();
  actualizarTarjetas();
  requestAnimationFrame(bucle);
}

if (HAS_DOM) init();

/* Exposición para pruebas y depuración */
const JardinVsZombis = {
  CFG, PLANTAS, ZOMBIS, PLAN_OLEADAS, MODOS, estado, reset, comenzar,
  colocarPlanta, puedeColocar, quitarPlanta, recogerSol,
  crearZombi, crearSolCielo, crearSolFlor, update, disparar, render,
  construirCalendario,
  obtenerCalendario: () => calendario,
};
if (typeof module !== 'undefined' && module.exports) module.exports = JardinVsZombis;
if (HAS_DOM) window.JardinVsZombis = JardinVsZombis;

