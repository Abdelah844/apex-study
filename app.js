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
    horario: [],     // { id, titulo, tipo, asignatura, dia, inicio, fin } (ver horario.js)
    deberes: [],     // { id, titulo, asignatura, fecha, hecho } (ver deberes.js)
    notas: [],       // { id, asignatura, nombre, nota, peso, examenId } (ver notas.js)
    objetivoNota: 5,
    nivel: "todos",      // qué estudia: "eso", "bachillerato", "fp" o "todos"
    misAsignaturas: [],  // asignaturas que añade el usuario (FP, universidad...)
    tarjetas: [],        // tarjetas de repaso (ver tarjetas.js)
    nombre: "",          // cómo se llama (lo pregunta Apix en la bienvenida)
    bienvenidaVista: false,
    sonido: "nada",      // sonido para concentrarse (ver sonidos.js)
    // Cuándo avisa Apix de exámenes y deberes (se cambia en Ajustes → Recordatorios)
    avisosConfig: { tarde: "18:00", manana: "07:30", semana: false, tresDias: true },
    avisosVistos: [],    // avisos que ya se enseñaron con la app abierta
    descanso: null,      // el descanso Pomodoro en marcha
    syncHorario: 0,
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
let vistaAgenda = "examenes";   // "examenes", "deberes", "planes" u "horario"
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
// Grupos que salen en el desplegable según lo que estudias
//   Primero "Mis asignaturas"; luego ESO y/o Bachillerato (en FP solo las tuyas)
function gruposAsignaturas() {
  const grupos = {};
  const mias = estado.misAsignaturas || [];
  if (mias.length) grupos["Mis asignaturas"] = mias;
  const nivel = estado.nivel || "todos";
  if (nivel === "eso" || nivel === "todos") grupos["ESO"] = ASIGNATURAS["ESO"];
  if (nivel === "bachillerato" || nivel === "todos") grupos["Bachillerato"] = ASIGNATURAS["Bachillerato"];
  return grupos;
}

function selectorAsig(id, valor) {
  const grupos = gruposAsignaturas();
  let conocidas = [];
  for (const g in grupos) conocidas = conocidas.concat(grupos[g]);
  const esOtra = valor && !conocidas.includes(valor);
  let html = '<select id="' + id + '" data-cambio="asig-otra">';
  html += '<option value="">Sin asignatura</option>';
  for (const grupo in grupos) {
    html += '<optgroup label="' + grupo + '">';
    for (const a of grupos[grupo]) {
      html += '<option value="' + esc(a) + '"' + (a === valor ? ' selected' : '') + '>' + esc(a) + '</option>';
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
  if (elegida === "otra") {
    const nueva = $(id + "Otra").value.trim();
    anadirMiAsignatura(nueva);   // la guardamos para que salga en la lista la próxima vez
    return nueva;
  }
  return elegida;
}

// Añade una asignatura a "Mis asignaturas" (si no estaba ya)
function anadirMiAsignatura(nombre) {
  if (!nombre) return false;
  estado.misAsignaturas = estado.misAsignaturas || [];
  const yaEsta = estado.misAsignaturas.some(function (a) { return a.toLowerCase() === nombre.toLowerCase(); });
  if (yaEsta) return false;
  estado.misAsignaturas.push(nombre);
  return true;
}

// Pulsar Intro en la caja de nueva asignatura (Ajustes) = botón Añadir
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Enter" && ev.target.id === "nuevaAsig") ACCIONES["anadir-mi-asig"]();
});

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
  const pasado = e.fecha < hoy();
  const nota = notaDeExamen(e.id);

  // Etiqueta: cuenta atrás, o la nota si ya pasó
  let pill = '<span class="pill exam">' + cuentaAtras(e.fecha) + '</span>';
  if (pasado) pill = nota ? '<span class="pill" style="color:' + colorNota(nota.nota) + '">Nota ' + formatoNota(nota.nota) + '</span>' : '<span class="pill pend">Pasado</span>';

  let botones = "";
  if (pasado && !nota) botones += '<button class="btn auto" data-act="nota-de-examen" data-id="' + e.id + '">Poner nota</button>';
  if (conBotones && !pasado) botones += '<button class="btn-sec" data-act="plan-de-examen" data-id="' + e.id + '">Planificar estudio</button>';
  if (conBotones) botones += '<button class="btn-sec" data-act="editar-examen" data-id="' + e.id + '">Editar</button>' +
    '<button class="btn-sec btn-danger" data-act="borrar-examen" data-id="' + e.id + '">Borrar</button>';

  return '<div class="item"><div class="dia-caja exam"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString("es-ES", { month: "short" }) + '</span></div>' +
    '<div class="grow"><span class="name"><span class="punto-asig" style="background:' + colorAsig(e.asignatura) + '"></span> ' + esc(e.asignatura) + '</span>' +
    '<p class="muted small">' + esc(e.tema || "Examen") + (e.hora ? ' · ' + e.hora : '') + '</p>' +
    '</div>' + pill +
    (botones ? '<div class="acciones">' + botones + '</div>' : '') + '</div>';
}

// Una fila de plan de estudio
function filaPlan(p, conBotones) {
  const st = estadoPlan(p);
  let botones = "";
  if (conBotones) {
    // Puedes ponerte a estudiar ya, aunque el plan sea para más tarde
    if (!p.hecho) botones += '<button class="btn auto" data-act="empezar-plan" data-id="' + p.id + '">▶ Estudiar</button>';
    if (!p.hecho) botones += '<button class="btn-sec" data-act="editar-plan" data-id="' + p.id + '">Editar</button>';
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
  if (apix.boton) botonApix = apix.boton;

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
    cabecera(estado.nombre ? "Hola, " + esc(estado.nombre) : "Apex Study", fechaLarga(hoy())) +
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
    tarjetaHorarioHoy() +
    tarjetaDeberesInicio() +
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
  const paraHoy = tarjetasParaHoy(null).length;
  const seg = '<div class="seg">' +
    '<button class="' + (vistaEstudiar === "sesion" ? "on" : "") + '" data-act="vista-estudiar" data-v="sesion">⏱️ Sesión</button>' +
    '<button class="' + (vistaEstudiar === "tarjetas" ? "on" : "") + '" data-act="vista-estudiar" data-v="tarjetas">🃏 Tarjetas' + (paraHoy ? ' (' + paraHoy + ')' : '') + '</button></div>';
  if (vistaEstudiar === "tarjetas") {
    $("app").innerHTML = '<div class="stack">' + cabecera("Estudiar", "Tarjetas de repaso") + seg + vistaTarjetasHTML() + '</div>';
    return;
  }
  const tiempos = [15, 25, 45, 60, 90];
  const chips = tiempos.map(function (m) {
    return '<button class="chip ' + (m === minutosElegidos ? "on" : "") + '" data-act="tiempo" data-min="' + m + '">' + m + ' min</button>';
  }).join("");
  const planesHoy = planesDelDia(hoy()).filter(function (p) { return !p.hecho; });

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Estudiar", "Sesión de concentración") + seg +
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
  } else if (vistaAgenda === "deberes") {
    contenido = vistaDeberesHTML();
  } else if (vistaAgenda === "horario") {
    contenido = vistaHorarioHTML();
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
    cabecera("Agenda", "Organiza tu semana") +
    '<div class="seg">' +
      '<button class="' + (vistaAgenda === "examenes" ? "on" : "") + '" data-act="vista-agenda" data-v="examenes">Exámenes</button>' +
      '<button class="' + (vistaAgenda === "deberes" ? "on" : "") + '" data-act="vista-agenda" data-v="deberes">Deberes</button>' +
      '<button class="' + (vistaAgenda === "planes" ? "on" : "") + '" data-act="vista-agenda" data-v="planes">Planes</button>' +
      '<button class="' + (vistaAgenda === "horario" ? "on" : "") + '" data-act="vista-agenda" data-v="horario">Horario</button>' +
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
    if (estado.deberes.some(function (x) { return x.fecha === dia && !x.hecho; })) puntos += '<i class="d"></i>';
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
    const de = estado.deberes.filter(function (x) { return x.fecha === diaSel; });
    let lista = ex.map(function (e) { return filaExamen(e, true); }).join("") +
      de.map(function (x) { return filaDeber(x, true); }).join("") +
      pl.map(function (p) { return filaPlan(p, true); }).join("");
    if (!lista) lista = '<p class="vacio">Nada apuntado este día.</p>';
    detalle = '<div class="card stack tight"><h2>' + fechaLarga(diaSel) + '</h2>' +
      (min ? '<p class="muted">✓ Estudiaste ' + min + ' min</p>' : '') +
      '<div class="list">' + lista + '</div>' +
      '<div class="tres"><button class="btn-sec" data-act="nuevo-examen" data-fecha="' + diaSel + '">+ Examen</button>' +
      '<button class="btn-sec" data-act="nuevo-deber" data-fecha="' + diaSel + '">+ Deberes</button>' +
      '<button class="btn-sec" data-act="nuevo-plan" data-fecha="' + diaSel + '">+ Plan</button></div></div>';
  }

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Calendario", "Tu mes de un vistazo") +
    '<div class="card stack">' +
      '<div class="row between"><button class="icon-btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button>' +
      '<h2>' + titulo + '</h2><button class="icon-btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>' +
      '<div class="cal">' + celdas + '</div>' +
      '<div class="leyenda"><span><i style="background:var(--exam)"></i>Examen</span><span><i style="background:var(--warn)"></i>Entrega</span><span><i style="background:var(--fire)"></i>Plan de estudio</span><span><i style="background:var(--good)"></i>Estudiaste</span></div>' +
    '</div>' + detalle + '</div>';
}

// ===== Pestaña PROGRESO =====
function pintarProgreso() {
  const seg = '<div class="seg">' +
    '<button class="' + (vistaProgreso === "estudio" ? "on" : "") + '" data-act="vista-progreso" data-v="estudio">Estudio</button>' +
    '<button class="' + (vistaProgreso === "notas" ? "on" : "") + '" data-act="vista-progreso" data-v="notas">Mis notas</button></div>';
  if (vistaProgreso === "notas") {
    $("app").innerHTML = '<div class="stack">' + cabecera("Progreso", "Tus notas") + seg + vistaNotasHTML() + '</div>';
    return;
  }
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
    cabecera("Progreso", "Tu constancia") + seg +
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

// ---------- COPIA DE SEGURIDAD ----------
// Descarga todos tus datos en un archivo .json (texto con tus datos ordenados)
function exportarDatos() {
  const texto = JSON.stringify({ app: "apex-study", version: 1, fecha: hoy(), datos: estado }, null, 2);
  const archivo = new Blob([texto], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = "apex-study-copia-" + hoy() + ".json";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  toast("💾 Copia guardada en Descargas");
}

// Lee un archivo de copia y cambia los datos actuales por los de la copia
function importarDatos(archivo) {
  const lector = new FileReader();
  lector.onload = function () {
    try {
      const copia = JSON.parse(lector.result);
      if (copia.app !== "apex-study" || !copia.datos || !Array.isArray(copia.datos.sesiones)) throw new Error("no es una copia");
      if (!confirm("Se cambiarán tus datos actuales por los de la copia del " + copia.fecha + ". ¿Seguro?")) return;
      estado = Object.assign(datosVacios(), copia.datos);
      estado.sesionActual = null;
      estado.descanso = null;
      guardar();
      cerrarHoja();
      programarTodosNube();
      irA("inicio");
      toast("📂 Copia recuperada");
    } catch (e) {
      toast("Ese archivo no es una copia de Apex Study");
    }
  };
  lector.readAsText(archivo);
}

document.addEventListener("change", function (ev) {
  if (ev.target.id === "archivoCopia" && ev.target.files[0]) importarDatos(ev.target.files[0]);
  if (ev.target.dataset.cambio === "nombre") {
    estado.nombre = ev.target.value.trim();
    guardar();
    toast("✓ Nombre guardado");
    pintar();
  }
});

// ---------- 5. FORMULARIOS (hoja inferior) ----------
function abrirHoja(html) {
  $("hoja").innerHTML = '<div class="sheet stack">' + html + '</div>';
  $("hoja").hidden = false;
}
function cerrarHoja() { $("hoja").hidden = true; $("hoja").innerHTML = ""; }

// id = examen a editar (si no hay, es uno nuevo)
function hojaExamen(fecha, id) {
  const e = id ? estado.examenes.find(function (x) { return x.id === id; }) : null;
  abrirHoja('<div class="row between"><h2>' + (e ? "Editar examen" : "Nuevo examen") + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">Asignatura' + selectorAsig("exAsig", e ? e.asignatura : "") + '</label>' +
    '<label class="f">Tema o unidad (opcional)<input id="exTema" value="' + (e ? esc(e.tema) : '') + '" placeholder="Ej: Tema 3 · Ecuaciones de segundo grado" maxlength="60"></label>' +
    '<div class="dos"><label class="f">Fecha<input id="exFecha" type="date" value="' + (e ? e.fecha : (fecha || sumarDias(hoy(), 7))) + '"></label>' +
    '<label class="f">Hora (opcional)<input id="exHora" type="time" value="' + (e ? e.hora : '') + '"></label></div>' +
    '<p class="err" id="exErr"></p>' +
    '<button class="btn" data-act="guardar-examen" data-id="' + (e ? e.id : '') + '">' + (e ? "Guardar cambios" : "Guardar examen") + '</button>');
}

// id = plan a editar (si no hay, es uno nuevo)
let antesElegido = 0;
function hojaPlan(fecha, examen, id) {
  const p = id ? estado.planes.find(function (x) { return x.id === id; }) : null;
  let objetivo = "";
  let asig = "";
  if (examen) { objetivo = "Repasar " + (examen.tema || examen.asignatura); asig = examen.asignatura; }
  if (p) { objetivo = p.objetivo; asig = p.asignatura; }
  const minutos = p ? p.min : 25;
  antesElegido = p ? (p.antes || 0) : 10;
  const tiempos = [15, 25, 45, 60, 90].map(function (m) {
    return '<button class="chip ' + (m === minutos ? "on" : "") + '" data-act="tiempo-plan" data-min="' + m + '">' + m + ' min</button>';
  }).join("");
  const antes = [[0, "Solo a la hora"], [5, "5 min antes"], [10, "10 min antes"], [30, "30 min antes"]].map(function (a) {
    return '<button class="chip ' + (a[0] === antesElegido ? "on" : "") + '" data-act="antes-plan" data-a="' + a[0] + '">' + a[1] + '</button>';
  }).join("");
  // Hora sugerida: la próxima media hora (ej: si son las 19:11, las 19:30)
  const d = new Date(Date.now() + 30 * 60000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  let horaSugerida = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  if (fecha && fecha !== hoy()) horaSugerida = "18:00";
  if (p) horaSugerida = p.hora;
  abrirHoja('<div class="row between"><h2>' + (p ? "Editar plan" : "¿Cuándo empiezas?") + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    tarjetaApix("anima", "Apix", "Cuando llegue la hora te avisaré. Si lo dices, lo cumples.", "") +
    '<label class="f">¿Qué vas a estudiar?<input id="plObj" value="' + esc(objetivo) + '" placeholder="Ej: repasar ecuaciones, gramática..." maxlength="80"></label>' +
    '<label class="f">Asignatura (opcional)' + selectorAsig("plAsig", asig) + '</label>' +
    '<div class="dos"><label class="f">Día<input id="plFecha" type="date" value="' + (p ? p.fecha : (fecha || hoy())) + '"></label>' +
    '<label class="f">Hora de empezar<input id="plHora" type="time" value="' + horaSugerida + '"></label></div>' +
    '<div><p class="label" style="margin-bottom:8px">Duración</p><div class="chips" id="plTiempos">' + tiempos + '</div></div>' +
    '<div><p class="label" style="margin-bottom:8px">Avisarme también</p><div class="chips">' + antes + '</div></div>' +
    '<p class="err" id="plErr"></p>' +
    '<button class="btn" data-act="guardar-plan" data-min="' + minutos + '" data-id="' + (p ? p.id : '') + '" id="plGuardar">' + (p ? "Guardar cambios" : "Doy mi palabra") + '</button>');
}

// ---------- RECORDATORIOS (Ajustes) ----------
function tarjetaRecordatorios() {
  const c = configAvisos();
  function interruptor(clave, texto) {
    return '<button class="interruptor ' + (c[clave] ? "on" : "") + '" data-act="cambiar-aviso" data-clave="' + clave + '"><span>' + texto + '</span><i></i></button>';
  }
  return '<div class="card stack tight"><h3>Recordatorios</h3>' +
    '<p class="muted small">Cuándo te avisa Apix de los exámenes y deberes.</p>' +
    '<div class="dos"><label class="f">El día antes a las<input id="avTarde" type="time" data-cambio="hora-aviso" value="' + c.tarde + '"></label>' +
    '<label class="f">El mismo día a las<input id="avManana" type="time" data-cambio="hora-aviso" value="' + c.manana + '"></label></div>' +
    interruptor("tresDias", "Avisar 3 días antes del examen") +
    interruptor("semana", "Avisar 1 semana antes del examen") +
    '</div>';
}

// Al cambiar los ajustes, se vuelven a programar todos los avisos con las horas nuevas
function guardarConfigAvisos(cambios) {
  estado.avisosConfig = Object.assign(configAvisos(), cambios);
  guardar();
  for (const e of proximosExamenes()) programarAvisosExamenNube(e);
  for (const d of deberesPendientes()) programarAvisosDeber(d);
}

document.addEventListener("change", function (ev) {
  if (ev.target.dataset.cambio === "hora-aviso" && ev.target.value) {
    guardarConfigAvisos({ tarde: $("avTarde").value || "18:00", manana: $("avManana").value || "07:30" });
    toast("✓ Recordatorios actualizados");
  }
});

// ---------- MODO CLARO / OSCURO ----------
// "auto" sigue al móvil; "claro" u "oscuro" lo fuerza. Se guarda aparte de los datos.
function temaGuardado() {
  try { return localStorage.getItem("apex-study-tema") || "auto"; } catch (e) { return "auto"; }
}

function ponerTema(tema) {
  try { localStorage.setItem("apex-study-tema", tema); } catch (e) { /* no pasa nada */ }
  if (tema === "auto") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
  // Color de la barra de arriba del móvil
  const oscuro = tema === "oscuro" || (tema === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", oscuro ? "#08080C" : "#F4F3F8");
}

function hojaAjustes() {
  let avisos;
  const permiso = permisoAvisos();
  if (permiso === "granted") avisos = '<p class="small">✓ Avisos activados</p><div class="dos"><button class="btn-sec" data-act="probar-aviso">Probar aviso</button>' +
    '<button class="btn-sec" data-act="diagnostico-avisos">Probar con la app cerrada</button></div>';
  else if (permiso === "denied") avisos = '<p class="muted small">Has bloqueado los avisos. Actívalos en los ajustes del navegador para esta página.</p>';
  else if (permiso === "no") avisos = '<p class="muted small">Este navegador no permite avisos. En iPhone, primero añade la app a la pantalla de inicio.</p>';
  else avisos = '<button class="btn" data-act="activar-avisos">Activar avisos de Apix</button>';

  // Qué estudias
  const niveles = [["eso", "ESO"], ["bachillerato", "Bachillerato"], ["fp", "FP"], ["todos", "Otro"]].map(function (n) {
    return '<button class="' + ((estado.nivel || "todos") === n[0] ? "on" : "") + '" data-act="nivel" data-n="' + n[0] + '">' + n[1] + '</button>';
  }).join("");
  const mias = estado.misAsignaturas || [];
  const listaMias = mias.map(function (a, i) {
    return '<div class="item"><span class="punto-asig" style="background:' + colorAsig(a) + '"></span><span class="name grow">' + esc(a) + '</span>' +
      '<button class="icon-btn mini" data-act="borrar-mi-asig" data-i="' + i + '" aria-label="Quitar">×</button></div>';
  }).join("");
  let ayuda = "Además de estas, verás las de ESO y Bachillerato.";
  if (estado.nivel === "eso") ayuda = "Además de estas, verás las de la ESO.";
  if (estado.nivel === "bachillerato") ayuda = "Además de estas, verás las de Bachillerato.";
  if (estado.nivel === "fp") ayuda = "En FP solo verás las que añadas aquí (los módulos de tu ciclo).";

  abrirHoja('<div class="row between"><h2>Ajustes</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<div class="card stack tight"><h3>Tu nombre</h3><input id="ajNombre" data-cambio="nombre" maxlength="20" placeholder="¿Cómo te llamas?" value="' + esc(estado.nombre || "") + '"></div>' +
    '<div class="card stack tight"><h3>¿Qué estudias?</h3><div class="seg">' + niveles + '</div></div>' +
    '<div class="card stack tight"><h3>Mis asignaturas</h3>' +
      '<p class="muted small">' + ayuda + '</p>' +
      (listaMias ? '<div class="list">' + listaMias + '</div>' : '') +
      '<div class="row"><input id="nuevaAsig" class="grow" placeholder="' + (estado.nivel === "fp" ? "Ej: Redes Locales" : "Ej: Robótica") + '" maxlength="40">' +
      '<button class="btn auto" data-act="anadir-mi-asig">Añadir</button></div>' +
      '<p class="err" id="asigErr"></p></div>' +
    '<div class="card stack tight"><h3>Apariencia</h3>' +
      '<div class="seg">' +
        ['auto', 'claro', 'oscuro'].map(function (t) {
          const texto = { auto: "Automático", claro: "☀️ Claro", oscuro: "🌙 Oscuro" }[t];
          return '<button class="' + (temaGuardado() === t ? "on" : "") + '" data-act="tema" data-tema="' + t + '">' + texto + '</button>';
        }).join("") +
      '</div><p class="muted small">Automático usa el mismo modo que tu móvil.</p></div>' +
    tarjetaRecordatorios() +
    '<div class="card stack tight"><h3>Calendario del móvil y widget</h3>' +
      '<p class="muted small">El móvil no deja que una web tenga widget, pero su Calendario sí. Añade allí tus exámenes, deberes, planes y horario (con alarmas que suenan aunque Apex Study esté cerrada) y pon el widget del Calendario en tu pantalla de inicio.</p>' +
      '<button class="btn-sec full" data-act="exportar-calendario">📲 Añadir al calendario del móvil</button>' +
      '<p class="muted small">Si cambias algo, vuelve a pulsarlo para actualizarlo.</p></div>' +
    '<div class="card stack tight"><h3>Avisos</h3><p class="muted small">Apix te avisará cuando llegue la hora de empezar a estudiar.</p>' + avisos + '</div>' +
    // Cómo instalarla: solo sale si aún la usas desde el navegador
    (appInstalada() ? '' : '<div class="card stack tight"><h3>Instalar en el móvil</h3>' +
      '<p class="muted small">En Android (Chrome): menú ⋮ → «Instalar aplicación». En iPhone (Safari): Compartir → «Añadir a pantalla de inicio».</p></div>') +
    '<div class="card stack tight"><h3>Tus datos</h3><p class="muted small">Se guardan solo en este móvil. Haz una copia de vez en cuando por si lo cambias o se borra.</p>' +
      '<div class="dos"><button class="btn-sec" data-act="exportar">💾 Guardar copia</button>' +
      '<button class="btn-sec" data-act="importar">📂 Recuperar copia</button></div>' +
      '<input type="file" id="archivoCopia" accept=".json,application/json" hidden>' +
      '<button class="btn-sec btn-danger" data-act="borrar-todo">Borrar todos los datos</button></div>');
}

// Lee los datos del formulario de examen
function guardarExamen(id) {
  const asignatura = leerAsig("exAsig");
  const fecha = $("exFecha").value;
  if (!asignatura) { $("exErr").textContent = "Elige la asignatura."; return; }
  if (!fecha) { $("exErr").textContent = "Elige la fecha."; return; }
  const datos = { asignatura: asignatura, tema: $("exTema").value.trim(), fecha: fecha, hora: $("exHora").value };
  let examen;
  if (id) {
    examen = estado.examenes.find(function (x) { return x.id === id; });
    Object.assign(examen, datos);
    toast("✓ Examen cambiado");
  } else {
    examen = Object.assign({ id: nuevoId() }, datos);
    estado.examenes.push(examen);
    toast("📅 Examen apuntado");
  }
  guardar(); cerrarHoja();
  programarAvisosExamenNube(examen);   // pone (o cambia) sus avisos
  pintar();
}

function guardarPlan(minutos, id) {
  const objetivo = $("plObj").value.trim();
  const fecha = $("plFecha").value;
  const hora = $("plHora").value;
  if (!objetivo) { $("plErr").textContent = "Escribe qué vas a estudiar."; return; }
  if (!fecha || !hora) { $("plErr").textContent = "Elige el día y la hora."; return; }
  const datos = { objetivo: objetivo, asignatura: leerAsig("plAsig"), fecha: fecha, hora: hora, min: minutos, antes: antesElegido, avisado: false };
  if (new Date(fecha + "T" + hora + ":00") < new Date(Date.now() - 60000)) { $("plErr").textContent = "Esa hora ya ha pasado. Elige una futura."; return; }
  let plan;
  if (id) {
    plan = estado.planes.find(function (x) { return x.id === id; });
    Object.assign(plan, datos);
  } else {
    plan = Object.assign({ id: nuevoId(), hecho: false }, datos);
    estado.planes.push(plan);
  }
  guardar(); cerrarHoja();
  programarAvisoPlan(plan);   // para que avise aunque la app esté cerrada
  pintar();
  if (id) { toast("✓ Plan cambiado: " + fechaCorta(fecha) + " a las " + hora); return; }
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
    botonesSonido() +
    '<button class="btn-sec" data-act="rendirse">Me rindo</button></div>';
  focoHumor = "";
  sonar(estado.sonido || "nada");
  actualizarFoco();
  clearInterval(relojFoco);
  relojFoco = setInterval(actualizarFoco, 1000);   // se repite cada segundo
}

let focoHumor = "";
let rondasSeguidas = 0;   // sesiones seguidas (cada 4, el descanso es largo)
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
  if (plan) { plan.hecho = true; cancelarAvisosPlan(plan.id); }

  estado.sesionActual = null;
  rondasSeguidas++;
  estado.mejorRacha = Math.max(estado.mejorRacha, rachaActual());
  guardar();
  cerrarFoco();
  confeti();
  vibrar([120, 60, 120]);
  mostrarAviso("Apix 🎉", "¡Objetivo cumplido! " + s.min + " min de " + s.objetivo + ".");

  let extra = s.distracciones ? "Saliste " + s.distracciones + (s.distracciones === 1 ? " vez" : " veces") + ". La próxima, a por 0." : "¡Sin salir ni una vez! Eres una máquina.";
  if (plan) extra = "Has cumplido tu palabra. " + extra;
  mostrarCapa('<div class="msg">' + apixSVG("campeon", "xl") + '<p class="label">Sesión completada</p><h1>¡Objetivo cumplido!</h1>' +
    '<p><b>' + s.min + ' min</b> de «' + esc(s.objetivo) + '»</p><p class="muted">' + extra + '</p>' +
    '<p class="big-num">🔥 ' + rachaActual() + ' ' + (rachaActual() === 1 ? "día" : "días") + '</p>' +
    botonesDescanso(s) + '</div>');
}

// =====================================================
// DESCANSOS POMODORO
// Después de cada sesión, 5 minutos de descanso. Cada 4 sesiones, 15.
// Al acabar el descanso, Apix te llama para seguir (aunque la app esté cerrada).
// =====================================================
function minutosDescanso() { return rondasSeguidas % 4 === 0 ? 15 : 5; }

function botonesDescanso(s) {
  const min = minutosDescanso();
  return '<button class="btn" data-act="empezar-descanso" data-min="' + min + '" data-objetivo="' + esc(s.objetivo) + '" data-asig="' + esc(s.asignatura || "") + '" data-estudio="' + s.min + '">☕ Descanso de ' + min + ' min</button>' +
    (min === 15 ? '<p class="muted small">Llevas 4 sesiones seguidas: te toca un descanso largo 💜</p>' : '') +
    '<button class="btn-sec full" data-act="terminar-por-hoy">Terminar por hoy</button>';
}

function empezarDescanso(min, objetivo, asignatura, minEstudio) {
  estado.descanso = { fin: Date.now() + min * 60000, min: min, objetivo: objetivo, asignatura: asignatura, minEstudio: minEstudio };
  guardar();
  cerrarCapa();
  // Aviso desde la nube por si cierras la app durante el descanso
  avisoNube("descanso", new Date(estado.descanso.fin), "Apix ☕", "¡Se acabó el descanso! Vuelve a «" + objetivo + "».");
  abrirDescanso();
}

function abrirDescanso() {
  $("tabs").hidden = true;
  $("foco").hidden = false;
  $("foco").innerHTML = '<div class="in">' +
    '<p class="label">Descanso</p><p class="objetivo">☕ ' + estado.descanso.min + ' minutos</p>' +
    '<div id="focoApix"></div>' +
    '<div class="bocadillo"><p id="focoFrase"></p></div>' +
    '<div class="anillo descanso"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="fondo"/><circle cx="50" cy="50" r="44" class="avance" id="focoAnillo" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><span class="t num" id="focoReloj">--:--</span></div>' +
    '<button class="btn-sec" data-act="saltar-descanso">Saltar descanso</button></div>';
  focoHumor = "";
  ponerApixFoco("descanso", "Respira, bebe agua y estira las piernas. Nada de redes, que luego cuesta volver 😉");
  actualizarDescanso();
  clearInterval(relojFoco);
  relojFoco = setInterval(actualizarDescanso, 1000);
}

function actualizarDescanso() {
  const d = estado.descanso;
  if (!d) return;
  const total = d.min * 60;
  const restantes = Math.max(0, Math.round((d.fin - Date.now()) / 1000));
  if (restantes <= 0) { terminarDescanso(true); return; }
  $("focoReloj").textContent = String(Math.floor(restantes / 60)).padStart(2, "0") + ":" + String(restantes % 60).padStart(2, "0");
  $("focoAnillo").setAttribute("stroke-dashoffset", (276.5 * (total - restantes) / total).toFixed(1));
  if (restantes <= 30) ponerApixFoco("anima", "¡Últimos segundos! Prepárate para volver.");
}

// porTiempo = true si el descanso acabó solo; false si lo has saltado
function terminarDescanso(porTiempo) {
  clearInterval(relojFoco);
  const d = estado.descanso;
  estado.descanso = null;
  guardar();
  if (!porTiempo) cancelarAvisoNube("descanso");
  else mostrarAviso("Apix ☕", "¡Se acabó el descanso! Vuelve a «" + d.objetivo + "».", "descanso");
  cerrarFoco();
  mostrarCapa('<div class="msg">' + apixSVG("anima", "xl") + '<p class="label">Apix</p><h1>¡Vuelta al estudio!</h1>' +
    '<p>¿Otra sesión de «' + esc(d.objetivo) + '»?</p>' +
    '<button class="btn" data-act="otra-sesion" data-objetivo="' + esc(d.objetivo) + '" data-asig="' + esc(d.asignatura || "") + '" data-min="' + d.minEstudio + '">Otra sesión de ' + d.minEstudio + ' min</button>' +
    '<button class="btn-sec full" data-act="terminar-por-hoy">Terminar por hoy</button></div>');
}

function cerrarFoco() {
  pararSonido();
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
  if (estado.sesionActual || estado.descanso || repaso) return;
  if (!$("capa").hidden) return;   // ya hay un aviso en pantalla
  comprobarExamenes();
  if (!$("capa").hidden) return;
  if (comprobarDeberes()) return;
  if (comprobarHorario()) return;
  const ahora = Date.now();
  // Aviso "X min antes" (solo un mensajito, sin pantalla grande)
  for (const p of estado.planes) {
    if (p.hecho || !p.antes) continue;
    if (yaToca(p.id + "-antes", new Date(fechaHoraPlan(p).getTime() - p.antes * 60000))) {
      mostrarAviso("Apix ⏰", "En " + p.antes + " min empiezas «" + p.objetivo + "».", "plan-" + p.id + "-antes");
      toast("⏰ En " + p.antes + " min empiezas «" + p.objetivo + "»");
    }
  }
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
    if (r.ok) return;
    // Si falla, leemos el mensaje de error para poder enseñarlo
    return r.text().then(function (texto) { throw new Error("Supabase " + r.status + ": " + texto.slice(0, 200)); });
  });
}

// =====================================================
// DIAGNÓSTICO DE AVISOS
// Comprueba paso a paso si los avisos con la app cerrada pueden funcionar
// y programa uno de prueba para dentro de 2 minutos.
// =====================================================
async function diagnosticoAvisos() {
  const pasos = [];
  function paso(ok, texto) { pasos.push((ok ? "✅ " : "❌ ") + texto); pintarPasos(); return ok; }
  function pintarPasos() {
    mostrarCapa('<div class="msg">' + apixSVG("estudia", "lg") + '<h1>Revisando avisos</h1>' +
      '<div class="card diag">' + pasos.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join("") + '</div>' +
      '<button class="btn-sec full" data-act="cerrar-capa">Cerrar</button></div>');
  }

  if (!paso(permisoAvisos() === "granted", "Permiso de avisos: " + permisoAvisos())) return;
  const esIphone = /iPhone|iPad/.test(navigator.userAgent);
  if (esIphone && !paso(appInstalada(), "En iPhone hay que abrirla desde el icono de la pantalla de inicio")) return;
  if (!paso("serviceWorker" in navigator && "PushManager" in window, "El móvil admite avisos push")) return;

  let sub;
  try {
    const reg = await navigator.serviceWorker.ready;
    paso(true, "Service worker activo");
    sub = await suscripcionPush();
    if (!paso(!!sub, "Dirección de avisos del móvil")) return;
    paso(true, "Servicio de avisos: " + new URL(sub.endpoint).host);
  } catch (e) {
    paso(false, "Error al crear la dirección de avisos: " + e.message);
    return;
  }

  try {
    const cuando = new Date(Date.now() + 2 * 60000);
    await llamarSupabase("study_programar_aviso", {
      p_endpoint: sub.endpoint, p_suscripcion: sub, p_plan: "prueba",
      p_cuando: cuando.toISOString(), p_titulo: "Apix 🔔", p_cuerpo: "¡Si ves esto con la app cerrada, los avisos funcionan!"
    });
    paso(true, "Aviso de prueba guardado en Supabase para las " + cuando.toTimeString().slice(0, 5));
    paso(true, "Ahora CIERRA la app del todo y espera 2 minutos.");
  } catch (e) {
    paso(false, "No se pudo guardar en Supabase → " + e.message);
  }
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

// Guarda en Supabase un aviso cualquiera: clave única, cuándo, título y texto
async function avisoNube(clave, cuando, titulo, cuerpo) {
  if (cuando <= new Date()) return;   // esa hora ya pasó
  try {
    const sub = await suscripcionPush();
    if (!sub) return;
    await llamarSupabase("study_programar_aviso", {
      p_endpoint: sub.endpoint, p_suscripcion: sub, p_plan: clave,
      p_cuando: cuando.toISOString(), p_titulo: titulo, p_cuerpo: cuerpo
    });
  } catch (e) {
    console.warn("No se pudo programar el aviso en la nube:", e);
  }
}

// ¿Ha llegado la hora de este aviso y aún no lo hemos enseñado? (con la app abierta)
function yaToca(clave, cuando) {
  const ahora = Date.now();
  const hora = cuando.getTime();
  estado.avisosVistos = estado.avisosVistos || [];
  if (ahora < hora || ahora - hora > 2 * 3600000) return false;
  if (estado.avisosVistos.includes(clave)) return false;
  estado.avisosVistos.push(clave);
  estado.avisosVistos = estado.avisosVistos.slice(-300);   // guardamos solo los últimos
  guardar();
  return true;
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
    if (!p.hecho && fechaHoraPlan(p) > ahora) programarAvisoPlan(p);
  }
  for (const e of estado.examenes) programarAvisosExamenNube(e);
  for (const d of estado.deberes) programarAvisosDeber(d);
  programarHorarioNube();
}

// ---------- AVISOS DE EXAMEN ----------
// Cada examen tiene 2 avisos: el día antes a las 18:00 y el mismo día a las 07:30
// Ajustes de los recordatorios (con valores por defecto si faltan)
function configAvisos() {
  return Object.assign({ tarde: "18:00", manana: "07:30", semana: false, tresDias: true }, estado.avisosConfig || {});
}

// Todos los avisos posibles de un examen; "activo" dice si están encendidos en Ajustes
function avisosDeExamen(e) {
  const c = configAvisos();
  const nombre = e.asignatura + (e.tema ? " (" + e.tema + ")" : "");
  return [
    { clave: "ex-" + e.id + "-7d", activo: c.semana, cuando: new Date(sumarDias(e.fecha, -7) + "T" + c.tarde + ":00"),
      texto: "Dentro de una semana tienes examen de " + nombre + ". Buen momento para empezar a repasar." },
    { clave: "ex-" + e.id + "-3d", activo: c.tresDias, cuando: new Date(sumarDias(e.fecha, -3) + "T" + c.tarde + ":00"),
      texto: "Faltan 3 días para el examen de " + nombre + ". ¿Planificamos cuándo estudias?" },
    { clave: "ex-" + e.id + "-antes", activo: true, cuando: new Date(sumarDias(e.fecha, -1) + "T" + c.tarde + ":00"),
      texto: "Mañana tienes examen de " + nombre + ". ¿Has repasado? Aún estás a tiempo." },
    { clave: "ex-" + e.id + "-dia", activo: true, cuando: new Date(e.fecha + "T" + c.manana + ":00"),
      texto: "Hoy es el examen de " + nombre + (e.hora ? " a las " + e.hora : "") + ". ¡Tú puedes!" }
  ];
}

// Guarda en Supabase los avisos del examen que aún no han pasado
// Guarda en Supabase los avisos del examen. Los apagados o ya pasados se quitan
// (por si cambiaste la fecha o los ajustes y quedaba uno viejo).
function programarAvisosExamenNube(e) {
  for (const a of avisosDeExamen(e)) {
    if (a.activo && a.cuando > new Date()) avisoNube(a.clave, a.cuando, "Apix 📅", a.texto);
    else cancelarAvisoNube(a.clave);
  }
}

function cancelarAvisosExamenNube(id) {
  for (const fin of ["-7d", "-3d", "-antes", "-dia"]) cancelarAvisoNube("ex-" + id + fin);
}

// Avisos de un plan: a la hora y, si quieres, unos minutos antes
function programarAvisoPlan(p) {
  if (p.hecho) return;
  programarAvisoNube(p);
  const antes = new Date(fechaHoraPlan(p).getTime() - (p.antes || 0) * 60000);
  if (p.antes && antes > new Date()) {
    avisoNube(p.id + "-antes", antes, "Apix ⏰", "En " + p.antes + " min empiezas «" + p.objetivo + "». Ve preparando tus cosas.");
  } else {
    cancelarAvisoNube(p.id + "-antes");
  }
}

function cancelarAvisosPlan(id) {
  cancelarAvisoNube(id);
  cancelarAvisoNube(id + "-antes");
}

// Con la app abierta: si ha llegado la hora de un aviso de examen, lo enseña
function comprobarExamenes() {
  const ahora = Date.now();
  estado.avisosVistos = estado.avisosVistos || [];
  for (const e of estado.examenes) {
    for (const a of avisosDeExamen(e)) {
      if (!a.activo) continue;
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
  "tema": function (b) { ponerTema(b.dataset.tema); hojaAjustes(); },
  "exportar": function () { exportarDatos(); },
  "exportar-calendario": function () { exportarCalendario(); },
  "cambiar-aviso": function (b) {
    const clave = b.dataset.clave;
    const cambio = {};
    cambio[clave] = !configAvisos()[clave];
    guardarConfigAvisos(cambio);
    b.classList.toggle("on", cambio[clave]);
  },
  "importar": function () { $("archivoCopia").click(); },
  "nivel": function (b) { estado.nivel = b.dataset.n; guardar(); hojaAjustes(); },
  "anadir-mi-asig": function () {
    const nombre = $("nuevaAsig").value.trim();
    if (!nombre) { $("asigErr").textContent = "Escribe el nombre de la asignatura."; return; }
    if (!anadirMiAsignatura(nombre)) { $("asigErr").textContent = "Esa ya la tienes."; return; }
    guardar(); hojaAjustes();
    toast("📘 " + nombre + " añadida");
    setTimeout(function () { if ($("nuevaAsig")) $("nuevaAsig").focus(); }, 50);   // para añadir otra seguida
  },
  "borrar-mi-asig": function (b) {
    const nombre = estado.misAsignaturas[Number(b.dataset.i)];
    if (!confirm("¿Quitar «" + nombre + "» de tu lista? (Lo que ya hayas apuntado con ella se queda)")) return;
    estado.misAsignaturas.splice(Number(b.dataset.i), 1);
    guardar(); hojaAjustes();
  },
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
    cancelarAvisosPlan(p.id);   // ya ha empezado: no hace falta avisar
    empezarSesion(p.objetivo, p.asignatura, p.min, p.id);
  },
  "posponer": function (b) {
    const p = estado.planes.find(function (x) { return x.id === b.dataset.id; });
    const nueva = new Date(Date.now() + 10 * 60000);
    p.fecha = fechaISO(nueva);
    p.hora = String(nueva.getHours()).padStart(2, "0") + ":" + String(nueva.getMinutes()).padStart(2, "0");
    p.avisado = false;
    guardar(); cerrarCapa(); pintar();
    programarAvisoPlan(p);   // cambia la hora del aviso en la nube
    toast("⏳ Vale, a las " + p.hora + ". Ni un minuto más.");
  },
  "empezar-descanso": function (b) { empezarDescanso(Number(b.dataset.min), b.dataset.objetivo, b.dataset.asig, Number(b.dataset.estudio)); },
  "saltar-descanso": function () { terminarDescanso(false); },
  "otra-sesion": function (b) { cerrarCapa(); empezarSesion(b.dataset.objetivo, b.dataset.asig, Number(b.dataset.min), null); },
  "terminar-por-hoy": function () {
    rondasSeguidas = 0;
    cerrarCapa(); pintar();
    toast("💜 Buen trabajo hoy. ¡Hasta mañana!");
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
  "nuevo-examen": function (b) { hojaExamen(b.dataset.fecha, null); },
  "guardar-examen": function (b) { guardarExamen(b.dataset.id); },
  "editar-examen": function (b) { hojaExamen(null, b.dataset.id); },
  "editar-plan": function (b) { hojaPlan(null, null, b.dataset.id); },
  "antes-plan": function (b) {
    antesElegido = Number(b.dataset.a);
    document.querySelectorAll('[data-act="antes-plan"]').forEach(function (c) { c.classList.toggle("on", c === b); });
  },
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
  "guardar-plan": function (b) { guardarPlan(Number(b.dataset.min), b.dataset.id); },
  "borrar-plan": function (b) {
    if (!confirm("¿Borrar este plan de estudio?")) return;
    estado.planes = estado.planes.filter(function (p) { return p.id !== b.dataset.id; });
    cancelarAvisosPlan(b.dataset.id);
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
  "diagnostico-avisos": function () { cerrarHoja(); diagnosticoAvisos(); },
  "borrar-todo": function () {
    if (!confirm("Se borrarán tus exámenes, planes y sesiones. ¿Seguro?")) return;
    cancelarAvisoNube(null);
    estado = datosVacios();
    guardar(); cerrarHoja(); irA("inicio");
  }
};

// Añadimos los botones del horario semanal (están en horario.js)
Object.assign(ACCIONES, ACCIONES_HORARIO, ACCIONES_DEBERES, ACCIONES_NOTAS, ACCIONES_TARJETAS, ACCIONES_SONIDOS, ACCIONES_BIENVENIDA);

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
ponerTema(temaGuardado());
pintar();

// Si cerraste la app en mitad de una sesión o de un descanso, sigue donde estaba
if (estado.sesionActual) abrirFoco();
else if (estado.descanso) abrirDescanso();
else if (!estado.bienvenidaVista) abrirBienvenida();   // primera vez: Apix se presenta

comprobarPlanes();
setInterval(comprobarPlanes, 20000);

// Si se abrió la app tocando un aviso de Apix, enseña la pantalla del plan
function abrirDesdeAviso(planId) {
  if (planId === "descanso") return;   // ya lo gestiona el arranque
  if (planId.indexOf("deb-") === 0) { vistaAgenda = "deberes"; irA("agenda"); return; }
  if (planId.indexOf("hor-") === 0) {
    const b = (estado.horario || []).find(function (x) { return planId.indexOf("hor-" + x.id + "-") === 0; });
    if (b && esAhora(b) && !estado.sesionActual) avisoBloque(b);
    else { vistaAgenda = "horario"; irA("agenda"); }
    return;
  }
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
  // Por si cambió la suscripción del móvil, volvemos a guardar los avisos pendientes.
  // Solo una vez cada 12 horas (antes se hacía siempre y con mala cobertura se atascaba)
  navigator.serviceWorker.ready.then(function () {
    const ultima = Number(localStorage.getItem("apex-study-sync") || 0);
    if (Date.now() - ultima < 12 * 3600000) return;
    localStorage.setItem("apex-study-sync", String(Date.now()));
    setTimeout(programarTodosNube, 3000);   // un poco después de abrir, para no frenar el arranque
  }).catch(function () {});

  // Cuando se instala una versión nueva: si acabas de abrir la app y no estás haciendo nada, recargamos
  const abiertaEn = Date.now();
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    const ocupado = estado.sesionActual || estado.descanso || repaso || !$("hoja").hidden || !$("capa").hidden;
    if (!ocupado && Date.now() - abiertaEn < 15000) location.reload();
  });
}
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) {
    // Si el descanso acabó mientras estabas fuera
    if (estado.descanso && Date.now() >= estado.descanso.fin) { terminarDescanso(true); return; }
    comprobarPlanes();
    if (!estado.sesionActual && $("foco").hidden) pintar();
  }
});

// Service worker: guarda la app para que funcione sin internet y permite los avisos
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(function () { /* en local puede fallar */ });
}
