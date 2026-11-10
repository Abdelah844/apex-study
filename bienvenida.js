// =====================================================
// APEX STUDY · BIENVENIDA Y EFECTOS
// - La primera vez que abres la app, Apix te presenta la app en 4 pasos.
// - confeti() y vibrar() dan alegría cuando consigues algo.
// =====================================================

let pasoBienvenida = 1;

function abrirBienvenida() {
  pasoBienvenida = 1;
  pintarBienvenida();
}

function puntosPaso() {
  let html = '<div class="pasos">';
  for (let i = 1; i <= 4; i++) html += '<i class="' + (i === pasoBienvenida ? "on" : "") + '"></i>';
  return html + '</div>';
}

function pintarBienvenida() {
  let html = "";

  if (pasoBienvenida === 1) {
    html = apixSVG("contento", "xl") +
      '<p class="label">Apex Study</p><h1>¡Hola! Soy Apix</h1>' +
      '<p>Estaré aquí para que cumplas tus objetivos: te ayudo a organizarte y a estudiar concentrado.</p>' +
      '<label class="f" style="width:100%;text-align:left">¿Cómo te llamas?<input id="biNombre" maxlength="20" placeholder="Tu nombre" value="' + esc(estado.nombre || "") + '"></label>' +
      '<button class="btn" data-act="bienvenida-siguiente">Siguiente</button>';
  }

  if (pasoBienvenida === 2) {
    const niveles = [["eso", "📗 ESO"], ["bachillerato", "📘 Bachillerato"], ["fp", "🛠️ FP"], ["todos", "🎓 Otro"]];
    html = apixSVG("estudia", "lg") +
      '<h1>¿Qué estudias' + (estado.nombre ? ', ' + esc(estado.nombre) : '') + '?</h1>' +
      '<p class="muted">Así te enseño las asignaturas que te tocan.</p>' +
      '<div class="dos" style="width:100%">' + niveles.map(function (n) {
        return '<button class="opcion ' + (estado.nivel === n[0] ? "on" : "") + '" data-act="bienvenida-nivel" data-n="' + n[0] + '">' + n[1] + '</button>';
      }).join("") + '</div>' +
      (estado.nivel === "fp"
        ? '<p class="small">Escribe tus módulos (uno por línea). Podrás cambiarlos en Ajustes:</p>' +
          '<textarea id="biModulos" rows="4" placeholder="Redes Locales&#10;Sistemas Operativos en Red&#10;Seguridad Informática">' + esc((estado.misAsignaturas || []).join("\n")) + '</textarea>'
        : '') +
      '<button class="btn" data-act="bienvenida-siguiente">Siguiente</button>';
  }

  if (pasoBienvenida === 3) {
    const permiso = permisoAvisos();
    html = apixSVG("anima", "lg") +
      '<h1>Yo te aviso</h1>' +
      '<p>Te recordaré los exámenes, los deberes y cuándo dijiste que empezarías a estudiar. ' +
      '<b>' + FRASE_PALABRA + '</b></p>' +
      '<p class="muted small">Si tienes menos de 14 años, pide permiso a tus padres antes de activarlos. <a href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a></p>' +
      (permiso === "granted" ? '<p class="small">✓ Los avisos ya están activados.</p><button class="btn" data-act="bienvenida-siguiente">Siguiente</button>'
        : permiso === "default" ? '<button class="btn" data-act="bienvenida-avisos">Activar avisos</button><button class="btn-txt" data-act="bienvenida-siguiente">Ahora no</button>'
        : '<p class="muted small">En este navegador no se pueden activar. Puedes probar más tarde desde Ajustes.</p><button class="btn" data-act="bienvenida-siguiente">Siguiente</button>');
  }

  if (pasoBienvenida === 4) {
    html = apixSVG("campeon", "xl") +
      '<h1>¡Todo listo' + (estado.nombre ? ', ' + esc(estado.nombre) : '') + '!</h1>' +
      '<p>Empieza por lo más importante: apunta tu próximo examen o crea tu horario.</p>' +
      '<button class="btn" data-act="bienvenida-fin" data-luego="examen">📅 Apuntar un examen</button>' +
      '<button class="btn-sec full" data-act="bienvenida-fin" data-luego="horario">🗓️ Crear mi horario</button>' +
      '<button class="btn-txt" data-act="bienvenida-fin">Ir al inicio</button>';
  }

  mostrarCapa('<div class="msg bienvenida">' + puntosPaso() + html + '</div>');
}

// Guarda lo escrito en el paso actual antes de pasar al siguiente
function guardarPasoBienvenida() {
  if (pasoBienvenida === 1) {
    estado.nombre = $("biNombre").value.trim();
  }
  if (pasoBienvenida === 2 && $("biModulos")) {
    const lineas = $("biModulos").value.split("\n");
    for (const l of lineas) anadirMiAsignatura(l.trim());
  }
  guardar();
}

// ---------- Efectos ----------
// Confeti de colores que cae por la pantalla durante 2,5 segundos
function confeti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colores = ["#9B7EFF", "#FF8A3D", "#3CE0A0", "#FF4D8D", "#4DB8FF", "#FFD23F"];
  const caja = document.createElement("div");
  caja.className = "confeti";
  for (let i = 0; i < 60; i++) {
    const trozo = document.createElement("i");
    trozo.style.left = Math.random() * 100 + "%";
    trozo.style.background = colores[i % colores.length];
    trozo.style.animationDelay = Math.random() * 0.6 + "s";
    trozo.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
    trozo.style.transform = "rotate(" + Math.random() * 360 + "deg)";
    caja.appendChild(trozo);
  }
  document.body.appendChild(caja);
  setTimeout(function () { caja.remove(); }, 3200);
}

// Vibración corta (solo en móviles que lo permiten, como Android)
function vibrar(ms) {
  if (navigator.vibrate) navigator.vibrate(ms || 20);
}

// ---------- Botones ----------
const ACCIONES_BIENVENIDA = {
  "bienvenida-siguiente": function () {
    guardarPasoBienvenida();
    pasoBienvenida++;
    pintarBienvenida();
  },
  "bienvenida-nivel": function (b) {
    estado.nivel = b.dataset.n;
    guardar();
    pintarBienvenida();
  },
  "bienvenida-avisos": function () {
    Notification.requestPermission().then(function (p) {
      if (p === "granted") programarTodosNube();
      pasoBienvenida++;
      pintarBienvenida();
    });
  },
  "bienvenida-fin": function (b) {
    estado.bienvenidaVista = true;
    guardar();
    cerrarCapa();
    confeti();
    if (b.dataset.luego === "examen") { irA("inicio"); hojaExamen(); }
    else if (b.dataset.luego === "horario") { vistaAgenda = "horario"; irA("agenda"); hojaBloque(null); }
    else irA("inicio");
  }
};
