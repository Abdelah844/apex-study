// =====================================================
// APIX STUDY · SESIÓN DE ESTUDIO Y DESCANSOS
// Pantalla de concentración, fin de la sesión y descansos Pomodoro.
// =====================================================

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
  const xpAntes = xpTotal();
  estado.sesiones.push({ fecha: hoy(), hora: horaActual(), min: s.min, objetivo: s.objetivo, asignatura: s.asignatura, distracciones: s.distracciones });

  // El plan queda cumplido: el de esta sesión, o el primero pendiente de hoy
  let plan = estado.planes.find(function (p) { return p.id === s.planId; });
  if (!plan) plan = planesDelDia(hoy()).find(function (p) { return !p.hecho && esPlanEstudio(p); });
  if (plan) { plan.hecho = true; cancelarAvisosPlan(plan.id); }

  estado.sesionActual = null;
  rondasSeguidas++;
  estado.mejorRacha = Math.max(estado.mejorRacha, rachaActual());
  guardar();
  programarResumenSemana();   // el resumen del domingo, con los minutos de hoy
  cerrarFoco();
  confeti();
  vibrar([120, 60, 120]);
  mostrarAviso("Apix 🎉", "¡Objetivo cumplido! " + s.min + " min de " + s.objetivo + ".");

  let extra = s.distracciones ? "Saliste " + s.distracciones + (s.distracciones === 1 ? " vez" : " veces") + ". La próxima, a por 0." : "¡Sin salir ni una vez! Eres una máquina.";
  if (plan) extra = "Has cumplido tu palabra. " + extra;
  const xpGanada = xpTotal() - xpAntes;
  const subida = comprobarSubida();   // "¡Subes a Oro I!" o ""
  mostrarCapa('<div class="msg">' + apixSVG("campeon", "xl") + '<p class="label">Sesión completada</p><h1>¡Objetivo cumplido!</h1>' +
    '<p><b>' + s.min + ' min</b> de «' + esc(s.objetivo) + '»</p><p class="muted">' + extra + '</p>' +
    '<p class="big-num">🔥 ' + rachaActual() + ' ' + (rachaActual() === 1 ? "día" : "días") + '</p>' +
    '<p><span class="pill ok">+' + xpGanada + ' XP</span>' + (xpGanada === 0 ? ' <span class="muted small">(ya llegaste al máximo de hoy)</span>' : '') + '</p>' +
    (subida ? '<p class="subida">' + subida + '</p>' : '') +
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

