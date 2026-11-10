// =====================================================
// APEX STUDY · TARJETAS DE REPASO
// Cada tarjeta: { id, asignatura, pregunta, respuesta, caja, proxima }
//
// Usamos el "sistema Leitner" (repetición espaciada):
//   - Hay 5 cajas. Las tarjetas nuevas empiezan en la caja 1.
//   - Si te la sabes, sube de caja y tarda más en volver a salir.
//   - Si fallas, vuelve a la caja 1 y sale otra vez hoy.
// Así repasas más lo que te cuesta y menos lo que ya dominas.
// =====================================================

// Días que espera cada caja antes de volver a preguntarte
const DIAS_CAJA = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };

let vistaEstudiar = "sesion";   // "sesion" o "tarjetas"
let repaso = null;              // el repaso en marcha: { cola, hechas, sabidas, falladas, inicio, titulo }
let asigVerTarjetas = null;     // asignatura cuya lista de tarjetas se está viendo

// Tarjetas que tocan hoy (o que ya tocaban y no repasaste)
function tarjetasParaHoy(asignatura) {
  return (estado.tarjetas || []).filter(function (t) {
    if (asignatura && t.asignatura !== asignatura) return false;
    return t.proxima <= hoy();
  });
}

// Asignaturas que tienen tarjetas ("mazos")
function mazos() {
  const lista = [];
  for (const t of estado.tarjetas || []) if (!lista.includes(t.asignatura)) lista.push(t.asignatura);
  return lista.sort();
}

// Mezcla una lista (para que las tarjetas no salgan siempre en el mismo orden)
function mezclar(lista) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copia[i]; copia[i] = copia[j]; copia[j] = tmp;
  }
  return copia;
}

// ---------- Vista de tarjetas (dentro de Estudiar) ----------
function vistaTarjetasHTML() {
  // Si está viendo la lista de una asignatura
  if (asigVerTarjetas) return listaTarjetasHTML(asigVerTarjetas);

  const lista = mazos();
  const paraHoy = tarjetasParaHoy(null).length;
  let html = tarjetaApix(paraHoy ? "anima" : "estudia", "Apix",
    !lista.length ? "Crea tarjetas con una pregunta y su respuesta. Yo te las pregunto y repites más las que te cuestan."
      : paraHoy ? "Hoy tienes " + paraHoy + (paraHoy === 1 ? " tarjeta" : " tarjetas") + " para repasar. ¡Son 5 minutos!"
      : "¡Todo repasado por hoy! Mañana te pregunto más.", "");

  if (paraHoy) html += '<button class="btn" data-act="repasar" data-asig="">Repasar todo (' + paraHoy + ')</button>';

  for (const a of lista) {
    const total = (estado.tarjetas || []).filter(function (t) { return t.asignatura === a; });
    const hoyA = tarjetasParaHoy(a).length;
    // "Dominadas" = las que están en la caja 4 o 5
    const dominadas = total.filter(function (t) { return t.caja >= 4; }).length;
    html += '<div class="card stack tight">' +
      '<div class="row between"><h3 class="grow"><span class="punto-asig" style="background:' + colorAsig(a) + '"></span> ' + esc(a) + '</h3>' +
      '<span class="pill ' + (hoyA ? "exam" : "ok") + '">' + (hoyA ? hoyA + " hoy" : "Al día") + '</span></div>' +
      '<p class="muted small">' + total.length + (total.length === 1 ? " tarjeta" : " tarjetas") + ' · ' + dominadas + ' dominadas</p>' +
      '<div class="bar"><i style="width:' + Math.round(dominadas / total.length * 100) + '%;background:' + colorAsig(a) + '"></i></div>' +
      '<div class="acciones">' +
        '<button class="btn auto" data-act="repasar" data-asig="' + esc(a) + '">' + (hoyA ? "Repasar" : "Repasar igualmente") + '</button>' +
        '<button class="btn-sec" data-act="ver-tarjetas" data-asig="' + esc(a) + '">Ver tarjetas</button>' +
        '<button class="btn-sec" data-act="nueva-tarjeta" data-asig="' + esc(a) + '">+ Tarjeta</button>' +
      '</div></div>';
  }
  return html + '<button class="btn' + (lista.length ? '-sec full' : '') + '" data-act="nueva-tarjeta" data-asig="">+ Nueva tarjeta</button>';
}

// Lista de las tarjetas de una asignatura (para editarlas o borrarlas)
function listaTarjetasHTML(asig) {
  const lista = (estado.tarjetas || []).filter(function (t) { return t.asignatura === asig; });
  return '<div class="row between"><button class="btn-txt" data-act="volver-tarjetas">‹ Volver</button>' +
    '<button class="btn-txt" data-act="nueva-tarjeta" data-asig="' + esc(asig) + '">+ Tarjeta</button></div>' +
    '<div class="card"><h2>' + esc(asig) + '</h2><div class="list">' +
    (lista.length ? lista.map(function (t) {
      return '<div class="item"><div class="grow"><span class="name">' + esc(t.pregunta) + '</span>' +
        '<p class="muted small">' + esc(t.respuesta) + '</p></div>' +
        '<span class="pill pend" title="Caja ' + t.caja + ' de 5">' + "●".repeat(t.caja) + "○".repeat(5 - t.caja) + '</span>' +
        '<div class="acciones"><button class="btn-sec" data-act="editar-tarjeta" data-id="' + t.id + '">Editar</button>' +
        '<button class="btn-sec btn-danger" data-act="borrar-tarjeta" data-id="' + t.id + '">Borrar</button></div></div>';
    }).join("") : '<p class="vacio">No quedan tarjetas.</p>') + '</div></div>' +
    '<p class="muted small" style="text-align:center">Los puntos ●●○○○ son la caja: cuantos más, mejor te la sabes.</p>';
}

// ---------- Formulario para crear o editar ----------
function hojaTarjeta(asignatura, id) {
  const t = id ? estado.tarjetas.find(function (x) { return x.id === id; }) : null;
  abrirHoja('<div class="row between"><h2>' + (t ? "Editar tarjeta" : "Nueva tarjeta") + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">Asignatura' + selectorAsig("taAsig", t ? t.asignatura : (asignatura || "")) + '</label>' +
    '<label class="f">Pregunta (delante)<textarea id="taPregunta" rows="2" maxlength="200" placeholder="Ej: ¿Qué es un sujeto omitido?">' + (t ? esc(t.pregunta) : '') + '</textarea></label>' +
    '<label class="f">Respuesta (detrás)<textarea id="taRespuesta" rows="3" maxlength="400" placeholder="Ej: Cuando el sujeto no aparece escrito, pero se sabe por el verbo.">' + (t ? esc(t.respuesta) : '') + '</textarea></label>' +
    '<p class="err" id="taErr"></p>' +
    (t ? '<button class="btn" data-act="guardar-tarjeta" data-id="' + t.id + '">Guardar cambios</button>'
       : '<button class="btn" data-act="guardar-tarjeta" data-otra="1">Guardar y crear otra</button>' +
         '<button class="btn-sec full" data-act="guardar-tarjeta">Guardar y cerrar</button>'));
  setTimeout(function () { if ($("taPregunta") && !t) $("taPregunta").focus(); }, 80);
}

function guardarTarjeta(id, otra) {
  const asignatura = leerAsig("taAsig");
  const pregunta = $("taPregunta").value.trim();
  const respuesta = $("taRespuesta").value.trim();
  if (!asignatura) { $("taErr").textContent = "Elige la asignatura (así se agrupan)."; return; }
  if (!pregunta || !respuesta) { $("taErr").textContent = "Escribe la pregunta y la respuesta."; return; }

  estado.tarjetas = estado.tarjetas || [];
  if (id) {
    const t = estado.tarjetas.find(function (x) { return x.id === id; });
    Object.assign(t, { asignatura: asignatura, pregunta: pregunta, respuesta: respuesta });
  } else {
    estado.tarjetas.push({ id: nuevoId(), asignatura: asignatura, pregunta: pregunta, respuesta: respuesta, caja: 1, proxima: hoy() });
  }
  guardar();

  if (otra) {
    // Actualizamos la lista de detrás, y dejamos la misma asignatura con las cajas vacías para la siguiente
    pintar();
    hojaTarjeta(asignatura, null);
    toast("✓ Guardada. Ya llevas " + estado.tarjetas.filter(function (t) { return t.asignatura === asignatura; }).length + " de " + asignatura);
  } else {
    cerrarHoja();
    toast(id ? "✓ Cambios guardados" : "🃏 Tarjeta creada");
    pintar();
  }
}

// ---------- Modo repaso (pantalla completa) ----------
function empezarRepaso(asignatura) {
  let cola = tarjetasParaHoy(asignatura || null);
  // Si no toca ninguna, repasa todas las de esa asignatura igualmente
  if (!cola.length) cola = (estado.tarjetas || []).filter(function (t) { return !asignatura || t.asignatura === asignatura; });
  if (!cola.length) return;
  repaso = {
    cola: mezclar(cola).map(function (t) { return t.id; }),
    total: cola.length, hechas: 0, sabidas: 0, falladas: 0,
    fallidas: [],   // ids de las que has fallado alguna vez en este repaso
    inicio: Date.now(), titulo: asignatura || "Todas las asignaturas"
  };
  $("tabs").hidden = true;
  $("foco").hidden = false;
  pintarRepaso(false);
}

function pintarRepaso(girada) {
  const t = estado.tarjetas.find(function (x) { return x.id === repaso.cola[0]; });
  const progreso = Math.round(repaso.hechas / repaso.total * 100);
  $("foco").innerHTML = '<div class="in">' +
    '<div class="row between" style="width:100%"><button class="btn-txt" data-act="salir-repaso">✕ Salir</button>' +
    '<span class="muted small num">' + Math.min(repaso.hechas + 1, repaso.total) + ' / ' + repaso.total + '</span></div>' +
    '<div class="bar" style="width:100%"><i style="width:' + progreso + '%"></i></div>' +
    '<p class="label"><span class="punto-asig" style="background:' + colorAsig(t.asignatura) + '"></span> ' + esc(t.asignatura) + '</p>' +
    '<button class="flashcard' + (girada ? ' girada' : '') + '" data-act="girar-tarjeta" aria-label="Dar la vuelta">' +
      '<div class="cara delante"><p class="label">Pregunta</p><p class="texto">' + esc(t.pregunta) + '</p><p class="muted small">Toca para ver la respuesta</p></div>' +
      '<div class="cara detras"><p class="label">Respuesta</p><p class="texto">' + esc(t.respuesta) + '</p></div>' +
    '</button>' +
    (girada
      ? '<p class="muted small">¿Te la sabías?</p><div class="tres respuestas">' +
          '<button class="btn-sec mal" data-act="respuesta-tarjeta" data-r="no">❌<br>No</button>' +
          '<button class="btn-sec regular" data-act="respuesta-tarjeta" data-r="casi">🤔<br>Más o menos</button>' +
          '<button class="btn-sec bien" data-act="respuesta-tarjeta" data-r="si">✅<br>Sí</button></div>'
      : '<button class="btn" data-act="girar-tarjeta">Ver respuesta</button>') +
    '</div>';
}

// Cambia la caja y la próxima fecha de una tarjeta según la respuesta (sistema Leitner)
//   "si": sube de caja · "casi": se queda y vuelve mañana · "no": vuelve a la caja 1 y sale hoy
function aplicarRespuesta(t, r, fechaHoy) {
  if (r === "si") {
    t.caja = Math.min(5, t.caja + 1);
    t.proxima = sumarDias(fechaHoy, DIAS_CAJA[t.caja] || 1);
  } else if (r === "casi") {
    t.proxima = sumarDias(fechaHoy, 1);
  } else {
    t.caja = 1;
    t.proxima = fechaHoy;
  }
  return t;
}

// Apunta cómo te ha ido con la tarjeta y pasa a la siguiente
function responderTarjeta(r) {
  const t = estado.tarjetas.find(function (x) { return x.id === repaso.cola[0]; });
  repaso.cola.shift();
  aplicarRespuesta(t, r, hoy());

  if (r === "si") {
    repaso.hechas++;
    if (!repaso.fallidas.includes(t.id)) repaso.sabidas++;   // solo cuenta si fue a la primera
  } else if (r === "casi") {
    repaso.hechas++;
  } else {
    repaso.cola.push(t.id);                         // la fallada sale otra vez al final de este repaso
    if (!repaso.fallidas.includes(t.id)) repaso.fallidas.push(t.id);
    repaso.falladas++;
    repaso.total++;
  }
  guardar();
  vibrar(r === "si" ? 15 : 40);

  if (repaso.cola.length) pintarRepaso(false);
  else terminarRepaso();
}

function terminarRepaso() {
  const minutos = Math.round((Date.now() - repaso.inicio) / 60000);
  // Si has estado al menos 1 minuto, cuenta como tiempo de estudio (y para la racha)
  if (minutos >= 1) {
    estado.sesiones.push({ fecha: hoy(), hora: horaActual(), min: minutos, objetivo: "Repaso de tarjetas", asignatura: repaso.titulo === "Todas las asignaturas" ? "" : repaso.titulo, distracciones: 0 });
    estado.mejorRacha = Math.max(estado.mejorRacha, rachaActual());
    guardar();
  }
  const r = repaso;
  repaso = null;
  cerrarFoco();
  confeti();
  const unicas = r.total - r.falladas;   // tarjetas distintas que has repasado
  mostrarCapa('<div class="msg">' + apixSVG("campeon", "xl") + '<p class="label">Repaso terminado</p><h1>¡Bien hecho!</h1>' +
    '<p>Te sabías <b>' + r.sabidas + ' de ' + unicas + '</b> a la primera' + (minutos >= 1 ? ' · ' + minutos + ' min' : '') + '.</p>' +
    '<p class="muted">' + (r.falladas ? "Las que fallaste te las volveré a preguntar pronto." : "¡Ni un fallo! Esas tardarán más en volver a salir.") + '</p>' +
    '<button class="btn" data-act="cerrar-capa">¡Genial!</button></div>');
}

// ---------- Botones ----------
const ACCIONES_TARJETAS = {
  "vista-estudiar": function (b) { vistaEstudiar = b.dataset.v; asigVerTarjetas = null; pintarEstudiar(); },
  "nueva-tarjeta": function (b) { hojaTarjeta(b.dataset.asig, null); },
  "editar-tarjeta": function (b) { hojaTarjeta(null, b.dataset.id); },
  "guardar-tarjeta": function (b) { guardarTarjeta(b.dataset.id, b.dataset.otra); },
  "borrar-tarjeta": function (b) {
    if (!confirm("¿Borrar esta tarjeta?")) return;
    estado.tarjetas = estado.tarjetas.filter(function (t) { return t.id !== b.dataset.id; });
    if (!estado.tarjetas.some(function (t) { return t.asignatura === asigVerTarjetas; })) asigVerTarjetas = null;
    guardar(); pintarEstudiar();
  },
  "ver-tarjetas": function (b) { asigVerTarjetas = b.dataset.asig; pintarEstudiar(); },
  "volver-tarjetas": function () { asigVerTarjetas = null; pintarEstudiar(); },
  "ir-tarjetas": function () { vistaEstudiar = "tarjetas"; asigVerTarjetas = null; irA("estudiar"); },
  "repasar": function (b) { empezarRepaso(b.dataset.asig); },
  "girar-tarjeta": function () { pintarRepaso(true); },
  "respuesta-tarjeta": function (b) { responderTarjeta(b.dataset.r); },
  "salir-repaso": function () {
    if (repaso.hechas && !confirm("¿Salir del repaso? Lo que ya has respondido se queda guardado.")) return;
    repaso = null;
    cerrarFoco();
  }
};
