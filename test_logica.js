/* =========================================================
   PRUEBAS AUTOMÁTICAS DE LA LÓGICA (Node.js)
   Ejecuta:  node test_logica.js
   No necesita navegador: llama directamente a game.js.
   ========================================================= */
'use strict';
const assert = require('assert');
const J = require('./game.js');
const E = J.estado;
const CFG = J.CFG;

let ok = 0, fallan = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; console.log('  ✓ ' + nombre); }
  catch (e) { fallan++; console.log('  ✗ ' + nombre + '  →  ' + e.message); }
}
/* Avanza el juego en pasos pequeños, como haría el navegador */
function avanzar(segundos) {
  const paso = 0.05;
  let restante = segundos;
  while (restante > 0.00001 && E.fase === 'jugando') {
    J.update(Math.min(paso, restante));
    restante -= paso;
  }
}
function jugar() { J.reset(); E.fase = 'jugando'; }

console.log('==== PRUEBAS DE JARDÍN VS ZOMBIS ====');

prueba('1. Colocar una planta descuenta soles y ocupa la casilla', () => {
  jugar(); E.sol = 300;
  assert.ok(J.colocarPlanta(2, 4, 'girasol'));
  assert.equal(E.sol, 300 - 50);
  assert.ok(E.rejilla[2][4]);
});

prueba('2. No se permiten dos plantas en la misma casilla', () => {
  jugar(); E.sol = 500;
  assert.ok(J.colocarPlanta(2, 4, 'girasol'));
  assert.ok(!J.colocarPlanta(2, 4, 'girasol'));
  assert.ok(!J.colocarPlanta(2, 4, 'guisante'));
});

prueba('3. Sin soles suficientes no se coloca nada', () => {
  jugar(); E.sol = 10;
  assert.ok(!J.colocarPlanta(0, 0, 'guisante'));   // cuesta 100
  assert.equal(E.sol, 10);
  assert.ok(!E.rejilla[0][0]);
});

prueba('4. El girasol genera soles recolectables (+25)', () => {
  jugar(); E.sol = 300;
  J.colocarPlanta(0, 0, 'girasol');
  avanzar(6);                       // primer sol sale a los ~4 s
  assert.ok(E.soles.length >= 1, 'no apareció ningún sol');
  const antes = E.sol;
  assert.ok(J.recogerSol(E.soles[0]));
  assert.equal(E.sol, antes + CFG.VALOR_SOL);
});

prueba('5. El girasol genera soles de forma periódica', () => {
  jugar(); E.sol = 300;
  J.colocarPlanta(1, 1, 'girasol');
  avanzar(20);
  const flores = E.soles.filter(s => s.tipo === 'flor');
  assert.ok(flores.length >= 2, 'solo ' + flores.length + ' soles de girasol (t=20 s)');
});

prueba('6. El lanzaguisantes dispara y daña al zombi', () => {
  jugar(); E.sol = 1000;
  J.colocarPlanta(2, 4, 'guisante');
  const z = J.crearZombi('normal', 2, 900);
  E.zombis.push(z);
  avanzar(2.5);
  assert.ok(z.hp < 100, 'el zombi no recibió daño (hp=' + z.hp + ')');
});

prueba('7. Sin zombis el lanzaguisantes no dispara', () => {
  jugar(); E.sol = 1000;
  J.colocarPlanta(2, 4, 'guisante');
  avanzar(4);
  assert.equal(E.guisantes.length, 0);
});

prueba('8. El lanzaguisantes mata a un zombi normal', () => {
  jugar(); E.sol = 1000;
  J.colocarPlanta(2, 4, 'guisante');
  const z = J.crearZombi('normal', 2, 850);
  E.zombis.push(z);
  avanzar(8);                       // ~5 disparos x 20 de daño
  assert.ok(z.muriendo || !E.zombis.includes(z), 'el zombi no murió');
  assert.equal(E.stats.muertos, 1);
});

prueba('9. El zombi ataca y destruye plantas', () => {
  jugar(); E.sol = 1000;
  J.colocarPlanta(2, 6, 'nuez');
  const z = J.crearZombi('normal', 2, 870);   // junto a la nuez
  E.zombis.push(z);
  avanzar(25);                      // nuez 350 hp / 26 dps ≈ 13.5 s
  assert.ok(!E.rejilla[2][6], 'la nuez no fue destruída');
  assert.ok(E.zombis.includes(z), 'el zombi desapareció sin morir');
});

prueba('10. Tras masticar la nuez, el zombi queda ralentizado', () => {
  jugar(); E.sol = 1000;
  J.colocarPlanta(2, 6, 'nuez');
  const z = J.crearZombi('normal', 2, 870);
  E.zombis.push(z);
  avanzar(14.5);                    // nuez 350 hp / 26 dps ≈ 13.5 s (lento aún activo)
  assert.ok(!E.rejilla[2][6], 'la nuez no fue comida');
  assert.ok(z.lento > 0, 'no se aplicó ralentización');
});

prueba('11. La repetidora dispara dos guisantes por ráfaga', () => {
  jugar(); E.sol = 1000;
  J.colocarPlanta(2, 4, 'repetidora');
  const z = J.crearZombi('normal', 2, 950);
  E.zombis.push(z);
  let maxGuisantes = 0;
  for (let i = 0; i < 20; i++) {    // 1 s: dos rápidos
    J.update(0.05);
    maxGuisantes = Math.max(maxGuisantes, E.guisantes.length);
  }
  assert.ok(maxGuisantes >= 2, 'nunca hubo 2 guisantes a la vez');
});

prueba('12. La petacereza explota y daña a varios zombis', () => {
  jugar(); E.sol = 1000;
  J.colocarPlanta(2, 4, 'cereza');
  E.zombis.push(J.crearZombi('normal', 2, 560));
  E.zombis.push(J.crearZombi('cono', 2, 640));
  avanzar(2);                       // mecha 1.1 s + explosión
  assert.ok(E.zombis.every(z => z.muriendo), 'no todos murieron');
  assert.ok(!E.rejilla[2][4], 'la cereza no se eliminó tras explotar');
});

prueba('13. La cortacésped salva el carril (y luego se va)', () => {
  jugar(); E.sol = 500;
  E.zombis.push(J.crearZombi('normal', 0, 300));   // cruza el bordillo aprox. en 5 s
  avanzar(11);
  assert.equal(E.fase, 'jugando', 'no debió perderse mientras exista cortacésped');
  assert.ok(E.cortadoras[0].activa, 'la cortacésped no se activó');
  assert.equal(E.stats.muertos, 1, 'la cortacésped no arrasó al zombi');
  assert.ok(!E.cortadoras[0].presente, 'la cortacésped no se fue tras usarla');
});

prueba('14. Derrota: zombi a la casa sin cortacésped', () => {
  jugar(); E.sol = 500;
  E.cortadoras[0].presente = false;                // carril indefenso
  E.zombis.push(J.crearZombi('normal', 0, 300));
  for (let i = 0; i < 400 && E.fase === 'jugando'; i++) J.update(0.05);
  assert.equal(E.fase, 'perdido');
});

prueba('20. Victoria al eliminar todos los zombis de todas las oleadas', () => {
  jugar();
  avanzar(0.5);                      // nada en el jardín todavía
  E.zombis = [];                     // (simulamos jardín limpio)
  E.si = E.calendario.length;        // todas las oleadas ya lanzadas
  J.update(0.05);
  assert.equal(E.fase, 'ganado');
});

prueba('15. Las oleadas aparecen escalonadas (no todas a la vez)', () => {
  jugar();
  avanzar(45);                       // a los 45 s solo salieron t=20,31,42
  assert.ok(E.si >= 2 && E.si <= 4, 'aparecieron ' + E.si + ' zombis a los 30 s');
});

prueba('16. Reiniciar devuelve la partida al estado inicial', () => {
  jugar(); E.sol = 1;
  J.colocarPlanta(0, 0, 'girasol');
  E.zombis.push(J.crearZombi('normal'));
  J.reset();
  assert.equal(E.sol, J.MODOS.normal.sun);
  assert.equal(E.fase, 'menu');
  assert.equal(E.zombis.length, 0);
  assert.equal(E.soles.length, 0);
  assert.ok(!E.rejilla[0][0]);
  assert.equal(E.stats.muertos, 0);
  assert.equal(E.cortadoras.length, 5);
  assert.ok(E.cortadoras.every(c => c.presente && !c.activa));
});

prueba('17. Calendario: 3 oleadas con 28 zombis en total (normal)', () => {
  assert.equal(J.PLAN_OLEADAS.length, 3);
  assert.equal(J.obtenerCalendario().length, 28);
});

prueba('18. Modo fácil: menos zombis (24), lentos y 250 de sol', () => {
  const cal = J.construirCalendario('facil');
  assert.equal(cal.length, 24);                 // 28 - 4 salteados
  assert.equal(J.MODOS.facil.sun, 250);
  assert.ok(J.MODOS.facil.vel < 1);
});

prueba('19. Modo difícil: 37 zombis y más velocidad', () => {
  const cal = J.construirCalendario('dificil');
  assert.equal(cal.length, 37);                 // 28 + 9 extra
  assert.equal(J.MODOS.dificil.sun, 100);
  assert.ok(J.MODOS.dificil.vel > 1);
  //OFFSET: los extras están en la misma oleada 3 en su mayoría
  const oleada3 = cal.filter(e => e.oleada === 2).length;
  assert.ok(oleada3 >= 18, 'la horda final debe engordar con los extras');
});

console.log('==== ' + ok + ' OK / ' + fallan + ' fallidas ====');
process.exit(fallan ? 1 : 0);
