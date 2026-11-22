// =====================================================
// APIX STUDY · TARJETAS DE REPASO
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
    !lista.length ? "Crea tarjetas con una pregunta y su respuesta (o deja que las saque yo de tus apuntes). Yo te las pregunto y repites más las que te cuestan."
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
        (total.length >= 4 ? '<button class="btn-sec" data-act="test-tarjetas" data-asig="' + esc(a) + '">📝 Test</button>' : '') +
        '<button class="btn-sec" data-act="ver-tarjetas" data-asig="' + esc(a) + '">Ver</button>' +
        '<button class="btn-sec" data-act="nueva-tarjeta" data-asig="' + esc(a) + '">+ Tarjeta</button>' +
      '</div></div>';
  }
  return html + '<button class="btn' + (lista.length ? '-sec full' : '') + '" data-act="tarjetas-apuntes-ir" data-asig="">✨ Crear tarjetas desde mis apuntes</button>' +
    '<div class="dos"><button class="btn-sec" data-act="nueva-tarjeta" data-asig="">+ Nueva tarjeta</button>' +
    '<button class="btn-sec" data-act="pegar-tarjetas" data-asig="">📋 Pegar una lista</button></div>';
}

// Lista de las tarjetas de una asignatura (para editarlas o borrarlas)
function listaTarjetasHTML(asig) {
  const lista = (estado.tarjetas || []).filter(function (t) { return t.asignatura === asig; });
  return '<div class="row between"><button class="btn-txt" data-act="volver-tarjetas">‹ Volver</button>' +
    '<span><button class="btn-txt" data-act="compartir-tarjetas" data-asig="' + esc(asig) + '">📤</button> ' +
    '<button class="btn-txt" data-act="pegar-tarjetas" data-asig="' + esc(asig) + '">📋 Lista</button> ' +
    '<button class="btn-txt" data-act="nueva-tarjeta" data-asig="' + esc(asig) + '">+ Tarjeta</button></span></div>' +
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

// ---------- Modo escribir: comparar tu respuesta con la buena ----------
// Quita mayúsculas, signos y artículos del principio ("el", "la", "the", "to"...)
function normalizarRespuesta(t, sinTildes) {
  let r = String(t || "").toLowerCase();
  if (sinTildes) r = r.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  r = r.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return r.replace(/^(el|la|los|las|un|una|unos|unas|the|a|an|to|le|les|der|die|das)\s+/, "");
}

// Cuántas letras hay que cambiar para pasar de una palabra a otra (distancia de Levenshtein)
function letrasDistintas(a, b) {
  const fila = [];
  for (let j = 0; j <= b.length; j++) fila.push(j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return fila[b.length];
}

// "si": está bien · "casi": falla una tilde o una letra · "no": no es eso
// · null: la respuesta es muy larga para comprobarla sola (la comparas tú)
function compararRespuesta(escrita, correcta) {
  if (!normalizarRespuesta(escrita, true)) return "no";
  if (correcta.split(/\s+/).length > 6) return null;
  // "car / coche" o "rojo, red": vale cualquiera de las opciones
  const opciones = correcta.split(/\s*[\/,;]\s*|\s+o\s+|\s+or\s+/).concat([correcta]);
  let mejor = "no";
  for (const op of opciones) {
    if (!op.trim()) continue;
    if (normalizarRespuesta(escrita) === normalizarRespuesta(op)) return "si";
    const a = normalizarRespuesta(escrita, true);
    const b = normalizarRespuesta(op, true);
    if (a === b) mejor = "casi";   // solo cambia una tilde
    else if (b.length >= 4 && letrasDistintas(a, b) <= (b.length > 7 ? 2 : 1)) mejor = "casi";
  }
  return mejor;
}

// ---------- Tarjetas a partir de tus apuntes ----------
let propuestaTarjetas = [];
function hojaTarjetasDeApuntes(asignatura) {
  const texto = apuntesDe(asignatura);   // generador.js
  propuestaTarjetas = texto ? tarjetasDesdeApuntes(texto, 20) : [];
  let cuerpo;
  // Subir archivos aquí mismo (PDF, Word, fotos o texto)
  const subir = '<button class="btn' + (texto ? '-sec full' : '') + '" data-act="tda-subir">📎 ' + (texto ? "Añadir más apuntes" : "Subir apuntes (PDF, Word, foto o texto)") + '</button>' +
    '<input type="file" id="tdaArchivo" accept=".pdf,.docx,.doc,.txt,.md,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden>' +
    '<p class="muted small" id="tdaLeyendo" aria-live="polite"></p><p class="err" id="tdaErr"></p>';
  if (!texto) {
    cuerpo = '<p class="vacio">Sube tus apuntes y saco las tarjetas. Con Word salen mejor.</p>' + subir;
  } else if (!propuestaTarjetas.length) {
    cuerpo = '<p class="vacio">Con estos apuntes no me salen tarjetas. Prueba con más texto (mejor en Word).</p>' + subir;
  } else {
    cuerpo = '<p class="muted small">Desmarca las que no te sirvan.</p><div class="list">' + propuestaTarjetas.map(function (t, i) {
      return '<label class="item elegir-tarjeta"><input type="checkbox" data-i="' + i + '" checked>' +
        '<div class="grow"><span class="name">' + esc(t.pregunta) + '</span><p class="muted small">' + esc(t.respuesta) + '</p></div></label>';
    }).join("") + '</div>' +
      '<button class="btn" data-act="crear-tarjetas-apuntes">Crear ' + propuestaTarjetas.length + ' tarjetas</button>' + subir;
  }
  abrirHoja('<div class="row between"><h2>Tarjetas de tus apuntes</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">Asignatura' + selectorAsig("tdaAsig", asignatura || "") + '</label>' + cuerpo);
}

function crearTarjetasDeApuntes() {
  const asignatura = leerAsig("tdaAsig") || "General";
  let creadas = 0;
  for (const caja of document.querySelectorAll(".elegir-tarjeta input")) {
    if (!caja.checked) continue;
    const t = propuestaTarjetas[Number(caja.dataset.i)];
    const repetida = estado.tarjetas.some(function (x) { return x.asignatura === asignatura && x.pregunta === t.pregunta; });
    if (repetida) continue;
    estado.tarjetas.push({ id: nuevoId(), asignatura: asignatura, pregunta: t.pregunta, respuesta: t.respuesta, caja: 1, proxima: hoy() });
    creadas++;
  }
  guardar();
  cerrarHoja();
  vistaEstudiar = "tarjetas";
  asigVerTarjetas = null;
  irA("estudiar");
  toast("🃏 " + creadas + (creadas === 1 ? " tarjeta creada" : " tarjetas creadas"));
}

// Lee los archivos, los junta con los apuntes de esa asignatura y vuelve a proponer tarjetas
async function subirApuntesTarjetas(archivos) {
  const asignatura = leerAsig("tdaAsig");
  let texto = apuntesDe(asignatura);
  for (const archivo of archivos) {
    try {
      $("tdaLeyendo").textContent = "Leyendo «" + archivo.name + "»…";
      const leido = (await leerArchivo(archivo, function (t) { if ($("tdaLeyendo")) $("tdaLeyendo").textContent = t; })).trim();   // lector.js
      texto = (texto ? texto + "\n\n" : "") + leido;
    } catch (e) {
      if ($("tdaErr")) $("tdaErr").textContent = e.message;
      return;
    }
  }
  guardarApuntes(asignatura, texto);   // también quedan guardados para hacer tests
  hojaTarjetasDeApuntes(asignatura);
}

// Cuenta en directo cuántas tarjetas vas a crear y cambia de asignatura
document.addEventListener("change", function (ev) {
  if (ev.target.closest && ev.target.closest(".elegir-tarjeta")) {
    const n = document.querySelectorAll(".elegir-tarjeta input:checked").length;
    const boton = document.querySelector('[data-act="crear-tarjetas-apuntes"]');
    if (boton) { boton.textContent = "Crear " + n + (n === 1 ? " tarjeta" : " tarjetas"); boton.disabled = !n; }
  }
  if (ev.target.id === "tdaAsig" && ev.target.value !== "otra") hojaTarjetasDeApuntes(ev.target.value);   // tda = tarjetas de apuntes
  if (ev.target.id === "tdaArchivo" && ev.target.files.length) { subirApuntesTarjetas(Array.from(ev.target.files)); ev.target.value = ""; }
});

// ---------- Crear muchas tarjetas pegando una lista ----------
// Una tarjeta por línea: "pregunta - respuesta" (también vale "=", ":", ";" o un tabulador)
const SEPARADORES_TARJETA = ["\t", " = ", " - ", " – ", " — ", ": ", ";"];

function parsearListaTarjetas(texto) {
  const tarjetas = [];
  let malas = 0;
  for (const bruta of String(texto || "").split("\n")) {
    const linea = bruta.replace(/^\s*([-•*·]|\d+[.)])\s+/, "").trim();   // quita viñetas y números de lista
    if (!linea || linea.indexOf("📚") === 0) continue;   // la línea de título de una lista compartida
    let partes = null;
    for (const sep of SEPARADORES_TARJETA) {
      const sitio = linea.indexOf(sep);
      if (sitio > 0) { partes = [linea.slice(0, sitio), linea.slice(sitio + sep.length)]; break; }
    }
    const pregunta = partes ? partes[0].trim() : "";
    const respuesta = partes ? partes[1].trim() : "";
    if (!pregunta || !respuesta) { malas++; continue; }
    tarjetas.push({ pregunta: pregunta.slice(0, 200), respuesta: respuesta.slice(0, 400) });
  }
  return { tarjetas: tarjetas, malas: malas };
}

// Texto para mandar las tarjetas a un compañero (se meten con "Pegar una lista")
function textoCompartirTarjetas(asignatura) {
  const lista = (estado.tarjetas || []).filter(function (t) { return t.asignatura === asignatura; });
  const limpiar = function (t) { return String(t).replace(/[\t\n\r]+/g, " / ").replace(/ = /g, "=").trim(); };
  const lineas = lista.map(function (t) {
    // Si la pregunta lleva un guion con espacios, lo cambiamos para que no se corte por ahí
    const pregunta = limpiar(t.pregunta).replace(/ [-–—] /g, " · ").replace(/: /g, ":\u00A0").replace(/;/g, ",");
    return pregunta + " - " + limpiar(t.respuesta);
  });
  return "📚 Tarjetas de " + asignatura + " (Apix Study)\n" + lineas.join("\n");
}

async function compartirTarjetas(asignatura) {
  const texto = textoCompartirTarjetas(asignatura);
  estado.compartido = true;
  guardar();
  try {
    if (navigator.share) { await navigator.share({ title: "Tarjetas de " + asignatura, text: texto }); return; }
  } catch (e) {
    if (e.name === "AbortError") return;   // has cerrado la ventana de compartir
  }
  try {
    await navigator.clipboard.writeText(texto);
    toast("📋 Copiadas. Pégalas en WhatsApp para tu compañero.");
  } catch (e) {
    toast("No he podido compartirlas en este móvil.");
  }
}

function hojaListaTarjetas(asignatura) {
  abrirHoja('<div class="row between"><h2>Pegar una lista</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<p class="muted">Escribe o pega <b>una tarjeta por línea</b>: la pregunta, un guion y la respuesta. Si un compañero te ha pasado sus tarjetas, pégalas aquí tal cual.</p>' +
    '<label class="f">Asignatura' + selectorAsig("tlAsig", asignatura || "") + '</label>' +
    '<label class="f">Tus tarjetas<textarea id="tlTexto" rows="9" placeholder="¿Qué es DHCP? - Un servicio que reparte direcciones IP\nPuerto de HTTPS - 443\nCapital de Francia = París"></textarea></label>' +
    '<p class="small" id="tlCuenta">Se crearán 0 tarjetas.</p>' +
    '<p class="err" id="tlErr"></p>' +
    '<button class="btn" data-act="guardar-lista-tarjetas">Crear tarjetas</button>');
  setTimeout(function () { if ($("tlTexto")) $("tlTexto").focus(); }, 80);
}

function guardarListaTarjetas() {
  const asignatura = leerAsig("tlAsig");
  const r = parsearListaTarjetas($("tlTexto").value);
  if (!asignatura) { $("tlErr").textContent = "Elige la asignatura (así se agrupan)."; return; }
  if (!r.tarjetas.length) { $("tlErr").textContent = "No encuentro ninguna tarjeta. Pon la pregunta, un guion ( - ) y la respuesta en cada línea."; return; }
  estado.tarjetas = estado.tarjetas || [];
  let creadas = 0;
  for (const t of r.tarjetas) {
    const repetida = estado.tarjetas.some(function (x) { return x.asignatura === asignatura && x.pregunta === t.pregunta; });
    if (repetida) continue;
    estado.tarjetas.push({ id: nuevoId(), asignatura: asignatura, pregunta: t.pregunta, respuesta: t.respuesta, caja: 1, proxima: hoy() });
    creadas++;
  }
  guardar();
  cerrarHoja();
  pintar();
  toast("🃏 " + creadas + (creadas === 1 ? " tarjeta creada" : " tarjetas creadas") + (r.malas ? " · " + r.malas + " líneas sin guion no se han usado" : ""));
}

// Cuenta en directo cuántas tarjetas saldrán
document.addEventListener("input", function (ev) {
  if (ev.target.id !== "tlTexto") return;
  const r = parsearListaTarjetas(ev.target.value);
  $("tlCuenta").textContent = "Se crearán " + r.tarjetas.length + (r.tarjetas.length === 1 ? " tarjeta" : " tarjetas") +
    (r.malas ? ". " + r.malas + (r.malas === 1 ? " línea no tiene" : " líneas no tienen") + " guion y no se usará" + (r.malas === 1 ? "" : "n") + "." : ".");
});

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
// todas = true: repasa todas las tarjetas de la asignatura (repaso de última hora antes del examen)
function empezarRepaso(asignatura, todas) {
  let cola = todas ? [] : tarjetasParaHoy(asignatura || null);
  // Si no toca ninguna, repasa todas las de esa asignatura igualmente
  if (!cola.length) cola = (estado.tarjetas || []).filter(function (t) { return !asignatura || t.asignatura === asignatura; });
  if (!cola.length) return;
  repaso = {
    cola: mezclar(cola).map(function (t) { return t.id; }),
    total: cola.length, hechas: 0, sabidas: 0, falladas: 0,
    fallidas: [],   // ids de las que has fallado alguna vez en este repaso
    inicio: Date.now(), titulo: asignatura || "Todas las asignaturas",
    seguidas: 0, mejorSeguidas: 0   // aciertos seguidos (🔥)
  };
  $("tabs").hidden = true;
  $("foco").hidden = false;
  pintarRepaso(false);
}

// girada: se ve la respuesta · comprobada: en modo escribir, { escrita, resultado }
function pintarRepaso(girada, comprobada) {
  const t = estado.tarjetas.find(function (x) { return x.id === repaso.cola[0]; });
  const progreso = Math.round(repaso.hechas / repaso.total * 100);
  const reves = !!estado.repasoReves;       // al revés: ves la respuesta y dices la pregunta
  const escribir = !!estado.repasoEscribir; // escribir la respuesta en vez de pensarla
  const delante = reves ? t.respuesta : t.pregunta;
  const detras = reves ? t.pregunta : t.respuesta;

  let abajo;
  if (!girada && escribir) {
    abajo = '<input id="rpEscribe" class="escribe-respuesta" placeholder="Escribe la respuesta" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<button class="btn" data-act="repaso-comprobar">Comprobar</button>' +
      '<button class="btn-txt" data-act="girar-tarjeta">No me la sé, ver respuesta</button>';
  } else if (!girada) {
    abajo = '<button class="btn" data-act="girar-tarjeta">Ver respuesta</button>';
  } else {
    const sugerida = comprobada ? comprobada.resultado : null;
    let veredicto = "";
    if (comprobada) {
      const textos = { si: "✅ ¡Correcto!", casi: "🤏 Casi: revisa alguna letra o tilde", no: "❌ No era eso" };
      veredicto = '<div class="explicacion-test ' + (sugerida === "si" ? "bien" : sugerida === "no" ? "mal" : "") + '">' +
        '<p class="small">Has escrito: <b>' + esc(comprobada.escrita || "—") + '</b></p>' +
        '<p><b>' + (sugerida ? textos[sugerida] : "Compara tu respuesta con la buena") + '</b></p></div>';
    }
    const boton = function (r, clase, icono, texto) {
      return '<button class="btn-sec ' + clase + (sugerida === r ? ' sugerida' : '') + '" data-act="respuesta-tarjeta" data-r="' + r + '">' + icono + '<br>' + texto + '</button>';
    };
    abajo = veredicto + '<p class="muted small">' + (sugerida ? "Confirma (o cámbialo si no estás de acuerdo):" : "¿Te la sabías?") + '</p>' +
      '<div class="tres respuestas">' + boton("no", "mal", "❌", "No") + boton("casi", "regular", "🤔", "Más o menos") + boton("si", "bien", "✅", "Sí") + '</div>';
  }

  $("foco").innerHTML = '<div class="in">' +
    '<div class="row between" style="width:100%"><button class="btn-txt" data-act="salir-repaso">✕ Salir</button>' +
    (repaso.seguidas >= 2 ? '<span class="pill ok">🔥 ' + repaso.seguidas + ' seguidas</span>' : '') +
    '<span class="muted small num">' + Math.min(repaso.hechas + 1, repaso.total) + ' / ' + repaso.total + '</span></div>' +
    '<div class="bar" style="width:100%"><i style="width:' + progreso + '%"></i></div>' +
    '<div class="row between" style="width:100%"><p class="label"><span class="punto-asig" style="background:' + colorAsig(t.asignatura) + '"></span> ' + esc(t.asignatura) + '</p>' +
      '<span><button class="chip ' + (escribir ? "on" : "") + '" data-act="repaso-modo" data-m="escribir">✍️ Escribir</button> ' +
      '<button class="chip ' + (reves ? "on" : "") + '" data-act="repaso-modo" data-m="reves">🔄 Al revés</button></span></div>' +
    '<button class="flashcard' + (girada ? ' girada' : '') + '" data-act="girar-tarjeta" aria-label="Dar la vuelta"' + (escribir && !girada ? ' tabindex="-1"' : '') + '>' +
      '<div class="cara delante"><p class="label">' + (reves ? "Respuesta" : "Pregunta") + '</p><p class="texto">' + esc(delante) + '</p>' +
        (escribir ? '' : '<p class="muted small">Toca para ver la ' + (reves ? "pregunta" : "respuesta") + '</p>') + '</div>' +
      '<div class="cara detras"><p class="label">' + (reves ? "Pregunta" : "Respuesta") + '</p><p class="texto">' + esc(detras) + '</p></div>' +
    '</button>' + abajo + '</div>';
  if (escribir && !girada) setTimeout(function () { if ($("rpEscribe")) $("rpEscribe").focus(); }, 60);
}

// Modo escribir: comprueba lo que has escrito
function comprobarEscrito() {
  const t = estado.tarjetas.find(function (x) { return x.id === repaso.cola[0]; });
  const escrita = $("rpEscribe").value.trim();
  const correcta = estado.repasoReves ? t.pregunta : t.respuesta;
  pintarRepaso(true, { escrita: escrita, resultado: compararRespuesta(escrita, correcta) });
}

// Intro en la caja de escribir = Comprobar
document.addEventListener("keydown", function (ev) {
  if (ev.key === "Enter" && ev.target.id === "rpEscribe") comprobarEscrito();
});

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
  contarRepaso();   // +1 XP (rangos.js)

  // Racha de aciertos seguidos 🔥
  repaso.seguidas = r === "si" ? repaso.seguidas + 1 : 0;
  repaso.mejorSeguidas = Math.max(repaso.mejorSeguidas, repaso.seguidas);
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
    programarAvisoRacha();   // curso.js
  }
  const r = repaso;
  repaso = null;
  cerrarFoco();
  confeti();
  const unicas = r.total - r.falladas;   // tarjetas distintas que has repasado
  const subida = comprobarSubida();
  mostrarCapa('<div class="msg">' + apixSVG("campeon", "xl") + '<p class="label">Repaso terminado</p><h1>¡Bien hecho!</h1>' +
    '<p>Te sabías <b>' + r.sabidas + ' de ' + unicas + '</b> a la primera' + (minutos >= 1 ? ' · ' + minutos + ' min' : '') + '.</p>' +
    '<p class="muted">' + (r.falladas ? "Las que fallaste te las volveré a preguntar pronto." : "¡Ni un fallo! Esas tardarán más en volver a salir.") + '</p>' +
    (r.mejorSeguidas >= 3 ? '<p class="big-num">🔥 ' + r.mejorSeguidas + ' seguidas</p>' : '') +
    (subida ? '<p class="subida">' + subida + '</p>' : '') +
    '<button class="btn" data-act="cerrar-capa">¡Genial!</button></div>');
}

// ---------- Botones ----------
const ACCIONES_TARJETAS = {
  "vista-estudiar": function (b) { vistaEstudiar = b.dataset.v; asigVerTarjetas = null; pintarEstudiar(); },
  "nueva-tarjeta": function (b) { hojaTarjeta(b.dataset.asig, null); },
  "pegar-tarjetas": function (b) { hojaListaTarjetas(b.dataset.asig); },
  "repaso-modo": function (b) {
    if (b.dataset.m === "escribir") estado.repasoEscribir = !estado.repasoEscribir;
    else estado.repasoReves = !estado.repasoReves;
    guardar();
    pintarRepaso(false);
  },
  "repaso-comprobar": function () { comprobarEscrito(); },
  "tarjetas-apuntes-ir": function () { hojaTarjetasDeApuntes(estado.testAsignatura || ""); },
  "crear-tarjetas-apuntes": function () { crearTarjetasDeApuntes(); },
  "tda-subir": function () { $("tdaArchivo").click(); },
  "ir-test-asig": function (b) { cerrarHoja(); estado.testAsignatura = b.dataset.asig; vistaEstudiar = "test"; irA("estudiar"); },
  "compartir-tarjetas": function (b) { compartirTarjetas(b.dataset.asig); },
  "guardar-lista-tarjetas": function () { guardarListaTarjetas(); },
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
