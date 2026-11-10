// =====================================================
// APEX STUDY · DEBERES Y ENTREGAS
// Cada deber: { id, titulo, asignatura, fecha, hecho }
//   fecha = día de entrega ("2026-11-10")
// Apix avisa el día antes a las 18:00 y el mismo día a las 7:30 (si no está hecho).
// =====================================================

// Deberes sin hacer, el que antes se entrega primero
function deberesPendientes() {
  return (estado.deberes || [])
    .filter(function (d) { return !d.hecho; })
    .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
}

// Texto y color de la etiqueta: Atrasado, Hoy, Mañana, En 3 días, Hecho
function etiquetaEntrega(d) {
  if (d.hecho) return { texto: "Hecho", clase: "ok" };
  const dias = diasEntre(hoy(), d.fecha);
  if (dias < 0) return { texto: "Atrasado", clase: "mal" };
  if (dias === 0) return { texto: "Hoy", clase: "exam" };
  if (dias === 1) return { texto: "Mañana", clase: "exam" };
  return { texto: "En " + dias + " días", clase: "pend" };
}

// Una fila de deberes con su casilla para marcarlo como hecho
function filaDeber(d, conBorrar) {
  const et = etiquetaEntrega(d);
  return '<div class="item deber' + (d.hecho ? ' hecho' : '') + '">' +
    '<button class="check' + (d.hecho ? ' on' : '') + '" data-act="hecho-deber" data-id="' + d.id + '" aria-label="Marcar como hecho">✓</button>' +
    '<div class="grow"><span class="name">' + esc(d.titulo) + '</span>' +
    '<p class="muted small">' + (d.asignatura ? '<span class="punto-asig" style="background:' + colorAsig(d.asignatura) + '"></span> ' + esc(d.asignatura) + ' · ' : '') + 'Entrega: ' + fechaCorta(d.fecha) + '</p></div>' +
    '<span class="pill ' + et.clase + '">' + et.texto + '</span>' +
    (conBorrar ? '<div class="acciones">' + (d.hecho ? '' : '<button class="btn-sec" data-act="editar-deber" data-id="' + d.id + '">Editar</button>') +
      '<button class="btn-sec btn-danger" data-act="borrar-deber" data-id="' + d.id + '">Borrar</button></div>' : '') +
    '</div>';
}

// ---------- Vista de deberes (dentro de Agenda) ----------
function vistaDeberesHTML() {
  const pendientes = deberesPendientes();
  const hechos = (estado.deberes || []).filter(function (d) { return d.hecho; })
    .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 10);
  return '<div class="card"><div class="list">' +
      (pendientes.length ? pendientes.map(function (d) { return filaDeber(d, true); }).join("") :
        '<p class="vacio">No tienes deberes pendientes. 🎉</p>') +
    '</div></div>' +
    '<button class="btn" data-act="nuevo-deber">+ Añadir deberes</button>' +
    (hechos.length ? '<div class="card"><p class="label">Ya hechos</p><div class="list">' + hechos.map(function (d) { return filaDeber(d, true); }).join("") + '</div></div>' : '');
}

// ---------- Tarjeta para Inicio ----------
function tarjetaDeberesInicio() {
  const pendientes = deberesPendientes();
  // Si nunca ha apuntado deberes, le invitamos a hacerlo
  if (!(estado.deberes || []).length) {
    return '<div class="card stack tight"><h2>Deberes</h2>' +
      '<p class="muted">Apunta lo que tienes que entregar y Apix te lo recordará el día antes.</p>' +
      '<button class="btn-sec full" data-act="nuevo-deber">+ Añadir deberes</button></div>';
  }
  if (!pendientes.length) return "";   // todo hecho: no hace falta enseñar nada
  return '<div class="card"><div class="row between"><h2>Deberes</h2><button class="btn-txt" data-act="ir-deberes">Ver todos</button></div>' +
    '<div class="list">' + pendientes.slice(0, 3).map(function (d) { return filaDeber(d, false); }).join("") + '</div></div>';
}

// ---------- Formulario ----------
// id = deberes a editar (si no hay, son nuevos)
function hojaDeber(fecha, id) {
  const d = id ? estado.deberes.find(function (x) { return x.id === id; }) : null;
  abrirHoja('<div class="row between"><h2>' + (d ? "Editar deberes" : "Nuevos deberes") + '</h2><button class="btn-txt" data-act="cerrar-hoja">Cerrar</button></div>' +
    '<label class="f">¿Qué hay que hacer?<input id="deTitulo" value="' + (d ? esc(d.titulo) : '') + '" placeholder="Ej: ejercicios 1-5 de la página 42" maxlength="80"></label>' +
    '<label class="f">Asignatura (opcional)' + selectorAsig("deAsig", d ? d.asignatura : "") + '</label>' +
    '<label class="f">¿Cuándo hay que entregarlo?<input id="deFecha" type="date" value="' + (d ? d.fecha : (fecha || sumarDias(hoy(), 1))) + '"></label>' +
    '<p class="err" id="deErr"></p>' +
    '<button class="btn" data-act="guardar-deber" data-id="' + (d ? d.id : '') + '">' + (d ? "Guardar cambios" : "Guardar") + '</button>');
}

function guardarDeber(id) {
  const titulo = $("deTitulo").value.trim();
  const fecha = $("deFecha").value;
  if (!titulo) { $("deErr").textContent = "Escribe qué hay que hacer."; return; }
  if (!fecha) { $("deErr").textContent = "Elige el día de entrega."; return; }
  estado.deberes = estado.deberes || [];
  const datos = { titulo: titulo, asignatura: leerAsig("deAsig"), fecha: fecha };
  let deber;
  if (id) {
    deber = estado.deberes.find(function (x) { return x.id === id; });
    Object.assign(deber, datos);
    toast("✓ Deberes cambiados");
  } else {
    deber = Object.assign({ id: nuevoId(), hecho: false }, datos);
    estado.deberes.push(deber);
    toast("✏️ Deberes apuntados");
  }
  guardar(); cerrarHoja();
  programarAvisosDeber(deber);
  pintar();
}

// ---------- Avisos ----------
function avisosDeDeber(d) {
  const que = "«" + d.titulo + "»" + (d.asignatura ? " de " + d.asignatura : "");
  return [
    { clave: "deb-" + d.id + "-antes", cuando: new Date(sumarDias(d.fecha, -1) + "T" + configAvisos().tarde + ":00"), texto: "Mañana entregas " + que + ". ¿Lo tienes hecho?" },
    { clave: "deb-" + d.id + "-dia", cuando: new Date(d.fecha + "T" + configAvisos().manana + ":00"), texto: "Hoy entregas " + que + ". ¡Que no se te olvide!" }
  ];
}

function programarAvisosDeber(d) {
  for (const a of avisosDeDeber(d)) {
    if (!d.hecho && a.cuando > new Date()) avisoNube(a.clave, a.cuando, "Apix ✏️", a.texto);
    else cancelarAvisoNube(a.clave);   // ya hecho o ya pasado: lo quitamos
  }
}

function cancelarAvisosDeber(d) {
  for (const a of avisosDeDeber(d)) cancelarAvisoNube(a.clave);
}

// Con la app abierta: si toca un aviso de deberes, lo enseña en grande
function comprobarDeberes() {
  for (const d of deberesPendientes()) {
    for (const a of avisosDeDeber(d)) {
      if (yaToca(a.clave, a.cuando)) {
        mostrarAviso("Apix ✏️", a.texto, a.clave);
        mostrarCapa('<div class="msg">' + apixSVG("anima", "xl") + '<p class="label">Apix · Deberes</p>' +
          '<h1>' + esc(d.titulo) + '</h1><p>' + esc(a.texto) + '</p>' +
          '<button class="btn" data-act="hecho-deber" data-id="' + d.id + '">Ya lo tengo hecho ✓</button>' +
          '<button class="btn-sec full" data-act="cerrar-capa">Me pongo ahora</button></div>');
        return true;
      }
    }
  }
  return false;
}

// ---------- Botones ----------
const ACCIONES_DEBERES = {
  "ir-deberes": function () { vistaAgenda = "deberes"; irA("agenda"); },
  "nuevo-deber": function (b) { hojaDeber(b.dataset.fecha, null); },
  "editar-deber": function (b) { hojaDeber(null, b.dataset.id); },
  "guardar-deber": function (b) { guardarDeber(b.dataset.id); },
  "hecho-deber": function (b) {
    const d = estado.deberes.find(function (x) { return x.id === b.dataset.id; });
    if (!d) return;
    d.hecho = !d.hecho;
    if (d.hecho) {
      cancelarAvisosDeber(d);
      vibrar(25);
      if (deberesPendientes().length === 0) { confeti(); toast("🎉 ¡Todos los deberes hechos!"); }
      else toast("✓ ¡Uno menos!");
    }
    else programarAvisosDeber(d);
    guardar(); cerrarCapa(); pintar();
  },
  "borrar-deber": function (b) {
    if (!confirm("¿Borrar estos deberes?")) return;
    const d = estado.deberes.find(function (x) { return x.id === b.dataset.id; });
    if (d) cancelarAvisosDeber(d);
    estado.deberes = estado.deberes.filter(function (x) { return x.id !== b.dataset.id; });
    guardar(); pintar();
  }
};
