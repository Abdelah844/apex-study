// =====================================================
// APEX STUDY · RANGOS Y EXPERIENCIA (XP)
// Estudiar da XP y con la XP subes de rango (como en los videojuegos).
// - La XP se calcula a partir de tu historial (sesiones, planes, tarjetas),
//   así que lo que ya habías estudiado también cuenta.
// - Cada rango tiene 3 divisiones: III (la más baja), II y I. Apex no tiene.
// - Cada alumno elige los nombres: de videojuego o de estudio.
// =====================================================

// Cuánta XP da cada cosa
const XP = {
  minuto: 1,        // cada minuto de sesión terminada
  plan: 20,         // cumplir un plan (cumplir tu palabra)
  sinSalir: 10,     // sesión sin salir de la app
  tarjeta: 1,       // cada tarjeta repasada
  racha7: 50,       // bonus al llegar a 7 días seguidos
  racha30: 150,     // bonus al llegar a 30 días seguidos
  maxDia: 300       // como mucho se gana esto al día (sin contar los bonus)
};

const RANGOS = [
  { xp: 0,     icono: "🥉", juego: "Bronce",   estudio: "Novato",     color: "#C47A45" },
  { xp: 300,   icono: "🥈", juego: "Plata",    estudio: "Aprendiz",   color: "#9AA3B5" },
  { xp: 900,   icono: "🥇", juego: "Oro",      estudio: "Estudiante", color: "#E8B520" },
  { xp: 2400,  icono: "💠", juego: "Platino",  estudio: "Experto",    color: "#3FC1C9" },
  { xp: 4800,  icono: "💎", juego: "Diamante", estudio: "Sabio",      color: "#4DB8FF" },
  { xp: 9000,  icono: "👑", juego: "Maestro",  estudio: "Genio",      color: "#B06DFF" },
  { xp: 18000, icono: "🔥", juego: "Apex",     estudio: "Apex",       color: "#FF6B3D" }
];
const DIVISIONES = ["III", "II", "I"];

// ---------- Cálculo de la XP ----------
// XP de cada día (con el límite diario), en orden de fecha
function xpPorDia() {
  const dias = {};
  function sumar(fecha, puntos) { dias[fecha] = (dias[fecha] || 0) + puntos; }
  for (const s of estado.sesiones) {
    sumar(s.fecha, s.min * XP.minuto);
    if (!s.distracciones) sumar(s.fecha, XP.sinSalir);
  }
  for (const p of estado.planes) if (p.hecho) sumar(p.fecha, XP.plan);
  const repasos = estado.repasos || {};
  for (const fecha in repasos) sumar(fecha, repasos[fecha] * XP.tarjeta);

  return Object.keys(dias).sort().map(function (fecha) {
    return { fecha: fecha, xp: Math.min(XP.maxDia, dias[fecha]) };
  });
}

// Bonus de racha: cada vez que una racha llega a 7 y a 30 días
function bonusRacha() {
  const lista = [];
  const estudiados = {};
  for (const s of estado.sesiones) estudiados[s.fecha] = true;
  for (const fecha of Object.keys(estudiados).sort()) {
    const dias = calcularRacha(fecha).dias;
    if (dias === 7) lista.push({ fecha: fecha, xp: XP.racha7 });
    if (dias === 30) lista.push({ fecha: fecha, xp: XP.racha30 });
  }
  return lista;
}

// Toda la XP ganada, día a día (para el total y el historial)
function historialXP() {
  const todo = xpPorDia().concat(bonusRacha());
  todo.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  return todo;
}

function xpTotal() {
  let total = 0;
  for (const d of historialXP()) total += d.xp;
  return total;
}

// ---------- Rangos ----------
function nombreRango(i) {
  return estado.estiloRangos === "estudio" ? RANGOS[i].estudio : RANGOS[i].juego;
}

// Todos los escalones: Bronce III, Bronce II, Bronce I, Plata III... y Apex
function escalones() {
  const lista = [];
  for (let i = 0; i < RANGOS.length; i++) {
    if (i === RANGOS.length - 1) { lista.push({ rango: i, division: "", xp: RANGOS[i].xp }); break; }
    const tramo = (RANGOS[i + 1].xp - RANGOS[i].xp) / 3;
    for (let d = 0; d < 3; d++) lista.push({ rango: i, division: DIVISIONES[d], xp: Math.round(RANGOS[i].xp + tramo * d) });
  }
  return lista;
}

// En qué escalón estás con esa XP, y cuánto te falta para el siguiente
function rangoDe(xp) {
  const lista = escalones();
  let n = 0;
  while (n + 1 < lista.length && xp >= lista[n + 1].xp) n++;
  const actual = lista[n];
  const siguiente = lista[n + 1] || null;
  return {
    escalon: n,
    rango: actual.rango,
    division: actual.division,
    nombre: nombreRango(actual.rango) + (actual.division ? " " + actual.division : ""),
    icono: RANGOS[actual.rango].icono,
    color: RANGOS[actual.rango].color,
    xp: xp,
    siguiente: siguiente ? nombreRango(siguiente.rango) + (siguiente.division ? " " + siguiente.division : "") : null,
    falta: siguiente ? siguiente.xp - xp : 0,
    // Porcentaje del camino hasta el siguiente escalón (para la barra)
    porcentaje: siguiente ? Math.round((xp - actual.xp) / (siguiente.xp - actual.xp) * 100) : 100
  };
}

function miRango() { return rangoDe(xpTotal()); }

// Día en que conseguiste cada rango (sin divisiones)
function historialRangos() {
  const lista = [{ rango: 0, fecha: null }];
  let total = 0;
  for (const d of historialXP()) {
    total += d.xp;
    while (lista.length < RANGOS.length && total >= RANGOS[lista.length].xp) {
      lista.push({ rango: lista.length, fecha: d.fecha });
    }
  }
  return lista;
}

// Formato con punto de miles: 18000 → "18.000"
function numeroBonito(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// ---------- Pantallas ----------
// Bloque del rango para Inicio
function bloqueRango() {
  const r = miRango();
  const texto = r.siguiente ? "Te faltan " + numeroBonito(r.falta) + " XP para " + r.siguiente : "Has llegado a lo más alto. ¡Eres Apex!";
  return '<button class="rango-bloque" data-act="ver-rangos" style="--rango:' + r.color + '">' +
    '<span class="rango-icono">' + r.icono + '</span>' +
    '<span class="grow"><span class="row between"><b>' + r.nombre + '</b><span class="muted small num">' + numeroBonito(r.xp) + ' XP</span></span>' +
    '<span class="bar"><i style="width:' + r.porcentaje + '%;background:' + r.color + '"></i></span>' +
    '<span class="muted small">' + texto + '</span></span></button>';
}

// Ventana con todos los rangos y cómo ganar XP
function abrirRangos() {
  const r = miRango();
  const conseguidos = historialRangos();
  const lista = RANGOS.map(function (rg, i) {
    const hecho = conseguidos.find(function (h) { return h.rango === i; });
    const cuando = hecho ? (hecho.fecha ? "Conseguido el " + fechaCorta(hecho.fecha) : "Al empezar") : numeroBonito(rg.xp) + " XP";
    return '<div class="item ' + (i === r.rango ? "rango-actual" : "") + (hecho ? "" : " bloqueado") + '">' +
      '<span class="rango-icono">' + rg.icono + '</span><div class="grow"><span class="name">' + nombreRango(i) + '</span>' +
      '<p class="muted small">' + cuando + '</p></div>' + (i === r.rango ? '<span class="pill ok">Ahora</span>' : '') + '</div>';
  }).join("");
  mostrarCapa('<div class="msg">' + apixSVG("campeon") +
    '<p class="label">Tu rango</p><h1>' + r.icono + ' ' + r.nombre + '</h1>' +
    '<p class="muted">' + numeroBonito(r.xp) + ' XP' + (r.siguiente ? ' · te faltan ' + numeroBonito(r.falta) + ' para ' + r.siguiente : '') + '</p>' +
    '<div class="card list" style="width:100%;text-align:left">' + lista + '</div>' +
    '<div class="card stack tight" style="width:100%;text-align:left"><h3>Cómo ganar XP</h3>' +
      '<p class="small">⏱️ <b>1 XP</b> por minuto de estudio</p>' +
      '<p class="small">🤝 <b>+20 XP</b> por cumplir un plan</p>' +
      '<p class="small">📵 <b>+10 XP</b> si no sales de la app en la sesión</p>' +
      '<p class="small">🃏 <b>+1 XP</b> por tarjeta repasada</p>' +
      '<p class="small">🔥 <b>+50 XP</b> al llegar a 7 días de racha y <b>+150 XP</b> a 30</p>' +
      '<p class="muted small">Como mucho se ganan 300 XP al día (sin contar los bonus). Cada rango tiene 3 divisiones: III, II y I.</p></div>' +
    '<button class="btn" data-act="cerrar-capa">Vale</button></div>');
}

// Primera vez que se ven los rangos: presentación
function presentarRangos() {
  const r = miRango();
  estado.rangoVisto = r.escalon;
  guardar();
  mostrarCapa('<div class="msg">' + apixSVG("campeon", "lg") + '<p class="label">¡Novedad!</p><h1>Rangos</h1>' +
    '<p>Ahora estudiar te da <b>XP</b> y con la XP subes de rango. Lo que ya habías estudiado también cuenta.</p>' +
    '<p class="big-num">' + r.icono + ' ' + r.nombre + '</p>' +
    '<p class="muted small">¿Qué nombres prefieres? Lo puedes cambiar en Ajustes.</p>' +
    '<div class="seg" style="width:100%">' + botonesEstilo() + '</div>' +
    '<button class="btn" data-act="ver-rangos">Ver todos los rangos</button>' +
    '<button class="btn-txt" data-act="cerrar-capa">Cerrar</button></div>');
}

function botonesEstilo() {
  const estilo = estado.estiloRangos || "juego";
  return '<button class="' + (estilo === "juego" ? "on" : "") + '" data-act="estilo-rangos" data-e="juego">🎮 Bronce, Plata…</button>' +
    '<button class="' + (estilo === "estudio" ? "on" : "") + '" data-act="estilo-rangos" data-e="estudio">📚 Novato, Aprendiz…</button>';
}

// Después de ganar XP: ¿has subido? Devuelve el texto para celebrarlo (o "")
function comprobarSubida() {
  const r = miRango();
  if (estado.rangoVisto === undefined) return "";   // aún no le hemos presentado los rangos
  if (r.escalon <= estado.rangoVisto) return "";
  estado.rangoVisto = r.escalon;
  guardar();
  return r.icono + " ¡Subes a " + r.nombre + "!";
}

// Apunta una tarjeta repasada hoy (para la XP)
function contarRepaso() {
  estado.repasos = estado.repasos || {};
  estado.repasos[hoy()] = (estado.repasos[hoy()] || 0) + 1;
}

// ---------- Botones ----------
const ACCIONES_RANGOS = {
  "ver-rangos": function () { abrirRangos(); },
  "estilo-rangos": function (b) {
    estado.estiloRangos = b.dataset.e;
    guardar();
    pintar();
    // Repinta lo que esté abierto (presentación o Ajustes)
    if (!$("capa").hidden) presentarRangos();
    if (!$("hoja").hidden) hojaAjustes();
  }
};
