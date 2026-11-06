// =====================================================
// APEX STUDY · MIS NOTAS
// Cada nota: { id, asignatura, nombre, nota, peso, examenId }
//   nota: de 0 a 10 · peso: cuánto cuenta (0.5 = mitad, 1 = normal, 2 = doble)
// La media es "ponderada": las notas que cuentan doble pesan el doble.
// =====================================================

let vistaProgreso = "estudio";   // "estudio" o "notas"
let pesoElegido = 1;

function notasDe(asignatura) {
  return (estado.notas || []).filter(function (n) { return n.asignatura === asignatura; });
}

// Media ponderada: suma de (nota × peso) entre la suma de pesos
function mediaDe(lista) {
  let suma = 0, pesos = 0;
  for (const n of lista) { suma += n.nota * n.peso; pesos += n.peso; }
  return pesos ? suma / pesos : 0;
}

// Asignaturas que tienen alguna nota, por orden alfabético
function asignaturasConNotas() {
  const lista = [];
  for (const n of estado.notas || []) if (!lista.includes(n.asignatura)) lista.push(n.asignatura);
  return lista.sort();
}

// 7.5 → "7,5" · 7 → "7" · 6.333 → "6,33"
function formatoNota(n) {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

// Color según la nota: rojo suspenso, amarillo aprobado justo, verde bien
function colorNota(n) {
  if (n < 5) return "var(--danger)";
  if (n < 7) return "var(--warn)";
  return "var(--good)";
}

// ¿Qué nota necesitas en el próximo examen (que cuenta normal) para llegar al objetivo?
//   (objetivo × (pesos + 1) − suma de nota×peso) ÷ 1
function notaNecesaria(lista, objetivo) {
  let suma = 0, pesos = 0;
  for (const n of lista) { suma += n.nota * n.peso; pesos += n.peso; }
  return objetivo * (pesos + 1) - suma;
}

function textoNecesitas(lista, objetivo) {
  const falta = notaNecesaria(lista, objetivo);
  if (falta <= 0) return "✓ Aunque saques un 0 en el próximo, seguirías con un " + objetivo + " o más.";
  if (falta > 10) return "😬 Con un solo examen no llegas al " + objetivo + " (necesitarías un " + formatoNota(falta) + "). Tendrás que ir subiendo en los siguientes.";
  return "Para tener un " + objetivo + " de media necesitas un <b>" + formatoNota(falta) + "</b> en el próximo examen.";
}

// ---------- Vista de notas (dentro de Progreso) ----------
function vistaNotasHTML() {
  const objetivo = estado.objetivoNota || 5;
  const asigs = asignaturasConNotas();

  let chips = "";
  for (const o of [5, 6, 7, 8, 9]) {
    chips += '<button class="chip ' + (o === objetivo ? "on" : "") + '" data-act="objetivo-nota" data-o="' + o + '">' + o + '</button>';
  }
  let html = '<div class="card stack tight"><p class="label">Tu objetivo de media</p><div class="chips">' + chips + '</div></div>';

  if (!asigs.length) {
    return html + '<div class="card stack tight"><p class="vacio">Apunta las notas de tus exámenes y trabajos. Te calculo la media y lo que necesitas para llegar a tu objetivo.</p></div>' +
      '<button class="btn" data-act="nueva-nota">+ Añadir nota</button>';
  }

  // Media general: la media de las medias de cada asignatura
  let sumaMedias = 0;
  for (const a of asigs) sumaMedias += mediaDe(notasDe(a));
  const general = sumaMedias / asigs.length;
  const suspensas = asigs.filter(function (a) { return mediaDe(notasDe(a)) < 5; }).length;

  html += '<div class="grid3">' +
    '<div class="card"><p class="label">Media</p><p class="big-num num" style="color:' + colorNota(general) + '">' + formatoNota(general) + '</p><p class="muted small">general</p></div>' +
    '<div class="card"><p class="label">Asignaturas</p><p class="big-num num">' + asigs.length + '</p><p class="muted small">con notas</p></div>' +
    '<div class="card"><p class="label">Suspensas</p><p class="big-num num" style="color:' + (suspensas ? "var(--danger)" : "var(--good)") + '">' + suspensas + '</p><p class="muted small">ahora mismo</p></div>' +
    '</div>';

  // Una tarjeta por asignatura
  for (const a of asigs) {
    const lista = notasDe(a);
    const media = mediaDe(lista);
    html += '<div class="card stack tight">' +
      '<div class="row between"><h3 class="grow"><span class="punto-asig" style="background:' + colorAsig(a) + '"></span> ' + esc(a) + '</h3>' +
      '<span class="big-num num" style="color:' + colorNota(media) + '">' + formatoNota(media) + '</span></div>' +
      '<div class="list">' + lista.map(function (n) {
        return '<div class="item nota-fila"><div class="grow"><span class="name">' + esc(n.nombre) + '</span>' +
          (n.peso !== 1 ? '<p class="muted small">Cuenta ' + (n.peso === 2 ? "doble" : "la mitad") + '</p>' : '') + '</div>' +
          '<b class="num" style="color:' + colorNota(n.nota) + '">' + formatoNota(n.nota) + '</b>' +
          '<button class="icon-btn mini" data-act="borrar-nota" data-id="' + n.id + '" aria-label="Borrar nota">×</button></div>';
      }).join("") + '</div>' +
      '<p class="small necesitas">' + textoNecesitas(lista, objetivo) + '</p>' +
      '<button class="btn-txt" data-act="nueva-nota" data-asig="' + esc(a) + '">+ Nota de ' + esc(a) + '</button></div>';
  }
  return html + '<button class="btn" data-act="nueva-nota">+ Añadir nota</button>';
}

// ---------- Formulario ----------
function hojaNota(asignatura, examen) {
  pesoElegido = 1;
  const nombre = examen ? "Examen" + (examen.tema ? " · " + examen.tema : "") : "";
  const pesos = [[0.5, "La mitad"], [1, "Normal"], [2, "Doble"]].map(function (p) {
    return '<button class="chip ' + (p[0] === 1 ? "on" : "") + '" data-act="peso-nota" data-p="' + p[0] + '">' + p[1] + '</button>';
  }).join("");
  abrirHoja('<div class="row between"><h2>Nueva nota</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">Asignatura' + selectorAsig("noAsig", asignatura || "") + '</label>' +
    '<label class="f">¿De qué es?<input id="noNombre" value="' + esc(nombre) + '" placeholder="Ej: examen tema 3, trabajo, exposición..." maxlength="50"></label>' +
    '<label class="f">Nota (de 0 a 10)<input id="noNota" inputmode="decimal" placeholder="Ej: 7,5" maxlength="5"></label>' +
    '<div><p class="label" style="margin-bottom:8px">¿Cuánto cuenta?</p><div class="chips">' + pesos + '</div></div>' +
    '<p class="err" id="noErr"></p>' +
    '<button class="btn" data-act="guardar-nota" data-examen="' + (examen ? examen.id : "") + '">Guardar nota</button>');
}

function guardarNota(examenId) {
  const asignatura = leerAsig("noAsig");
  // Aceptamos "7,5" y "7.5"
  const nota = Number($("noNota").value.trim().replace(",", "."));
  if (!asignatura) { $("noErr").textContent = "Elige la asignatura."; return; }
  if ($("noNota").value.trim() === "" || isNaN(nota) || nota < 0 || nota > 10) { $("noErr").textContent = "Escribe una nota entre 0 y 10."; return; }
  estado.notas = estado.notas || [];
  estado.notas.push({
    id: nuevoId(), asignatura: asignatura, nombre: $("noNombre").value.trim() || "Nota",
    nota: nota, peso: pesoElegido, examenId: examenId || null
  });
  guardar(); cerrarHoja();
  toast(nota >= 5 ? "🎉 ¡Un " + formatoNota(nota) + "! Bien hecho" : "💪 Apuntado. El próximo lo sacas");
  vistaProgreso = "notas";
  irA("progreso");
}

// Nota que se puso a un examen (si la hay)
function notaDeExamen(id) {
  return (estado.notas || []).find(function (n) { return n.examenId === id; });
}

// ---------- Botones ----------
const ACCIONES_NOTAS = {
  "vista-progreso": function (b) { vistaProgreso = b.dataset.v; pintarProgreso(); },
  "objetivo-nota": function (b) { estado.objetivoNota = Number(b.dataset.o); guardar(); pintarProgreso(); },
  "nueva-nota": function (b) { hojaNota(b.dataset.asig, null); },
  "nota-de-examen": function (b) {
    const e = estado.examenes.find(function (x) { return x.id === b.dataset.id; });
    cerrarCapa();
    hojaNota(e.asignatura, e);
  },
  "peso-nota": function (b) {
    pesoElegido = Number(b.dataset.p);
    document.querySelectorAll('[data-act="peso-nota"]').forEach(function (c) { c.classList.toggle("on", c === b); });
  },
  "guardar-nota": function (b) { guardarNota(b.dataset.examen); },
  "borrar-nota": function (b) {
    if (!confirm("¿Borrar esta nota?")) return;
    estado.notas = estado.notas.filter(function (n) { return n.id !== b.dataset.id; });
    guardar(); pintarProgreso();
  }
};
