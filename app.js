// =====================================================
// APEX STUDY · LÓGICA DE LA APP
// Partes:
//  1. Datos (se guardan en el móvil con localStorage)
//  2. Ayudas de fechas
//  3. Cálculos (racha, minutos, próximos exámenes...)
//  4. Pantallas (pestañas)
//  5. Formularios (hoja inferior)
//  6. Sesión de estudio (pantalla de concentración)
//  7. Avisos de Apix ("Tienes que cumplir con tu palabra")
//  8. Botones (todas las acciones en un sitio)
// =====================================================

// ---------- 1. DATOS ----------
const CLAVE = "apex-study-v1";   // nombre con el que se guardan los datos en el navegador

function datosVacios() {
  return {
    sesiones: [],    // { fecha, hora, min, objetivo, asignatura, distracciones }
    examenes: [],    // { id, asignatura, tema, fecha, hora }
    planes: [],      // { id, objetivo, asignatura, fecha, hora, min, hecho, avisado }
    mejorRacha: 0,
    sesionActual: null   // la sesión en marcha (por si cierras la app sin querer)
  };
}

function cargar() {
  try {
    const texto = localStorage.getItem(CLAVE);
    if (texto) return Object.assign(datosVacios(), JSON.parse(texto));
  } catch (e) { /* si falla, empezamos de cero */ }
  return datosVacios();
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
  catch (e) { toast("No se han podido guardar los datos"); }
}

let estado = cargar();

// Variables de la interfaz (no se guardan)
let tab = "inicio";             // pestaña abierta
let vistaAgenda = "examenes";   // "examenes" o "planes"
let mesVista = primerDiaMes(new Date());
let diaSel = null;              // día pulsado en el calendario
let minutosElegidos = 25;
let relojFoco = null;           // el setInterval de la sesión
let enfadoHasta = 0;            // hasta cuándo Apix sigue enfadado tras volver

// Para crear identificadores únicos
function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Evita que un texto escrito por el usuario rompa el HTML (por ejemplo si escribe "<")
function esc(t) {
  return String(t).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function $(id) { return document.getElementById(id); }

// ---------- 2. FECHAS ----------
// Las fechas se guardan como texto "2026-11-05" (año-mes-día)
function fechaISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function hoy() { return fechaISO(new Date()); }
function horaActual() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function sumarDias(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}
function diasEntre(a, b) {
  return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
}
function primerDiaMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function fechaCorta(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}
function fechaLarga(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
function fechaHoraPlan(p) { return new Date(p.fecha + "T" + p.hora + ":00"); }

// "Hoy", "Mañana", "En 5 días"...
function cuentaAtras(iso) {
  const d = diasEntre(hoy(), iso);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d < 0) return "Pasado";
  return "En " + d + " días";
}

// ---------- 3. CÁLCULOS ----------
function minutosDelDia(iso) {
  let total = 0;
  for (const s of estado.sesiones) if (s.fecha === iso) total += s.min;
  return total;
}

// Días seguidos estudiando (cuenta hoy o, si hoy aún no, desde ayer)
function rachaActual() {
  let dia = hoy();
  if (minutosDelDia(dia) === 0) dia = sumarDias(dia, -1);
  let n = 0;
  while (minutosDelDia(dia) > 0) { n++; dia = sumarDias(dia, -1); }
  return n;
}

// Si ayer no estudiaste ni hoy tampoco: ¿cuántos días seguidos tenías antes?
function rachaPerdida() {
  if (minutosDelDia(hoy()) > 0 || minutosDelDia(sumarDias(hoy(), -1)) > 0) return 0;
  let dia = sumarDias(hoy(), -2), n = 0;
  while (minutosDelDia(dia) > 0) { n++; dia = sumarDias(dia, -1); }
  return n;
}

function proximosExamenes() {
  return estado.examenes
    .filter(function (e) { return e.fecha >= hoy(); })
    .sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; });
}

function planesDelDia(iso) {
  return estado.planes
    .filter(function (p) { return p.fecha === iso; })
    .sort(function (a, b) { return a.hora < b.hora ? -1 : 1; });
}

function proximosPlanes() {
  const ahora = hoy();
  return estado.planes
    .filter(function (p) { return p.fecha >= ahora && !p.hecho; })
    .sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; });
}

// Estado de un plan: cumplido, no cumplido o pendiente
function estadoPlan(p) {
  if (p.hecho) return { texto: "Cumplido", clase: "ok" };
  // Damos 1 hora de margen antes de decir que no lo cumpliste
  if (fechaHoraPlan(p).getTime() + 3600000 < Date.now()) return { texto: "No cumplido", clase: "mal" };
  return { texto: "Pendiente", clase: "pend" };
}

// Cada asignatura tiene su color (se calcula a partir del nombre)
const COLORES = ["#9B7EFF", "#FF8A3D", "#3CE0A0", "#FF4D8D", "#4DB8FF", "#FFC94D", "#C77DFF"];
function colorAsig(nombre) {
  let suma = 0;
  for (const letra of (nombre || "").toLowerCase()) suma += letra.charCodeAt(0);
  return COLORES[suma % COLORES.length];
}

// Asignaturas de la ESO y Bachillerato (salen en el desplegable)
const ASIGNATURAS = {
  "ESO": [
    "Lengua Castellana y Literatura", "Matemáticas", "Inglés", "Geografía e Historia",
    "Biología y Geología", "Física y Química", "Tecnología y Digitalización", "Educación Física",
    "Música", "Educación Plástica, Visual y Audiovisual", "Francés", "Latín",
    "Economía y Emprendimiento", "Filosofía", "Valores Cívicos y Éticos", "Religión"
  ],
  "Bachillerato": [
    "Matemáticas I", "Matemáticas II", "Matemáticas Aplicadas a las CCSS", "Física", "Química",
    "Biología", "Geología y Ciencias Ambientales", "Dibujo Técnico", "Tecnología e Ingeniería",
    "Historia de España", "Historia de la Filosofía", "Historia del Mundo Contemporáneo",
    "Historia del Arte", "Geografía", "Griego", "Economía",
    "Empresa y Diseño de Modelos de Negocio", "Literatura Universal", "Dibujo Artístico"
  ]
};

// Desplegable de asignaturas. Si eliges "Otra…", aparece una caja para escribirla.
function selectorAsig(id, valor) {
  const conocidas = ASIGNATURAS["ESO"].concat(ASIGNATURAS["Bachillerato"]);
  const esOtra = valor && !conocidas.includes(valor);
  let html = '<select id="' + id + '" data-cambio="asig-otra">';
  html += '<option value="">Sin asignatura</option>';
  for (const grupo in ASIGNATURAS) {
    html += '<optgroup label="' + grupo + '">';
    for (const a of ASIGNATURAS[grupo]) {
      html += '<option' + (a === valor ? ' selected' : '') + '>' + a + '</option>';
    }
    html += '</optgroup>';
  }
  html += '<option value="otra"' + (esOtra ? ' selected' : '') + '>Otra…</option></select>';
  html += '<input id="' + id + 'Otra" placeholder="Escribe la asignatura" maxlength="40" value="' + (esOtra ? esc(valor) : '') + '"' + (esOtra ? '' : ' hidden') + '>';
  return html;
}

// Lee la asignatura elegida (del desplegable o de la caja "Otra")
function leerAsig(id) {
  const elegida = $(id).value;
  if (elegida === "otra") return $(id + "Otra").value.trim();
  return elegida;
}

// Al cambiar el desplegable, enseña u oculta la caja "Otra"
document.addEventListener("change", function (ev) {
  if (ev.target.dataset.cambio === "asig-otra") {
    const caja = $(ev.target.id + "Otra");
    caja.hidden = ev.target.value !== "otra";
    if (!caja.hidden) caja.focus();
  }
});

// ---------- 4. PANTALLAS ----------
function pintar() {
  // Marca la pestaña activa en la barra de abajo
  document.querySelectorAll("nav.tabs button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.tab === tab);
  });
  if (tab === "inicio") pintarInicio();
  if (tab === "estudiar") pintarEstudiar();
  if (tab === "agenda") pintarAgenda();
  if (tab === "calendario") pintarCalendario();
  if (tab === "progreso") pintarProgreso();
}

function irA(nueva) { tab = nueva; window.scrollTo(0, 0); pintar(); }

function cabecera(titulo, sub) {
  return '<div class="head"><div><p class="label">' + sub + '</p><h1>' + titulo + '</h1></div>' +
    '<button class="icon-btn" data-act="ajustes" aria-label="Ajustes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div>';
}

// Tarjeta de Apix con su bocadillo
function tarjetaApix(humor, titulo, mensaje, botones) {
  return '<div class="apix-card tono-' + humor + '">' + apixSVG(humor) +
    '<div class="bocadillo"><p class="label">' + titulo + '</p><p>' + esc(mensaje) + '</p>' +
    (botones ? '<div class="acciones">' + botones + '</div>' : '') + '</div></div>';
}

// Una fila de examen
function filaExamen(e, conBotones) {
  const d = new Date(e.fecha + "T12:00:00");
  return '<div class="item"><div class="dia-caja exam"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString("es-ES", { month: "short" }) + '</span></div>' +
    '<div class="grow"><span class="name"><span class="punto-asig" style="background:' + colorAsig(e.asignatura) + '"></span> ' + esc(e.asignatura) + '</span>' +
    '<p class="muted small">' + esc(e.tema || "Examen") + (e.hora ? ' · ' + e.hora : '') + '</p>' +
    '</div><span class="pill exam">' + cuentaAtras(e.fecha) + '</span>' +
    (conBotones ? '<div class="acciones"><button class="btn-sec" data-act="plan-de-examen" data-id="' + e.id + '">Planificar estudio</button>' +
      '<button class="btn-sec btn-danger" data-act="borrar-examen" data-id="' + e.id + '">Borrar</button></div>' : '') + '</div>';
}

// Una fila de plan de estudio
function filaPlan(p, conBotones) {
  const st = estadoPlan(p);
  let botones = "";
  if (conBotones) {
    if (!p.hecho && p.fecha === hoy()) botones += '<button class="btn auto" data-act="empezar-plan" data-id="' + p.id + '">Empezar</button>';
    if (!p.hecho && st.clase === "pend") botones += '<a class="btn-sec" target="_blank" rel="noopener" href="' + enlaceGoogleCalendar(p) + '">📅 Calendario</a>';
    botones += '<button class="btn-sec btn-danger" data-act="borrar-plan" data-id="' + p.id + '">Borrar</button>';
  }
  return '<div class="item"><div class="dia-caja"><b>' + p.hora + '</b><span>' + (p.fecha === hoy() ? "hoy" : fechaCorta(p.fecha)) + '</span></div>' +
    '<div class="grow"><span class="name">' + esc(p.objetivo) + '</span>' +
    '<p class="muted small">' + (p.asignatura ? esc(p.asignatura) + ' · ' : '') + p.min + ' min</p>' +
    '</div><span class="pill ' + st.clase + '">' + st.texto + '</span>' +
    (botones ? '<div class="acciones">' + botones + '</div>' : '') + '</div>';
}

// ===== Pestaña INICIO =====
function pintarInicio() {
  const apix = estadoMascota();
  let botonApix = "";
  if (apix.plan) botonApix = '<button class="btn auto" data-act="empezar-plan" data-id="' + apix.plan + '">Empezar ahora</button>';

  // Semana actual (de lunes a domingo)
  const lunes = sumarDias(hoy(), -((new Date().getDay() + 6) % 7));
  let semana = "";
  const letras = ["L", "M", "X", "J", "V", "S", "D"];
  for (let i = 0; i < 7; i++) {
    const dia = sumarDias(lunes, i);
    const clase = (minutosDelDia(dia) > 0 ? "on " : "") + (dia === hoy() ? "today" : "");
    semana += '<div>' + letras[i] + '<i class="' + clase + '">' + (minutosDelDia(dia) > 0 ? "✓" : "") + '</i></div>';
  }

  const examenes = proximosExamenes().slice(0, 3);
  const planes = proximosPlanes().slice(0, 3);

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Apex Study", fechaLarga(hoy())) +
    tarjetaApix(apix.humor, "Apix", apix.mensaje, botonApix) +
    '<div class="card hero stack tight">' +
      '<div class="grid3">' +
        '<div><p class="label">Racha</p><p class="big-num num">🔥 ' + rachaActual() + '</p><p class="muted small">días</p></div>' +
        '<div><p class="label">Hoy</p><p class="big-num num">' + minutosDelDia(hoy()) + '</p><p class="muted small">minutos</p></div>' +
        '<div><p class="label">Exámenes</p><p class="big-num num">' + proximosExamenes().length + '</p><p class="muted small">por hacer</p></div>' +
      '</div>' +
      '<div class="week" style="margin-top:8px">' + semana + '</div>' +
      '<button class="btn" data-act="ir" data-tab="estudiar" style="margin-top:10px">Empezar a estudiar</button>' +
    '</div>' +
    '<div class="card"><div class="row between"><h2>Planes de estudio</h2><button class="btn-txt" data-act="nuevo-plan">+ Nuevo</button></div>' +
      '<div class="list">' + (planes.length ? planes.map(function (p) { return filaPlan(p, true); }).join("") :
        '<p class="vacio">¿Cuándo vas a empezar a estudiar? Ponle fecha y hora, y Apix te avisará.</p>') + '</div></div>' +
    '<div class="card"><div class="row between"><h2>Próximos exámenes</h2><button class="btn-txt" data-act="nuevo-examen">+ Nuevo</button></div>' +
      '<div class="list">' + (examenes.length ? examenes.map(function (e) { return filaExamen(e, false); }).join("") :
        '<p class="vacio">Apunta tus exámenes para no llevarte sustos.</p>') + '</div></div>' +
    '</div>';
}

// ===== Pestaña ESTUDIAR =====
function pintarEstudiar() {
  const tiempos = [15, 25, 45, 60, 90];
  const chips = tiempos.map(function (m) {
    return '<button class="chip ' + (m === minutosElegidos ? "on" : "") + '" data-act="tiempo" data-min="' + m + '">' + m + ' min</button>';
  }).join("");
  const planesHoy = planesDelDia(hoy()).filter(function (p) { return !p.hecho; });

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Estudiar", "Sesión de concentración") +
    tarjetaApix("estudia", "Apix", "Dime qué vas a aprender y cuánto tiempo. Yo vigilo que no te escapes al móvil.", "") +
    '<div class="card stack">' +
      '<label class="f">¿Qué quieres aprender?<input id="objetivo" placeholder="Ej: ecuaciones, gramática..." maxlength="80"></label>' +
      '<label class="f">Asignatura (opcional)' + selectorAsig("asignatura", "") + '</label>' +
      '<div><p class="label" style="margin-bottom:8px">Tiempo</p><div class="chips">' + chips + '</div></div>' +
      '<p class="err" id="errEstudiar"></p>' +
      '<button class="btn" data-act="empezar">Empezar a estudiar</button>' +
    '</div>' +
    (planesHoy.length ? '<div class="card"><h2>Tus planes de hoy</h2><div class="list">' + planesHoy.map(function (p) { return filaPlan(p, true); }).join("") + '</div></div>' : '') +
    '<div class="card stack tight"><h3>📵 Bloquea las redes sociales</h3>' +
      '<p class="muted">Una web no puede bloquear otras apps, pero Android sí. Antes de empezar:</p>' +
      '<p class="small">1. Abre <b>Ajustes</b> → <b>Bienestar digital y controles parentales</b>.<br>2. Pulsa <b>Modo concentración</b>.<br>3. Marca Instagram, TikTok… y pulsa <b>Activar ahora</b>.</p>' +
      '<p class="muted small">Además, si sales de Apex Study mientras estudias, Apix se enfada y lo apunta.</p>' +
    '</div></div>';
}

// ===== Pestaña AGENDA =====
function pintarAgenda() {
  let contenido = "";
  if (vistaAgenda === "examenes") {
    const futuros = proximosExamenes();
    const pasados = estado.examenes.filter(function (e) { return e.fecha < hoy(); }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    contenido = '<div class="card"><div class="list">' +
      (futuros.length ? futuros.map(function (e) { return filaExamen(e, true); }).join("") : '<p class="vacio">No tienes exámenes apuntados.</p>') +
      '</div></div>' +
      '<button class="btn" data-act="nuevo-examen">+ Añadir examen</button>' +
      (pasados.length ? '<div class="card"><p class="label">Ya pasados</p><div class="list">' + pasados.map(function (e) { return filaExamen(e, false); }).join("") + '</div></div>' : '');
  } else {
    const futuros = estado.planes.filter(function (p) { return p.fecha >= hoy(); }).sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; });
    const pasados = estado.planes.filter(function (p) { return p.fecha < hoy(); }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 10);
    contenido = '<div class="card"><div class="list">' +
      (futuros.length ? futuros.map(function (p) { return filaPlan(p, true); }).join("") : '<p class="vacio">Aún no has dicho cuándo vas a estudiar.</p>') +
      '</div></div>' +
      '<button class="btn" data-act="nuevo-plan">+ ¿Cuándo empiezo a estudiar?</button>' +
      (pasados.length ? '<div class="card"><p class="label">Anteriores</p><div class="list">' + pasados.map(function (p) { return filaPlan(p, false); }).join("") + '</div></div>' : '');
  }

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Agenda", "Exámenes y planes") +
    '<div class="seg">' +
      '<button class="' + (vistaAgenda === "examenes" ? "on" : "") + '" data-act="vista-agenda" data-v="examenes">Exámenes</button>' +
      '<button class="' + (vistaAgenda === "planes" ? "on" : "") + '" data-act="vista-agenda" data-v="planes">Planes de estudio</button>' +
    '</div>' + contenido + '</div>';
}

// ===== Pestaña CALENDARIO =====
function pintarCalendario() {
  const anio = mesVista.getFullYear();
  const mes = mesVista.getMonth();
  const titulo = mesVista.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  // Empezamos en el lunes de la semana del día 1
  const primero = fechaISO(mesVista);
  const hueco = (mesVista.getDay() + 6) % 7;
  let dia = sumarDias(primero, -hueco);

  let celdas = ["L", "M", "X", "J", "V", "S", "D"].map(function (l) { return '<span class="dsem">' + l + '</span>'; }).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(dia + "T12:00:00");
    let clases = "";
    if (d.getMonth() !== mes) clases += " fuera";
    if (dia === hoy()) clases += " hoy";
    if (dia === diaSel) clases += " sel";
    let puntos = "";
    if (estado.examenes.some(function (e) { return e.fecha === dia; })) puntos += '<i class="e"></i>';
    if (estado.planes.some(function (p) { return p.fecha === dia; })) puntos += '<i class="p"></i>';
    if (minutosDelDia(dia) > 0) puntos += '<i class="s"></i>';
    celdas += '<button class="' + clases + '" data-act="dia" data-dia="' + dia + '">' + d.getDate() + '<span class="puntos">' + puntos + '</span></button>';
    dia = sumarDias(dia, 1);
    // Si ya hemos pasado el mes y la semana está completa, paramos
    if (i % 7 === 6 && new Date(dia + "T12:00:00").getMonth() !== mes && i >= 27) break;
  }

  // Lo que hay el día seleccionado
  let detalle = "";
  if (diaSel) {
    const ex = estado.examenes.filter(function (e) { return e.fecha === diaSel; });
    const pl = planesDelDia(diaSel);
    const min = minutosDelDia(diaSel);
    let lista = ex.map(function (e) { return filaExamen(e, true); }).join("") + pl.map(function (p) { return filaPlan(p, true); }).join("");
    if (!lista) lista = '<p class="vacio">Nada apuntado este día.</p>';
    detalle = '<div class="card stack tight"><h2>' + fechaLarga(diaSel) + '</h2>' +
      (min ? '<p class="muted">✓ Estudiaste ' + min + ' min</p>' : '') +
      '<div class="list">' + lista + '</div>' +
      '<div class="dos"><button class="btn-sec" data-act="nuevo-examen" data-fecha="' + diaSel + '">+ Examen</button>' +
      '<button class="btn-sec" data-act="nuevo-plan" data-fecha="' + diaSel + '">+ Plan de estudio</button></div></div>';
  }

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Calendario", "Tu mes de un vistazo") +
    '<div class="card stack">' +
      '<div class="row between"><button class="icon-btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button>' +
      '<h2>' + titulo + '</h2><button class="icon-btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>' +
      '<div class="cal">' + celdas + '</div>' +
      '<div class="leyenda"><span><i style="background:var(--exam)"></i>Examen</span><span><i style="background:var(--fire)"></i>Plan de estudio</span><span><i style="background:var(--good)"></i>Estudiaste</span></div>' +
    '</div>' + detalle + '</div>';
}

// ===== Pestaña PROGRESO =====
function pintarProgreso() {
  // Minutos de los últimos 7 días
  const dias = [];
  for (let i = 6; i >= 0; i--) dias.push(sumarDias(hoy(), -i));
  const minutos = dias.map(minutosDelDia);
  const maximo = Math.max(30, Math.max.apply(null, minutos));
  const barras = dias.map(function (d, i) {
    const alto = Math.round((minutos[i] / maximo) * 100);
    const letra = new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "narrow" });
    return '<div><span class="num">' + (minutos[i] || "") + '</span><i class="' + (minutos[i] ? "" : "cero") + '" style="height:' + alto + '%"></i>' + letra + '</div>';
  }).join("");

  // Total y por asignatura
  let total = 0;
  const porAsig = {};
  for (const s of estado.sesiones) {
    total += s.min;
    const a = s.asignatura || "Sin asignatura";
    porAsig[a] = (porAsig[a] || 0) + s.min;
  }
  const asigs = Object.keys(porAsig).sort(function (a, b) { return porAsig[b] - porAsig[a]; });
  const maxAsig = asigs.length ? porAsig[asigs[0]] : 1;
  const listaAsig = asigs.map(function (a) {
    return '<div class="stack tight" style="gap:4px"><div class="row between"><span class="name"><span class="punto-asig" style="background:' + colorAsig(a) + '"></span> ' + esc(a) + '</span><span class="muted num">' + porAsig[a] + ' min</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(porAsig[a] / maxAsig * 100) + '%;background:' + colorAsig(a) + '"></i></div></div>';
  }).join("");

  const cumplidos = estado.planes.filter(function (p) { return p.hecho; }).length;
  const vencidos = estado.planes.filter(function (p) { return estadoPlan(p).clase !== "pend"; }).length;
  const ultimas = estado.sesiones.slice(-8).reverse();

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Progreso", "Tu constancia") +
    '<div class="grid3">' +
      '<div class="card"><p class="label">Racha</p><p class="big-num num">' + rachaActual() + '</p><p class="muted small">mejor: ' + estado.mejorRacha + '</p></div>' +
      '<div class="card"><p class="label">Total</p><p class="big-num num">' + (total / 60).toFixed(1).replace(".", ",") + '</p><p class="muted small">horas</p></div>' +
      '<div class="card"><p class="label">Palabra</p><p class="big-num num">' + cumplidos + '/' + vencidos + '</p><p class="muted small">planes cumplidos</p></div>' +
    '</div>' +
    '<div class="card stack"><h2>Últimos 7 días</h2><div class="grafica">' + barras + '</div></div>' +
    '<div class="card stack"><h2>Por asignatura</h2>' + (listaAsig || '<p class="vacio">Cuando estudies, aquí verás en qué inviertes el tiempo.</p>') + '</div>' +
    '<div class="card"><h2>Últimas sesiones</h2><div class="list">' +
      (ultimas.length ? ultimas.map(function (s) {
        return '<div class="item"><div class="grow"><span class="name">' + esc(s.objetivo) + '</span><p class="muted small">' + fechaCorta(s.fecha) + ' · ' + s.hora + (s.asignatura ? ' · ' + esc(s.asignatura) : '') + '</p></div>' +
          '<span class="pill ' + (s.distracciones ? "pend" : "ok") + '">' + s.min + ' min' + (s.distracciones ? ' · ' + s.distracciones + ' salidas' : '') + '</span></div>';
      }).join("") : '<p class="vacio">Aún no hay sesiones.</p>') +
    '</div></div></div>';
}

// ---------- 5. FORMULARIOS (hoja inferior) ----------
function abrirHoja(html) {
  $("hoja").innerHTML = '<div class="sheet stack">' + html + '</div>';
  $("hoja").hidden = false;
}
function cerrarHoja() { $("hoja").hidden = true; $("hoja").innerHTML = ""; }

function hojaExamen(fecha) {
  abrirHoja('<div class="row between"><h2>Nuevo examen</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">Asignatura' + selectorAsig("exAsig", "") + '</label>' +
    '<label class="f">Tema o unidad (opcional)<input id="exTema" placeholder="Ej: Tema 3 · Ecuaciones de segundo grado" maxlength="60"></label>' +
    '<div class="dos"><label class="f">Fecha<input id="exFecha" type="date" value="' + (fecha || sumarDias(hoy(), 7)) + '"></label>' +
    '<label class="f">Hora (opcional)<input id="exHora" type="time"></label></div>' +
    '<p class="err" id="exErr"></p>' +
    '<button class="btn" data-act="guardar-examen">Guardar examen</button>');
}

function hojaPlan(fecha, examen) {
  let objetivo = "";
  let asig = "";
  if (examen) { objetivo = "Repasar " + (examen.tema || examen.asignatura); asig = examen.asignatura; }
  const tiempos = [15, 25, 45, 60, 90].map(function (m) {
    return '<button class="chip ' + (m === 25 ? "on" : "") + '" data-act="tiempo-plan" data-min="' + m + '">' + m + ' min</button>';
  }).join("");
  // Hora sugerida: la próxima media hora (ej: si son las 19:11, las 19:30)
  const d = new Date(Date.now() + 30 * 60000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  let horaSugerida = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  if (fecha && fecha !== hoy()) horaSugerida = "18:00";
  abrirHoja('<div class="row between"><h2>¿Cuándo empiezas?</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    tarjetaApix("anima", "Apix", "Cuando llegue la hora te avisaré. Si lo dices, lo cumples.", "") +
    '<label class="f">¿Qué vas a estudiar?<input id="plObj" value="' + esc(objetivo) + '" placeholder="Ej: repasar ecuaciones, gramática..." maxlength="80"></label>' +
    '<label class="f">Asignatura (opcional)' + selectorAsig("plAsig", asig) + '</label>' +
    '<div class="dos"><label class="f">Día<input id="plFecha" type="date" value="' + (fecha || hoy()) + '"></label>' +
    '<label class="f">Hora de empezar<input id="plHora" type="time" value="' + horaSugerida + '"></label></div>' +
    '<div><p class="label" style="margin-bottom:8px">Duración</p><div class="chips" id="plTiempos">' + tiempos + '</div></div>' +
    '<p class="err" id="plErr"></p>' +
    '<button class="btn" data-act="guardar-plan" data-min="25" id="plGuardar">Doy mi palabra</button>');
}

function hojaAjustes() {
  let avisos;
  const permiso = permisoAvisos();
  if (permiso === "granted") avisos = '<p class="small">✓ Avisos activados</p><button class="btn-sec" data-act="probar-aviso">Probar aviso</button>';
  else if (permiso === "denied") avisos = '<p class="muted small">Has bloqueado los avisos. Actívalos en los ajustes del navegador para esta página.</p>';
  else if (permiso === "no") avisos = '<p class="muted small">Este navegador no permite avisos. En iPhone, primero añade la app a la pantalla de inicio.</p>';
  else avisos = '<button class="btn" data-act="activar-avisos">Activar avisos de Apix</button>';

  abrirHoja('<div class="row between"><h2>Ajustes</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<div class="card stack tight"><h3>Avisos</h3><p class="muted small">Apix te avisará cuando llegue la hora de empezar a estudiar.</p>' + avisos + '</div>' +
    '<div class="card stack tight"><h3>Instalar en el móvil</h3>' +
      (appInstalada() ? '<p class="small">✓ Ya estás usando Apex Study como app.</p>' :
        '<p class="muted small">En Android (Chrome): menú ⋮ → «Instalar aplicación». En iPhone (Safari): Compartir → «Añadir a pantalla de inicio».</p>') + '</div>' +
    '<div class="card stack tight"><h3>Tus datos</h3><p class="muted small">Se guardan solo en este móvil.</p>' +
      '<button class="btn-sec btn-danger" data-act="borrar-todo">Borrar todos los datos</button></div>');
}

// Lee los datos del formulario de examen
function guardarExamen() {
  const asignatura = leerAsig("exAsig");
  const fecha = $("exFecha").value;
  if (!asignatura) { $("exErr").textContent = "Elige la asignatura."; return; }
  if (!fecha) { $("exErr").textContent = "Elige la fecha."; return; }
  const examen = { id: nuevoId(), asignatura: asignatura, tema: $("exTema").value.trim(), fecha: fecha, hora: $("exHora").value };
  estado.examenes.push(examen);
  guardar(); cerrarHoja();
  programarAvisosExamenNube(examen);   // avisos del día antes y del mismo día
  toast("📅 Examen apuntado");
  pintar();
}

function guardarPlan(minutos) {
  const objetivo = $("plObj").value.trim();
  const fecha = $("plFecha").value;
  const hora = $("plHora").value;
  if (!objetivo) { $("plErr").textContent = "Escribe qué vas a estudiar."; return; }
  if (!fecha || !hora) { $("plErr").textContent = "Elige el día y la hora."; return; }
  const plan = { id: nuevoId(), objetivo: objetivo, asignatura: leerAsig("plAsig"), fecha: fecha, hora: hora, min: minutos, hecho: false, avisado: false };
  if (fechaHoraPlan(plan) < new Date(Date.now() - 60000)) { $("plErr").textContent = "Esa hora ya ha pasado. Elige una futura."; return; }
  estado.planes.push(plan);
  guardar(); cerrarHoja();
  programarAvisoNube(plan);   // para que avise aunque la app esté cerrada
  pintar();
  // Si no tiene los avisos activados, se lo pedimos (sin avisos, Apix no puede recordárselo)
  if (permisoAvisos() === "default") {
    mostrarCapa('<div class="msg">' + apixSVG("anima", "lg") + '<h1>¡Trato hecho!</h1>' +
      '<p>El ' + fechaLarga(fecha) + ' a las ' + hora + ' empiezas «' + esc(objetivo) + '».</p>' +
      '<p class="muted">Activa los avisos para que pueda recordártelo.</p>' +
      '<button class="btn" data-act="activar-avisos">Activar avisos</button><button class="btn-txt" data-act="cerrar-capa">Ahora no</button></div>');
  } else {
    toast("🤝 Trato hecho. Apix te avisará a las " + hora);
  }
}

// Enlace para añadir el plan a Google Calendar (así te avisa aunque la app esté cerrada)
function enlaceGoogleCalendar(p) {
  const inicio = fechaHoraPlan(p);
  const fin = new Date(inicio.getTime() + p.min * 60000);
  function formato(d) { return fechaISO(d).replace(/-/g, "") + "T" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00"; }
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent("📚 " + p.objetivo + " (Apex Study)") +
    "&dates=" + formato(inicio) + "/" + formato(fin) +
    "&details=" + encodeURIComponent("Apix: " + FRASE_PALABRA) +
    "&ctz=" + encodeURIComponent(zona);
}

// ---------- 6. SESIÓN DE ESTUDIO ----------
function empezarSesion(objetivo, asignatura, minutos, planId) {
  estado.sesionActual = {
    objetivo: objetivo, asignatura: asignatura, min: minutos, planId: planId || null,
    inicio: Date.now(), fin: Date.now() + minutos * 60000, distracciones: 0
  };
  guardar();
  abrirFoco();
}

function abrirFoco() {
  const s = estado.sesionActual;
  $("tabs").hidden = true;
  $("foco").hidden = false;
  $("foco").innerHTML = '<div class="in">' +
    '<p class="label">Estudiando' + (s.asignatura ? ' · ' + esc(s.asignatura) : '') + '</p>' +
    '<p class="objetivo">' + esc(s.objetivo) + '</p>' +
    '<div id="focoApix"></div>' +
    '<div class="bocadillo"><p id="focoFrase"></p></div>' +
    '<div class="anillo"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="fondo"/><circle cx="50" cy="50" r="44" class="avance" id="focoAnillo" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><span class="t num" id="focoReloj">--:--</span></div>' +
    '<p class="muted small" id="focoSalidas"></p>' +
    '<button class="btn-sec" data-act="rendirse">Me rindo</button></div>';
  focoHumor = "";
  actualizarFoco();
  clearInterval(relojFoco);
  relojFoco = setInterval(actualizarFoco, 1000);   // se repite cada segundo
}

let focoHumor = "";
function ponerApixFoco(humor, frase) {
  if (humor !== focoHumor) { $("focoApix").innerHTML = apixSVG(humor, "lg"); focoHumor = humor; }
  if ($("focoFrase").textContent !== frase) $("focoFrase").textContent = frase;
}

// Se ejecuta cada segundo mientras estudias
function actualizarFoco() {
  const s = estado.sesionActual;
  if (!s) return;
  const total = s.min * 60;
  const restantes = Math.max(0, Math.round((s.fin - Date.now()) / 1000));
  const pasados = total - restantes;

  if (restantes <= 0) { terminarSesion(); return; }

  // Reloj mm:ss y anillo
  const m = Math.floor(restantes / 60);
  const seg = restantes % 60;
  $("focoReloj").textContent = String(m).padStart(2, "0") + ":" + String(seg).padStart(2, "0");
  $("focoAnillo").setAttribute("stroke-dashoffset", (276.5 * pasados / total).toFixed(1));
  $("focoSalidas").textContent = s.distracciones ? "Has salido " + s.distracciones + (s.distracciones === 1 ? " vez" : " veces") : "";

  // Qué dice Apix
  if (Date.now() < enfadoHasta) {
    ponerApixFoco("enfadado", "¡Te he visto salir! Vuelve a tu objetivo 😠");
  } else if (pasados < 8) {
    ponerApixFoco("anima", "¡Vamos! A por «" + s.objetivo + "» 💪");
  } else if (restantes <= 60) {
    ponerApixFoco("anima", "¡Último minuto! Aguanta, ya casi lo tienes.");
  } else if (pasados >= total / 2 && pasados < total / 2 + 60) {
    ponerApixFoco("anima", "¡Ya llevas la mitad! No lo dejes ahora.");
  } else {
    const indice = Math.floor(pasados / 300);     // cambia cada 5 minutos
    ponerApixFoco("estudia", FRASES_ESTUDIO[indice % FRASES_ESTUDIO.length]);
  }
}

function terminarSesion() {
  clearInterval(relojFoco);
  const s = estado.sesionActual;
  estado.sesiones.push({ fecha: hoy(), hora: horaActual(), min: s.min, objetivo: s.objetivo, asignatura: s.asignatura, distracciones: s.distracciones });

  // El plan queda cumplido: el de esta sesión, o el primero pendiente de hoy
  let plan = estado.planes.find(function (p) { return p.id === s.planId; });
  if (!plan) plan = planesDelDia(hoy()).find(function (p) { return !p.hecho; });
  if (plan) { plan.hecho = true; cancelarAvisoNube(plan.id); }

  estado.sesionActual = null;
  estado.mejorRacha = Math.max(estado.mejorRacha, rachaActual());
  guardar();
  cerrarFoco();
  mostrarAviso("Apix 🎉", "¡Objetivo cumplido! " + s.min + " min de " + s.objetivo + ".");

  let extra = s.distracciones ? "Saliste " + s.distracciones + (s.distracciones === 1 ? " vez" : " veces") + ". La próxima, a por 0." : "¡Sin salir ni una vez! Eres una máquina.";
  if (plan) extra = "Has cumplido tu palabra. " + extra;
  mostrarCapa('<div class="msg">' + apixSVG("campeon", "xl") + '<p class="label">Sesión completada</p><h1>¡Objetivo cumplido!</h1>' +
    '<p><b>' + s.min + ' min</b> de «' + esc(s.objetivo) + '»</p><p class="muted">' + extra + '</p>' +
    '<p class="big-num">🔥 ' + rachaActual() + ' ' + (rachaActual() === 1 ? "día" : "días") + '</p>' +
    '<button class="btn" data-act="cerrar-capa">¡Genial!</button></div>');
}

function cerrarFoco() {
  $("foco").hidden = true;
  $("foco").innerHTML = "";
  $("tabs").hidden = false;
  pintar();
}

// Si sales de la app mientras estudias, Apix lo nota
document.addEventListener("visibilitychange", function () {
  if (!estado.sesionActual) return;
  if (document.hidden) {
    estado.sesionActual.distracciones++;
    guardar();
    const quedan = Math.max(1, Math.round((estado.sesionActual.fin - Date.now()) / 60000));
    mostrarAviso("Apix 😠", "¡Vuelve a estudiar! Te quedan " + quedan + " min de «" + estado.sesionActual.objetivo + "».");
  } else {
    enfadoHasta = Date.now() + 4000;   // 4 segundos enfadado
    actualizarFoco();
  }
});

// ---------- 7. AVISOS DE APIX ----------
function permisoAvisos() {
  if (typeof Notification === "undefined") return "no";
  return Notification.permission;   // "default", "granted" o "denied"
}

function mostrarAviso(titulo, texto, etiqueta) {
  if (permisoAvisos() !== "granted") return false;
  const op = { body: texto, icon: "iconos/icono-192.png", badge: "iconos/icono-192.png", tag: etiqueta || "apex-study", vibrate: [200, 100, 200] };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(titulo, op); });
  } else {
    try { new Notification(titulo, op); } catch (e) { return false; }
  }
  return true;
}

// Mira si ha llegado la hora de algún plan. Se ejecuta al abrir, al volver y cada 20 segundos.
function comprobarPlanes() {
  if (estado.sesionActual) return;
  if (!$("capa").hidden) return;   // ya hay un aviso en pantalla
  comprobarExamenes();
  if (!$("capa").hidden) return;
  const ahora = Date.now();
  for (const p of estado.planes) {
    const hora = fechaHoraPlan(p).getTime();
    // Ha llegado la hora (y no hace más de 2 horas), no está hecho y aún no avisamos
    if (!p.hecho && !p.avisado && ahora >= hora && ahora - hora < 2 * 3600000) {
      p.avisado = true;
      guardar();
      mostrarAviso("Apix 📚", FRASE_PALABRA + " Toca empezar «" + p.objetivo + "» (" + p.min + " min).", "plan-" + p.id);
      avisoPalabra(p);
      return;
    }
  }
}

// Pantalla grande de Apix: "Tienes que cumplir con tu palabra"
function avisoPalabra(p) {
  mostrarCapa('<div class="msg">' + apixSVG("anima", "xl") + '<p class="label">Apix · ' + p.hora + '</p>' +
    '<h1>' + FRASE_PALABRA + '</h1>' +
    '<p>Dijiste que ahora empezarías <b>«' + esc(p.objetivo) + '»</b> durante ' + p.min + ' min.</p>' +
    '<button class="btn" data-act="empezar-plan" data-id="' + p.id + '">Empezar ahora</button>' +
    '<button class="btn-sec full" data-act="posponer" data-id="' + p.id + '">Dame 10 minutos</button></div>');
}

// ---------- AVISOS DESDE LA NUBE (Supabase) ----------
// Con la app cerrada, el móvil no puede mirar la hora. Por eso guardamos el aviso
// en Supabase, y Supabase lo envía a la hora exacta (notificación push).
const SUPABASE_URL = "https://bwgukadlvyhogwtszlhl.supabase.co";
const SUPABASE_CLAVE = "sb_publishable_-rnOK3rj54mx7h4s0-L_yA_rgrhU6SU";   // clave pública (es normal que esté aquí)
const VAPID_PUBLICA = "BEN_7_TDiIF6EdGLyNOw0OoKiYQfpkwmm0SsfKDIMaZ28kmgIqpmMYTF2-_S_7Jc9iVyLmO97pk4NA__y7fbMJA";   // clave pública de avisos

// Llama a una función de Supabase (las del archivo supabase/1-tabla-avisos.sql)
function llamarSupabase(funcion, datos) {
  return fetch(SUPABASE_URL + "/rest/v1/rpc/" + funcion, {
    method: "POST",
    headers: { "apikey": SUPABASE_CLAVE, "Content-Type": "application/json" },
    body: JSON.stringify(datos)
  }).then(function (r) {
    if (!r.ok) throw new Error("Supabase respondió " + r.status);
  });
}

// La clave VAPID viene en texto (base64) y el navegador la quiere en bytes
function claveEnBytes(texto) {
  const base64 = (texto + "=".repeat((4 - texto.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// "Dirección" de este móvil para recibir avisos (se crea la primera vez)
async function suscripcionPush() {
  if (permisoAvisos() !== "granted" || !("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveEnBytes(VAPID_PUBLICA) });
  return sub.toJSON();
}

// Guarda en Supabase el aviso de un plan
async function programarAvisoNube(p) {
  try {
    const sub = await suscripcionPush();
    if (!sub) return;
    await llamarSupabase("study_programar_aviso", {
      p_endpoint: sub.endpoint,
      p_suscripcion: sub,
      p_plan: p.id,
      p_cuando: fechaHoraPlan(p).toISOString(),
      p_titulo: "Apix 📚",
      p_cuerpo: FRASE_PALABRA + " Toca empezar «" + p.objetivo + "» (" + p.min + " min)."
    });
  } catch (e) {
    console.warn("No se pudo programar el aviso en la nube:", e);
  }
}

// Quita de Supabase el aviso de un plan (o todos si planId es null)
async function cancelarAvisoNube(planId) {
  try {
    const sub = await suscripcionPush();
    if (!sub) return;
    await llamarSupabase("study_cancelar_aviso", { p_endpoint: sub.endpoint, p_plan: planId });
  } catch (e) {
    console.warn("No se pudo cancelar el aviso en la nube:", e);
  }
}

// Programa en la nube todos los planes futuros que aún no se han cumplido
function programarTodosNube() {
  const ahora = new Date();
  for (const p of estado.planes) {
    if (!p.hecho && fechaHoraPlan(p) > ahora) programarAvisoNube(p);
  }
  for (const e of estado.examenes) programarAvisosExamenNube(e);
}

// ---------- AVISOS DE EXAMEN ----------
// Cada examen tiene 2 avisos: el día antes a las 18:00 y el mismo día a las 07:30
function avisosDeExamen(e) {
  const nombre = e.asignatura + (e.tema ? " (" + e.tema + ")" : "");
  return [
    {
      clave: "ex-" + e.id + "-antes",
      cuando: new Date(sumarDias(e.fecha, -1) + "T18:00:00"),
      texto: "Mañana tienes examen de " + nombre + ". ¿Has repasado? Aún estás a tiempo."
    },
    {
      clave: "ex-" + e.id + "-dia",
      cuando: new Date(e.fecha + "T07:30:00"),
      texto: "Hoy es el examen de " + nombre + (e.hora ? " a las " + e.hora : "") + ". ¡Tú puedes!"
    }
  ];
}

// Guarda en Supabase los avisos del examen que aún no han pasado
async function programarAvisosExamenNube(e) {
  try {
    const sub = await suscripcionPush();
    if (!sub) return;
    for (const a of avisosDeExamen(e)) {
      if (a.cuando <= new Date()) continue;   // esa hora ya pasó
      await llamarSupabase("study_programar_aviso", {
        p_endpoint: sub.endpoint, p_suscripcion: sub, p_plan: a.clave,
        p_cuando: a.cuando.toISOString(), p_titulo: "Apix 📅", p_cuerpo: a.texto
      });
    }
  } catch (err) {
    console.warn("No se pudo programar el aviso del examen:", err);
  }
}

function cancelarAvisosExamenNube(id) {
  cancelarAvisoNube("ex-" + id + "-antes");
  cancelarAvisoNube("ex-" + id + "-dia");
}

// Con la app abierta: si ha llegado la hora de un aviso de examen, lo enseña
function comprobarExamenes() {
  const ahora = Date.now();
  estado.avisosVistos = estado.avisosVistos || [];
  for (const e of estado.examenes) {
    for (const a of avisosDeExamen(e)) {
      const hora = a.cuando.getTime();
      if (ahora >= hora && ahora - hora < 3 * 3600000 && !estado.avisosVistos.includes(a.clave)) {
        estado.avisosVistos.push(a.clave);
        guardar();
        mostrarAviso("Apix 📅", a.texto, a.clave);
        avisoExamen(e, a.texto);
        return;
      }
    }
  }
}

// Pantalla grande de Apix para el examen
function avisoExamen(e, texto) {
  mostrarCapa('<div class="msg">' + apixSVG("anima", "xl") + '<p class="label">Apix · Examen</p>' +
    '<h1>' + esc(e.asignatura) + '</h1><p>' + esc(texto) + '</p>' +
    '<button class="btn" data-act="plan-de-examen" data-id="' + e.id + '">Planificar estudio</button>' +
    '<button class="btn-sec full" data-act="cerrar-capa">Vale</button></div>');
}

function mostrarCapa(html) { $("capa").innerHTML = html; $("capa").hidden = false; }
function cerrarCapa() { $("capa").hidden = true; $("capa").innerHTML = ""; }

let temporizadorToast = null;
function toast(texto) {
  $("toast").textContent = texto;
  $("toast").hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(function () { $("toast").hidden = true; }, 2800);
}

function appInstalada() {
  return window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
}

// ---------- 8. BOTONES ----------
// Cada botón tiene data-act="nombre". Aquí está lo que hace cada uno.
const ACCIONES = {
  "ir": function (b) { irA(b.dataset.tab); },
  "ajustes": function () { hojaAjustes(); },
  "cerrar-hoja": function () { cerrarHoja(); },
  "cerrar-capa": function () { cerrarCapa(); pintar(); },

  // Estudiar
  "tiempo": function (b) { minutosElegidos = Number(b.dataset.min); document.querySelectorAll('[data-act="tiempo"]').forEach(function (c) { c.classList.toggle("on", c === b); }); },
  "empezar": function () {
    const objetivo = $("objetivo").value.trim();
    if (!objetivo) { $("errEstudiar").textContent = "Primero dime qué quieres aprender 😉"; return; }
    empezarSesion(objetivo, leerAsig("asignatura"), minutosElegidos, null);
  },
  "empezar-plan": function (b) {
    const p = estado.planes.find(function (x) { return x.id === b.dataset.id; });
    if (!p) return;
    p.avisado = true;
    cerrarCapa();
    cancelarAvisoNube(p.id);   // ya ha empezado: no hace falta avisar
    empezarSesion(p.objetivo, p.asignatura, p.min, p.id);
  },
  "posponer": function (b) {
    const p = estado.planes.find(function (x) { return x.id === b.dataset.id; });
    const nueva = new Date(Date.now() + 10 * 60000);
    p.fecha = fechaISO(nueva);
    p.hora = String(nueva.getHours()).padStart(2, "0") + ":" + String(nueva.getMinutes()).padStart(2, "0");
    p.avisado = false;
    guardar(); cerrarCapa(); pintar();
    programarAvisoNube(p);   // cambia la hora del aviso en la nube
    toast("⏳ Vale, a las " + p.hora + ". Ni un minuto más.");
  },
  "rendirse": function () {
    if (!confirm("¿Seguro que quieres dejarlo? No contará para tu racha.")) return;
    clearInterval(relojFoco);
    estado.sesionActual = null;
    guardar();
    cerrarFoco();
    mostrarCapa('<div class="msg">' + apixSVG("cuida", "lg") + '<h1>No pasa nada</h1><p>Descansa un poco y lo intentamos otra vez. Yo te espero.</p>' +
      '<button class="btn" data-act="cerrar-capa">Vale</button></div>');
  },

  // Agenda y calendario
  "vista-agenda": function (b) { vistaAgenda = b.dataset.v; pintarAgenda(); },
  "nuevo-examen": function (b) { hojaExamen(b.dataset.fecha); },
  "guardar-examen": function () { guardarExamen(); },
  "borrar-examen": function (b) {
    if (!confirm("¿Borrar este examen?")) return;
    estado.examenes = estado.examenes.filter(function (e) { return e.id !== b.dataset.id; });
    cancelarAvisosExamenNube(b.dataset.id);
    guardar(); pintar();
  },
  "nuevo-plan": function (b) { hojaPlan(b.dataset.fecha, null); },
  "plan-de-examen": function (b) {
    const ex = estado.examenes.find(function (e) { return e.id === b.dataset.id; });
    cerrarCapa();
    hojaPlan(hoy(), ex);
  },
  "tiempo-plan": function (b) {
    document.querySelectorAll('[data-act="tiempo-plan"]').forEach(function (c) { c.classList.toggle("on", c === b); });
    $("plGuardar").dataset.min = b.dataset.min;
  },
  "guardar-plan": function (b) { guardarPlan(Number(b.dataset.min)); },
  "borrar-plan": function (b) {
    if (!confirm("¿Borrar este plan de estudio?")) return;
    estado.planes = estado.planes.filter(function (p) { return p.id !== b.dataset.id; });
    cancelarAvisoNube(b.dataset.id);
    guardar(); pintar();
  },
  "mes": function (b) { mesVista = new Date(mesVista.getFullYear(), mesVista.getMonth() + Number(b.dataset.n), 1); pintarCalendario(); },
  "dia": function (b) { diaSel = b.dataset.dia; pintarCalendario(); },

  // Avisos y datos
  "activar-avisos": function () {
    if (permisoAvisos() === "no") { toast("Este navegador no permite avisos"); return; }
    Notification.requestPermission().then(function (p) {
      cerrarCapa();
      if (p === "granted") { toast("✓ Avisos activados"); mostrarAviso("Apix 📚", "¡Hola! Así te avisaré cuando toque estudiar."); programarTodosNube(); }
      else toast("No se han activado los avisos");
      if (!$("hoja").hidden) hojaAjustes();
      pintar();
    });
  },
  "probar-aviso": function () { mostrarAviso("Apix 📚", FRASE_PALABRA); },
  "borrar-todo": function () {
    if (!confirm("Se borrarán tus exámenes, planes y sesiones. ¿Seguro?")) return;
    cancelarAvisoNube(null);
    estado = datosVacios();
    guardar(); cerrarHoja(); irA("inicio");
  }
};

// Un solo "escuchador" para todos los clics de la app
document.addEventListener("click", function (ev) {
  const pestaña = ev.target.closest("nav.tabs button");
  if (pestaña) { irA(pestaña.dataset.tab); return; }
  const boton = ev.target.closest("[data-act]");
  if (boton && ACCIONES[boton.dataset.act]) { ACCIONES[boton.dataset.act](boton); return; }
  // Tocar fuera de la hoja la cierra
  if (ev.target.id === "hoja") cerrarHoja();
});

// ---------- ARRANQUE ----------
pintar();

// Si cerraste la app en mitad de una sesión, sigue donde estaba
if (estado.sesionActual) abrirFoco();

comprobarPlanes();
setInterval(comprobarPlanes, 20000);

// Si se abrió la app tocando un aviso de Apix, enseña la pantalla del plan
function abrirDesdeAviso(planId) {
  // Aviso de examen ("ex-ID-antes" o "ex-ID-dia")
  if (planId.indexOf("ex-") === 0) {
    const e = estado.examenes.find(function (x) { return planId.indexOf("ex-" + x.id + "-") === 0; });
    if (e) { vistaAgenda = "examenes"; irA("agenda"); }
    return;
  }
  const p = estado.planes.find(function (x) { return x.id === planId; });
  if (p && !p.hecho && !estado.sesionActual) { p.avisado = true; guardar(); avisoPalabra(p); }
}
const planDelEnlace = new URLSearchParams(location.search).get("plan");
if (planDelEnlace) { abrirDesdeAviso(planDelEnlace); history.replaceState(null, "", location.pathname); }
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", function (ev) {
    if (ev.data && ev.data.plan) abrirDesdeAviso(ev.data.plan);
  });
  // Por si cambió la suscripción del móvil, volvemos a guardar los avisos pendientes
  navigator.serviceWorker.ready.then(programarTodosNube);
}
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) { comprobarPlanes(); if (!estado.sesionActual && $("foco").hidden) pintar(); }
});

// Service worker: guarda la app para que funcione sin internet y permite los avisos
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(function () { /* en local puede fallar */ });
}
