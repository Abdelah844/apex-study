// =====================================================
// APEX STUDY · HORARIO SEMANAL
// Cada bloque del horario es algo que se repite todas las semanas:
//   { id, titulo, tipo, asignatura, dia, inicio, fin }
//   dia: 0 = lunes ... 6 = domingo · inicio y fin: "16:00"
// Se guarda en estado.horario (junto con el resto de datos).
// =====================================================

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

// Tipos de bloque: cada uno con su icono y color
const TIPOS = {
  clase:    { nombre: "Clase",    icono: "🏫", color: "#4DB8FF" },
  estudio:  { nombre: "Estudio",  icono: "📚", color: "#9B7EFF" },
  deberes:  { nombre: "Deberes",  icono: "✏️", color: "#FF8A3D" },
  deporte:  { nombre: "Deporte",  icono: "🏃", color: "#3CE0A0" },
  descanso: { nombre: "Descanso", icono: "😴", color: "#FFC94D" },
  otro:     { nombre: "Otro",     icono: "📌", color: "#C77DFF" }
};

let vistaHorario = "dia";           // "dia" o "semana"
let diaHorario = diaDeHoy();        // día que se está viendo (0-6)

// Día de la semana de hoy (0 = lunes)
function diaDeHoy() { return (new Date().getDay() + 6) % 7; }

// Pasa "16:30" a minutos (990) para poder comparar y restar horas
function aMinutos(hora) {
  const partes = hora.split(":");
  return Number(partes[0]) * 60 + Number(partes[1]);
}

function minutosAhora() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Bloques de un día, ordenados por hora
function bloquesDelDia(dia) {
  return (estado.horario || [])
    .filter(function (b) { return b.dia === dia; })
    .sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
}

// ¿Este bloque está pasando ahora mismo?
function esAhora(b) {
  const ahora = minutosAhora();
  return b.dia === diaDeHoy() && ahora >= aMinutos(b.inicio) && ahora < aMinutos(b.fin);
}

// Duración en texto: "1 h 30 min"
function duracionTexto(b) {
  const min = aMinutos(b.fin) - aMinutos(b.inicio);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return h + " h " + m + " min";
  if (h) return h + " h";
  return m + " min";
}

// ---------- Una fila de bloque ----------
// modo: "completo" (con Editar y Borrar) o "inicio" (solo el botón Empezar)
function filaBloque(b, modo) {
  const t = TIPOS[b.tipo] || TIPOS.otro;
  const ahora = esAhora(b);
  let botones = "";
  if (ahora && (b.tipo === "estudio" || b.tipo === "deberes")) {
    botones += '<button class="btn auto" data-act="empezar-bloque" data-id="' + b.id + '">Empezar</button>';
  }
  if (modo === "completo") {
    botones += '<button class="btn-sec" data-act="editar-bloque" data-id="' + b.id + '">Editar</button>' +
               '<button class="btn-sec btn-danger" data-act="borrar-bloque" data-id="' + b.id + '">Borrar</button>';
  }
  return '<div class="item bloque' + (ahora ? ' ahora' : '') + '" style="--color-bloque:' + t.color + '">' +
    '<div class="dia-caja hora-caja"><b>' + b.inicio + '</b><span>' + b.fin + '</span></div>' +
    '<div class="grow"><span class="name">' + t.icono + ' ' + esc(b.titulo) + '</span>' +
    '<p class="muted small">' + t.nombre + (b.asignatura ? ' · ' + esc(b.asignatura) : '') + ' · ' + duracionTexto(b) + '</p></div>' +
    (ahora ? '<span class="pill ok">Ahora</span>' : '') +
    (botones ? '<div class="acciones">' + botones + '</div>' : '') + '</div>';
}

// ---------- Vista del horario (dentro de Agenda) ----------
function vistaHorarioHTML() {
  const total = (estado.horario || []).length;

  // Cuántas horas de estudio y deberes hay en la semana
  let minEstudio = 0;
  for (const b of estado.horario || []) {
    if (b.tipo === "estudio" || b.tipo === "deberes") minEstudio += aMinutos(b.fin) - aMinutos(b.inicio);
  }

  let html = '<div class="seg">' +
    '<button class="' + (vistaHorario === "dia" ? "on" : "") + '" data-act="vista-horario" data-v="dia">Por días</button>' +
    '<button class="' + (vistaHorario === "semana" ? "on" : "") + '" data-act="vista-horario" data-v="semana">Semana entera</button></div>';

  if (vistaHorario === "dia") {
    // Botones de los días con un puntito si ese día tiene algo
    let chips = "";
    for (let d = 0; d < 7; d++) {
      const clases = (d === diaHorario ? "on " : "") + (d === diaDeHoy() ? "hoy" : "");
      const punto = bloquesDelDia(d).length ? '<i></i>' : '';
      chips += '<button class="dia-chip ' + clases + '" data-act="dia-horario" data-d="' + d + '">' + DIAS_CORTOS[d] + punto + '</button>';
    }
    const bloques = bloquesDelDia(diaHorario);
    html += '<div class="dias-chips">' + chips + '</div>' +
      '<div class="card"><div class="row between"><h2>' + DIAS[diaHorario] + (diaHorario === diaDeHoy() ? ' · hoy' : '') + '</h2>' +
      (bloques.length ? '<button class="btn-txt" data-act="copiar-dia">Copiar día</button>' : '') + '</div>' +
      '<div class="list">' + (bloques.length ? bloques.map(function (b) { return filaBloque(b, "completo"); }).join("") :
        '<p class="vacio">Nada este día. Añade tus clases, ratos de estudio, deporte…</p>') + '</div></div>';
  } else {
    html += total ? semanaHTML() : '<div class="card"><p class="vacio">Tu semana está vacía. Añade tu primer bloque.</p></div>';
  }

  html += '<button class="btn" data-act="nuevo-bloque">+ Añadir al horario</button>';
  if (minEstudio) {
    html += '<p class="muted small" style="text-align:center">📚 Esta semana tienes <b>' + (minEstudio / 60).toFixed(1).replace(".", ",") + ' h</b> de estudio y deberes en tu horario.</p>';
  }
  return html;
}

// ---------- Vista "Semana entera": rejilla con los 7 días ----------
function semanaHTML() {
  // Desde la hora del bloque más temprano hasta la del más tardío
  let primera = 24 * 60, ultima = 0;
  for (const b of estado.horario) {
    primera = Math.min(primera, aMinutos(b.inicio));
    ultima = Math.max(ultima, aMinutos(b.fin));
  }
  const desde = Math.floor(primera / 60);      // hora entera de inicio
  const hasta = Math.ceil(ultima / 60);        // hora entera de fin
  const PX_HORA = 46;                          // alto de cada hora en píxeles
  const alto = (hasta - desde) * PX_HORA;

  // Cabecera con los días
  let html = '<div class="card sg"><div class="sg-cab"><span></span>';
  for (let d = 0; d < 7; d++) html += '<span class="' + (d === diaDeHoy() ? "hoy" : "") + '">' + DIAS_CORTOS[d] + '</span>';
  html += '</div><div class="sg-cuerpo" style="height:' + alto + 'px">';

  // Columna de horas
  html += '<div class="sg-horas">';
  for (let h = desde; h < hasta; h++) html += '<span style="top:' + ((h - desde) * PX_HORA) + 'px">' + h + '</span>';
  html += '</div>';

  // Una columna por día, con sus bloques colocados según la hora
  for (let d = 0; d < 7; d++) {
    html += '<div class="sg-col' + (d === diaDeHoy() ? ' hoy' : '') + '">';
    for (const b of bloquesDelDia(d)) {
      const t = TIPOS[b.tipo] || TIPOS.otro;
      const arriba = (aMinutos(b.inicio) - desde * 60) / 60 * PX_HORA;
      const altura = Math.max(16, (aMinutos(b.fin) - aMinutos(b.inicio)) / 60 * PX_HORA - 2);
      html += '<button class="sg-bloque' + (esAhora(b) ? ' ahora' : '') + '" style="top:' + arriba + 'px;height:' + altura + 'px;--color-bloque:' + t.color + '" data-act="editar-bloque" data-id="' + b.id + '" title="' + esc(b.titulo) + ' ' + b.inicio + '–' + b.fin + '">' +
        '<span>' + t.icono + '</span>' + (altura > 34 ? '<small>' + esc(b.titulo) + '</small>' : '') + '</button>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  // Leyenda de colores
  html += '<div class="leyenda" style="justify-content:center">';
  for (const clave in TIPOS) html += '<span><i style="background:' + TIPOS[clave].color + '"></i>' + TIPOS[clave].nombre + '</span>';
  return html + '</div><p class="muted small" style="text-align:center">Toca un bloque para editarlo.</p>';
}

// ---------- Tarjeta "Hoy en tu horario" (pantalla de Inicio) ----------
function tarjetaHorarioHoy() {
  if (!(estado.horario || []).length) {
    return '<div class="card stack tight"><h2>Tu horario semanal</h2>' +
      '<p class="muted">Apunta tus clases, ratos de estudio y deporte. Así ves de un vistazo qué te toca cada día.</p>' +
      '<button class="btn-sec full" data-act="ir-horario">Crear mi horario</button></div>';
  }
  const ahora = minutosAhora();
  // Lo que está pasando ahora y lo que queda por hacer hoy
  const quedan = bloquesDelDia(diaDeHoy()).filter(function (b) { return aMinutos(b.fin) > ahora; }).slice(0, 4);
  return '<div class="card"><div class="row between"><h2>Hoy en tu horario</h2><button class="btn-txt" data-act="ir-horario">Ver todo</button></div>' +
    '<div class="list">' + (quedan.length ? quedan.map(function (b) { return filaBloque(b, "inicio"); }).join("") :
      '<p class="vacio">Ya no te queda nada en el horario de hoy. ¡Descansa! 😴</p>') + '</div></div>';
}

// ---------- Formulario para añadir o editar un bloque ----------
let tipoElegido = "clase";
let avisarElegido = false;

// Por defecto avisamos en los bloques de Estudio y Deberes (en las clases sería un rollo)
function avisaBloque(b) {
  if (b.avisar !== undefined) return b.avisar;
  return b.tipo === "estudio" || b.tipo === "deberes";
}

function botonAvisar() {
  return '<button class="chip ' + (avisarElegido ? "on" : "") + '" data-act="avisar-bloque" id="blAvisar">🔔 ' +
    (avisarElegido ? "Apix me avisa al empezar" : "Sin aviso") + '</button>';
}

function hojaBloque(id) {
  const b = (estado.horario || []).find(function (x) { return x.id === id; });
  tipoElegido = b ? b.tipo : "clase";
  avisarElegido = b ? avisaBloque(b) : false;
  const diasMarcados = b ? [b.dia] : [diaHorario];

  let tipos = "";
  for (const clave in TIPOS) {
    tipos += '<button class="chip ' + (clave === tipoElegido ? "on" : "") + '" data-act="tipo-bloque" data-tipo="' + clave + '">' + TIPOS[clave].icono + ' ' + TIPOS[clave].nombre + '</button>';
  }
  let dias = "";
  for (let d = 0; d < 7; d++) {
    dias += '<button class="dia-chip ' + (diasMarcados.includes(d) ? "on" : "") + '" data-act="marcar-dia" data-d="' + d + '">' + DIAS_CORTOS[d] + '</button>';
  }

  abrirHoja('<div class="row between"><h2>' + (b ? "Editar bloque" : "Añadir al horario") + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">¿Qué es?<input id="blTitulo" value="' + (b ? esc(b.titulo) : '') + '" placeholder="Ej: Clase de Matemáticas, repasar inglés, fútbol..." maxlength="50"></label>' +
    '<div><p class="label" style="margin-bottom:8px">Tipo</p><div class="chips">' + tipos + '</div></div>' +
    '<label class="f">Asignatura (opcional)' + selectorAsig("blAsig", b ? b.asignatura : "") + '</label>' +
    '<div><p class="label" style="margin-bottom:8px">' + (b ? "Día" : "Días (puedes marcar varios)") + '</p><div class="dias-chips">' + dias + '</div></div>' +
    '<div class="dos"><label class="f">Empieza<input id="blInicio" type="time" value="' + (b ? b.inicio : "16:00") + '"></label>' +
    '<label class="f">Termina<input id="blFin" type="time" value="' + (b ? b.fin : "17:00") + '"></label></div>' +
    '<div><p class="label" style="margin-bottom:8px">Aviso</p>' + botonAvisar() + '</div>' +
    '<p class="err" id="blErr"></p>' +
    '<button class="btn" data-act="guardar-bloque" data-id="' + (b ? b.id : "") + '">' + (b ? "Guardar cambios" : "Añadir") + '</button>');
}

function guardarBloque(id) {
  const asignatura = leerAsig("blAsig");
  let titulo = $("blTitulo").value.trim();
  if (!titulo && asignatura) titulo = asignatura;   // si no pone nombre, usamos la asignatura
  const inicio = $("blInicio").value;
  const fin = $("blFin").value;

  // Días marcados en los botones L M X J V S D
  const dias = [];
  document.querySelectorAll('[data-act="marcar-dia"].on').forEach(function (c) { dias.push(Number(c.dataset.d)); });

  if (!titulo) { $("blErr").textContent = "Escribe qué es (o elige una asignatura)."; return; }
  if (!dias.length) { $("blErr").textContent = "Marca al menos un día."; return; }
  if (!inicio || !fin) { $("blErr").textContent = "Pon la hora de empezar y de terminar."; return; }
  if (aMinutos(fin) <= aMinutos(inicio)) { $("blErr").textContent = "La hora de terminar tiene que ser más tarde que la de empezar."; return; }

  estado.horario = estado.horario || [];
  const cambiados = [];
  if (id) {
    // Editar: quitamos los avisos que tenía y cambiamos el bloque con el primer día marcado...
    const b = estado.horario.find(function (x) { return x.id === id; });
    cancelarAvisosBloque(b);
    Object.assign(b, { titulo: titulo, tipo: tipoElegido, asignatura: asignatura, dia: dias[0], inicio: inicio, fin: fin, avisar: avisarElegido });
    cambiados.push(b);
    dias.shift();
  }
  // ...y creamos uno nuevo por cada día que quede
  for (const d of dias) {
    const nuevo = { id: nuevoId(), titulo: titulo, tipo: tipoElegido, asignatura: asignatura, dia: d, inicio: inicio, fin: fin, avisar: avisarElegido };
    estado.horario.push(nuevo);
    cambiados.push(nuevo);
  }
  for (const b of cambiados) programarAvisosBloque(b);
  guardar(); cerrarHoja();
  // Si choca con otra cosa del horario, avisamos (pero se guarda igual)
  const choque = buscarChoque(titulo, inicio, fin);
  if (choque) toast("⚠️ Ojo: coincide con «" + choque.titulo + "» (" + DIAS[choque.dia] + ")");
  else toast(id ? "✓ Cambios guardados" : "🗓️ Añadido a tu horario");
  pintar();
}

// Busca otro bloque que se pise en horas con el que acabas de guardar
function buscarChoque(titulo, inicio, fin) {
  const misBloques = estado.horario.filter(function (b) { return b.titulo === titulo && b.inicio === inicio && b.fin === fin; });
  for (const mio of misBloques) {
    for (const otro of bloquesDelDia(mio.dia)) {
      if (otro.id === mio.id) continue;
      // Se pisan si uno empieza antes de que el otro termine, y al revés
      if (aMinutos(otro.inicio) < aMinutos(fin) && aMinutos(inicio) < aMinutos(otro.fin)) return otro;
    }
  }
  return null;
}

// Elegir a qué días copiar todo lo del día que estás viendo
function hojaCopiarDia() {
  let dias = "";
  for (let d = 0; d < 7; d++) {
    if (d === diaHorario) continue;
    dias += '<button class="dia-chip" data-act="marcar-dia" data-d="' + d + '">' + DIAS_CORTOS[d] + '</button>';
  }
  abrirHoja('<div class="row between"><h2>Copiar ' + DIAS[diaHorario].toLowerCase() + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<p class="muted">Se copiará todo lo del ' + DIAS[diaHorario].toLowerCase() + ' a los días que marques (lo que ya tengan se queda).</p>' +
    '<div class="dias-chips">' + dias + '</div><p class="err" id="blErr"></p>' +
    '<button class="btn" data-act="confirmar-copia">Copiar</button>');
}

// ---------- Botones del horario ----------
const ACCIONES_HORARIO = {
  "ir-horario": function () { vistaAgenda = "horario"; irA("agenda"); },
  "vista-horario": function (b) { vistaHorario = b.dataset.v; pintarAgenda(); },
  "dia-horario": function (b) { diaHorario = Number(b.dataset.d); pintarAgenda(); },
  "nuevo-bloque": function () { hojaBloque(null); },
  "editar-bloque": function (b) { hojaBloque(b.dataset.id); },
  "tipo-bloque": function (b) {
    tipoElegido = b.dataset.tipo;
    document.querySelectorAll('[data-act="tipo-bloque"]').forEach(function (c) { c.classList.toggle("on", c === b); });
    // Al cambiar de tipo, ponemos el aviso que le toca por defecto
    avisarElegido = tipoElegido === "estudio" || tipoElegido === "deberes";
    $("blAvisar").outerHTML = botonAvisar();
  },
  "avisar-bloque": function () {
    avisarElegido = !avisarElegido;
    $("blAvisar").outerHTML = botonAvisar();
  },
  "marcar-dia": function (b) { b.classList.toggle("on"); },
  "guardar-bloque": function (b) { guardarBloque(b.dataset.id); },
  "borrar-bloque": function (b) {
    if (!confirm("¿Borrar este bloque del horario?")) return;
    const viejo = estado.horario.find(function (x) { return x.id === b.dataset.id; });
    if (viejo) cancelarAvisosBloque(viejo);
    estado.horario = estado.horario.filter(function (x) { return x.id !== b.dataset.id; });
    guardar(); pintar();
  },
  "copiar-dia": function () { hojaCopiarDia(); },
  "confirmar-copia": function () {
    const destino = [];
    document.querySelectorAll('[data-act="marcar-dia"].on').forEach(function (c) { destino.push(Number(c.dataset.d)); });
    if (!destino.length) { $("blErr").textContent = "Marca al menos un día."; return; }
    for (const d of destino) {
      for (const b of bloquesDelDia(diaHorario)) {
        const copia = { id: nuevoId(), titulo: b.titulo, tipo: b.tipo, asignatura: b.asignatura, dia: d, inicio: b.inicio, fin: b.fin, avisar: avisaBloque(b) };
        estado.horario.push(copia);
        programarAvisosBloque(copia);
      }
    }
    guardar(); cerrarHoja();
    toast("✓ Copiado a " + destino.length + (destino.length === 1 ? " día" : " días"));
    pintar();
  },
  // Empezar a estudiar desde un bloque de estudio: dura lo que le queda al bloque
  "empezar-bloque": function (b) {
    const bloque = estado.horario.find(function (x) { return x.id === b.dataset.id; });
    // Lo que le queda al bloque, pero como mucho 50 min (luego toca descanso, como en Pomodoro)
    const quedan = Math.min(50, Math.max(5, aMinutos(bloque.fin) - minutosAhora()));
    cerrarCapa();
    empezarSesion(bloque.titulo, bloque.asignatura, quedan, null);
  }
};

// =====================================================
// AVISOS DEL HORARIO
// El servidor solo sabe mandar avisos de una fecha concreta, así que
// programamos las próximas 2 semanas de cada bloque. Cada vez que abres
// la app se vuelven a programar, así nunca se acaban.
// =====================================================

// Las veces que va a empezar este bloque en los próximos 14 días
function proximasVecesBloque(b) {
  const veces = [];
  for (let i = 0; i < 14; i++) {
    const fecha = sumarDias(hoy(), i);
    const dia = (new Date(fecha + "T12:00:00").getDay() + 6) % 7;
    if (dia !== b.dia) continue;
    veces.push({
      clave: "hor-" + b.id + "-" + fecha.replace(/-/g, ""),
      cuando: new Date(fecha + "T" + b.inicio + ":00")
    });
  }
  return veces;
}

function textoAvisoBloque(b) {
  const t = TIPOS[b.tipo] || TIPOS.otro;
  return "Son las " + b.inicio + ": toca «" + b.titulo + "» " + t.icono + " (hasta las " + b.fin + ").";
}

function programarAvisosBloque(b) {
  if (!avisaBloque(b)) return;
  for (const v of proximasVecesBloque(b)) avisoNube(v.clave, v.cuando, "Apix 🗓️", textoAvisoBloque(b));
}

function cancelarAvisosBloque(b) {
  for (const v of proximasVecesBloque(b)) cancelarAvisoNube(v.clave);
}

// Reprograma todo el horario (como mucho una vez cada 6 horas, para no saturar)
function programarHorarioNube() {
  const ahora = Date.now();
  if (estado.syncHorario && ahora - estado.syncHorario < 6 * 3600000) return;
  estado.syncHorario = ahora;
  guardar();
  for (const b of estado.horario || []) programarAvisosBloque(b);
}

// Con la app abierta: si empieza un bloque con aviso, Apix sale en grande
function comprobarHorario() {
  for (const b of bloquesDelDia(diaDeHoy())) {
    if (!avisaBloque(b)) continue;
    const vez = proximasVecesBloque(b)[0];
    if (!vez || fechaISO(vez.cuando) !== hoy()) continue;
    if (yaToca(vez.clave, vez.cuando)) {
      mostrarAviso("Apix 🗓️", textoAvisoBloque(b), vez.clave);
      avisoBloque(b);
      return true;
    }
  }
  return false;
}

function avisoBloque(b) {
  const t = TIPOS[b.tipo] || TIPOS.otro;
  const estudio = b.tipo === "estudio" || b.tipo === "deberes";
  mostrarCapa('<div class="msg">' + apixSVG("anima", "xl") + '<p class="label">Apix · ' + b.inicio + '</p>' +
    '<h1>' + t.icono + ' ' + esc(b.titulo) + '</h1><p>Toca hasta las ' + b.fin + '. ' + (estudio ? FRASE_PALABRA : '¡Vamos!') + '</p>' +
    (estudio ? '<button class="btn" data-act="empezar-bloque" data-id="' + b.id + '">Empezar ahora</button>' : '') +
    '<button class="btn-sec full" data-act="cerrar-capa">Vale</button></div>');
}
