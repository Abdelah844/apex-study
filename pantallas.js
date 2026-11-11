// =====================================================
// APIX STUDY · PANTALLAS
// Dibuja cada pestaña: Inicio, Estudiar, Agenda, Calendario y Progreso.
// =====================================================

// ---------- 4. PANTALLAS ----------
function pintar() {
  // Marca la pestaña activa en la barra de abajo
  document.querySelectorAll("nav.tabs button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.tab === tab);
  });
  if (tab === "inicio") pintarInicio();
  if (tab === "estudiar") pintarEstudiar();
  if (tab === "agenda") pintarAgenda();
  if (tab === "calendario") pintarCalendario();
  if (tab === "progreso") pintarProgreso();
}

function irA(nueva) { tab = nueva; window.scrollTo(0, 0); pintar(); }

function cabecera(titulo, sub) {
  return '<div class="head"><div><p class="label">' + sub + '</p><h1>' + titulo + '</h1></div>' +
    '<button class="icon-btn" data-act="ajustes" aria-label="Ajustes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div>';
}

// Tarjeta de Apix con su bocadillo
function tarjetaApix(humor, titulo, mensaje, botones) {
  return '<div class="apix-card tono-' + humor + '"><div class="apix-con-medalla">' + apixSVG(humor) +
    '<span class="medalla" aria-label="Tu rango">' + miRango().icono + '</span></div>' +
    '<div class="bocadillo"><p class="label">' + titulo + '</p><p>' + esc(mensaje) + '</p>' +
    (botones ? '<div class="acciones">' + botones + '</div>' : '') + '</div></div>';
}

// Una fila de examen
function filaExamen(e, conBotones) {
  const d = new Date(e.fecha + "T12:00:00");
  const pasado = e.fecha < hoy();
  const nota = notaDeExamen(e.id);

  // Etiqueta: cuenta atrás, o la nota si ya pasó
  let pill = '<span class="pill exam">' + cuentaAtras(e.fecha) + '</span>';
  if (pasado) pill = nota ? '<span class="pill" style="color:' + colorNota(nota.nota) + '">Nota ' + formatoNota(nota.nota) + '</span>' : '<span class="pill pend">Pasado</span>';

  let botones = "";
  if (pasado && !nota) botones += '<button class="btn auto" data-act="nota-de-examen" data-id="' + e.id + '">Poner nota</button>';
  if (conBotones && !pasado) botones += '<button class="btn-sec" data-act="plan-de-examen" data-id="' + e.id + '">Planificar estudio</button>';
  if (conBotones) botones += '<button class="btn-sec" data-act="editar-examen" data-id="' + e.id + '">Editar</button>' +
    '<button class="btn-sec btn-danger" data-act="borrar-examen" data-id="' + e.id + '">Borrar</button>';

  return '<div class="item"><div class="dia-caja exam"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString("es-ES", { month: "short" }) + '</span></div>' +
    '<div class="grow"><span class="name"><span class="punto-asig" style="background:' + colorAsig(e.asignatura) + '"></span> ' + esc(e.asignatura) + '</span>' +
    '<p class="muted small">' + esc(e.tema || "Examen") + (e.hora ? ' · ' + e.hora : '') + '</p>' +
    '</div>' + pill +
    (botones ? '<div class="acciones">' + botones + '</div>' : '') + '</div>';
}

// Una fila de plan de estudio
function filaPlan(p, conBotones) {
  const st = estadoPlan(p);
  let botones = "";
  if (conBotones) {
    // Puedes ponerte a estudiar ya, aunque el plan sea para más tarde
    if (!p.hecho) botones += '<button class="btn auto" data-act="empezar-plan" data-id="' + p.id + '">▶ Estudiar</button>';
    if (!p.hecho) botones += '<button class="btn-sec" data-act="editar-plan" data-id="' + p.id + '">Editar</button>';
    botones += '<button class="btn-sec btn-danger" data-act="borrar-plan" data-id="' + p.id + '">Borrar</button>';
  }
  return '<div class="item"><div class="dia-caja"><b>' + p.hora + '</b><span>' + (p.fecha === hoy() ? "hoy" : fechaCorta(p.fecha)) + '</span></div>' +
    '<div class="grow"><span class="name">' + esc(p.objetivo) + '</span>' +
    '<p class="muted small">' + (p.asignatura ? esc(p.asignatura) + ' · ' : '') + p.min + ' min</p>' +
    '</div><span class="pill ' + st.clase + '">' + st.texto + '</span>' +
    (botones ? '<div class="acciones">' + botones + '</div>' : '') + '</div>';
}

// ===== Pestaña INICIO =====
function pintarInicio() {
  const apix = estadoMascota();
  let botonApix = "";
  if (apix.plan) botonApix = '<button class="btn auto" data-act="empezar-plan" data-id="' + apix.plan + '">Empezar ahora</button>';
  if (apix.boton) botonApix = apix.boton;

  // Semana actual (de lunes a domingo)
  const lunes = sumarDias(hoy(), -((new Date().getDay() + 6) % 7));
  let semana = "";
  const letras = ["L", "M", "X", "J", "V", "S", "D"];
  const salvados = diasSalvados();   // días que salvó el protector 🛡️
  for (let i = 0; i < 7; i++) {
    const dia = sumarDias(lunes, i);
    const estudiado = minutosDelDia(dia) > 0;
    const salvado = salvados.includes(dia);
    const clase = (estudiado ? "on " : "") + (salvado ? "salvado " : "") + (dia === hoy() ? "today" : "");
    semana += '<div>' + letras[i] + '<i class="' + clase + '">' + (estudiado ? "✓" : salvado ? "🛡️" : "") + '</i></div>';
  }

  const examenes = proximosExamenes().slice(0, 3);
  const planes = proximosPlanes().slice(0, 3);

  $("app").innerHTML = '<div class="stack">' +
    cabecera(estado.nombre ? "Hola, " + esc(estado.nombre) : "Apix Study", fechaLarga(hoy())) +
    tarjetaApix(apix.humor, "Apix", apix.mensaje, botonApix) +
    '<div class="card hero stack tight">' +
      '<div class="grid3">' +
        '<div><p class="label">Racha</p><p class="big-num num">🔥 ' + rachaActual() + '</p><p class="muted small">días</p></div>' +
        '<div><p class="label">Hoy</p><p class="big-num num">' + minutosDelDia(hoy()) + '</p><p class="muted small">minutos</p></div>' +
        '<div><p class="label">Exámenes</p><p class="big-num num">' + proximosExamenes().length + '</p><p class="muted small">por hacer</p></div>' +
      '</div>' +
      bloqueRango() +   // rangos.js
      '<div class="week" style="margin-top:8px">' + semana + '</div>' +
      '<button class="btn-txt protector" data-act="info-protector">' + (protectorDisponible() ? "🛡️ Protector de racha: te queda 1 esta semana" : "🛡️ Protector de racha: ya usado esta semana") + '</button>' +
      '<button class="btn" data-act="ir" data-tab="estudiar" style="margin-top:10px">Empezar a estudiar</button>' +
      '<button class="btn-sec full" data-act="que-estudio">🤔 ¿Qué estudio hoy?</button>' +
    '</div>' +
    tarjetaHorarioHoy() +
    tarjetaDeberesInicio() +
    '<div class="card"><div class="row between"><h2>Planes de estudio</h2><button class="btn-txt" data-act="nuevo-plan">+ Nuevo</button></div>' +
      '<div class="list">' + (planes.length ? planes.map(function (p) { return filaPlan(p, true); }).join("") :
        '<p class="vacio">¿Cuándo vas a empezar a estudiar? Ponle fecha y hora, y Apix te avisará.</p>') + '</div></div>' +
    '<div class="card"><div class="row between"><h2>Próximos exámenes</h2><button class="btn-txt" data-act="nuevo-examen">+ Nuevo</button></div>' +
      '<div class="list">' + (examenes.length ? examenes.map(function (e) { return filaExamen(e, false); }).join("") :
        '<p class="vacio">Apunta tus exámenes para no llevarte sustos.</p>') + '</div></div>' +
    '</div>';
}

// ===== Pestaña ESTUDIAR =====
function pintarEstudiar() {
  const paraHoy = tarjetasParaHoy(null).length;
  const seg = '<div class="seg">' +
    '<button class="' + (vistaEstudiar === "sesion" ? "on" : "") + '" data-act="vista-estudiar" data-v="sesion">⏱️ Sesión</button>' +
    '<button class="' + (vistaEstudiar === "tarjetas" ? "on" : "") + '" data-act="vista-estudiar" data-v="tarjetas">🃏 Tarjetas' + (paraHoy ? ' (' + paraHoy + ')' : '') + '</button></div>';
  if (vistaEstudiar === "tarjetas") {
    $("app").innerHTML = '<div class="stack">' + cabecera("Estudiar", "Tarjetas de repaso") + seg + vistaTarjetasHTML() + '</div>';
    return;
  }
  const tiempos = [15, 25, 45, 60, 90];
  const chips = tiempos.map(function (m) {
    return '<button class="chip ' + (m === minutosElegidos ? "on" : "") + '" data-act="tiempo" data-min="' + m + '">' + m + ' min</button>';
  }).join("");
  const planesHoy = planesDelDia(hoy()).filter(function (p) { return !p.hecho; });

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Estudiar", "Sesión de concentración") + seg +
    tarjetaApix("estudia", "Apix", "Dime qué vas a aprender y cuánto tiempo. Yo vigilo que no te escapes al móvil.", "") +
    '<div class="card stack">' +
      '<label class="f">¿Qué quieres aprender?<input id="objetivo" placeholder="Ej: ecuaciones, gramática..." maxlength="80"></label>' +
      '<label class="f">Asignatura (opcional)' + selectorAsig("asignatura", "") + '</label>' +
      '<div><p class="label" style="margin-bottom:8px">Tiempo</p><div class="chips">' + chips + '</div></div>' +
      '<p class="err" id="errEstudiar"></p>' +
      '<button class="btn" data-act="empezar">Empezar a estudiar</button>' +
    '</div>' +
    (planesHoy.length ? '<div class="card"><h2>Tus planes de hoy</h2><div class="list">' + planesHoy.map(function (p) { return filaPlan(p, true); }).join("") + '</div></div>' : '') +
    '<div class="card stack tight"><h3>📵 Bloquea las redes sociales</h3>' +
      '<p class="muted">Una web no puede bloquear otras apps, pero Android sí. Antes de empezar:</p>' +
      '<p class="small">1. Abre <b>Ajustes</b> → <b>Bienestar digital y controles parentales</b>.<br>2. Pulsa <b>Modo concentración</b>.<br>3. Marca Instagram, TikTok… y pulsa <b>Activar ahora</b>.</p>' +
      '<p class="muted small">Además, si sales de Apix Study mientras estudias, Apix se enfada y lo apunta.</p>' +
    '</div></div>';
}

// ===== Pestaña AGENDA =====
function pintarAgenda() {
  let contenido = "";
  if (vistaAgenda === "examenes") {
    const futuros = proximosExamenes();
    const pasados = estado.examenes.filter(function (e) { return e.fecha < hoy(); }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    contenido = '<div class="card"><div class="list">' +
      (futuros.length ? futuros.map(function (e) { return filaExamen(e, true); }).join("") : '<p class="vacio">No tienes exámenes apuntados.</p>') +
      '</div></div>' +
      '<button class="btn" data-act="nuevo-examen">+ Añadir examen</button>' +
      (pasados.length ? '<div class="card"><p class="label">Ya pasados</p><div class="list">' + pasados.map(function (e) { return filaExamen(e, false); }).join("") + '</div></div>' : '');
  } else if (vistaAgenda === "deberes") {
    contenido = vistaDeberesHTML();
  } else if (vistaAgenda === "horario") {
    contenido = vistaHorarioHTML();
  } else {
    const futuros = estado.planes.filter(function (p) { return p.fecha >= hoy(); }).sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; });
    const pasados = estado.planes.filter(function (p) { return p.fecha < hoy(); }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 10);
    contenido = '<div class="card"><div class="list">' +
      (futuros.length ? futuros.map(function (p) { return filaPlan(p, true); }).join("") : '<p class="vacio">Aún no has dicho cuándo vas a estudiar.</p>') +
      '</div></div>' +
      '<button class="btn" data-act="nuevo-plan">+ ¿Cuándo empiezo a estudiar?</button>' +
      (pasados.length ? '<div class="card"><p class="label">Anteriores</p><div class="list">' + pasados.map(function (p) { return filaPlan(p, false); }).join("") + '</div></div>' : '');
  }

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Agenda", "Organiza tu semana") +
    '<div class="seg">' +
      '<button class="' + (vistaAgenda === "examenes" ? "on" : "") + '" data-act="vista-agenda" data-v="examenes">Exámenes</button>' +
      '<button class="' + (vistaAgenda === "deberes" ? "on" : "") + '" data-act="vista-agenda" data-v="deberes">Deberes</button>' +
      '<button class="' + (vistaAgenda === "planes" ? "on" : "") + '" data-act="vista-agenda" data-v="planes">Planes</button>' +
      '<button class="' + (vistaAgenda === "horario" ? "on" : "") + '" data-act="vista-agenda" data-v="horario">Horario</button>' +
    '</div>' + contenido + '</div>';
}

// ===== Pestaña CALENDARIO =====
function pintarCalendario() {
  const anio = mesVista.getFullYear();
  const mes = mesVista.getMonth();
  const titulo = mesVista.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  // Empezamos en el lunes de la semana del día 1
  const primero = fechaISO(mesVista);
  const hueco = (mesVista.getDay() + 6) % 7;
  let dia = sumarDias(primero, -hueco);

  let celdas = ["L", "M", "X", "J", "V", "S", "D"].map(function (l) { return '<span class="dsem">' + l + '</span>'; }).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(dia + "T12:00:00");
    let clases = "";
    if (d.getMonth() !== mes) clases += " fuera";
    if (dia === hoy()) clases += " hoy";
    if (dia === diaSel) clases += " sel";
    let puntos = "";
    if (estado.examenes.some(function (e) { return e.fecha === dia; })) puntos += '<i class="e"></i>';
    if (estado.planes.some(function (p) { return p.fecha === dia; })) puntos += '<i class="p"></i>';
    if (estado.deberes.some(function (x) { return x.fecha === dia && !x.hecho; })) puntos += '<i class="d"></i>';
    if (minutosDelDia(dia) > 0) puntos += '<i class="s"></i>';
    celdas += '<button class="' + clases + '" data-act="dia" data-dia="' + dia + '">' + d.getDate() + '<span class="puntos">' + puntos + '</span></button>';
    dia = sumarDias(dia, 1);
    // Si ya hemos pasado el mes y la semana está completa, paramos
    if (i % 7 === 6 && new Date(dia + "T12:00:00").getMonth() !== mes && i >= 27) break;
  }

  // Lo que hay el día seleccionado
  let detalle = "";
  if (diaSel) {
    const ex = estado.examenes.filter(function (e) { return e.fecha === diaSel; });
    const pl = planesDelDia(diaSel);
    const min = minutosDelDia(diaSel);
    const de = estado.deberes.filter(function (x) { return x.fecha === diaSel; });
    let lista = ex.map(function (e) { return filaExamen(e, true); }).join("") +
      de.map(function (x) { return filaDeber(x, true); }).join("") +
      pl.map(function (p) { return filaPlan(p, true); }).join("");
    if (!lista) lista = '<p class="vacio">Nada apuntado este día.</p>';
    detalle = '<div class="card stack tight"><h2>' + fechaLarga(diaSel) + '</h2>' +
      (min ? '<p class="muted">✓ Estudiaste ' + min + ' min</p>' : '') +
      '<div class="list">' + lista + '</div>' +
      '<div class="tres"><button class="btn-sec" data-act="nuevo-examen" data-fecha="' + diaSel + '">+ Examen</button>' +
      '<button class="btn-sec" data-act="nuevo-deber" data-fecha="' + diaSel + '">+ Deberes</button>' +
      '<button class="btn-sec" data-act="nuevo-plan" data-fecha="' + diaSel + '">+ Plan</button></div></div>';
  }

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Calendario", "Tu mes de un vistazo") +
    '<div class="card stack">' +
      '<div class="row between"><button class="icon-btn" data-act="mes" data-n="-1" aria-label="Mes anterior">‹</button>' +
      '<h2>' + titulo + '</h2><button class="icon-btn" data-act="mes" data-n="1" aria-label="Mes siguiente">›</button></div>' +
      '<div class="cal">' + celdas + '</div>' +
      '<div class="leyenda"><span><i style="background:var(--exam)"></i>Examen</span><span><i style="background:var(--warn)"></i>Entrega</span><span><i style="background:var(--fire)"></i>Plan de estudio</span><span><i style="background:var(--good)"></i>Estudiaste</span></div>' +
    '</div>' + detalle + '</div>';
}

// ===== Pestaña PROGRESO =====
function pintarProgreso() {
  const seg = '<div class="seg">' +
    '<button class="' + (vistaProgreso === "estudio" ? "on" : "") + '" data-act="vista-progreso" data-v="estudio">Estudio</button>' +
    '<button class="' + (vistaProgreso === "notas" ? "on" : "") + '" data-act="vista-progreso" data-v="notas">Mis notas</button></div>';
  if (vistaProgreso === "notas") {
    $("app").innerHTML = '<div class="stack">' + cabecera("Progreso", "Tus notas") + seg + vistaNotasHTML() + '</div>';
    return;
  }
  // Minutos de los últimos 7 días
  const dias = [];
  for (let i = 6; i >= 0; i--) dias.push(sumarDias(hoy(), -i));
  const minutos = dias.map(minutosDelDia);
  const maximo = Math.max(30, Math.max.apply(null, minutos));
  const barras = dias.map(function (d, i) {
    const alto = Math.round((minutos[i] / maximo) * 100);
    const letra = new Date(d + "T12:00:00").toLocaleDateString("es-ES", { weekday: "narrow" });
    return '<div><span class="num">' + (minutos[i] || "") + '</span><i class="' + (minutos[i] ? "" : "cero") + '" style="height:' + alto + '%"></i>' + letra + '</div>';
  }).join("");

  // Total de horas
  let total = 0;
  for (const s of estado.sesiones) total += s.min;

  const cumplidos = estado.planes.filter(function (p) { return p.hecho; }).length;
  const vencidos = estado.planes.filter(function (p) { return estadoPlan(p).clase !== "pend"; }).length;
  const ultimas = estado.sesiones.slice(-8).reverse();

  $("app").innerHTML = '<div class="stack">' +
    cabecera("Progreso", "Tu constancia") + seg +
    '<div class="card">' + bloqueRango() + '</div>' +
    '<div class="grid3">' +
      '<div class="card"><p class="label">Racha</p><p class="big-num num">' + rachaActual() + '</p><p class="muted small">mejor: ' + estado.mejorRacha + ' · 🛡️ ' + (protectorDisponible() ? "1" : "0") + '</p></div>' +
      '<div class="card"><p class="label">Total</p><p class="big-num num">' + (total / 60).toFixed(1).replace(".", ",") + '</p><p class="muted small">horas</p></div>' +
      '<div class="card"><p class="label">Palabra</p><p class="big-num num">' + cumplidos + '/' + vencidos + '</p><p class="muted small">planes cumplidos</p></div>' +
    '</div>' +
    '<div class="card stack"><h2>Últimos 7 días</h2><div class="grafica">' + barras + '</div></div>' +
    tarjetaPorAsignatura() +   // planificador.js
    '<div class="card"><h2>Últimas sesiones</h2><div class="list">' +
      (ultimas.length ? ultimas.map(function (s) {
        return '<div class="item"><div class="grow"><span class="name">' + esc(s.objetivo) + '</span><p class="muted small">' + fechaCorta(s.fecha) + ' · ' + s.hora + (s.asignatura ? ' · ' + esc(s.asignatura) : '') + '</p></div>' +
          '<span class="pill ' + (s.distracciones ? "pend" : "ok") + '">' + s.min + ' min' + (s.distracciones ? ' · ' + s.distracciones + ' salidas' : '') + '</span></div>';
      }).join("") : '<p class="vacio">Aún no hay sesiones.</p>') +
    '</div></div></div>';
}

