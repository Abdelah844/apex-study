// =====================================================
// APEX STUDY · AJUSTES
// Copia de seguridad, recordatorios, modo claro/oscuro y la hoja de Ajustes.
// =====================================================

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
  estado.copia = Object.assign({}, estado.copia, { ultima: hoy() });
  guardar();
  toast("💾 Copia guardada en Descargas");
}

// Apix te recuerda hacer copia (una vez al mes)
function recordarCopia() {
  if (!tocaRecordarCopia(estado, hoy())) return;
  if (!$("capa").hidden || !$("hoja").hidden) return;   // no interrumpir otra cosa
  estado.copia = Object.assign({}, estado.copia, { ultimoAviso: hoy() });
  guardar();
  const ultima = estado.copia.ultima ? "Tu última copia es del " + fechaLarga(estado.copia.ultima) + "." : "Todavía no has hecho ninguna copia.";
  mostrarCapa('<div class="msg">' + apixSVG("cuida", "lg") + '<p class="label">Apix · Copia de seguridad</p>' +
    '<h1>¿Hacemos una copia?</h1>' +
    '<p>Tus datos solo están en este móvil. Si borras la app o cambias de móvil, los perderías. ' + ultima + '</p>' +
    '<button class="btn" data-act="copia-ahora">💾 Guardar copia ahora</button>' +
    '<button class="btn-sec full" data-act="cerrar-capa">Recuérdamelo el mes que viene</button>' +
    '<button class="btn-txt" data-act="copia-no-recordar">No volver a recordar</button></div>');
}

// Lee un archivo de copia y cambia los datos actuales por los de la copia
function importarDatos(archivo) {
  const lector = new FileReader();
  lector.onload = function () {
    try {
      const copia = JSON.parse(lector.result);
      if (copia.app !== "apex-study" || !copia.datos || !Array.isArray(copia.datos.sesiones)) throw new Error("no es una copia");
      if (!confirm("Se cambiarán tus datos actuales por los de la copia del " + copia.fecha + ". ¿Seguro?")) return;
      estado = Object.assign(datosVacios(), limpiarIds(copia.datos));
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


// ---------- RECORDATORIOS (Ajustes) ----------
function tarjetaRecordatorios() {
  const c = configAvisos();
  function interruptor(clave, texto) {
    return '<button class="interruptor ' + (c[clave] ? "on" : "") + '" data-act="cambiar-aviso" data-clave="' + clave + '"><span>' + texto + '</span><i></i></button>';
  }
  return '<div class="card stack tight"><h3>Recordatorios</h3>' +
    '<p class="muted small">Cuándo te avisa Apix de los exámenes, los deberes y tu semana.</p>' +
    '<div class="dos"><label class="f">El día antes a las<input id="avTarde" type="time" data-cambio="hora-aviso" value="' + c.tarde + '"></label>' +
    '<label class="f">El mismo día a las<input id="avManana" type="time" data-cambio="hora-aviso" value="' + c.manana + '"></label></div>' +
    interruptor("tresDias", "Avisar 3 días antes del examen") +
    interruptor("semana", "Avisar 1 semana antes del examen") +
    interruptor("resumen", "Resumen de tu semana (domingos a las 20:00)") +
    '</div>';
}

// Al cambiar los ajustes, se vuelven a programar todos los avisos con las horas nuevas
function guardarConfigAvisos(cambios) {
  estado.avisosConfig = Object.assign(configAvisos(), cambios);
  guardar();
  for (const e of proximosExamenes()) programarAvisosExamenNube(e);
  for (const d of deberesPendientes()) programarAvisosDeber(d);
  programarResumenSemana();
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
    '<div class="card stack tight"><h3>Nombres de los rangos</h3><div class="seg">' + botonesEstilo() + '</div></div>' +
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
    '<div class="card stack tight"><h3>Avisos</h3><p class="muted small">Apix te avisará cuando llegue la hora de empezar a estudiar.</p>' + avisos + '</div>' +
    // Cómo instalarla: solo sale si aún la usas desde el navegador
    (appInstalada() ? '' : '<div class="card stack tight"><h3>Instalar en el móvil</h3>' +
      '<p class="muted small">En Android (Chrome): menú ⋮ → «Instalar aplicación». En iPhone (Safari): Compartir → «Añadir a pantalla de inicio».</p></div>') +
    '<div class="card stack tight"><h3>Tus datos</h3><p class="muted small">Se guardan solo en este móvil. Haz una copia de vez en cuando por si lo cambias o se borra.</p>' +
      '<p class="small">' + ((estado.copia || {}).ultima ? "💾 Última copia: " + fechaLarga(estado.copia.ultima) : "⚠️ Aún no has hecho ninguna copia") + '</p>' +
      '<button class="interruptor ' + ((estado.copia || {}).noRecordar ? "" : "on") + '" data-act="copia-recordar"><span>Recordarme hacer copia cada mes</span><i></i></button>' +
      '<div class="dos"><button class="btn-sec" data-act="exportar">💾 Guardar copia</button>' +
      '<button class="btn-sec" data-act="importar">📂 Recuperar copia</button></div>' +
      '<input type="file" id="archivoCopia" accept=".json,application/json" hidden>' +
      '<button class="btn-sec btn-danger" data-act="borrar-todo">Borrar todos los datos</button></div>' +
    '<a class="btn-txt" href="privacidad.html" target="_blank" rel="noopener" style="text-align:center">🛡️ Política de privacidad</a>');
}

