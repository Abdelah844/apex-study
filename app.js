// =====================================================
// APEX STUDY · BOTONES Y ARRANQUE
// Este archivo se carga el último: une los botones de todos los archivos
// y arranca la app. Orden de carga: mira las etiquetas <script> de index.html.
// =====================================================

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

// ---------- 8. BOTONES ----------
// Cada botón tiene data-act="nombre". Aquí está lo que hace cada uno.
const ACCIONES = {
  "ir": function (b) { irA(b.dataset.tab); },
  "ajustes": function () { hojaAjustes(); },
  "cerrar-hoja": function () { cerrarHoja(); },
  "tema": function (b) { ponerTema(b.dataset.tema); hojaAjustes(); },
  "exportar": function () { exportarDatos(); },
  "copia-ahora": function () { cerrarCapa(); exportarDatos(); },
  "copia-no-recordar": function () {
    estado.copia = Object.assign({}, estado.copia, { noRecordar: true });
    guardar(); cerrarCapa();
    toast("Vale. Puedes volver a activarlo en Ajustes → Tus datos");
  },
  "copia-recordar": function (b) {
    const no = !(estado.copia || {}).noRecordar;
    estado.copia = Object.assign({}, estado.copia, { noRecordar: no });
    guardar();
    b.classList.toggle("on", !no);
  },
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
else setTimeout(recordarCopia, 2500);                  // una vez al mes: "¿hacemos una copia?"

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
    // "sync2": con la función nueva de avisos hay que volver a guardarlos todos una vez
    const ultima = Number(localStorage.getItem("apex-study-sync2") || 0);
    if (Date.now() - ultima < 12 * 3600000) return;
    if (!ultima) estado.syncHorario = 0;   // también el horario
    localStorage.setItem("apex-study-sync2", String(Date.now()));
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
