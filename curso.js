// =====================================================
// APIX STUDY · CURSO, RACHA EN PELIGRO Y COMPARTIR
// 1. Fechas del curso: fin de cada evaluación y PAU (cuenta atrás en Inicio).
// 2. Aviso de "racha en peligro" a las 20:00 si ese día aún no has estudiado.
// 3. "Mi trimestre con Apix": resumen de cada evaluación.
// 4. Imagen para compartir tu semana o tu evaluación (WhatsApp, Instagram...).
// =====================================================

// ---------- 1. FECHAS DEL CURSO ----------
// Fechas aproximadas: cada uno puede poner las de su instituto en Ajustes
function fechasCurso(fechaHoy) {
  const d = new Date((fechaHoy || hoy()) + "T12:00:00");
  // El curso empieza en septiembre: de enero a agosto seguimos en el curso del año anterior
  const anio = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  const porDefecto = {
    inicio: anio + "-09-08",
    fin1: anio + "-12-22",
    fin2: (anio + 1) + "-03-19",
    fin3: (anio + 1) + "-06-18",
    pau: (anio + 1) + "-06-01"
  };
  const propias = estado.fechasCurso || {};
  // Solo valen las fechas guardadas de este mismo curso
  const delCurso = propias.curso === anio ? propias : {};
  return Object.assign(porDefecto, delCurso, { curso: anio });
}

// Las tres evaluaciones del curso: { numero, inicio, fin }
function evaluaciones(fechaHoy) {
  const f = fechasCurso(fechaHoy);
  return [
    { numero: 1, inicio: f.inicio, fin: f.fin1 },
    { numero: 2, inicio: sumarDias(f.fin1, 1), fin: f.fin2 },
    { numero: 3, inicio: sumarDias(f.fin2, 1), fin: f.fin3 }
  ];
}

// La evaluación en la que estamos (o null en verano)
function evaluacionActual(fechaHoy) {
  return evaluaciones(fechaHoy).find(function (e) { return fechaHoy >= e.inicio && fechaHoy <= e.fin; }) || null;
}

// Tarjeta de cuenta atrás para Inicio
function tarjetaCuentaAtras() {
  const ev = evaluacionActual(hoy());
  const f = fechasCurso(hoy());
  const partes = [];
  if (ev) {
    const dias = diasEntre(hoy(), ev.fin);
    partes.push('<span>📅 Fin de la ' + ev.numero + 'ª evaluación: <b>' + (dias === 0 ? "hoy" : dias + (dias === 1 ? " día" : " días")) + '</b></span>');
  }
  if (estado.nivel === "bachillerato" && f.pau >= hoy()) {
    const dias = diasEntre(hoy(), f.pau);
    partes.push('<span>🎓 PAU: <b>' + dias + (dias === 1 ? " día" : " días") + '</b></span>');
  }
  if (!partes.length) return "";
  return '<button class="cuenta-atras" data-act="ajustes" aria-label="Cambiar las fechas del curso">' + partes.join("") + '</button>';
}

// Ajustes: fechas del curso
function tarjetaFechasCurso() {
  const f = fechasCurso(hoy());
  const campo = function (clave, texto) {
    return '<label class="f">' + texto + '<input type="date" data-cambio="fecha-curso" data-clave="' + clave + '" value="' + f[clave] + '"></label>';
  };
  return '<div class="card stack tight"><h3>Fechas del curso</h3>' +
    '<p class="muted small">Son aproximadas. Pon las de tu instituto para que la cuenta atrás y tu resumen de cada evaluación cuadren.</p>' +
    '<div class="dos">' + campo("fin1", "Fin 1ª evaluación") + campo("fin2", "Fin 2ª evaluación") + '</div>' +
    '<div class="dos">' + campo("fin3", "Fin 3ª evaluación") + (estado.nivel === "bachillerato" ? campo("pau", "PAU (Selectividad)") : '') + '</div>' +
    (estado.nivel === "bachillerato" ? '<p class="muted small">La fecha de la PAU es la del año pasado. Cámbiala cuando tu comunidad publique la oficial.</p>' : '') +
    '</div>';
}

document.addEventListener("change", function (ev) {
  if (ev.target.dataset.cambio !== "fecha-curso" || !ev.target.value) return;
  const f = fechasCurso(hoy());
  estado.fechasCurso = Object.assign({}, estado.fechasCurso && estado.fechasCurso.curso === f.curso ? estado.fechasCurso : {}, { curso: f.curso });
  estado.fechasCurso[ev.target.dataset.clave] = ev.target.value;
  guardar();
  toast("✓ Fecha guardada");
});

// ---------- 2. RACHA EN PELIGRO ----------
function textoAvisoRacha(dias, conProtector) {
  return "Hoy aún no has estudiado y tu racha de " + dias + (dias === 1 ? " día" : " días") + " se pierde a medianoche. " +
    (conProtector ? "Si no estudias, gastarás tu protector 🛡️. " : "") + "¡Con 25 minutos la salvas!";
}

// Se llama al abrir la app y al terminar de estudiar.
// - Si hoy ya has estudiado: quitamos el aviso de hoy y dejamos preparado el de mañana.
// - Si hoy no has estudiado y tienes racha: aviso hoy a las 20:00.
function programarAvisoRacha() {
  if (permisoAvisos() !== "granted") return;
  const claveHoy = "racha-" + hoy();
  const manana = sumarDias(hoy(), 1);
  const claveManana = "racha-" + manana;
  if (!configAvisos().rachaAviso) { cancelarAvisoNube(claveHoy); cancelarAvisoNube(claveManana); return; }
  const dias = rachaActual();
  if (minutosDelDia(hoy()) > 0) {
    cancelarAvisoNube(claveHoy);
    avisoNube(claveManana, new Date(manana + "T20:00:00"), "Apix 🔥", textoAvisoRacha(dias, false));
  } else if (dias > 0) {
    avisoNube(claveHoy, new Date(hoy() + "T20:00:00"), "Apix 🔥", textoAvisoRacha(dias, protectorDisponible()));
  }
}

// ---------- 3. RESÚMENES (semana y evaluación) ----------
// Mejor racha (días seguidos estudiando) entre dos fechas
function mejorRachaEntre(desde, hasta) {
  const dias = {};
  for (const s of estado.sesiones) if (s.fecha >= desde && s.fecha <= hasta) dias[s.fecha] = true;
  let mejor = 0;
  let seguidos = 0;
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    seguidos = dias[d] ? seguidos + 1 : 0;
    mejor = Math.max(mejor, seguidos);
  }
  return mejor;
}

// Datos de un periodo: minutos, días, asignatura top, tests, tarjetas...
function resumenPeriodo(desde, hasta) {
  let minutos = 0;
  const dias = {};
  const porAsig = {};
  for (const s of estado.sesiones) {
    if (s.fecha < desde || s.fecha > hasta) continue;
    minutos += s.min;
    dias[s.fecha] = true;
    if (s.asignatura) porAsig[s.asignatura] = (porAsig[s.asignatura] || 0) + s.min;
  }
  const asignaturas = Object.keys(porAsig).sort(function (a, b) { return porAsig[b] - porAsig[a]; });
  const tests = (estado.testsHechos || []).filter(function (t) { return t.fecha >= desde && t.fecha <= hasta; });
  let tarjetas = 0;
  const repasos = estado.repasos || {};
  for (const fecha in repasos) if (fecha >= desde && fecha <= hasta) tarjetas += repasos[fecha];
  return {
    minutos: minutos,
    dias: Object.keys(dias).length,
    asignaturaTop: asignaturas[0] || "",
    minutosTop: asignaturas.length ? porAsig[asignaturas[0]] : 0,
    mejorRacha: mejorRachaEntre(desde, hasta),
    tests: tests.length,
    mejorNota: tests.length ? Math.max.apply(null, tests.map(function (t) { return t.nota; })) : null,
    tarjetas: tarjetas
  };
}

function lunesDeEstaSemana() { return lunesDe(hoy()); }

// Datos para la imagen de "Mi semana"
function datosImagenSemana() {
  const lunes = lunesDeEstaSemana();
  const domingo = sumarDias(lunes, 6);
  const r = resumenPeriodo(lunes, domingo);
  const semana = [];
  for (let i = 0; i < 7; i++) semana.push(minutosDelDia(sumarDias(lunes, i)) > 0);
  const rango = miRango();
  return {
    titulo: "Mi semana",
    subtitulo: fechaCorta(lunes) + " – " + fechaCorta(domingo),
    datos: [
      { icono: "⏱️", valor: textoMinutos(r.minutos), texto: "estudiando" },
      { icono: "🔥", valor: String(rachaActual()), texto: rachaActual() === 1 ? "día de racha" : "días de racha" },
      { icono: "✅", valor: r.dias + "/7", texto: "días con estudio" },
      { icono: "🏅", valor: rango.nombre, texto: numeroBonito(rango.xp) + " XP" }
    ],
    semana: semana,
    extra: r.asignaturaTop ? "Lo que más: " + r.asignaturaTop : (r.tests ? r.tests + " tests hechos" : "")
  };
}

// Datos de una evaluación (hasta hoy si aún no ha terminado)
function datosEvaluacion(ev) {
  const hasta = ev.fin < hoy() ? ev.fin : hoy();
  const r = resumenPeriodo(ev.inicio, hasta);
  return { ev: ev, r: r, terminada: ev.fin < hoy() };
}

function datosImagenEvaluacion(ev) {
  const d = datosEvaluacion(ev);
  const r = d.r;
  const datos = [
    { icono: "⏱️", valor: textoMinutos(r.minutos), texto: "estudiando" },
    { icono: "✅", valor: String(r.dias), texto: r.dias === 1 ? "día con estudio" : "días con estudio" },
    { icono: "🔥", valor: String(r.mejorRacha), texto: "mejor racha" },
    r.mejorNota !== null ? { icono: "📝", valor: formatoNota(r.mejorNota), texto: "mejor nota de test" }
      : { icono: "🃏", valor: String(r.tarjetas), texto: "tarjetas repasadas" }
  ];
  return {
    titulo: "Mi " + ev.numero + "ª evaluación",
    subtitulo: d.terminada ? "con Apix Study" : "hasta hoy",
    datos: datos,
    semana: null,
    extra: r.asignaturaTop ? "Mi asignatura: " + r.asignaturaTop + " (" + textoMinutos(r.minutosTop) + ")" : ""
  };
}

// Ventana "Mi trimestre con Apix"
function abrirResumenEvaluacion(numero) {
  const ev = evaluaciones(hoy()).find(function (e) { return e.numero === numero; });
  if (!ev) return;
  const d = datosEvaluacion(ev);
  const r = d.r;
  estado.resumenesVistos = estado.resumenesVistos || [];
  const clave = fechasCurso(hoy()).curso + "-" + numero;
  if (!estado.resumenesVistos.includes(clave)) { estado.resumenesVistos.push(clave); guardar(); pintar(); }   // quita el aviso de Inicio
  const fila = function (icono, texto) { return '<div class="item"><span class="rango-icono">' + icono + '</span><div class="grow"><span class="name">' + texto + '</span></div></div>'; };
  const filas = [
    fila("⏱️", "Has estudiado <b>" + textoMinutos(r.minutos) + "</b>"),
    fila("📅", "<b>" + r.dias + "</b> " + (r.dias === 1 ? "día" : "días") + " con estudio"),
    fila("🔥", "Tu mejor racha: <b>" + r.mejorRacha + (r.mejorRacha === 1 ? " día" : " días") + "</b>")
  ];
  if (r.asignaturaTop) filas.push(fila("📚", "Tu asignatura: <b>" + esc(r.asignaturaTop) + "</b> (" + textoMinutos(r.minutosTop) + ")"));
  if (r.tests) filas.push(fila("📝", "<b>" + r.tests + "</b> " + (r.tests === 1 ? "test" : "tests") + (r.mejorNota !== null ? " · mejor nota <b>" + formatoNota(r.mejorNota) + "</b>" : "")));
  if (r.tarjetas) filas.push(fila("🃏", "<b>" + r.tarjetas + "</b> tarjetas repasadas"));
  filas.push(fila(miRango().icono, "Ahora eres <b>" + miRango().nombre + "</b>"));
  const frase = !r.minutos ? "Aún no hay estudio en esta evaluación. ¡Empieza hoy y verás crecer tu resumen!"
    : r.minutos >= 1200 ? "¡Menuda evaluación! Se nota el esfuerzo." : "Cada minuto cuenta. ¡A por la siguiente!";
  mostrarCapa('<div class="msg">' + apixSVG(r.minutos ? "campeon" : "anima", "lg") +
    '<p class="label">' + (d.terminada ? "Tu resumen" : "Tu resumen hasta hoy") + '</p><h1>Mi ' + numero + 'ª evaluación</h1>' +
    '<p class="muted">' + frase + '</p>' +
    '<div class="card list" style="width:100%;text-align:left">' + filas.join("") + '</div>' +
    (r.minutos ? '<button class="btn" data-act="compartir-evaluacion" data-n="' + numero + '">📸 Compartir mi resumen</button>' : '') +
    '<button class="btn-txt" data-act="cerrar-capa">Cerrar</button></div>');
}

// Botones de Progreso: "Mi semana" y una por cada evaluación empezada
function tarjetaResumenes() {
  const empezadas = evaluaciones(hoy()).filter(function (e) { return e.inicio <= hoy(); });
  return '<div class="card stack tight"><h2>Tus resúmenes</h2>' +
    '<button class="btn-sec full" data-act="compartir-semana">📸 Compartir mi semana</button>' +
    (empezadas.length ? '<div class="chips">' + empezadas.map(function (e) {
      return '<button class="chip" data-act="ver-evaluacion" data-n="' + e.numero + '">🎁 ' + e.numero + 'ª evaluación</button>';
    }).join("") + '</div>' : '') + '</div>';
}

// Aviso en Inicio cuando una evaluación está acabando (o acaba de acabar) y no has visto su resumen
function evaluacionParaAvisar(fechaHoy) {
  const vistos = estado.resumenesVistos || [];
  const curso = fechasCurso(fechaHoy).curso;
  return evaluaciones(fechaHoy).find(function (e) {
    const cerca = fechaHoy >= sumarDias(e.fin, -5) && fechaHoy <= sumarDias(e.fin, 14);
    return cerca && !vistos.includes(curso + "-" + e.numero) && resumenPeriodo(e.inicio, e.fin).minutos > 0;
  }) || null;
}

function tarjetaAvisoEvaluacion() {
  const e = evaluacionParaAvisar(hoy());
  if (!e) return "";
  return '<div class="card stack tight consejo"><p>🎁 <b>Tu ' + e.numero + 'ª evaluación con Apix</b> ' + (e.fin < hoy() ? "ya está lista." : "está a punto de acabar.") + ' Mira todo lo que has estudiado.</p>' +
    '<div class="acciones"><button class="btn auto" data-act="ver-evaluacion" data-n="' + e.numero + '">Ver mi resumen</button></div></div>';
}

// ---------- 4. IMAGEN PARA COMPARTIR ----------
// Dibuja una imagen de 1080 × 1350 (formato de Instagram) con los datos
async function dibujarImagen(d) {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1080;
  lienzo.height = 1350;
  const c = lienzo.getContext("2d");
  const titulo = '"Chakra Petch", system-ui, sans-serif';
  const texto = '"Manrope", system-ui, sans-serif';
  try { await document.fonts.load("700 60px " + titulo); await document.fonts.load("700 40px " + texto); } catch (e) { /* sin fuentes, usa las del sistema */ }

  // Fondo morado con degradado
  const fondo = c.createLinearGradient(0, 0, 1080, 1350);
  fondo.addColorStop(0, "#5B2BE0");
  fondo.addColorStop(1, "#9B7EFF");
  c.fillStyle = fondo;
  c.fillRect(0, 0, 1080, 1350);

  // Apix arriba
  try {
    const svg = apixSVG("campeon").replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" ');
    const img = new Image();
    await new Promise(function (ok, mal) { img.onload = ok; img.onerror = mal; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    c.drawImage(img, 390, 40, 300, 300);
  } catch (e) { /* si no se puede dibujar, seguimos sin Apix */ }

  c.textAlign = "center";
  c.fillStyle = "#FFFFFF";
  c.font = "700 92px " + titulo;
  c.fillText(d.titulo.toUpperCase(), 540, 430);
  c.font = "600 40px " + texto;
  c.globalAlpha = 0.85;
  c.fillText(d.subtitulo, 540, 490);
  c.globalAlpha = 1;

  // 4 cajas blancas con los datos
  d.datos.forEach(function (dato, i) {
    const x = 70 + (i % 2) * 480;
    const y = 550 + Math.floor(i / 2) * 290;
    c.fillStyle = "rgba(255,255,255,0.95)";
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, 460, 260, 36); else c.rect(x, y, 460, 260);
    c.fill();
    c.fillStyle = "#15131C";
    c.font = "64px " + texto;
    c.fillText(dato.icono, x + 230, y + 85);
    c.font = "700 " + (dato.valor.length > 10 ? 50 : 64) + "px " + titulo;
    c.fillText(dato.valor, x + 230, y + 170);
    c.fillStyle = "#5E5A6B";
    c.font = "600 34px " + texto;
    c.fillText(dato.texto, x + 230, y + 222);
  });

  // Semana: L M X J V S D con ✓ en los días estudiados
  if (d.semana) {
    const letras = ["L", "M", "X", "J", "V", "S", "D"];
    d.semana.forEach(function (si, i) {
      const x = 180 + i * 120;
      c.fillStyle = si ? "#FFD23F" : "rgba(255,255,255,0.25)";
      c.beginPath();
      c.arc(x, 1150, 38, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = si ? "#15131C" : "#FFFFFF";
      c.font = "700 36px " + texto;
      c.fillText(si ? "✓" : letras[i], x, 1163);
    });
  }
  // Frase de abajo (asignatura que más has estudiado)
  if (d.extra) {
    c.fillStyle = "#FFFFFF";
    c.font = "700 38px " + texto;
    c.fillText(d.extra, 540, d.semana ? 1250 : 1170);
  }

  c.fillStyle = "#FFFFFF";
  c.globalAlpha = 0.9;
  c.font = "700 38px " + titulo;
  c.fillText("APIX STUDY", 540, 1310);
  c.globalAlpha = 1;

  return await new Promise(function (ok) { lienzo.toBlob(ok, "image/png"); });
}

let imagenParaCompartir = null;   // { blob, nombre, texto }

// Enseña la imagen y el botón de compartir
async function prepararImagen(datos, nombre) {
  mostrarCapa('<div class="msg"><p class="muted">Preparando la imagen…</p></div>');
  const blob = await dibujarImagen(datos);
  imagenParaCompartir = { blob: blob, nombre: nombre, texto: datos.titulo + " en Apix Study 📚" };
  const url = URL.createObjectURL(blob);
  mostrarCapa('<div class="msg"><img class="imagen-compartir" src="' + url + '" alt="' + esc(datos.titulo) + '">' +
    '<button class="btn" data-act="compartir-imagen">📤 Compartir</button>' +
    '<button class="btn-txt" data-act="cerrar-capa">Cerrar</button></div>');
}

async function compartirImagen() {
  if (!imagenParaCompartir) return;
  const archivo = new File([imagenParaCompartir.blob], imagenParaCompartir.nombre, { type: "image/png" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], text: imagenParaCompartir.texto });
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return;   // has cerrado la ventana de compartir
  }
  // Si el móvil no deja compartir archivos, la descargamos
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(imagenParaCompartir.blob);
  enlace.download = imagenParaCompartir.nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  toast("📥 Imagen guardada. Compártela desde tu galería.");
}

// ---------- Botones ----------
const ACCIONES_CURSO = {
  "compartir-semana": function () { prepararImagen(datosImagenSemana(), "mi-semana-apix.png"); },
  "ver-evaluacion": function (b) { abrirResumenEvaluacion(Number(b.dataset.n)); },
  "compartir-evaluacion": function (b) {
    const ev = evaluaciones(hoy()).find(function (e) { return e.numero === Number(b.dataset.n); });
    prepararImagen(datosImagenEvaluacion(ev), "mi-evaluacion-" + ev.numero + "-apix.png");
  },
  "compartir-imagen": function () { compartirImagen(); }
};
