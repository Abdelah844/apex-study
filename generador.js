// =====================================================
// APIX STUDY · GENERADOR DE EXÁMENES TIPO TEST
// Pegas tus apuntes y la app crea un test de hasta 20 preguntas.
// Funciona sin internet y sin IA:
//   1. Parte los apuntes en frases.
//   2. Busca las palabras importantes (términos que se repiten, fechas, números, nombres).
//   3. En cada frase quita una palabra clave: "¿Qué palabra falta?".
//      Las opciones falsas son otras palabras importantes de tus apuntes.
//   4. Si hay definiciones ("X es..."), pregunta "¿Qué es X?".
// =====================================================

const MAX_PREGUNTAS = 20;
const HUECO = "_____";

// Palabras muy comunes que nunca son la respuesta
const PALABRAS_VACIAS = new Set(("de la que el en y a los del se las por un para con no una su al lo como más pero sus le ya o este " +
  "sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra " +
  "otros ese eso ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos " +
  "cual poco ella estar estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía " +
  "es son ser fue fueron era eran será serán sido está están estaba estaban tiene tienen tenía tener hace hacen hacer " +
  "puede pueden poder debe deben cada mismo misma mismos mismas tipo tipos forma formas parte partes manera través " +
  "además mientras según aunque entonces así bien solo sólo tan tal tales cuyo cuya dicho dicha dichos dichas siempre " +
  "nunca menos mayor menor mejor peor gran grande grandes primero primera segundo segunda último última luego después " +
  "otro aquí allí ahora hoy cosa cosas vez veces caso casos ejemplo ejemplos etc decir llamado llamada llamados llamadas " +
  "permite permiten utiliza utilizan usar usa usan uso sirve sirven existe existen cual cuales cuales donde cómo cuándo").split(" "));

// ---------- 1. Frases ----------
function dividirFrases(texto) {
  const frases = [];
  const lineas = String(texto || "").replace(/\r/g, "").split("\n");
  for (let linea of lineas) {
    // Quita viñetas y números de lista: "- ", "• ", "1. ", "a) "
    linea = linea.replace(/^\s*([-•*·▪►]|\d+[.)]|[a-zA-Z][)])\s+/, "").trim();
    if (!linea) continue;
    // Corta en ". " "! " "? " cuando lo siguiente empieza por mayúscula o número
    const trozos = linea.split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/);
    for (const t of trozos) {
      const frase = t.trim();
      const palabras = frase.split(/\s+/).length;
      if (palabras >= 6 && palabras <= 45) frases.push(frase);
    }
  }
  return frases;
}

// Palabras de una frase (letras y números, con tildes)
function palabrasDe(texto) {
  return String(texto).match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || [];
}

// ¿Qué tipo de palabra es? Así las opciones falsas son del mismo tipo
function tipoPalabra(palabra) {
  if (/^(1[0-9]{3}|20[0-9]{2})$/.test(palabra)) return "anio";
  if (/^\d+([.,]\d+)?$/.test(palabra)) return "numero";
  if (/^\p{Lu}/u.test(palabra)) return "nombre";
  return "palabra";
}

// Clase de palabra aproximada por cómo acaba (para que las opciones encajen en la frase)
function claseDe(palabra) {
  const p = palabra.toLowerCase();
  if (/mente$/.test(p)) return "adverbio";
  if (/(ar|er|ir|ando|iendo|aron|ieron|aban|ían)$/.test(p)) return "verbo";
  if (/(an|en)$/.test(p) && !/(men|gen)$/.test(p)) return "verbo";   // examen, imagen... son nombres
  return "nombre";
}

// ---------- 2. Palabras importantes ----------
// Devuelve { "clave en minúsculas": { texto, tipo, veces, puntos } }
function palabrasClave(frases) {
  const claves = {};
  for (const frase of frases) {
    const palabras = palabrasDe(frase);
    palabras.forEach(function (p, i) {
      const min = p.toLowerCase();
      const tipo = tipoPalabra(p);
      if (PALABRAS_VACIAS.has(min)) return;
      if (tipo === "palabra" && p.length < 5) return;
      if (tipo === "numero" && p.length < 2) return;
      // La primera palabra de la frase va en mayúscula por ser la primera, no por ser un nombre
      if (i === 0 && tipo === "nombre") return;
      if (!claves[min]) claves[min] = { texto: p, tipo: tipo, veces: 0, puntos: 0 };
      claves[min].veces++;
    });
  }
  for (const min in claves) {
    const c = claves[min];
    let puntos = Math.min(c.veces, 4);   // lo que se repite suele ser importante
    if (c.tipo === "anio") puntos += 3;
    if (c.tipo === "numero") puntos += 2;
    if (c.tipo === "nombre") puntos += 2;
    if (c.texto.length >= 8) puntos += 1;
    if (c.tipo === "palabra" && claseDe(c.texto) !== "nombre") puntos -= 2;   // mejor preguntar por sustantivos
    c.puntos = puntos;
  }
  return claves;
}

// ---------- Ayudas ----------
function mezclarCon(lista, azar) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    const t = copia[i]; copia[i] = copia[j]; copia[j] = t;
  }
  return copia;
}

// Escapa una palabra para usarla en una expresión regular
function escRegex(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Recorta un texto largo para que todas las opciones midan parecido
function recortar(t, max) { return t.length > max ? t.slice(0, max - 1).trim() + "…" : t; }

// Busca 3 opciones falsas del mismo tipo que la respuesta
function opcionesFalsas(respuesta, frase, claves, azar) {
  const tipo = tipoPalabra(respuesta);
  const enLaFrase = new Set(palabrasDe(frase).map(function (p) { return p.toLowerCase(); }));
  const candidatas = [];
  for (const min in claves) {
    const c = claves[min];
    if (min === respuesta.toLowerCase() || enLaFrase.has(min)) continue;
    if (c.tipo !== tipo) continue;
    if (tipo === "palabra" && claseDe(c.texto) !== claseDe(respuesta)) continue;
    // Se parecen más si miden parecido y acaban igual (masculino/femenino, singular/plural)
    let distancia = Math.abs(c.texto.length - respuesta.length) / 2;
    if (c.texto.slice(-1) !== respuesta.slice(-1)) distancia += 4;
    if (c.texto.slice(-2) === respuesta.slice(-2)) distancia -= 1;
    candidatas.push({ texto: c.texto, orden: distancia + azar() * 3 });
  }
  candidatas.sort(function (a, b) { return a.orden - b.orden; });
  const falsas = candidatas.slice(0, 3).map(function (c) { return c.texto; });

  // Fechas y números: si faltan, se crean cercanos (son opciones falsas, no datos)
  if (tipo === "anio" || tipo === "numero") {
    const n = Number(respuesta.replace(",", "."));
    let intento = 0;
    while (falsas.length < 3 && intento < 50) {
      intento++;
      const salto = tipo === "anio" ? Math.ceil(azar() * 15) : Math.max(1, Math.round(n * (0.2 + azar() * 0.6)));
      const otro = String(azar() < 0.5 ? n - salto : n + salto);
      if (otro !== respuesta && Number(otro) > 0 && !falsas.includes(otro)) falsas.push(otro);
    }
  }
  return falsas.length === 3 ? falsas : null;
}

// ---------- 3. Preguntas de "¿qué palabra falta?" ----------
function preguntaHueco(frase, posicion, claves, azar) {
  const palabras = palabrasDe(frase);
  // La mejor palabra clave de la frase (no la primera, y que salga una sola vez en la frase)
  let mejor = null;
  palabras.forEach(function (p, i) {
    const c = claves[p.toLowerCase()];
    if (!c || i === 0) return;
    const repetida = palabras.filter(function (x) { return x.toLowerCase() === p.toLowerCase(); }).length > 1;
    if (repetida) return;
    // Nombres de varias palabras ("Active Directory"): no se pregunta solo un trozo
    const mayus = function (x) { return x && /^\p{Lu}/u.test(x); };
    if (mayus(p) && ((i > 1 && mayus(palabras[i - 1])) || mayus(palabras[i + 1]))) return;
    const puntos = c.puntos + azar() * 0.5;
    if (!mejor || puntos > mejor.puntos) mejor = { texto: p, puntos: puntos };
  });
  if (!mejor || mejor.puntos < 2) return null;

  const falsas = opcionesFalsas(mejor.texto, frase, claves, azar);
  if (!falsas) return null;
  // Quita la palabra de la frase (solo la palabra entera)
  const exp = new RegExp("(^|[^\\p{L}\\p{N}])" + escRegex(mejor.texto) + "(?![\\p{L}\\p{N}])", "u");
  const enunciado = frase.replace(exp, "$1" + HUECO);
  if (enunciado === frase) return null;
  return { tipo: "hueco", enunciado: enunciado, correcta: mejor.texto, falsas: falsas, frase: frase, posicion: posicion, clave: mejor.texto };
}

// ---------- 4. Preguntas de definición: "X es ..." ----------
function buscarDefiniciones(frases) {
  const lista = [];
  frases.forEach(function (frase, posicion) {
    const m = frase.match(/^([\p{L}][\p{L}\p{N}\s()-]{1,45}?)\s+(es|son|se define como|consiste en|se denomina)\s+(.{15,})$/u);
    if (!m) return;
    const termino = m[1].trim();
    if (termino.split(/\s+/).length > 5) return;
    if (PALABRAS_VACIAS.has(termino.toLowerCase())) return;
    // "X es imprescindible para..." no es una definición
    const primera = m[3].split(/\s+/)[0].toLowerCase();
    if (/(ble|nte|oso|osa|ivo|iva|ario|aria)$/.test(primera) || ["muy", "más", "menos", "necesario", "importante", "fundamental"].includes(primera)) return;
    lista.push({ termino: termino, verbo: m[2], definicion: m[3].replace(/[.;]$/, ""), frase: frase, posicion: posicion });
  });
  return lista;
}

// "El controlador" → "el controlador", pero "Kerberos" se queda con mayúscula
function terminoEnFrase(termino) {
  const articulo = /^(El|La|Los|Las|Un|Una|Unos|Unas)\s/.test(termino);
  return articulo ? termino.charAt(0).toLowerCase() + termino.slice(1) : termino;
}

function preguntasDefinicion(definiciones, azar) {
  if (definiciones.length < 4) return [];
  return definiciones.map(function (d) {
    const otras = mezclarCon(definiciones.filter(function (x) { return x !== d && x.termino.toLowerCase() !== d.termino.toLowerCase(); }), azar).slice(0, 3);
    const pregunta = d.verbo === "son" ? "¿Qué son " : "¿Qué es ";
    return {
      tipo: "definicion",
      enunciado: pregunta + terminoEnFrase(d.termino) + "?",
      correcta: recortar(d.definicion, 130),
      falsas: otras.map(function (o) { return recortar(o.definicion, 130); }),
      frase: d.frase, posicion: d.posicion, clave: d.termino.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, "")
    };
  });
}

// ---------- Generar el examen ----------
// azar: función que da números entre 0 y 1 (Math.random; en las pruebas, una fija)
function generarExamen(texto, cuantas, azar) {
  azar = azar || Math.random;
  cuantas = Math.max(1, Math.min(MAX_PREGUNTAS, cuantas || 10));
  const frases = dividirFrases(texto);
  const claves = palabrasClave(frases);

  // Como mucho un tercio de preguntas de definición, para variar
  const defs = mezclarCon(preguntasDefinicion(buscarDefiniciones(frases), azar), azar).slice(0, Math.ceil(cuantas / 3));
  const usadas = new Set(defs.map(function (d) { return d.posicion; }));
  const huecos = [];
  frases.forEach(function (frase, i) {
    if (usadas.has(i)) return;
    const p = preguntaHueco(frase, i, claves, azar);
    if (p) huecos.push(p);
  });

  // Reparte las preguntas por todos los apuntes (no todas del principio)
  let todas = defs.concat(huecos);
  const yaPreguntado = new Set();
  todas = todas.filter(function (p) {   // la misma palabra no se pregunta dos veces
    const k = p.clave.toLowerCase();
    if (yaPreguntado.has(k)) return false;
    yaPreguntado.add(k);
    return true;
  });
  todas.sort(function (a, b) { return a.posicion - b.posicion; });
  let elegidas = todas;
  if (todas.length > cuantas) {
    elegidas = [];
    const tramo = todas.length / cuantas;
    for (let i = 0; i < cuantas; i++) {
      const desde = Math.floor(i * tramo);
      const hasta = Math.max(desde + 1, Math.floor((i + 1) * tramo));
      elegidas.push(todas[desde + Math.floor(azar() * (hasta - desde))]);
    }
  }

  // La respuesta correcta va en A, B, C o D repartida sin patrón
  let posiciones = [];
  while (posiciones.length < elegidas.length) posiciones = posiciones.concat(mezclarCon([0, 1, 2, 3], azar));
  return elegidas.map(function (p, i) {
    const opciones = p.falsas.slice();
    opciones.splice(posiciones[i], 0, p.correcta);
    return { enunciado: p.enunciado, opciones: opciones, correcta: posiciones[i], frase: p.frase, clave: p.clave };
  });
}

// Nota sobre 10 (con un decimal)
function notaTest(preguntas, respuestas) {
  let bien = 0;
  preguntas.forEach(function (p, i) { if (respuestas[i] === p.correcta) bien++; });
  return { bien: bien, nota: Math.round(bien / preguntas.length * 100) / 10 };
}

// =====================================================
// PANTALLAS
// =====================================================
let testCuantas = 10;
let test = null;   // el examen que estás haciendo: { preguntas, respuestas, actual, asignatura, texto }
const LETRAS = ["A", "B", "C", "D"];

// Pestaña Estudiar → Test
function vistaTestHTML() {
  const chips = [5, 10, 15, 20].map(function (n) {
    return '<button class="chip ' + (n === testCuantas ? "on" : "") + '" data-act="test-cuantas" data-n="' + n + '">' + n + '</button>';
  }).join("");
  const hechos = (estado.testsHechos || []).slice(-5).reverse().map(function (t) {
    return '<div class="item"><div class="grow"><span class="name">' + (t.asignatura ? esc(t.asignatura) : "Test") + '</span>' +
      '<p class="muted small">' + fechaCorta(t.fecha) + ' · ' + t.bien + ' de ' + t.preguntas + '</p></div>' +
      '<span class="pill ' + (t.nota >= 5 ? "ok" : "exam") + '">' + formatoNota(t.nota) + '</span></div>';
  }).join("");
  return tarjetaApix("estudia", "Apix", "Pega tus apuntes y te hago un examen tipo test. Así compruebas si te lo sabes.", "") +
    '<div class="card stack">' +
      '<label class="f">Tus apuntes<textarea id="tsTexto" rows="9" placeholder="Pega aquí el texto de tus apuntes (cuanto más texto, mejores preguntas)">' + esc(estado.testApuntes || "") + '</textarea></label>' +
      '<p class="muted small">¿Los tienes en PDF o Word? Ábrelo, mantén pulsado el texto, elige <b>Seleccionar todo</b> → <b>Copiar</b> y pégalo aquí.</p>' +
      '<label class="f">Asignatura (opcional)' + selectorAsig("tsAsig", estado.testAsignatura || "") + '</label>' +
      '<div><p class="label" style="margin-bottom:8px">Número de preguntas</p><div class="chips">' + chips + '</div></div>' +
      '<p class="err" id="tsErr"></p>' +
      '<button class="btn" data-act="crear-test">📝 Crear examen</button>' +
    '</div>' +
    (hechos ? '<div class="card"><h2>Tus últimos test</h2><div class="list">' + hechos + '</div></div>' : '');
}

function crearTest(mismoTexto) {
  const texto = mismoTexto ? test.texto : $("tsTexto").value.trim();
  const asignatura = mismoTexto ? test.asignatura : leerAsig("tsAsig");
  if (!mismoTexto) {
    if (texto.length < 200) { $("tsErr").textContent = "Pega más texto: al menos un par de párrafos de apuntes."; return; }
    estado.testApuntes = texto.slice(0, 60000);   // se guarda para no tener que pegarlo otra vez
    estado.testAsignatura = asignatura;
    guardar();
  }
  const preguntas = generarExamen(texto, testCuantas);
  if (preguntas.length < 3) {
    if (mismoTexto) { cerrarFoco(); return; }
    $("tsErr").textContent = "Con estos apuntes no salen suficientes preguntas. Pega más texto, con frases completas.";
    return;
  }
  test = { preguntas: preguntas, respuestas: [], actual: 0, asignatura: asignatura, texto: texto };
  $("tabs").hidden = true;
  $("foco").hidden = false;
  if (preguntas.length < testCuantas) test.aviso = "Tus apuntes dan para " + preguntas.length + " preguntas. Con más texto saldrán más.";
  pintarPregunta();
}

function pintarPregunta() {
  const p = test.preguntas[test.actual];
  const total = test.preguntas.length;
  const elegida = test.respuestas[test.actual];
  const ultima = test.actual === total - 1;
  const opciones = p.opciones.map(function (o, i) {
    return '<button class="opcion-test ' + (elegida === i ? "on" : "") + '" data-act="test-elegir" data-i="' + i + '">' +
      '<b>' + LETRAS[i] + '</b><span>' + esc(o) + '</span></button>';
  }).join("");
  $("foco").innerHTML = '<div class="in">' +
    '<div class="row between" style="width:100%"><button class="btn-txt" data-act="test-salir">✕ Salir</button>' +
    '<span class="muted small num">' + (test.actual + 1) + ' / ' + total + '</span></div>' +
    '<div class="bar" style="width:100%"><i style="width:' + Math.round(test.actual / total * 100) + '%"></i></div>' +
    '<p class="label">' + (test.asignatura ? esc(test.asignatura) : "Examen tipo test") + '</p>' +
    (test.aviso && test.actual === 0 ? '<p class="muted small">' + esc(test.aviso) + '</p>' : '') +
    '<p class="enunciado-test">' + esc(p.enunciado).replace(HUECO, '<span class="hueco">' + HUECO + '</span>') + '</p>' +
    '<div class="stack tight" style="width:100%">' + opciones + '</div>' +
    '<div class="dos" style="width:100%">' +
      '<button class="btn-sec" data-act="test-anterior"' + (test.actual === 0 ? " disabled" : "") + '>‹ Anterior</button>' +
      (ultima ? '<button class="btn" data-act="test-terminar">Corregir</button>'
              : '<button class="btn" data-act="test-siguiente">Siguiente ›</button>') +
    '</div></div>';
}

function terminarTest() {
  const sinResponder = test.preguntas.length - test.respuestas.filter(function (r) { return r !== undefined; }).length;
  if (sinResponder && !confirm("Te quedan " + sinResponder + " sin responder (cuentan como fallo). ¿Corregir ya?")) return;
  const r = notaTest(test.preguntas, test.respuestas);
  estado.testsHechos = (estado.testsHechos || []).concat([{ fecha: hoy(), asignatura: test.asignatura, nota: r.nota, bien: r.bien, preguntas: test.preguntas.length }]).slice(-30);
  guardar();

  const fallos = [];
  test.preguntas.forEach(function (p, i) { if (test.respuestas[i] !== p.correcta) fallos.push(i); });
  const humor = r.nota >= 9 ? "campeon" : r.nota >= 5 ? "contento" : "anima";
  const frase = r.nota >= 9 ? "¡Te lo sabes de maravilla!" : r.nota >= 5 ? "¡Aprobado! Repasa los fallos y lo bordas." : "Aún no está. Repasa lo de abajo y vuelve a intentarlo.";

  const lista = fallos.map(function (i) {
    const p = test.preguntas[i];
    const tuya = test.respuestas[i];
    const exp = new RegExp(escRegex(esc(p.opciones[p.correcta])));
    return '<div class="card stack tight fallo-test" style="text-align:left;width:100%">' +
      '<p class="label">Pregunta ' + (i + 1) + '</p><p><b>' + esc(p.enunciado) + '</b></p>' +
      '<p class="small mal">❌ Tu respuesta: ' + (tuya === undefined ? "sin responder" : LETRAS[tuya] + ") " + esc(p.opciones[tuya])) + '</p>' +
      '<p class="small bien">✅ Correcta: ' + LETRAS[p.correcta] + ') ' + esc(p.opciones[p.correcta]) + '</p>' +
      '<p class="muted small">En tus apuntes: «' + esc(p.frase).replace(exp, function (t) { return "<b>" + t + "</b>"; }) + '»</p></div>';
  }).join("");
  // Conceptos fallados, sin repetir
  const conceptos = [];
  for (const i of fallos) {
    const c = test.preguntas[i].clave;
    if (!conceptos.some(function (x) { return x.toLowerCase() === c.toLowerCase(); })) conceptos.push(c);
  }
  const repasar = conceptos.map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join(" ");

  $("foco").innerHTML = '<div class="in">' + apixSVG(humor, "lg") +
    '<p class="label">Tu nota</p><p class="nota-test">' + formatoNota(r.nota) + '<small> / 10</small></p>' +
    '<p>' + r.bien + ' de ' + test.preguntas.length + ' bien. ' + frase + '</p>' +
    (fallos.length ? '<div style="width:100%;text-align:left"><p class="label">Conceptos que tienes que repasar</p><div class="chips">' + repasar + '</div></div>' +
      '<button class="btn-sec full" data-act="test-a-tarjetas">🃏 Pasar los fallos a tarjetas de repaso</button>' + lista : '') +
    '<button class="btn" data-act="test-otra-vez">🔄 Otro test con los mismos apuntes</button>' +
    '<button class="btn-txt" data-act="test-cerrar">Cerrar</button></div>';
  if (r.nota >= 9) confeti();
}

// Crea una tarjeta de repaso por cada pregunta fallada
function fallosATarjetas() {
  let nuevas = 0;
  test.preguntas.forEach(function (p, i) {
    if (test.respuestas[i] === p.correcta) return;
    const pregunta = recortar(p.enunciado, 200);
    const yaEsta = estado.tarjetas.some(function (t) { return t.pregunta === pregunta; });
    if (yaEsta) return;
    estado.tarjetas.push({ id: nuevoId(), asignatura: test.asignatura || "General", pregunta: pregunta, respuesta: p.opciones[p.correcta], caja: 1, proxima: hoy() });
    nuevas++;
  });
  guardar();
  toast(nuevas ? "🃏 " + nuevas + (nuevas === 1 ? " tarjeta creada" : " tarjetas creadas") : "Esas tarjetas ya las tenías");
}

// ---------- Botones ----------
const ACCIONES_GENERADOR = {
  "test-cuantas": function (b) {
    testCuantas = Number(b.dataset.n);
    for (const c of document.querySelectorAll('[data-act="test-cuantas"]')) c.classList.toggle("on", c === b);
  },
  "crear-test": function () { crearTest(false); },
  "test-elegir": function (b) { test.respuestas[test.actual] = Number(b.dataset.i); pintarPregunta(); },
  "test-siguiente": function () { test.actual++; pintarPregunta(); },
  "test-anterior": function () { if (test.actual > 0) { test.actual--; pintarPregunta(); } },
  "test-terminar": function () { terminarTest(); },
  "test-a-tarjetas": function (b) { fallosATarjetas(); b.disabled = true; },
  "test-otra-vez": function () { crearTest(true); },
  "test-salir": function () {
    if (!confirm("¿Salir del examen? Se perderán tus respuestas.")) return;
    test = null;
    cerrarFoco();
  },
  "test-cerrar": function () { test = null; cerrarFoco(); }
};
