// =====================================================
// APIX STUDY · FORMULARIOS
// Hojas que suben desde abajo para crear o editar exámenes y planes.
// =====================================================

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
// Tipo de plan elegido en el formulario: "estudio" u "otro"
let tipoPlanElegido = "estudio";
const PISTA_ESTUDIO = "Ej: repasar ecuaciones, gramática...";
const PISTA_OTRO = "Ej: cargar los cascos, preparar la mochila...";

// Cambia el formulario según el tipo (sin borrar lo que ya has escrito)
function cambiarTipoPlan(tipo) {
  tipoPlanElegido = tipo;
  const otro = tipo === "otro";
  for (const b of document.querySelectorAll("#plTipo button")) b.classList.toggle("on", b.dataset.t === tipo);
  for (const el of document.querySelectorAll("#hoja .solo-estudio")) el.hidden = otro;
  $("plObjTexto").textContent = otro ? "¿Qué tienes que hacer?" : "¿Qué vas a estudiar?";
  $("plObj").placeholder = otro ? PISTA_OTRO : PISTA_ESTUDIO;
}

function hojaPlan(fecha, examen, id) {
  const p = id ? estado.planes.find(function (x) { return x.id === id; }) : null;
  let objetivo = "";
  let asig = "";
  if (examen) { objetivo = "Repasar " + (examen.tema || examen.asignatura); asig = examen.asignatura; }
  if (p) { objetivo = p.objetivo; asig = p.asignatura; }
  const minutos = p ? (p.min || 25) : 25;
  antesElegido = p ? (p.antes || 0) : 10;
  tipoPlanElegido = p && p.tipo === "otro" ? "otro" : "estudio";
  const otro = tipoPlanElegido === "otro";
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
  abrirHoja('<div class="row between"><h2>' + (p ? "Editar plan" : "Nuevo plan") + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    tarjetaApix("anima", "Apix", "Cuando llegue la hora te avisaré. Si lo dices, lo cumples.", "") +
    '<div class="seg" id="plTipo">' +
      '<button class="' + (otro ? "" : "on") + '" data-act="tipo-plan" data-t="estudio">📚 Estudiar</button>' +
      '<button class="' + (otro ? "on" : "") + '" data-act="tipo-plan" data-t="otro">✅ Otra cosa</button></div>' +
    '<label class="f"><span id="plObjTexto">' + (otro ? "¿Qué tienes que hacer?" : "¿Qué vas a estudiar?") + '</span>' +
      '<input id="plObj" value="' + esc(objetivo) + '" placeholder="' + (otro ? PISTA_OTRO : PISTA_ESTUDIO) + '" maxlength="80"></label>' +
    '<label class="f solo-estudio"' + (otro ? " hidden" : "") + '>Asignatura (opcional)' + selectorAsig("plAsig", asig) + '</label>' +
    '<div class="dos"><label class="f">Día<input id="plFecha" type="date" value="' + (p ? p.fecha : (fecha || hoy())) + '"></label>' +
    '<label class="f">Hora<input id="plHora" type="time" value="' + horaSugerida + '"></label></div>' +
    '<div class="solo-estudio"' + (otro ? " hidden" : "") + '><p class="label" style="margin-bottom:8px">Duración</p><div class="chips" id="plTiempos">' + tiempos + '</div></div>' +
    '<div><p class="label" style="margin-bottom:8px">Avisarme también</p><div class="chips">' + antes + '</div></div>' +
    '<p class="err" id="plErr"></p>' +
    '<button class="btn" data-act="guardar-plan" data-min="' + minutos + '" data-id="' + (p ? p.id : '') + '" id="plGuardar">' + (p ? "Guardar cambios" : "Doy mi palabra") + '</button>');
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
  if (!id) abrirPlanExamen(examen.id);   // examen nuevo: Apix propone un plan de estudio
}

function guardarPlan(minutos, id) {
  const objetivo = $("plObj").value.trim();
  const fecha = $("plFecha").value;
  const hora = $("plHora").value;
  const otro = tipoPlanElegido === "otro";
  if (!objetivo) { $("plErr").textContent = otro ? "Escribe qué tienes que hacer." : "Escribe qué vas a estudiar."; return; }
  if (!fecha || !hora) { $("plErr").textContent = "Elige el día y la hora."; return; }
  const datos = { tipo: tipoPlanElegido, objetivo: objetivo, asignatura: otro ? "" : leerAsig("plAsig"), fecha: fecha, hora: hora, min: otro ? 0 : minutos, antes: antesElegido, avisado: false };
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
      '<p>El ' + fechaLarga(fecha) + ' a las ' + hora + ': «' + esc(objetivo) + '».</p>' +
      '<p class="muted">Activa los avisos para que pueda recordártelo.</p>' +
      '<button class="btn" data-act="activar-avisos">Activar avisos</button><button class="btn-txt" data-act="cerrar-capa">Ahora no</button></div>');
  } else {
    toast("🤝 Trato hecho. Apix te avisará a las " + hora);
  }
}


