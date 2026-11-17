// =====================================================
// APIX STUDY · GENERADOR DE EXÁMENES TIPO TEST
// Pegas tus apuntes y la app crea un test de hasta 20 preguntas.
// Funciona sin internet y sin IA:
//   1. Parte los apuntes en frases.
//   2. Busca las palabras importantes (términos que se repiten, fechas, números, nombres).
//   3. En cada frase quita una palabra clave: "¿Qué palabra falta?".
//      Las opciones falsas son otras palabras importantes de tus apuntes.
//   4. Si hay definiciones ("X es..."), pregunta "¿Qué es X?" y "¿Qué concepto es este?".
//   5. También hace verdadero o falso y "¿Cuál de estas afirmaciones es correcta?",
//      cambiando a propósito una palabra de algunas frases.
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
// Quita lo que no son apuntes: índice, encabezados y pies de página, números de página
function limpiarTexto(texto) {
  const lineas = String(texto || "").replace(/\r/g, "").split("\n");
  // Las líneas que se repiten 3 veces o más son encabezados o pies de página
  // (por ejemplo "Ministerio de Educación" en cada hoja de un PDF)
  const veces = {};
  const comoClave = function (l) { return l.trim().toLowerCase().replace(/\d+/g, "#"); };
  for (const l of lineas) {
    const k = comoClave(l);
    if (k.length >= 3) veces[k] = (veces[k] || 0) + 1;
  }
  return lineas.filter(function (l) {
    const t = l.trim();
    if (!t) return true;
    if (veces[comoClave(t)] >= 3 && t.length < 120 && !/\.$/.test(t)) return false;   // encabezado o pie (no acaban en punto)
    if (/(\.{4,}|…{2,}|·{4,}|_{4,}|\. \. \. \.)/.test(t)) return false;    // línea del índice "Tema 1 ........ 5"
    if (/^(p[áa]g(ina)?\.?\s*)?\d+(\s*(\/|de)\s*\d+)?$/i.test(t)) return false; // "Página 3", "3 / 20", "14"
    return true;
  }).join("\n");
}

// Frases que no se entienden solas ("Esta división es...", "Por ello...")
const EMPIEZA_SIN_CONTEXTO = /^(est[aeo]s?|es[aeo]s?|aquel(l[oa]s?)?|dich[oa]s?|ell[oa]s?|por (ello|eso|tanto|lo tanto|este motivo)|sin embargo|además|también|así|asimismo|en este caso|de esta (forma|manera)|de este modo|otr[oa]s?|lo anterior|en cambio|no obstante|esto)\b/i;
// En los PDF y en las fotos una frase suele venir cortada en varias líneas: las volvemos a juntar
function juntarLineas(texto) {
  const lineas = limpiarTexto(texto).split("\n");
  const juntas = [];
  for (const bruta of lineas) {
    const linea = bruta.trim();
    if (!linea) { juntas.push(""); continue; }
    // El lector de fotos a veces mete una línea en blanco en mitad de una frase: la quitamos
    const antesDelHueco = juntas.length > 1 ? juntas[juntas.length - 2] : "";
    if (juntas[juntas.length - 1] === "" && antesDelHueco && !/[.!?:;]$/.test(antesDelHueco) && /^[\p{Ll}0-9(]/u.test(linea)) juntas.pop();
    const anterior = juntas.length ? juntas[juntas.length - 1] : "";
    const esVineta = /^([-•*·▪►]|\d+[.)]|[a-zA-Z][)])\s/.test(linea);
    const anteriorAcaba = /[.!?:;]$/.test(anterior);
    const empiezaMinuscula = /^[\p{Ll}0-9(]/u.test(linea);
    if (anterior && !esVineta && !anteriorAcaba && empiezaMinuscula) {
      // "palabra-" al final de línea: era una palabra partida
      juntas[juntas.length - 1] = /-$/.test(anterior) ? anterior.slice(0, -1) + linea : anterior + " " + linea;
    } else {
      juntas.push(linea);
    }
  }
  return juntas;
}

function dividirFrases(texto) {
  const frases = [];
  for (let linea of juntarLineas(texto)) {
    // Quita viñetas y números de lista: "- ", "• ", "1. ", "a) "
    const esVineta = /^\s*([-•*·▪►]|\d+[.)]|[a-zA-Z][)])\s+/.test(linea);
    linea = linea.replace(/^\s*([-•*·▪►]|\d+[.)]|[a-zA-Z][)])\s+/, "").trim();
    if (!linea) continue;
    // Un título no acaba en punto: solo valen frases terminadas (o puntos de una lista)
    if (!esVineta && !/[.!?:;»")]$/.test(linea)) continue;
    // Corta en ". " "! " "? " cuando lo siguiente empieza por mayúscula o número
    const trozos = linea.split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/);
    for (const t of trozos) {
      const frase = t.trim();
      const palabras = frase.split(/\s+/).length;
      if (palabras < 6 || palabras > 45) continue;
      if (EMPIEZA_SIN_CONTEXTO.test(frase)) continue;
      if (/^\d+(\s+\d+)+\s/.test(frase)) continue;   // "14 5 Introducción..." (números de apartado y página)
      frases.push(frase);
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
  if (/(ar|er|ir|ando|iendo|aron|ieron|aba|aban|ían)$/.test(p)) return "verbo";
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
    distancia -= Math.min(c.veces, 3) * 0.8;   // las palabras que se repiten suelen ser conceptos del tema
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
    const anteriorEsNombre = i > 1 ? mayus(palabras[i - 1]) : mayus(palabras[0]) && !PALABRAS_VACIAS.has(palabras[0].toLowerCase());
    if (mayus(p) && (anteriorEsNombre || mayus(palabras[i + 1]))) return;
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
  // ¿Sirve para hacer una frase falsa creíble? Solo si la palabra cambiada encaja (fechas, números, nombres
  // o palabras que acaban igual, como "dominio" → "directorio")
  const tipo = tipoPalabra(mejor.texto);
  const buenCambio = tipo !== "palabra" || falsas[0].slice(-1) === mejor.texto.slice(-1);
  return { tipo: "hueco", enunciado: enunciado, correcta: mejor.texto, falsas: falsas, frase: frase, posicion: posicion, clave: mejor.texto, buenCambio: buenCambio };
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

// Quita el artículo y pone mayúscula: "el controlador de dominio" → "Controlador de dominio"
function conceptoLimpio(termino) {
  const t = termino.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Dos tipos con las definiciones: "¿Qué es X?" y "¿Qué concepto es este?" (unir concepto y definición)
function preguntasDefinicion(definiciones, azar) {
  if (definiciones.length < 4) return [];
  return definiciones.map(function (d) {
    const otras = mezclarCon(definiciones.filter(function (x) { return x !== d && x.termino.toLowerCase() !== d.termino.toLowerCase(); }), azar).slice(0, 3);
    const clave = conceptoLimpio(d.termino);
    const definicion = recortar(d.definicion, 130);
    if (azar() < 0.5) {
      return {
        tipo: "definicion", enunciado: (d.verbo === "son" ? "¿Qué son " : "¿Qué es ") + terminoEnFrase(d.termino) + "?",
        correcta: definicion, falsas: otras.map(function (o) { return recortar(o.definicion, 130); }),
        frase: d.frase, resalta: definicion.replace(/…$/, ""), posicion: d.posicion, clave: clave
      };
    }
    return {
      tipo: "concepto", enunciado: "¿A qué concepto corresponde esta definición? «" + definicion + "»",
      correcta: clave, falsas: otras.map(function (o) { return conceptoLimpio(o.termino); }),
      frase: d.frase, resalta: d.termino, posicion: d.posicion, clave: clave
    };
  });
}

// Una frase de los apuntes con una palabra cambiada por otra (para las afirmaciones falsas)
function fraseCambiada(h) {
  return h.enunciado.replace(HUECO, h.falsas[0]);
}

// Convierte una pregunta de hueco en "verdadero o falso"
function preguntaVerdaderoFalso(h, verdadera) {
  const afirmacion = verdadera ? h.frase : fraseCambiada(h);
  return {
    tipo: "vf", enunciado: "¿Verdadero o falso? «" + afirmacion + "»",
    opciones: ["Verdadero", "Falso"], correcta: verdadera ? 0 : 1,
    frase: h.frase, resalta: h.correcta, posicion: h.posicion, clave: h.clave,
    tarjeta: { pregunta: "¿Verdadero o falso? «" + afirmacion + "»", respuesta: (verdadera ? "Verdadero" : "Falso") + ". En tus apuntes: «" + h.frase + "»" }
  };
}

// Con 4 frases: "¿Cuál es correcta?" (1 real y 3 cambiadas) o "¿Cuál es incorrecta?" (3 reales y 1 cambiada)
function preguntaAfirmaciones(grupo, azar) {
  const otrasCambiables = grupo.slice(1).every(function (h) { return h.buenCambio; });
  let buscaCorrecta = azar() < 0.6;
  if (buscaCorrecta && !otrasCambiables) buscaCorrecta = false;
  if (!buscaCorrecta && !grupo[0].buenCambio) buscaCorrecta = true;
  if (buscaCorrecta && !otrasCambiables) return null;   // no se pueden hacer frases falsas creíbles
  const principal = grupo[0];   // la frase en la que se fija la respuesta
  const correcta = buscaCorrecta ? principal.frase : fraseCambiada(principal);
  const falsas = grupo.slice(1).map(function (h) { return buscaCorrecta ? fraseCambiada(h) : h.frase; });
  return {
    tipo: "afirmaciones",
    enunciado: buscaCorrecta ? "¿Cuál de estas afirmaciones es correcta?" : "¿Cuál de estas afirmaciones es INCORRECTA?",
    correcta: recortar(correcta, 170), falsas: falsas.map(function (f) { return recortar(f, 170); }),
    frase: principal.frase, resalta: principal.correcta, posicion: principal.posicion, clave: principal.clave
  };
}

// Elige "cuantos" elementos repartidos por toda la lista (no todos del principio)
function repartir(lista, cuantos, azar) {
  if (lista.length <= cuantos) return lista.slice();
  const elegidos = [];
  const tramo = lista.length / cuantos;
  for (let i = 0; i < cuantos; i++) {
    const desde = Math.floor(i * tramo);
    const hasta = Math.max(desde + 1, Math.floor((i + 1) * tramo));
    elegidos.push(lista[desde + Math.floor(azar() * (hasta - desde))]);
  }
  return elegidos;
}

// ---------- Generar el examen ----------
// Mezcla de tipos: rellenar hueco, verdadero o falso, ¿cuál es correcta?, ¿qué es X? y ¿qué concepto es?
// azar: función que da números entre 0 y 1 (Math.random; en las pruebas, una fija)
function generarExamen(texto, cuantas, azar) {
  azar = azar || Math.random;
  cuantas = Math.max(1, Math.min(MAX_PREGUNTAS, cuantas || 10));
  const frases = dividirFrases(texto);
  const claves = palabrasClave(frases);

  // 1. Definiciones: como mucho una cuarta parte del examen
  const defs = mezclarCon(preguntasDefinicion(buscarDefiniciones(frases), azar), azar).slice(0, Math.ceil(cuantas / 4));
  const usadas = new Set(defs.map(function (d) { return d.posicion; }));

  // 2. Frases con una palabra clave (cada palabra se pregunta una sola vez)
  const yaPreguntado = new Set(defs.map(function (d) { return d.clave.toLowerCase(); }));
  const huecos = [];
  frases.forEach(function (frase, i) {
    if (usadas.has(i)) return;
    const h = preguntaHueco(frase, i, claves, azar);
    if (!h || yaPreguntado.has(h.clave.toLowerCase())) return;
    yaPreguntado.add(h.clave.toLowerCase());
    huecos.push(h);
  });

  // 3. ¿Cuántas de cada tipo? "¿Cuál es correcta?" gasta 4 frases, las demás 1
  let quedan = Math.min(cuantas - defs.length, huecos.length);
  let afirmaciones = Math.min(Math.floor(quedan / 5), Math.floor((huecos.length - quedan) / 3));
  if (afirmaciones < 0) afirmaciones = 0;
  const vf = Math.floor(quedan / 5);
  const tipos = [];
  for (let i = 0; i < afirmaciones; i++) tipos.push("afirmaciones");
  for (let i = 0; i < vf; i++) tipos.push("vf");
  while (tipos.length < quedan) tipos.push("hueco");
  const orden = mezclarCon(tipos, azar);

  // 4. Construir las preguntas recorriendo los apuntes en orden
  const elegidos = repartir(huecos, quedan + afirmaciones * 3, azar);
  const preguntas = defs.slice();
  let n = 0;
  for (const tipo of orden) {
    if (n >= elegidos.length) break;
    const afirm = tipo === "afirmaciones" && n + 4 <= elegidos.length ? preguntaAfirmaciones(elegidos.slice(n, n + 4), azar) : null;
    if (afirm) {
      preguntas.push(afirm);
      n += 4;
    } else if (tipo === "vf") {
      // Falsa solo si el cambio de palabra es creíble
      const verdadera = !elegidos[n].buenCambio || azar() < 0.5;
      preguntas.push(preguntaVerdaderoFalso(elegidos[n], verdadera));
      n++;
    } else {
      preguntas.push(elegidos[n]);
      n++;
    }
  }
  preguntas.sort(function (a, b) { return a.posicion - b.posicion; });

  // 5. La respuesta correcta va en A, B, C o D repartida sin patrón
  let posiciones = [];
  return preguntas.map(function (p) {
    if (p.tipo === "vf") return p;   // ya tiene sus 2 opciones
    if (!posiciones.length) posiciones = mezclarCon([0, 1, 2, 3], azar);
    const sitio = posiciones.pop();
    const opciones = p.falsas.slice();
    opciones.splice(sitio, 0, p.correcta);
    return {
      tipo: p.tipo, enunciado: p.enunciado, opciones: opciones, correcta: sitio,
      frase: p.frase, resalta: p.resalta || p.correcta, clave: p.clave,
      tarjeta: { pregunta: recortar(p.enunciado, 200), respuesta: p.correcta }
    };
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
      '<button class="btn-sec full" data-act="subir-apuntes">📎 Subir apuntes (PDF, Word, foto o texto)</button>' +
      '<input type="file" id="tsArchivo" accept=".pdf,.docx,.doc,.txt,.md,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden>' +
      '<p class="muted small" id="tsLeyendo" aria-live="polite"></p>' +
      '<label class="f"><span class="row between">Tus apuntes<button class="btn-txt" data-act="borrar-apuntes" style="min-height:0;padding:0">Borrar</button></span>' +
        '<textarea id="tsTexto" rows="9" placeholder="Sube un archivo o pega aquí el texto de tus apuntes (cuanto más texto, mejores preguntas)">' + esc(estado.testApuntes || "") + '</textarea></label>' +
      '<p class="muted small">Puedes subir varios archivos: el texto se va juntando. Las fotos se leen mejor con buena luz y la hoja recta.</p>' +
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
    const exp = new RegExp(escRegex(esc(p.resalta || "")));
    return '<div class="card stack tight fallo-test" style="text-align:left;width:100%">' +
      '<p class="label">Pregunta ' + (i + 1) + '</p><p><b>' + esc(p.enunciado) + '</b></p>' +
      '<p class="small mal">❌ Tu respuesta: ' + (tuya === undefined ? "sin responder" : LETRAS[tuya] + ") " + esc(p.opciones[tuya])) + '</p>' +
      '<p class="small bien">✅ Correcta: ' + LETRAS[p.correcta] + ') ' + esc(p.opciones[p.correcta]) + '</p>' +
      '<p class="muted small">En tus apuntes: «' + (p.resalta ? esc(p.frase).replace(exp, function (t) { return "<b>" + t + "</b>"; }) : esc(p.frase)) + '»</p></div>';
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
    const pregunta = recortar(p.tarjeta.pregunta, 300);
    const yaEsta = estado.tarjetas.some(function (t) { return t.pregunta === pregunta; });
    if (yaEsta) return;
    estado.tarjetas.push({ id: nuevoId(), asignatura: test.asignatura || "General", pregunta: pregunta, respuesta: recortar(p.tarjeta.respuesta, 400), caja: 1, proxima: hoy() });
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
