// =====================================================
// APEX STUDY · MIS NOTAS
// Cada nota: { id, asignatura, nombre, nota, porcentaje, examenId }
//   nota: de 0 a 10
//   porcentaje: cuánto cuenta en la nota final (ej: 30 = 30 %).
//               Viene en los criterios de evaluación de cada asignatura.
//
// Ejemplo: examen 1 (6, cuenta 30 %) y examen 2 (8, cuenta 30 %)
//   - Ya está decidido el 60 % de la nota y queda un 40 %.
//   - Puntos conseguidos: 6×0,30 + 8×0,30 = 4,2 (de 10)
//   - Para un 5 necesitas: (5 − 4,2) ÷ 0,40 = 2 de media en lo que queda.
//
// Las notas antiguas sin porcentaje usan "peso" (0,5 / 1 / 2) como antes.
// =====================================================

let vistaProgreso = "estudio";   // "estudio" o "notas"

function notasDe(asignatura) {
  return (estado.notas || []).filter(function (n) { return n.asignatura === asignatura; });
}

// ¿Todas las notas de la lista tienen su porcentaje puesto?
function usaPorcentaje(lista) {
  return lista.length > 0 && lista.every(function (n) { return n.porcentaje > 0; });
}

// Suma de los porcentajes ya puestos
function porcentajeUsado(lista) {
  let total = 0;
  for (const n of lista) total += n.porcentaje || 0;
  return total;
}

// Media de las notas que ya tienes (ponderada: lo que cuenta más, pesa más)
function mediaDe(lista) {
  let suma = 0, pesos = 0;
  for (const n of lista) {
    const peso = usaPorcentaje(lista) ? n.porcentaje : (n.peso || 1);
    suma += n.nota * peso;
    pesos += peso;
  }
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

// ---------- ¿Qué necesito sacar? ----------
function textoNecesitas(lista, objetivo) {
  if (usaPorcentaje(lista)) {
    const usado = porcentajeUsado(lista);
    const queda = 100 - usado;
    // Puntos ya conseguidos sobre 10 (cada nota aporta nota × porcentaje / 100)
    let puntos = 0;
    for (const n of lista) puntos += n.nota * n.porcentaje / 100;

    if (queda <= 0) return "Ya está todo el 100 %: tu nota final es un <b>" + formatoNota(puntos) + "</b>.";
    const necesitas = (objetivo - puntos) / (queda / 100);
    if (necesitas <= 0) return "✓ Ya tienes el " + objetivo + " asegurado: aunque saques un 0 en el " + queda + " % que queda, tendrías un " + formatoNota(puntos) + ".";
    if (necesitas > 10) {
      const maximo = puntos + 10 * queda / 100;
      return "😬 Aunque saques un 10 en el " + queda + " % que queda, llegarías a un " + formatoNota(maximo) + ". El " + objetivo + " ya no es posible.";
    }
    return "Para tener un " + objetivo + " necesitas sacar de media un <b>" + formatoNota(necesitas) + "</b> en el <b>" + queda + " %</b> que queda.";
  }

  // Sin porcentajes: suponemos que el próximo examen cuenta igual que los demás
  let suma = 0, pesos = 0;
  for (const n of lista) { suma += n.nota * (n.peso || 1); pesos += n.peso || 1; }
  const falta = objetivo * (pesos + 1) - suma;
  let texto;
  if (falta <= 0) texto = "✓ Aunque saques un 0 en el próximo, seguirías con un " + objetivo + " o más.";
  else if (falta > 10) texto = "😬 Con un solo examen no llegas al " + objetivo + " (necesitarías un " + formatoNota(falta) + ").";
  else texto = "Para tener un " + objetivo + " de media necesitas un <b>" + formatoNota(falta) + "</b> en el próximo examen.";
  return texto + '<br><span class="muted">💡 Pon cuánto cuenta (%) cada nota y te lo calculo exacto. Toca una nota para cambiarla.</span>';
}

// ---------- Vista de notas (dentro de Progreso) ----------
function vistaNotasHTML() {
  const objetivo = estado.objetivoNota || 5;
  const asigs = asignaturasConNotas();

  let chips = "";
  for (const o of [5, 6, 7, 8, 9]) {
    chips += '<button class="chip ' + (o === objetivo ? "on" : "") + '" data-act="objetivo-nota" data-o="' + o + '">' + (o === 5 ? "5 · Aprobar" : o) + '</button>';
  }
  let html = '<div class="card stack tight"><p class="label">Tu objetivo</p><div class="chips">' + chips + '</div></div>';

  if (!asigs.length) {
    return html + '<div class="card stack tight"><p class="vacio">Apunta las notas de tus exámenes y trabajos con lo que cuenta cada una (%). Te digo qué necesitas sacar para aprobar.</p></div>' +
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
    const usado = porcentajeUsado(lista);

    // Barra con el % de la nota que ya está decidido
    let barra = "";
    if (usaPorcentaje(lista)) {
      barra = '<p class="muted small">Decidido el <b>' + usado + ' %</b> de la nota · queda el ' + Math.max(0, 100 - usado) + ' %</p>' +
        '<div class="bar"><i style="width:' + Math.min(100, usado) + '%;background:' + colorAsig(a) + '"></i></div>';
    }

    html += '<div class="card stack tight">' +
      '<div class="row between"><h3 class="grow"><span class="punto-asig" style="background:' + colorAsig(a) + '"></span> ' + esc(a) + '</h3>' +
      '<span class="big-num num" style="color:' + colorNota(media) + '">' + formatoNota(media) + '</span></div>' +
      barra +
      '<div class="list">' + lista.map(function (n) {
        let cuenta = "Toca para poner cuánto cuenta (%)";
        if (n.porcentaje) cuenta = "Cuenta el " + n.porcentaje + " %";
        return '<div class="item nota-fila"><button class="grow nota-editar" data-act="editar-nota" data-id="' + n.id + '"><span class="name">' + esc(n.nombre) + '</span>' +
          '<span class="muted small">' + cuenta + '</span></button>' +
          '<b class="num" style="color:' + colorNota(n.nota) + '">' + formatoNota(n.nota) + '</b>' +
          '<button class="icon-btn mini" data-act="borrar-nota" data-id="' + n.id + '" aria-label="Borrar nota">×</button></div>';
      }).join("") + '</div>' +
      '<p class="small necesitas">' + textoNecesitas(lista, objetivo) + '</p>' +
      '<button class="btn-txt" data-act="nueva-nota" data-asig="' + esc(a) + '">+ Nota de ' + esc(a) + '</button></div>';
  }
  return html + '<button class="btn" data-act="nueva-nota">+ Añadir nota</button>';
}

// ---------- Formulario (nueva nota o editar) ----------
function hojaNota(asignatura, examen, id) {
  const n = id ? estado.notas.find(function (x) { return x.id === id; }) : null;
  let nombre = examen ? "Examen" + (examen.tema ? " · " + examen.tema : "") : "";
  if (n) nombre = n.nombre;
  const asig = n ? n.asignatura : (asignatura || "");

  // Cuánto % queda libre en esa asignatura (para ayudar)
  let ayuda = "Míralo en los criterios de evaluación (ej: exámenes 60 %, trabajos 30 %…). Si no lo sabes, déjalo vacío.";
  if (asig) {
    const otras = notasDe(asig).filter(function (x) { return !n || x.id !== n.id; });
    const usado = porcentajeUsado(otras);
    if (usado) ayuda = "En " + asig + " ya llevas un " + usado + " % puesto. Te queda un " + Math.max(0, 100 - usado) + " %.";
  }

  abrirHoja('<div class="row between"><h2>' + (n ? "Editar nota" : "Nueva nota") + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">Asignatura' + selectorAsig("noAsig", asig) + '</label>' +
    '<label class="f">¿De qué es?<input id="noNombre" value="' + esc(nombre) + '" placeholder="Ej: examen tema 3, trabajo, exposición..." maxlength="50"></label>' +
    '<div class="dos"><label class="f">Nota (0 a 10)<input id="noNota" inputmode="decimal" placeholder="Ej: 7,5" maxlength="5" value="' + (n ? formatoNota(n.nota) : '') + '"></label>' +
    '<label class="f">Cuenta (%)<input id="noPorcentaje" inputmode="decimal" placeholder="Ej: 30" maxlength="5" value="' + (n && n.porcentaje ? formatoNota(n.porcentaje) : '') + '"></label></div>' +
    '<p class="muted small">' + esc(ayuda) + '</p>' +
    '<p class="err" id="noErr"></p>' +
    '<button class="btn" data-act="guardar-nota" data-examen="' + (examen ? examen.id : "") + '" data-id="' + (n ? n.id : "") + '">' + (n ? "Guardar cambios" : "Guardar nota") + '</button>');
}

// Convierte lo escrito en número ("7,5" → 7.5). Si está vacío devuelve null
function leerNumero(id) {
  const texto = $(id).value.trim().replace(",", ".").replace("%", "");
  if (texto === "") return null;
  return Number(texto);
}

function guardarNota(examenId, id) {
  const asignatura = leerAsig("noAsig");
  const nota = leerNumero("noNota");
  const porcentaje = leerNumero("noPorcentaje");

  if (!asignatura) { $("noErr").textContent = "Elige la asignatura."; return; }
  if (nota === null || isNaN(nota) || nota < 0 || nota > 10) { $("noErr").textContent = "Escribe una nota entre 0 y 10."; return; }
  if (porcentaje !== null && (isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100)) { $("noErr").textContent = "El porcentaje tiene que ser entre 1 y 100."; return; }

  // Los porcentajes de una asignatura no pueden pasar del 100 %
  if (porcentaje) {
    const otras = notasDe(asignatura).filter(function (x) { return x.id !== id; });
    const usado = porcentajeUsado(otras);
    if (usado + porcentaje > 100) {
      $("noErr").textContent = "En " + asignatura + " ya llevas un " + usado + " %. Esta nota puede contar como mucho un " + (100 - usado) + " %.";
      return;
    }
  }

  estado.notas = estado.notas || [];
  if (id) {
    const n = estado.notas.find(function (x) { return x.id === id; });
    Object.assign(n, { asignatura: asignatura, nombre: $("noNombre").value.trim() || "Nota", nota: nota, porcentaje: porcentaje });
    toast("✓ Nota cambiada");
  } else {
    estado.notas.push({
      id: nuevoId(), asignatura: asignatura, nombre: $("noNombre").value.trim() || "Nota",
      nota: nota, porcentaje: porcentaje, peso: 1, examenId: examenId || null
    });
    toast(nota >= 5 ? "🎉 ¡Un " + formatoNota(nota) + "! Bien hecho" : "💪 Apuntado. El próximo lo sacas");
  }
  guardar(); cerrarHoja();
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
  "nueva-nota": function (b) { hojaNota(b.dataset.asig, null, null); },
  "editar-nota": function (b) { hojaNota(null, null, b.dataset.id); },
  "nota-de-examen": function (b) {
    const e = estado.examenes.find(function (x) { return x.id === b.dataset.id; });
    cerrarCapa();
    hojaNota(e.asignatura, e, null);
  },
  "guardar-nota": function (b) { guardarNota(b.dataset.examen, b.dataset.id); },
  "borrar-nota": function (b) {
    if (!confirm("¿Borrar esta nota?")) return;
    estado.notas = estado.notas.filter(function (n) { return n.id !== b.dataset.id; });
    guardar(); pintarProgreso();
  }
};
