// =====================================================
// APEX STUDY · DATOS, FECHAS Y CÁLCULOS
// Lo que se guarda en el móvil, cómo se cargan y guardan los datos,
// las ayudas de fechas, los cálculos (racha, minutos...) y las asignaturas.
// No toca la pantalla: por eso se puede probar sin navegador (test/correr.js).
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
    // Copia de seguridad: cuándo se hizo la última, cuándo avisó Apix y si no quieres que te lo recuerde
    copia: { ultima: null, ultimoAviso: null, noRecordar: false },
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

// ---------- RACHA CON PROTECTOR 🛡️ ----------
// Una vez por semana (de lunes a domingo), si un día no estudias, no pierdes la racha.
// Reglas: solo salva días sueltos (el día de antes sí estudiaste) y uno por semana.
// El día salvado no suma a la racha, pero tampoco la rompe.

// Lunes de la semana de esa fecha
function lunesDe(fecha) {
  const diaSemana = new Date(fecha + "T12:00:00").getDay();   // 0 = domingo
  return sumarDias(fecha, -((diaSemana + 6) % 7));
}

// Cuenta la racha hacia atrás empezando en "dia".
// Devuelve los días estudiados y los días que salvó el protector.
function calcularRacha(dia) {
  let dias = 0;
  const salvados = [];
  const semanasUsadas = [];
  while (true) {
    if (minutosDelDia(dia) > 0) { dias++; dia = sumarDias(dia, -1); continue; }
    // Día sin estudiar: ¿lo salva el protector?
    const antes = sumarDias(dia, -1);
    const semana = lunesDe(dia);
    if (minutosDelDia(antes) > 0 && !semanasUsadas.includes(semana)) {
      semanasUsadas.push(semana);
      salvados.push(dia);
      dia = antes;
      continue;
    }
    break;   // dos días seguidos sin estudiar, o ya usaste el protector esa semana
  }
  return { dias: dias, salvados: salvados };
}

// Si hoy aún no has estudiado, la racha se cuenta desde ayer
function inicioRacha() {
  return minutosDelDia(hoy()) > 0 ? hoy() : sumarDias(hoy(), -1);
}

// Días seguidos estudiando
function rachaActual() {
  return calcularRacha(inicioRacha()).dias;
}

// Días que el protector ha salvado en la racha actual
function diasSalvados() {
  const r = calcularRacha(inicioRacha());
  return r.dias ? r.salvados : [];
}

// ¿Te queda el protector de esta semana?
function protectorDisponible() {
  const lunes = lunesDe(hoy());
  return !diasSalvados().some(function (d) { return d >= lunes; });
}

// Si has perdido la racha: ¿cuántos días seguidos tenías antes?
function rachaPerdida() {
  if (rachaActual() > 0) return 0;
  return calcularRacha(sumarDias(hoy(), -2)).dias;
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


// ---------- COPIA DE SEGURIDAD (lógica) ----------
// ¿Toca que Apix recuerde hacer copia? Una vez al mes, si tienes datos que perder
// y no has marcado "No volver a recordar".
function tocaRecordarCopia(e, fechaHoy) {
  const c = e.copia || {};
  if (c.noRecordar) return false;
  // Solo si ya hay algo que perder (al menos 5 cosas apuntadas)
  const cosas = e.sesiones.length + e.examenes.length + e.deberes.length + e.planes.length +
    e.horario.length + e.notas.length + e.tarjetas.length;
  if (cosas < 5) return false;
  if (c.ultima && diasEntre(c.ultima, fechaHoy) < 30) return false;        // hiciste copia hace menos de un mes
  if (c.ultimoAviso && diasEntre(c.ultimoAviso, fechaHoy) < 30) return false;   // ya te avisó este mes
  return true;
}

// Limpia una copia que viene de un archivo: los "id" solo pueden tener letras, números, "-" y "_".
// Así un archivo trucado no puede meter código en la app a través de los id.
function limpiarIds(datos) {
  const listas = ["examenes", "deberes", "planes", "horario", "notas", "tarjetas"];
  for (const nombre of listas) {
    if (!Array.isArray(datos[nombre])) { datos[nombre] = []; continue; }
    for (const x of datos[nombre]) {
      x.id = String(x.id || nuevoId()).replace(/[^a-zA-Z0-9_-]/g, "");
      if (x.examenId) x.examenId = String(x.examenId).replace(/[^a-zA-Z0-9_-]/g, "");
    }
  }
  if (!Array.isArray(datos.sesiones)) datos.sesiones = [];
  return datos;
}
