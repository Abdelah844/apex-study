// =====================================================
// APIX STUDY · PLANIFICADOR DE APIX
// 1. Plan automático: al apuntar un examen, Apix reparte sesiones de repaso
//    en los días de antes (10, 7, 4, 2 y 1 día antes).
// 2. ¿Qué estudio hoy?: Apix mira exámenes, deberes, planes y tarjetas
//    y te dice por dónde empezar.
// 3. Resumen del domingo: aviso a las 20:00 con tu semana.
// 4. Estadísticas por asignatura (para la pestaña Progreso).
// =====================================================

// ---------- 1. PLAN AUTOMÁTICO PARA UN EXAMEN ----------
const DIAS_ANTES = [10, 7, 4, 2, 1];   // días antes del examen en los que se estudia

// Devuelve las sesiones que Apix propone (no guarda nada).
// hora = a qué hora estudiar, horaAhora = hora actual (para no proponer horas pasadas)
function propuestaPlanExamen(examen, fechaHoy, hora, horaAhora) {
  const tema = examen.tema || examen.asignatura;
  const quedan = diasEntre(fechaHoy, examen.fecha);
  const sesiones = [];
  for (const antes of DIAS_ANTES) {
    const fecha = sumarDias(examen.fecha, -antes);
    if (antes > quedan) continue;                              // ese día ya pasó
    if (fecha === fechaHoy && hora <= horaAhora) continue;     // hoy, pero la hora ya pasó
    // Si ya hay un plan de este examen ese día, no lo repetimos
    const yaHay = estado.planes.some(function (p) { return p.examenId === examen.id && p.fecha === fecha; });
    if (!yaHay) sesiones.push({ fecha: fecha, antes: antes });
  }
  // El texto de cada sesión: la primera para empezar, la última repaso final
  sesiones.forEach(function (s, i) {
    if (s.antes === 1) s.objetivo = "Repaso final de " + tema;
    else if (i === 0) s.objetivo = "Estudiar " + tema;
    else s.objetivo = "Repasar " + tema;
  });
  return sesiones;
}

// Lo que el usuario ha elegido en la ventana del plan
let planExamen = { id: null, hora: "18:00", min: 45 };

function abrirPlanExamen(examenId) {
  const ex = estado.examenes.find(function (e) { return e.id === examenId; });
  if (!ex) return;
  if (planExamen.id !== examenId) planExamen = { id: examenId, hora: configAvisos().tarde, min: 45 };
  const sesiones = propuestaPlanExamen(ex, hoy(), planExamen.hora, horaActual());
  const titulo = esc(ex.asignatura) + (ex.tema ? " · " + esc(ex.tema) : "");

  // Sin días libres: el examen es hoy (o ya tiene todas sus sesiones)
  if (!sesiones.length) {
    mostrarCapa('<div class="msg">' + apixSVG("anima", "lg") + '<h1>¡A repasar!</h1>' +
      '<p>' + (ex.fecha === hoy() ? "El examen de <b>" + titulo + "</b> es hoy. Haz un último repaso ahora." :
        "Ya tienes planes para todos los días antes de <b>" + titulo + "</b>.") + '</p>' +
      '<button class="btn" data-act="estudiar-ya" data-obj="' + esc("Repasar " + (ex.tema || ex.asignatura)) + '" data-asig="' + esc(ex.asignatura) + '" data-min="25">▶ Repasar ahora</button>' +
      '<button class="btn-sec full" data-act="plan-a-mano" data-id="' + ex.id + '">Hacer un plan a mano</button>' +
      '<button class="btn-txt" data-act="cerrar-capa">Cerrar</button></div>');
    return;
  }

  const lista = sesiones.map(function (s) {
    return '<div class="item"><div class="grow"><span class="name">' + esc(s.objetivo) + '</span>' +
      '<p class="muted small">' + fechaCorta(s.fecha) + ' · ' + planExamen.hora + ' · ' + planExamen.min + ' min</p></div>' +
      '<span class="pill">' + (s.antes === 1 ? "1 día antes" : s.antes + " días antes") + '</span></div>';
  }).join("");
  const tiempos = [25, 45, 60].map(function (m) {
    return '<button class="chip ' + (m === planExamen.min ? "on" : "") + '" data-act="plan-examen-min" data-min="' + m + '">' + m + ' min</button>';
  }).join("");

  mostrarCapa('<div class="msg">' + apixSVG("estudia") +
    '<p class="label">Examen de ' + titulo + '</p><h1>¿Te preparo un plan?</h1>' +
    '<p class="muted">Estudiar poco a poco se recuerda mucho mejor que todo el último día.</p>' +
    '<div class="card list" style="width:100%;text-align:left">' + lista + '</div>' +
    '<div class="stack tight" style="width:100%;text-align:left"><label class="f">Hora de estudiar<input id="peHora" type="time" data-cambio="plan-examen-hora" value="' + planExamen.hora + '"></label>' +
    '<div><p class="label" style="margin-bottom:8px">Duración de cada sesión</p><div class="chips">' + tiempos + '</div></div></div>' +
    '<button class="btn" data-act="crear-plan-examen">✅ Sí, crear ' + sesiones.length + (sesiones.length === 1 ? ' sesión' : ' sesiones') + '</button>' +
    '<button class="btn-sec full" data-act="plan-a-mano" data-id="' + ex.id + '">Prefiero hacerlo a mano</button>' +
    '<button class="btn-txt" data-act="cerrar-capa">Ahora no</button></div>');
}

function crearPlanExamen() {
  const ex = estado.examenes.find(function (e) { return e.id === planExamen.id; });
  if (!ex) return;
  const sesiones = propuestaPlanExamen(ex, hoy(), planExamen.hora, horaActual());
  for (const s of sesiones) {
    const plan = {
      id: nuevoId(), hecho: false, avisado: false, examenId: ex.id,
      objetivo: s.objetivo, asignatura: ex.asignatura,
      fecha: s.fecha, hora: planExamen.hora, min: planExamen.min, antes: 10
    };
    estado.planes.push(plan);
    programarAvisoPlan(plan);
  }
  guardar();
  cerrarCapa();
  pintar();
  confeti();
  if (permisoAvisos() === "default") {
    mostrarCapa('<div class="msg">' + apixSVG("anima", "lg") + '<h1>¡Plan hecho!</h1>' +
      '<p>' + sesiones.length + ' sesiones antes del examen. Activa los avisos para que te recuerde cada una.</p>' +
      '<button class="btn" data-act="activar-avisos">Activar avisos</button><button class="btn-txt" data-act="cerrar-capa">Ahora no</button></div>');
  } else {
    toast("🗓️ Plan creado: " + sesiones.length + " sesiones. Apix te avisará.");
  }
}

// ---------- 2. ¿QUÉ ESTUDIO HOY? ----------
// Junta todo lo pendiente, le da puntos según lo urgente que es
// y devuelve las 3 cosas más importantes.
function queEstudioHoy(fechaHoy) {
  const cosas = [];

  // Planes de hoy sin cumplir: lo prometiste
  for (const p of planesDelDia(fechaHoy)) {
    if (p.hecho || !esPlanEstudio(p)) continue;
    cosas.push({ tipo: "plan", puntos: 95, id: p.id, titulo: p.objetivo, texto: "Lo prometiste para las " + p.hora });
  }

  // Deberes: cuanto antes se entreguen, más puntos
  for (const d of deberesPendientes()) {
    const dias = diasEntre(fechaHoy, d.fecha);
    let puntos = 0;
    let texto = "";
    if (dias < 0) { puntos = 100; texto = "¡Entrega atrasada!"; }
    else if (dias === 0) { puntos = 92; texto = "Se entrega hoy"; }
    else if (dias === 1) { puntos = 84; texto = "Se entrega mañana"; }
    else if (dias === 2) { puntos = 60; texto = "Se entrega en 2 días"; }
    if (puntos) cosas.push({ tipo: "deber", puntos: puntos, titulo: d.titulo, asignatura: d.asignatura || "", texto: texto });
  }

  // Exámenes de los próximos 7 días (si hoy ya tienes un plan para él, no lo repetimos)
  for (const e of proximosExamenes()) {
    const dias = diasEntre(fechaHoy, e.fecha);
    if (dias > 7) continue;
    const conPlanHoy = planesDelDia(fechaHoy).some(function (p) { return p.examenId === e.id && !p.hecho; });
    if (conPlanHoy) continue;
    cosas.push({
      tipo: "examen", puntos: 90 - dias * 4, titulo: e.tema || e.asignatura, asignatura: e.asignatura,
      texto: "Examen de " + e.asignatura + " " + (dias === 0 ? "hoy" : dias === 1 ? "mañana" : "en " + dias + " días")
    });
  }

  // Tarjetas que tocan repasar hoy
  const tarjetas = tarjetasParaHoy(null).length;
  if (tarjetas) {
    cosas.push({ tipo: "tarjetas", puntos: 55 + Math.min(tarjetas, 20), titulo: "Repasar tarjetas",
      texto: tarjetas + (tarjetas === 1 ? " tarjeta toca" : " tarjetas tocan") + " hoy" });
  }

  cosas.sort(function (a, b) { return b.puntos - a.puntos; });
  return cosas.slice(0, 3);
}

function abrirQueEstudio() {
  const cosas = queEstudioHoy(hoy());
  if (!cosas.length) {
    mostrarCapa('<div class="msg">' + apixSVG("campeon", "lg") + '<h1>¡Lo llevas al día!</h1>' +
      '<p>No tienes nada urgente. Puedes adelantar algo o descansar, que también hace falta.</p>' +
      '<button class="btn" data-act="ir-estudiar">Estudiar algo igualmente</button>' +
      '<button class="btn-txt" data-act="cerrar-capa">Cerrar</button></div>');
    return;
  }
  const iconos = { plan: "🤝", deber: "✏️", examen: "📅", tarjetas: "🃏" };
  const lista = cosas.map(function (c, i) {
    let boton = "";
    if (c.tipo === "plan") boton = '<button class="btn auto" data-act="empezar-plan" data-id="' + c.id + '">▶ Empezar</button>';
    if (c.tipo === "deber") boton = '<button class="btn auto" data-act="estudiar-ya" data-obj="' + esc("Hacer: " + c.titulo) + '" data-asig="' + esc(c.asignatura) + '" data-min="25">▶ Hacerlo</button>';
    if (c.tipo === "examen") boton = '<button class="btn auto" data-act="estudiar-ya" data-obj="' + esc("Repasar " + c.titulo) + '" data-asig="' + esc(c.asignatura) + '" data-min="45">▶ Repasar</button>';
    if (c.tipo === "tarjetas") boton = '<button class="btn auto" data-act="repasar-ya">▶ Repasar</button>';
    return '<div class="item"><div class="dia-caja"><b>' + (i + 1) + '</b></div>' +
      '<div class="grow"><span class="name">' + iconos[c.tipo] + ' ' + esc(c.titulo) + '</span><p class="muted small">' + esc(c.texto) + '</p></div>' +
      '<div class="acciones">' + boton + '</div></div>';
  }).join("");
  mostrarCapa('<div class="msg">' + apixSVG("estudia") +
    '<p class="label">Apix ha mirado tu agenda</p><h1>Empieza por aquí</h1>' +
    '<div class="card list" style="width:100%;text-align:left">' + lista + '</div>' +
    '<button class="btn-txt" data-act="cerrar-capa">Cerrar</button></div>');
}

// ---------- 3. RESUMEN DEL DOMINGO ----------
// Escribe los minutos como "3 h 20 min"
function textoMinutos(m) {
  const h = Math.floor(m / 60);
  const resto = m % 60;
  if (!h) return resto + " min";
  return h + " h" + (resto ? " " + resto + " min" : "");
}

// El domingo de la semana de esa fecha (si ya es domingo, ese mismo día)
function domingoDeLaSemana(fecha) {
  const diaSemana = new Date(fecha + "T12:00:00").getDay();   // 0 = domingo
  return sumarDias(fecha, (7 - diaSemana) % 7);
}

// Texto del resumen: lo que estudiaste esa semana y lo que viene la siguiente
function textoResumenSemana(domingo) {
  let minutos = 0;
  let dias = 0;
  for (let i = 6; i >= 0; i--) {
    const m = minutosDelDia(sumarDias(domingo, -i));
    minutos += m;
    if (m > 0) dias++;
  }
  const desde = sumarDias(domingo, 1);
  const hasta = sumarDias(domingo, 7);
  const examenes = estado.examenes.filter(function (e) { return e.fecha >= desde && e.fecha <= hasta; });
  const entregas = deberesPendientes().filter(function (d) { return d.fecha >= desde && d.fecha <= hasta; });

  let cuerpo = minutos
    ? "Esta semana has estudiado " + textoMinutos(minutos) + " en " + dias + (dias === 1 ? " día" : " días") + ". "
    : "Esta semana no has estudiado. ¡La que viene la empezamos con fuerza! ";
  if (examenes.length || entregas.length) {
    const partes = [];
    if (examenes.length) {
      const nombres = examenes.map(function (e) { return e.asignatura; }).slice(0, 3).join(", ");
      partes.push(examenes.length + (examenes.length === 1 ? " examen" : " exámenes") + " (" + nombres + ")");
    }
    if (entregas.length) partes.push(entregas.length + (entregas.length === 1 ? " entrega" : " entregas"));
    cuerpo += "La semana que viene: " + partes.join(" y ") + ".";
  } else {
    cuerpo += "La semana que viene no tienes exámenes ni entregas apuntados.";
  }
  return { titulo: "Apix 📊 Tu semana", cuerpo: cuerpo.slice(0, 290) };
}

// Programa (o actualiza) el aviso del domingo a las 20:00 con los datos de ahora
function programarResumenSemana() {
  if (permisoAvisos() !== "granted") return;
  let domingo = domingoDeLaSemana(hoy());
  if (domingo === hoy() && horaActual() >= "20:00") domingo = sumarDias(domingo, 7);
  const clave = "resumen-" + domingo;
  if (!configAvisos().resumen) { cancelarAvisoNube(clave); return; }
  const r = textoResumenSemana(domingo);
  avisoNube(clave, new Date(domingo + "T20:00:00"), r.titulo, r.cuerpo);
}

// ---------- 4. ESTADÍSTICAS POR ASIGNATURA ----------
let periodoAsig = 7;   // 7 días, 30 días o 0 (= siempre)

// Minutos de cada asignatura desde una fecha (null = desde siempre)
function minutosPorAsignatura(desde) {
  const porAsig = {};
  for (const s of estado.sesiones) {
    if (desde && s.fecha < desde) continue;
    const a = s.asignatura || "Sin asignatura";
    porAsig[a] = (porAsig[a] || 0) + s.min;
  }
  return porAsig;
}

// Asignaturas con examen en los próximos 14 días que no has tocado en los últimos 7
function asignaturasOlvidadas(fechaHoy) {
  const estudiadas = minutosPorAsignatura(sumarDias(fechaHoy, -6));
  const lista = [];
  for (const e of proximosExamenes()) {
    const dias = diasEntre(fechaHoy, e.fecha);
    if (dias > 14 || estudiadas[e.asignatura]) continue;
    if (lista.some(function (x) { return x.asignatura === e.asignatura; })) continue;
    lista.push({ asignatura: e.asignatura, dias: dias, tema: e.tema || e.asignatura });
  }
  return lista;
}

// Tarjeta "Por asignatura" de la pestaña Progreso
function tarjetaPorAsignatura() {
  const desde = periodoAsig ? sumarDias(hoy(), -(periodoAsig - 1)) : null;
  const porAsig = minutosPorAsignatura(desde);
  const asigs = Object.keys(porAsig).sort(function (a, b) { return porAsig[b] - porAsig[a]; });
  let total = 0;
  for (const a of asigs) total += porAsig[a];
  const maximo = asigs.length ? porAsig[asigs[0]] : 1;

  const periodos = [[7, "7 días"], [30, "30 días"], [0, "Siempre"]].map(function (p) {
    return '<button class="' + (periodoAsig === p[0] ? "on" : "") + '" data-act="periodo-asig" data-p="' + p[0] + '">' + p[1] + '</button>';
  }).join("");

  const barras = asigs.map(function (a) {
    const porcentaje = Math.round(porAsig[a] / total * 100);
    return '<div class="stack tight" style="gap:4px"><div class="row between"><span class="name"><span class="punto-asig" style="background:' + colorAsig(a) + '"></span> ' + esc(a) + '</span>' +
      '<span class="muted num">' + textoMinutos(porAsig[a]) + ' · ' + porcentaje + ' %</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(porAsig[a] / maximo * 100) + '%;background:' + colorAsig(a) + '"></i></div></div>';
  }).join("");

  const olvidadas = asignaturasOlvidadas(hoy()).map(function (o) {
    return '<div class="item"><div class="grow"><span class="name">⚠️ ' + esc(o.asignatura) + '</span>' +
      '<p class="muted small">Examen ' + (o.dias === 0 ? "hoy" : o.dias === 1 ? "mañana" : "en " + o.dias + " días") + ' y esta semana no la has tocado</p></div>' +
      '<div class="acciones"><button class="btn auto" data-act="estudiar-ya" data-obj="' + esc("Repasar " + o.tema) + '" data-asig="' + esc(o.asignatura) + '" data-min="25">▶ Estudiar</button></div></div>';
  }).join("");

  return '<div class="card stack"><h2>Por asignatura</h2><div class="seg">' + periodos + '</div>' +
    (barras || '<p class="vacio">' + (periodoAsig ? "En estos días no has estudiado." : "Cuando estudies, aquí verás en qué inviertes el tiempo.") + '</p>') +
    (olvidadas ? '<p class="label" style="margin-top:6px">Apix te avisa</p><div class="list">' + olvidadas + '</div>' : '') +
    '</div>';
}

// ---------- 5. REPASO DE ÚLTIMA HORA ----------
// Si tienes un examen hoy o mañana, Apix te ofrece repasar todas las tarjetas de esa asignatura
function examenParaRepasoExpres(fechaHoy) {
  return proximosExamenes().find(function (e) { return diasEntre(fechaHoy, e.fecha) <= 1; }) || null;
}

function tarjetaRepasoExpres() {
  const e = examenParaRepasoExpres(hoy());
  if (!e) return "";
  const cuando = e.fecha === hoy() ? "hoy" : "mañana";
  const tarjetas = (estado.tarjetas || []).filter(function (t) { return t.asignatura === e.asignatura; }).length;
  let boton = "";
  if (tarjetas) boton = '<button class="btn auto" data-act="repaso-expres" data-asig="' + esc(e.asignatura) + '">⚡ Repasar ' + tarjetas + (tarjetas === 1 ? ' tarjeta' : ' tarjetas') + '</button>';
  else if (estado.testApuntes) boton = '<button class="btn auto" data-act="ir-test">📝 Hacer un test</button>';
  else boton = '<button class="btn auto" data-act="ir-test">📝 Subir apuntes y hacer un test</button>';
  return '<div class="card stack tight expres"><p class="label">Repaso de última hora</p>' +
    '<p>Tienes examen de <b>' + esc(e.asignatura) + '</b> ' + cuando + '. Un repaso rápido ahora marca la diferencia.</p>' +
    '<div class="acciones">' + boton + '</div></div>';
}

// ---------- 6. CONSEJOS DE APIX ----------
// Cada 2 días, Apix enseña una función que aún no has usado (hasta que pulses "Vale" o "Probar")
const CONSEJOS = [
  { id: "test", texto: "Sube tus apuntes (PDF, Word o fotos) y te hago un examen tipo test.", boton: "Probar", act: "ir-test",
    usado: function () { return (estado.testsHechos || []).length > 0; } },
  { id: "rapido", texto: "¿Sin ganas de pensar? Pulsa «▶ 25 min ya» y empiezas a estudiar al momento.", boton: "Empezar", act: "estudio-rapido",
    usado: function () { return estado.sesiones.some(function (s) { return s.rapida; }); } },
  { id: "lista", texto: "Puedes crear muchas tarjetas de golpe pegando una lista: pregunta, guion y respuesta.", boton: "Probar", act: "pegar-tarjetas",
    usado: function () { return (estado.tarjetas || []).length >= 10; } },
  { id: "horario", texto: "Apunta tus clases en Agenda → Horario y te diré cuándo te toca estudiar.", boton: "Ir al horario", act: "ir-horario",
    usado: function () { return (estado.horario || []).length > 0; } },
  { id: "compartir", texto: "Pasa tus tarjetas a un compañero con el botón 📤 de cada asignatura.", boton: "Ver tarjetas", act: "ir-tarjetas",
    usado: function () { return !!estado.compartido || !(estado.tarjetas || []).length; } },
  { id: "silencio", texto: "En Ajustes puedes poner horas de silencio para que no te avise de noche ni en clase.", boton: "Ajustes", act: "ajustes",
    usado: function () { return false; } }
];

function consejoDeHoy(fechaHoy) {
  const c = estado.consejos || (estado.consejos = { vistos: [], ultimo: null, actual: null });
  const buscar = function (id) { return CONSEJOS.find(function (x) { return x.id === id; }); };
  if (c.actual && !c.vistos.includes(c.actual)) {
    const actual = buscar(c.actual);
    if (actual && !actual.usado()) return actual;
    c.actual = null;   // ya lo has usado por tu cuenta: no hace falta enseñarlo
  }
  if (c.ultimo && diasEntre(c.ultimo, fechaHoy) < 2) return null;
  const siguiente = CONSEJOS.find(function (x) { return !c.vistos.includes(x.id) && !x.usado(); });
  if (!siguiente) return null;
  c.actual = siguiente.id;
  c.ultimo = fechaHoy;
  guardar();
  return siguiente;
}

function tarjetaConsejo() {
  if (!estado.sesiones.length) return "";   // el primer día ya hay bastante que ver
  const c = consejoDeHoy(hoy());
  if (!c) return "";
  return '<div class="card stack tight consejo"><p>💡 <b>¿Sabías que…?</b> ' + esc(c.texto) + '</p>' +
    '<div class="acciones"><button class="btn auto" data-act="consejo-probar">' + c.boton + '</button>' +
    '<button class="btn-txt" data-act="consejo-vale">Vale</button></div></div>';
}

function cerrarConsejo(fechaHoy) {
  const c = estado.consejos;
  const id = c.actual;
  if (id && !c.vistos.includes(id)) c.vistos.push(id);
  c.actual = null;
  c.ultimo = fechaHoy || hoy();
  guardar();
  return CONSEJOS.find(function (x) { return x.id === id; });
}

// ---------- 7. DIARIO DE ESTUDIO ----------
function tarjetaDiario() {
  const entradas = estado.sesiones.filter(function (s) { return s.aprendido; }).slice(-5).reverse();
  if (!entradas.length) return "";
  return '<div class="card"><h2>📓 Lo que has aprendido</h2><div class="list">' + entradas.map(function (s) {
    return '<div class="item"><div class="grow"><span class="name">' + esc(s.aprendido) + '</span>' +
      '<p class="muted small">' + fechaCorta(s.fecha) + (s.asignatura ? ' · ' + esc(s.asignatura) : '') + '</p></div></div>';
  }).join("") + '</div></div>';
}

// ---------- Botones ----------
const ACCIONES_PLANIFICADOR = {
  "repaso-expres": function (b) { empezarRepaso(b.dataset.asig, true); },
  "ir-test": function () { vistaEstudiar = "test"; irA("estudiar"); },
  "ir-horario": function () { vistaAgenda = "horario"; irA("agenda"); },
  "consejo-vale": function () { cerrarConsejo(); pintar(); },
  "consejo-probar": function () {
    const c = cerrarConsejo();
    pintar();
    if (c && ACCIONES[c.act]) ACCIONES[c.act]({ dataset: {} });
  },
  "plan-examen-min": function (b) {
    planExamen.min = Number(b.dataset.min);
    abrirPlanExamen(planExamen.id);
  },
  "crear-plan-examen": function () { crearPlanExamen(); },
  "plan-a-mano": function (b) {
    const ex = estado.examenes.find(function (e) { return e.id === b.dataset.id; });
    cerrarCapa();
    hojaPlan(hoy(), ex);
  },
  "que-estudio": function () { abrirQueEstudio(); },
  "estudiar-ya": function (b) {
    cerrarCapa();
    empezarSesion(b.dataset.obj, b.dataset.asig, Number(b.dataset.min) || 25, null);
  },
  "repasar-ya": function () { cerrarCapa(); empezarRepaso(""); },
  "ir-estudiar": function () { cerrarCapa(); irA("estudiar"); },
  "periodo-asig": function (b) { periodoAsig = Number(b.dataset.p); pintarProgreso(); },
  "info-protector": function () {
    mostrarCapa('<div class="msg">' + apixSVG("anima", "lg") + '<p class="label">Racha</p><h1>Protector 🛡️</h1>' +
      '<p>Todos tenemos un mal día. <b>Una vez por semana</b> (de lunes a domingo), si un día no estudias, no pierdes la racha.</p>' +
      '<p class="muted">Solo salva días sueltos: si fallas dos días seguidos, la racha se pierde. El día salvado no suma, pero tampoco resta.</p>' +
      '<p><b>' + (protectorDisponible() ? "Esta semana aún te queda." : "Esta semana ya lo has usado.") + '</b></p>' +
      '<button class="btn" data-act="cerrar-capa">Entendido</button></div>');
  }
};

// Cambiar la hora en la ventana del plan
document.addEventListener("change", function (ev) {
  if (ev.target.dataset.cambio === "plan-examen-hora" && ev.target.value) {
    planExamen.hora = ev.target.value;
    abrirPlanExamen(planExamen.id);
  }
});
