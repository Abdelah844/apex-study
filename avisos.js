// =====================================================
// APEX STUDY · AVISOS
// Avisos con la app abierta, avisos desde la nube (Supabase),
// diagnóstico de avisos y mensajes cortos (toast).
// =====================================================

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
// Función de Supabase que envía los avisos (la de Apex Study, distinta de la de Apex Gym)
const FUNCION_AVISOS = SUPABASE_URL + "/functions/v1/study-enviar-avisos";

// Clave pública de avisos: se la pedimos a la función y la guardamos en el móvil
async function clavePublicaAvisos() {
  try {
    const guardada = localStorage.getItem("apex-study-vapid");
    if (guardada) return guardada;
  } catch (e) { /* seguimos */ }
  const r = await fetch(FUNCION_AVISOS + "?clave=1");
  const datos = await r.json();
  try { localStorage.setItem("apex-study-vapid", datos.publica); } catch (e) { /* no pasa nada */ }
  return datos.publica;
}

// Pasa los bytes de una clave a texto (para comparar claves)
function bytesEnTexto(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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
  const clave = await clavePublicaAvisos();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  // Si el móvil estaba apuntado con otra clave (la antigua), lo desapuntamos y lo apuntamos de nuevo
  if (sub && sub.options && sub.options.applicationServerKey && bytesEnTexto(sub.options.applicationServerKey) !== clave) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveEnBytes(clave) });
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

