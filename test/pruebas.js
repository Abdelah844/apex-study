// =====================================================
// APIX STUDY · PRUEBAS AUTOMÁTICAS
// Comprueban que los cálculos de la app dan lo que tienen que dar.
// Se ejecutan con:  node test/correr.js
// Cada prueba empieza con datos vacíos (no toca tus datos reales).
// =====================================================

const PRUEBAS = [];
function prueba(grupo, nombre, fn) { PRUEBAS.push({ grupo: grupo, nombre: nombre, fn: fn }); }

// Ayudas para comprobar resultados
function igual(sale, esperado, que) {
  if (JSON.stringify(sale) !== JSON.stringify(esperado)) {
    throw new Error((que ? que + ": " : "") + "esperaba " + JSON.stringify(esperado) + " y salió " + JSON.stringify(sale));
  }
}
function cierto(condicion, que) { if (!condicion) throw new Error(que || "tenía que ser verdad"); }
function cerca(sale, esperado, que) { if (Math.abs(sale - esperado) > 0.01) igual(sale, esperado, que); }

// Una sesión de estudio de prueba hace "dias" días
function sesionHace(dias, min) {
  estado.sesiones.push({ fecha: sumarDias(hoy(), -dias), hora: "18:00", min: min || 25, objetivo: "Prueba", asignatura: "", distracciones: 0 });
}

// ---------- FECHAS ----------
prueba("Fechas", "sumarDias cruza meses y años", function () {
  igual(sumarDias("2026-12-31", 1), "2027-01-01");
  igual(sumarDias("2026-03-01", -1), "2026-02-28");
  igual(sumarDias("2028-02-28", 1), "2028-02-29", "año bisiesto");
});
prueba("Fechas", "diasEntre cuenta bien (también con cambio de hora)", function () {
  igual(diasEntre("2026-03-28", "2026-03-30"), 2);
  igual(diasEntre("2026-10-24", "2026-10-26"), 2);
  igual(diasEntre("2026-11-10", "2026-11-03"), -7);
});
prueba("Fechas", "cuentaAtras dice Hoy, Mañana y En X días", function () {
  igual(cuentaAtras(hoy()), "Hoy");
  igual(cuentaAtras(sumarDias(hoy(), 1)), "Mañana");
  igual(cuentaAtras(sumarDias(hoy(), 5)), "En 5 días");
  igual(cuentaAtras(sumarDias(hoy(), -1)), "Pasado");
});

// ---------- RACHA Y MINUTOS ----------
prueba("Racha", "sin sesiones la racha es 0", function () {
  igual(rachaActual(), 0);
});
prueba("Racha", "3 días seguidos hasta hoy = racha de 3", function () {
  sesionHace(0); sesionHace(1); sesionHace(2);
  igual(rachaActual(), 3);
});
prueba("Racha", "si hoy aún no estudiaste, cuenta desde ayer", function () {
  sesionHace(1); sesionHace(2);
  igual(rachaActual(), 2);
});
prueba("Racha", "dos días seguidos sin estudiar cortan la racha", function () {
  sesionHace(0); sesionHace(3); sesionHace(4);
  igual(rachaActual(), 1);
});
prueba("Racha", "racha perdida: estudiabas y llevas 2 días sin estudiar", function () {
  sesionHace(3); sesionHace(4); sesionHace(5);
  igual(rachaActual(), 0);
  igual(rachaPerdida(), 3);
});

// ---------- PROTECTOR DE RACHA ----------
// Fechas fijas para no depender del día de hoy: usamos calcularRacha(fecha)
function estudio(fechas) { for (const f of fechas) estado.sesiones.push({ fecha: f, hora: "18:00", min: 25, objetivo: "x", asignatura: "" }); }
prueba("Protector", "lunesDe da el lunes de cada semana", function () {
  igual(lunesDe("2026-11-10"), "2026-11-09", "martes");
  igual(lunesDe("2026-11-15"), "2026-11-09", "domingo");
  igual(lunesDe("2026-11-16"), "2026-11-16", "lunes");
});
prueba("Protector", "un día suelto sin estudiar no rompe la racha (y no suma)", function () {
  estudio(["2026-11-10", "2026-11-11", "2026-11-13"]);   // falta el jueves 12
  const r = calcularRacha("2026-11-13");
  igual(r.dias, 3);
  igual(r.salvados, ["2026-11-12"]);
});
prueba("Protector", "solo salva un día por semana", function () {
  estudio(["2026-11-09", "2026-11-11", "2026-11-13"]);   // faltan martes 10 y jueves 12
  const r = calcularRacha("2026-11-13");
  igual(r.dias, 2, "salva el jueves, pero el martes ya no");
});
prueba("Protector", "en semanas distintas salva uno en cada una", function () {
  estudio(["2026-11-06", "2026-11-08", "2026-11-09", "2026-11-11"]);   // faltan sáb 7 y mar 10
  igual(calcularRacha("2026-11-11").dias, 4);
});
prueba("Protector", "no salva dos días seguidos aunque sean de semanas distintas", function () {
  estudio(["2026-11-14", "2026-11-17"]);   // faltan domingo 15 y lunes 16
  igual(calcularRacha("2026-11-17").dias, 1);
});
prueba("Protector", "si ayer no estudiaste, hoy aún puedes salvar la racha", function () {
  sesionHace(2); sesionHace(3);
  igual(rachaActual(), 2);
  igual(diasSalvados(), [sumarDias(hoy(), -1)]);
});
prueba("Protector", "con la racha a 0 no se gasta el protector", function () {
  igual(rachaActual(), 0);
  cierto(protectorDisponible());
});

prueba("Racha", "minutosDelDia suma todas las sesiones del día", function () {
  sesionHace(0, 25); sesionHace(0, 45); sesionHace(1, 60);
  igual(minutosDelDia(hoy()), 70);
});

// ---------- PLANES ----------
prueba("Planes", "estado de un plan: pendiente, cumplido y no cumplido", function () {
  const futuro = { fecha: sumarDias(hoy(), 1), hora: "18:00", hecho: false };
  const hecho = { fecha: sumarDias(hoy(), -1), hora: "18:00", hecho: true };
  const pasado = { fecha: sumarDias(hoy(), -1), hora: "18:00", hecho: false };
  igual(estadoPlan(futuro).texto, "Pendiente");
  igual(estadoPlan(hecho).texto, "Cumplido");
  igual(estadoPlan(pasado).texto, "No cumplido");
});

// ---------- NOTAS ----------
prueba("Notas", "media con porcentajes (8 al 30 % y 4,5 al 20 % = 6,6)", function () {
  const lista = [{ nota: 8, porcentaje: 30 }, { nota: 4.5, porcentaje: 20 }];
  cerca(mediaDe(lista), 6.6);
});
prueba("Notas", "qué necesitas para el 5: un 3,4 en el 50 % que queda", function () {
  const lista = [{ nota: 8, porcentaje: 30 }, { nota: 4.5, porcentaje: 20 }];
  cierto(textoNecesitas(lista, 5).includes("3,4"), textoNecesitas(lista, 5));
  cierto(textoNecesitas(lista, 5).includes("50 %"));
});
prueba("Notas", "si ya está aprobado pase lo que pase, lo dice", function () {
  const lista = [{ nota: 10, porcentaje: 60 }];
  cierto(textoNecesitas(lista, 5).includes("asegurado"), textoNecesitas(lista, 5));
});
prueba("Notas", "si ya no se puede llegar, lo dice", function () {
  const lista = [{ nota: 1, porcentaje: 80 }];
  cierto(textoNecesitas(lista, 5).includes("ya no es posible"), textoNecesitas(lista, 5));
});
prueba("Notas", "con el 100 % puesto, da la nota final", function () {
  const lista = [{ nota: 6, porcentaje: 50 }, { nota: 8, porcentaje: 50 }];
  cierto(textoNecesitas(lista, 5).includes("nota final es un <b>7</b>"), textoNecesitas(lista, 5));
});
prueba("Notas", "sin porcentajes usa la media normal (y las antiguas con peso)", function () {
  cerca(mediaDe([{ nota: 4 }, { nota: 8 }]), 6);
  cerca(mediaDe([{ nota: 4, peso: 1 }, { nota: 10, peso: 2 }]), 8);
});
prueba("Notas", "formatoNota usa coma y quita ceros", function () {
  igual(formatoNota(7.5), "7,5");
  igual(formatoNota(7), "7");
  igual(formatoNota(6.333), "6,33");
});

// ---------- TARJETAS (sistema Leitner) ----------
prueba("Tarjetas", "acertar sube de caja y espera más días", function () {
  const t = { caja: 1, proxima: hoy() };
  aplicarRespuesta(t, "si", "2026-11-10");
  igual([t.caja, t.proxima], [2, "2026-11-11"]);
  aplicarRespuesta(t, "si", "2026-11-11");
  igual([t.caja, t.proxima], [3, "2026-11-14"]);
});
prueba("Tarjetas", "fallar vuelve a la caja 1 y sale hoy", function () {
  const t = { caja: 4, proxima: "2026-11-20" };
  aplicarRespuesta(t, "no", "2026-11-10");
  igual([t.caja, t.proxima], [1, "2026-11-10"]);
});
prueba("Tarjetas", "'más o menos' se queda en su caja y vuelve mañana", function () {
  const t = { caja: 3, proxima: "2026-11-10" };
  aplicarRespuesta(t, "casi", "2026-11-10");
  igual([t.caja, t.proxima], [3, "2026-11-11"]);
});
prueba("Tarjetas", "la caja 5 es la máxima", function () {
  const t = { caja: 5, proxima: hoy() };
  aplicarRespuesta(t, "si", "2026-11-10");
  igual(t.caja, 5);
});
prueba("Tarjetas", "tarjetasParaHoy incluye las atrasadas pero no las futuras", function () {
  estado.tarjetas = [
    { id: "a", asignatura: "Inglés", caja: 1, proxima: sumarDias(hoy(), -3) },
    { id: "b", asignatura: "Inglés", caja: 2, proxima: hoy() },
    { id: "c", asignatura: "Inglés", caja: 3, proxima: sumarDias(hoy(), 2) }
  ];
  igual(tarjetasParaHoy(null).map(function (t) { return t.id; }), ["a", "b"]);
});

// ---------- DEBERES ----------
prueba("Deberes", "etiqueta de entrega: Atrasado, Hoy, Mañana, En X días, Hecho", function () {
  igual(etiquetaEntrega({ fecha: sumarDias(hoy(), -1), hecho: false }).texto, "Atrasado");
  igual(etiquetaEntrega({ fecha: hoy(), hecho: false }).texto, "Hoy");
  igual(etiquetaEntrega({ fecha: sumarDias(hoy(), 1), hecho: false }).texto, "Mañana");
  igual(etiquetaEntrega({ fecha: sumarDias(hoy(), 4), hecho: false }).texto, "En 4 días");
  igual(etiquetaEntrega({ fecha: hoy(), hecho: true }).texto, "Hecho");
});
prueba("Deberes", "pendientes ordenados por fecha de entrega y sin los hechos", function () {
  estado.deberes = [
    { id: "1", titulo: "B", fecha: sumarDias(hoy(), 5), hecho: false },
    { id: "2", titulo: "A", fecha: sumarDias(hoy(), 1), hecho: false },
    { id: "3", titulo: "C", fecha: sumarDias(hoy(), 2), hecho: true }
  ];
  igual(deberesPendientes().map(function (d) { return d.id; }), ["2", "1"]);
});
prueba("Deberes", "los avisos usan las horas de Ajustes", function () {
  estado.avisosConfig = { tarde: "20:00", manana: "08:15", semana: false, tresDias: true };
  const avisos = avisosDeDeber({ id: "x", titulo: "Ejercicios", asignatura: "", fecha: "2026-12-10" });
  igual(avisos[0].cuando.getHours() + ":" + avisos[0].cuando.getMinutes(), "20:0", "día antes");
  igual(fechaISO(avisos[0].cuando), "2026-12-09");
  igual(avisos[1].cuando.getHours() + ":" + avisos[1].cuando.getMinutes(), "8:15", "mismo día");
});

// ---------- EXÁMENES ----------
prueba("Exámenes", "avisos de 1 semana y 3 días se encienden y apagan en Ajustes", function () {
  estado.avisosConfig = { tarde: "18:00", manana: "07:30", semana: false, tresDias: true };
  const e = { id: "e1", asignatura: "Matemáticas", tema: "", fecha: "2026-12-20", hora: "" };
  const activos = avisosDeExamen(e).filter(function (a) { return a.activo; }).map(function (a) { return a.clave; });
  igual(activos, ["ex-e1-3d", "ex-e1-antes", "ex-e1-dia"]);
  estado.avisosConfig.semana = true;
  cierto(avisosDeExamen(e)[0].activo, "el de 1 semana debería estar activo");
  igual(fechaISO(avisosDeExamen(e)[0].cuando), "2026-12-13");
});
prueba("Exámenes", "próximos exámenes: solo los futuros y en orden", function () {
  estado.examenes = [
    { id: "a", asignatura: "X", fecha: sumarDias(hoy(), 9), hora: "" },
    { id: "b", asignatura: "Y", fecha: sumarDias(hoy(), -2), hora: "" },
    { id: "c", asignatura: "Z", fecha: sumarDias(hoy(), 3), hora: "" }
  ];
  igual(proximosExamenes().map(function (e) { return e.id; }), ["c", "a"]);
});

// ---------- HORARIO ----------
prueba("Horario", "aMinutos y duración en texto", function () {
  igual(aMinutos("16:30"), 990);
  igual(duracionTexto({ inicio: "16:00", fin: "17:30" }), "1 h 30 min");
  igual(duracionTexto({ inicio: "08:00", fin: "14:00" }), "6 h");
  igual(duracionTexto({ inicio: "10:00", fin: "10:45" }), "45 min");
});
prueba("Horario", "cada bloque se programa 2 veces en las próximas 2 semanas", function () {
  const b = { id: "b1", titulo: "Repasar", tipo: "estudio", dia: (diaDeHoy() + 1) % 7, inicio: "17:00", fin: "18:00" };
  igual(proximasVecesBloque(b).length, 2);
});
prueba("Horario", "detecta cuando dos bloques coinciden en hora", function () {
  estado.horario = [
    { id: "a", titulo: "Clase", tipo: "clase", dia: 0, inicio: "08:00", fin: "14:30" },
    { id: "b", titulo: "Repasar", tipo: "estudio", dia: 0, inicio: "14:00", fin: "15:00" }
  ];
  igual(buscarChoque("Repasar", "14:00", "15:00").id, "a");
  estado.horario[1].inicio = "14:30";
  igual(buscarChoque("Repasar", "14:30", "15:00"), null, "pegados no chocan");
});
prueba("Horario", "por defecto avisan los bloques de estudio y deberes, no las clases", function () {
  cierto(avisaBloque({ tipo: "estudio" }));
  cierto(avisaBloque({ tipo: "deberes" }));
  cierto(!avisaBloque({ tipo: "clase" }));
  cierto(!avisaBloque({ tipo: "estudio", avisar: false }), "si lo apagas, no avisa");
});

// ---------- ASIGNATURAS ----------
prueba("Asignaturas", "en FP solo salen las tuyas", function () {
  estado.nivel = "fp";
  estado.misAsignaturas = ["Redes Locales"];
  igual(Object.keys(gruposAsignaturas()), ["Mis asignaturas"]);
});
prueba("Asignaturas", "en ESO salen las tuyas y las de la ESO", function () {
  estado.nivel = "eso";
  estado.misAsignaturas = ["Robótica"];
  igual(Object.keys(gruposAsignaturas()), ["Mis asignaturas", "ESO"]);
});
prueba("Asignaturas", "no se repiten (aunque cambien mayúsculas)", function () {
  cierto(anadirMiAsignatura("Redes Locales"));
  cierto(!anadirMiAsignatura("redes locales"));
  igual(estado.misAsignaturas.length, 1);
});

// ---------- COPIA DE SEGURIDAD ----------
function llenarDatos(n) { for (let i = 0; i < n; i++) sesionHace(i); }
prueba("Copia", "no molesta si aún no hay datos que perder", function () {
  llenarDatos(2);
  cierto(!tocaRecordarCopia(estado, hoy()));
});
prueba("Copia", "recuerda si nunca has hecho copia y ya tienes datos", function () {
  llenarDatos(6);
  cierto(tocaRecordarCopia(estado, hoy()));
});
prueba("Copia", "no recuerda si hiciste copia hace menos de un mes", function () {
  llenarDatos(6);
  estado.copia = { ultima: sumarDias(hoy(), -10), ultimoAviso: null, noRecordar: false };
  cierto(!tocaRecordarCopia(estado, hoy()));
  estado.copia.ultima = sumarDias(hoy(), -31);
  cierto(tocaRecordarCopia(estado, hoy()), "a los 31 días sí");
});
prueba("Copia", "solo avisa una vez al mes", function () {
  llenarDatos(6);
  estado.copia = { ultima: null, ultimoAviso: sumarDias(hoy(), -5), noRecordar: false };
  cierto(!tocaRecordarCopia(estado, hoy()));
});
prueba("Copia", "'No volver a recordar' lo apaga para siempre", function () {
  llenarDatos(6);
  estado.copia = { ultima: null, ultimoAviso: null, noRecordar: true };
  cierto(!tocaRecordarCopia(estado, hoy()));
});
prueba("Copia", "una copia trucada no puede meter código por los id", function () {
  const trucada = { sesiones: [], examenes: [{ id: 'x" onfocus="alert(1)', asignatura: "Mates", fecha: hoy() }], notas: [{ id: "n<1>", examenId: "a b" }] };
  limpiarIds(trucada);
  igual(trucada.examenes[0].id, "xonfocusalert1");
  igual(trucada.notas[0].id, "n1");
  igual(trucada.notas[0].examenId, "ab");
  igual(trucada.deberes, [], "listas que faltan se crean vacías");
});

// ---------- SEGURIDAD ----------
prueba("Seguridad", "esc() convierte los caracteres peligrosos", function () {
  igual(esc('<img src=x onerror="a">'), "&lt;img src=x onerror=&quot;a&quot;&gt;");
  igual(esc("Lengua & Literatura"), "Lengua &amp; Literatura");
});

// ---------- APIX ----------
prueba("Apix", "se enfada si no cumpliste un plan de hoy", function () {
  const hace10 = new Date(Date.now() - 10 * 60000);
  if (fechaISO(hace10) !== hoy()) return;   // justo a medianoche no se puede comprobar
  estado.planes = [{ id: "p", objetivo: "Repasar", fecha: hoy(), hora: String(hace10.getHours()).padStart(2, "0") + ":" + String(hace10.getMinutes()).padStart(2, "0"), min: 25, hecho: false }];
  const m = estadoMascota();
  igual(m.humor, "enfadado");
  cierto(m.mensaje.includes(FRASE_PALABRA));
});
prueba("Apix", "brilla (campeón) si hoy ya has estudiado", function () {
  sesionHace(0, 30);
  igual(estadoMascota().humor, "campeon");
});
prueba("Apix", "te recuerda los deberes de mañana", function () {
  estado.deberes = [{ id: "d", titulo: "Redacción", asignatura: "", fecha: sumarDias(hoy(), 1), hecho: false }];
  cierto(estadoMascota().mensaje.includes("Redacción"));
});


// ---------- PLAN AUTOMÁTICO DE EXAMEN ----------
const EXAMEN = { id: "ex1", asignatura: "Matemáticas", tema: "Ecuaciones", fecha: "2026-11-30", hora: "" };
prueba("Plan de examen", "con tiempo de sobra propone 5 sesiones (10, 7, 4, 2 y 1 día antes)", function () {
  const s = propuestaPlanExamen(EXAMEN, "2026-11-10", "18:00", "09:00");
  igual(s.map(function (x) { return x.fecha; }), ["2026-11-20", "2026-11-23", "2026-11-26", "2026-11-28", "2026-11-29"]);
});
prueba("Plan de examen", "la primera es para empezar y la última es el repaso final", function () {
  const s = propuestaPlanExamen(EXAMEN, "2026-11-10", "18:00", "09:00");
  igual(s[0].objetivo, "Estudiar Ecuaciones");
  igual(s[2].objetivo, "Repasar Ecuaciones");
  igual(s[4].objetivo, "Repaso final de Ecuaciones");
});
prueba("Plan de examen", "con el examen en 3 días solo propone los días que quedan", function () {
  const s = propuestaPlanExamen(EXAMEN, "2026-11-27", "18:00", "09:00");
  igual(s.map(function (x) { return x.antes; }), [2, 1]);
});
prueba("Plan de examen", "no propone hoy si la hora ya ha pasado", function () {
  igual(propuestaPlanExamen(EXAMEN, "2026-11-28", "18:00", "09:00").length, 2, "por la mañana: hoy y mañana");
  igual(propuestaPlanExamen(EXAMEN, "2026-11-28", "18:00", "19:30").length, 1, "por la noche: solo mañana");
});
prueba("Plan de examen", "si el examen es hoy, no propone nada", function () {
  igual(propuestaPlanExamen(EXAMEN, "2026-11-30", "18:00", "09:00").length, 0);
});
prueba("Plan de examen", "no repite días que ya tienen plan de ese examen", function () {
  estado.planes = [{ id: "p", examenId: "ex1", fecha: "2026-11-29", hora: "18:00", hecho: false }];
  const s = propuestaPlanExamen(EXAMEN, "2026-11-10", "18:00", "09:00");
  igual(s.length, 4);
  cierto(!s.some(function (x) { return x.fecha === "2026-11-29"; }));
});

// ---------- ¿QUÉ ESTUDIO HOY? ----------
prueba("Qué estudio hoy", "sin nada pendiente no propone nada", function () {
  igual(queEstudioHoy(hoy()), []);
});
prueba("Qué estudio hoy", "una entrega atrasada va antes que un examen", function () {
  estado.deberes = [{ id: "d", titulo: "Redacción", fecha: sumarDias(hoy(), -1), hecho: false }];
  estado.examenes = [{ id: "e", asignatura: "Física", tema: "", fecha: sumarDias(hoy(), 2), hora: "" }];
  igual(queEstudioHoy(hoy()).map(function (c) { return c.tipo; }), ["deber", "examen"]);
});
prueba("Qué estudio hoy", "el examen más cercano va primero", function () {
  estado.examenes = [
    { id: "a", asignatura: "Inglés", tema: "", fecha: sumarDias(hoy(), 6), hora: "" },
    { id: "b", asignatura: "Historia", tema: "", fecha: sumarDias(hoy(), 1), hora: "" },
    { id: "c", asignatura: "Lengua", tema: "", fecha: sumarDias(hoy(), 20), hora: "" }
  ];
  const c = queEstudioHoy(hoy());
  igual(c.map(function (x) { return x.asignatura; }), ["Historia", "Inglés"], "el de dentro de 20 días no sale");
  cierto(c[0].texto.includes("mañana"));
});
prueba("Qué estudio hoy", "como mucho enseña 3 cosas", function () {
  for (let i = 0; i < 6; i++) estado.examenes.push({ id: "e" + i, asignatura: "A" + i, tema: "", fecha: sumarDias(hoy(), i + 1), hora: "" });
  igual(queEstudioHoy(hoy()).length, 3);
});
prueba("Qué estudio hoy", "incluye las tarjetas que tocan hoy", function () {
  estado.tarjetas = [{ id: "t", asignatura: "Inglés", caja: 1, proxima: hoy() }];
  igual(queEstudioHoy(hoy())[0].tipo, "tarjetas");
});

// ---------- RESUMEN DEL DOMINGO ----------
prueba("Resumen", "domingoDeLaSemana", function () {
  igual(domingoDeLaSemana("2026-11-10"), "2026-11-15", "martes");
  igual(domingoDeLaSemana("2026-11-15"), "2026-11-15", "domingo");
  igual(domingoDeLaSemana("2026-11-16"), "2026-11-22", "lunes");
});
prueba("Resumen", "textoMinutos", function () {
  igual(textoMinutos(45), "45 min");
  igual(textoMinutos(120), "2 h");
  igual(textoMinutos(200), "3 h 20 min");
});
prueba("Resumen", "cuenta los minutos y días de la semana y lo que viene", function () {
  estado.sesiones = [
    { fecha: "2026-11-10", min: 60 }, { fecha: "2026-11-10", min: 40 }, { fecha: "2026-11-12", min: 100 },
    { fecha: "2026-11-08", min: 500 }   // la semana anterior: no cuenta
  ];
  estado.examenes = [{ id: "e", asignatura: "Física", fecha: "2026-11-18" }, { id: "f", asignatura: "Lengua", fecha: "2026-11-30" }];
  estado.deberes = [{ id: "d", titulo: "X", fecha: "2026-11-17", hecho: false }];
  const r = textoResumenSemana("2026-11-15");
  cierto(r.cuerpo.includes("3 h 20 min en 2 días"), r.cuerpo);
  cierto(r.cuerpo.includes("1 examen (Física) y 1 entrega"), r.cuerpo);
});
prueba("Resumen", "si no estudiaste, te anima", function () {
  cierto(textoResumenSemana("2026-11-15").cuerpo.includes("no has estudiado"));
});
prueba("Resumen", "el texto cabe en el aviso (máximo 300 letras)", function () {
  for (let i = 0; i < 40; i++) estado.examenes.push({ id: "e" + i, asignatura: "Asignatura con nombre muy largo " + i, fecha: "2026-11-17" });
  cierto(textoResumenSemana("2026-11-15").cuerpo.length <= 300);
});

// ---------- ESTADÍSTICAS POR ASIGNATURA ----------
prueba("Por asignatura", "suma los minutos de cada asignatura desde una fecha", function () {
  estado.sesiones = [
    { fecha: sumarDias(hoy(), -2), min: 30, asignatura: "Inglés" },
    { fecha: sumarDias(hoy(), -1), min: 20, asignatura: "Inglés" },
    { fecha: sumarDias(hoy(), -40), min: 99, asignatura: "Inglés" },
    { fecha: hoy(), min: 25, asignatura: "" }
  ];
  igual(minutosPorAsignatura(sumarDias(hoy(), -6)), { "Inglés": 50, "Sin asignatura": 25 });
  igual(minutosPorAsignatura(null)["Inglés"], 149, "siempre");
});
prueba("Por asignatura", "avisa de asignaturas con examen cerca que no has tocado", function () {
  estado.sesiones = [{ fecha: hoy(), min: 30, asignatura: "Inglés" }];
  estado.examenes = [
    { id: "a", asignatura: "Inglés", fecha: sumarDias(hoy(), 3) },
    { id: "b", asignatura: "Física", fecha: sumarDias(hoy(), 5) },
    { id: "c", asignatura: "Lengua", fecha: sumarDias(hoy(), 30) }
  ];
  igual(asignaturasOlvidadas(hoy()).map(function (o) { return o.asignatura; }), ["Física"]);
});


// ---------- RANGOS Y XP ----------
function sesionDia(fecha, min, salidas) { estado.sesiones.push({ fecha: fecha, hora: "18:00", min: min, objetivo: "x", asignatura: "", distracciones: salidas || 0 }); }
prueba("Rangos", "1 XP por minuto y +10 si no sales de la app", function () {
  sesionDia("2026-11-10", 45, 0);
  sesionDia("2026-11-10", 30, 2);
  igual(xpPorDia(), [{ fecha: "2026-11-10", xp: 85 }]);
});
prueba("Rangos", "+20 por cada plan cumplido y +1 por tarjeta", function () {
  sesionDia("2026-11-10", 25, 1);
  estado.planes = [{ id: "p", fecha: "2026-11-10", hecho: true }, { id: "q", fecha: "2026-11-10", hecho: false }];
  estado.repasos = { "2026-11-10": 12 };
  igual(xpTotal(), 25 + 20 + 12);
});
prueba("Rangos", "como mucho 300 XP al día", function () {
  sesionDia("2026-11-10", 500, 0);
  sesionDia("2026-11-11", 50, 1);
  igual(xpTotal(), 350);
});
prueba("Rangos", "bonus al llegar a 7 días de racha", function () {
  for (let i = 1; i <= 7; i++) sesionDia("2026-11-0" + i, 10, 1);
  igual(bonusRacha(), [{ fecha: "2026-11-07", xp: 50 }]);
  igual(xpTotal(), 70 + 50);
});
prueba("Rangos", "hay 19 escalones: 6 rangos con 3 divisiones y Apex", function () {
  const e = escalones();
  igual(e.length, 19);
  igual([e[0].xp, e[1].xp, e[2].xp, e[3].xp], [0, 100, 200, 300]);
  igual(e[18].xp, 18000);
});
prueba("Rangos", "nombre y división según la XP", function () {
  igual(rangoDe(0).nombre, "Bronce III");
  igual(rangoDe(150).nombre, "Bronce II");
  igual(rangoDe(299).nombre, "Bronce I");
  igual(rangoDe(300).nombre, "Plata III");
  igual(rangoDe(1400).nombre, "Oro II");
  igual(rangoDe(25000).nombre, "Apex");
});
prueba("Rangos", "cuánto falta y la barra", function () {
  const r = rangoDe(150);
  igual([r.siguiente, r.falta, r.porcentaje], ["Bronce I", 50, 50]);
  igual(rangoDe(18000).falta, 0, "en Apex no falta nada");
});
prueba("Rangos", "historial: el día en que conseguiste cada rango", function () {
  sesionDia("2026-11-01", 200, 1);
  sesionDia("2026-11-02", 200, 1);   // aquí pasas de 300: Plata
  igual(historialRangos(), [{ rango: 0, fecha: null }, { rango: 1, fecha: "2026-11-02" }]);
});
prueba("Rangos", "detecta cuando subes (y solo una vez)", function () {
  estado.rangoVisto = 0;
  sesionDia("2026-11-10", 120, 1);
  cierto(comprobarSubida().endsWith(" ¡Subes a Bronce II!"));
  igual(comprobarSubida(), "");
});
prueba("Rangos", "numeroBonito pone el punto de miles", function () {
  igual(numeroBonito(18000), "18.000");
  igual(numeroBonito(950), "950");
});


// ---------- PLANES DE "OTRA COSA" ----------
prueba("Planes", "los planes antiguos (sin tipo) son de estudio", function () {
  cierto(esPlanEstudio({ objetivo: "Repasar" }));
  cierto(!esPlanEstudio({ tipo: "otro", objetivo: "Cargar los cascos" }));
});
prueba("Planes", "un plan de otra cosa tiene botón Hecho, no Estudiar", function () {
  cierto(botonPlan({ id: "a", tipo: "otro" }, "▶ Estudiar").includes("plan-hecho"));
  cierto(botonPlan({ id: "b" }, "▶ Estudiar").includes("empezar-plan"));
});
prueba("Planes", "el aviso de otra cosa no habla de minutos de estudio", function () {
  igual(textoAvisoPlan({ tipo: "otro", objetivo: "Abrigo", min: 0 }), FRASE_PALABRA + " Toca: «Abrigo».");
  cierto(textoAvisoPlan({ objetivo: "Repasar", min: 25 }).includes("25 min"));
});
prueba("Planes", "cumplir un plan de otra cosa no da XP", function () {
  estado.planes = [{ id: "a", tipo: "otro", fecha: "2026-11-10", hecho: true }];
  igual(xpTotal(), 0);
});
prueba("Planes", "¿Qué estudio hoy? no propone planes de otra cosa", function () {
  estado.planes = [{ id: "a", tipo: "otro", objetivo: "Abrigo", fecha: hoy(), hora: "23:59", hecho: false }];
  igual(queEstudioHoy(hoy()), []);
});


// ---------- GENERADOR DE TEST ----------
// Azar fijo para que las pruebas den siempre lo mismo
function azarFijo() { let x = 7; return function () { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
const APUNTES = "La Revolución Francesa comenzó en 1789 con la toma de la Bastilla, el 14 de julio.\n" +
  "Las causas principales fueron la crisis económica, las desigualdades sociales y la influencia de la Ilustración.\n" +
  "La sociedad del Antiguo Régimen estaba dividida en tres estamentos: nobleza, clero y tercer estado.\n" +
  "- Luis XVI fue ejecutado en la guillotina en 1793, durante la etapa de la Convención.\n" +
  "Robespierre dirigió el período del Terror, en el que miles de personas fueron ejecutadas.\n" +
  "Los jacobinos eran el grupo más radical, mientras que los girondinos eran más moderados.\n" +
  "En 1799 Napoleón Bonaparte dio un golpe de Estado y puso fin a la Revolución.\n" +
  "Napoleón se coronó emperador en 1804 y extendió su imperio por gran parte de Europa.\n" +
  "Napoleón fue derrotado definitivamente en la batalla de Waterloo en 1815.\n" +
  "Rousseau escribió El contrato social, donde defendía la soberanía nacional.";
prueba("Generador de test", "parte los apuntes en frases y quita las viñetas", function () {
  const f = dividirFrases("TEMA 1\n- El primer punto tiene más de seis palabras. El segundo también tiene seis palabras o más.\nCorta");
  igual(f, ["El primer punto tiene más de seis palabras.", "El segundo también tiene seis palabras o más."]);
});
prueba("Generador de test", "reconoce fechas, números y nombres", function () {
  igual([tipoPalabra("1789"), tipoPalabra("389"), tipoPalabra("Napoleón"), tipoPalabra("estado")], ["anio", "numero", "nombre", "palabra"]);
});
prueba("Generador de test", "como mucho 20 preguntas", function () {
  let largo = "";
  for (let i = 0; i < 6; i++) largo += APUNTES.replace(/\d{4}/g, function (a) { return String(Number(a) + i * 20); }) + "\n";
  cierto(generarExamen(largo, 50, azarFijo()).length <= 20);
});
prueba("Generador de test", "opciones distintas y una correcta (4, o 2 en verdadero o falso)", function () {
  const qs = generarExamen(APUNTES, 10, azarFijo());
  cierto(qs.length >= 5, "salen " + qs.length);
  for (const q of qs) {
    igual(q.opciones.length, q.tipo === "vf" ? 2 : 4, q.enunciado);
    igual(new Set(q.opciones.map(function (o) { return o.toLowerCase(); })).size, q.opciones.length, q.enunciado);
    cierto(q.correcta >= 0 && q.correcta < q.opciones.length);
    cierto(q.tarjeta && q.tarjeta.pregunta && q.tarjeta.respuesta, "tiene tarjeta de repaso");
  }
});
prueba("Generador de test", "en rellenar el hueco, la respuesta sale de los apuntes y no se ve", function () {
  for (const q of generarExamen(APUNTES, 10, azarFijo())) {
    if (q.tipo !== "hueco") continue;
    cierto(q.enunciado.includes(HUECO));
    cierto(q.frase.includes(q.opciones[q.correcta]));
  }
});
prueba("Generador de test", "las fechas tienen opciones falsas que también son fechas", function () {
  const frases = dividirFrases(APUNTES);
  const h = preguntaHueco(frases[0], 0, palabrasClave(frases), azarFijo());
  igual(h.correcta, "1789");
  cierto(h.falsas.every(function (o) { return /^\d{4}$/.test(o); }));
});
prueba("Generador de test", "la respuesta correcta no siempre está en la misma letra", function () {
  const letras = new Set(generarExamen(APUNTES, 10, azarFijo()).map(function (q) { return q.correcta; }));
  cierto(letras.size >= 3);
});
prueba("Generador de test", "con muy poco texto no inventa preguntas", function () {
  igual(generarExamen("Hola, esto es muy corto.", 10, azarFijo()).length, 0);
});
prueba("Generador de test", "la nota sobre 10", function () {
  const qs = [{ correcta: 0 }, { correcta: 1 }, { correcta: 2 }, { correcta: 3 }];
  igual(notaTest(qs, [0, 1, 0, undefined]), { bien: 2, nota: 5 });
  igual(notaTest(qs.slice(0, 3), [0, 1, 2]), { bien: 3, nota: 10 });
});


prueba("Generador de test", "junta las frases que vienen cortadas en dos líneas (PDF y fotos)", function () {
  igual(juntarLineas("La Revolución comenzó\nen 1789 con la toma de la Bas-\ntilla.\n- Punto nuevo"), ["La Revolución comenzó en 1789 con la toma de la Bastilla.", "- Punto nuevo"]);
  igual(juntarLineas("clero y tercer\n\nestado.\n\nOtra frase."), ["clero y tercer estado.", "", "Otra frase."]);
});
prueba("Generador de test", "verdadero o falso: la falsa cambia una palabra de la frase", function () {
  const frases = dividirFrases(APUNTES);
  const h = preguntaHueco(frases[0], 0, palabrasClave(frases), azarFijo());
  const v = preguntaVerdaderoFalso(h, true);
  const f = preguntaVerdaderoFalso(h, false);
  igual([v.correcta, f.correcta], [0, 1]);
  cierto(v.enunciado.includes(frases[0]));
  cierto(!f.enunciado.includes("1789") && f.enunciado.includes(h.falsas[0]));
});
prueba("Generador de test", "¿cuál es correcta?: solo una opción es una frase real", function () {
  const frases = dividirFrases(APUNTES);
  const claves = palabrasClave(frases);
  const grupo = [0, 3, 6, 8].map(function (i) { return preguntaHueco(frases[i], i, claves, azarFijo(), "Revolución"); });
  grupo.forEach(function (h) { h.buenCambio = true; });
  const p = preguntaAfirmaciones(grupo, function () { return 0.1; });   // 0.1 → "¿cuál es correcta?"
  igual(p.correcta, frases[0]);
  cierto(p.falsas.every(function (f) { return !frases.includes(f); }));
});
prueba("Generador de test", "con apuntes largos mezcla tipos de pregunta", function () {
  let largo = "";
  for (let i = 0; i < 4; i++) largo += APUNTES.replace(/\d{4}/g, function (a) { return String(Number(a) + i * 30); }).replace(/Napoleón/g, "Napoleón" + "ABCD"[i]) + "\n";
  const tipos = new Set(generarExamen(largo, 20, azarFijo()).map(function (q) { return q.tipo; }));
  cierto(tipos.has("hueco") && tipos.has("vf"), [...tipos].join(", "));
});
prueba("Lector de archivos", "reconoce el tipo de archivo", function () {
  igual([tipoArchivo("tema1.PDF", ""), tipoArchivo("a.docx", ""), tipoArchivo("a.doc", ""), tipoArchivo("foto.jpg", ""), tipoArchivo("x", "image/png"), tipoArchivo("n.txt", ""), tipoArchivo("a.zip", "")],
    ["pdf", "docx", "doc", "imagen", "imagen", "texto", "otro"]);
});
prueba("Lector de archivos", "saca el texto del XML de Word por párrafos", function () {
  igual(textoDeWord('<w:p><w:r><w:t>Tema 1</w:t></w:r></w:p><w:p><w:r><w:t>Uno &amp; </w:t></w:r><w:r><w:t>dos</w:t></w:r></w:p>'), "Tema 1\nUno & dos");
});


prueba("Generador de test", "quita el índice, los encabezados y los números de página", function () {
  const pdf = "Ministerio de Educación\nÍNDICE\n14 5 Introducción a protocolos en red ............ 14\n" +
    "Ministerio de Educación\nPágina 2\nUn protocolo es un conjunto de reglas para comunicar equipos en una red.\n" +
    "Ministerio de Educación\n3 / 20\nEl modelo OSI divide la comunicación en siete capas distintas.";
  igual(dividirFrases(pdf), ["Un protocolo es un conjunto de reglas para comunicar equipos en una red.", "El modelo OSI divide la comunicación en siete capas distintas."]);
});
prueba("Generador de test", "no usa frases que no se entienden solas ni títulos", function () {
  const t = "Las redes se dividen en subredes más pequeñas.\nEsta división es un paso para facilitar la gestión del tráfico.\n" +
    "Introducción a los protocolos de red de área local\nPor ello los routers necesitan tablas de rutas actualizadas.";
  igual(dividirFrases(t), ["Las redes se dividen en subredes más pequeñas."]);
});


prueba("Generador de test", "no confunde frases normales con definiciones", function () {
  const d = buscarDefiniciones([
    "Quitando la primera dirección que es la dirección de la subred quedarían 30 hosts.",
    "La diferencia con DHCP es que DHCP configura la conexión de los equipos.",
    "Existen máscaras que no son estándares y que se usan para crear subredes.",
    "El servidor es un equipo o programa que ofrece una funcionalidad a otros."]);
  igual(d.map(function (x) { return x.termino; }), ["El servidor"]);
});


prueba("Generador de test", "no pregunta adjetivos como «posibles» o «distintos»", function () {
  const frases = ["Se pierden ochenta y cuatro posibles hosts en las tres subredes WAN."];
  const h = preguntaHueco(frases[0], 0, palabrasClave(frases.concat(["Los hosts y las subredes forman parte de la red local."])), azarFijo());
  cierto(!h || h.correcta !== "posibles", h && h.correcta);
});
prueba("Generador de test", "usa el título del apartado cuando la frase no dice de qué habla", function () {
  const titulos = [];
  const f = dividirFrases("1.1 Máscara de red\nEs un procedimiento equivalente al sufijo /X de CIDR en las direcciones.", titulos);
  igual(titulos, ["Máscara de red"]);
  cierto(empiezaSinSujeto(f[0]));
  const claves = palabrasClave(f.concat(["CIDR y DHCP y DNS y HTTP son protocolos o métodos de las redes IP."]));
  const h = preguntaHueco(f[0], 0, claves, azarFijo(), titulos[0]);
  igual(h && h.contexto, "Máscara de red");
  igual(preguntaHueco(f[0], 0, claves, azarFijo(), ""), null, "sin título no se pregunta");
});


// ---------- HORAS DE SILENCIO ----------
const SILENCIO = { silencio: true, silDesde: "23:00", silHasta: "07:00", silencioClases: false };
function hhmm(d) { return fechaISO(d) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
prueba("Silencio", "un aviso a las 23:30 pasa a las 07:00 del día siguiente", function () {
  igual(hhmm(fueraDeSilencio(new Date("2026-11-20T23:30:00"), SILENCIO, [])), "2026-11-21 07:00");
});
prueba("Silencio", "un aviso a las 05:00 pasa a las 07:00 del mismo día", function () {
  igual(hhmm(fueraDeSilencio(new Date("2026-11-20T05:00:00"), SILENCIO, [])), "2026-11-20 07:00");
});
prueba("Silencio", "fuera del silencio no cambia", function () {
  igual(hhmm(fueraDeSilencio(new Date("2026-11-20T18:00:00"), SILENCIO, [])), "2026-11-20 18:00");
});
prueba("Silencio", "si está apagado, no cambia nada", function () {
  igual(hhmm(fueraDeSilencio(new Date("2026-11-20T23:30:00"), Object.assign({}, SILENCIO, { silencio: false }), [])), "2026-11-20 23:30");
});
prueba("Silencio", "en clase: se mueve al final de la clase", function () {
  // 2026-11-20 es viernes → dia 4
  const horario = [{ tipo: "clase", dia: 4, inicio: "08:00", fin: "14:30" }, { tipo: "estudio", dia: 4, inicio: "17:00", fin: "18:00" }];
  const c = Object.assign({}, SILENCIO, { silencioClases: true });
  igual(hhmm(fueraDeSilencio(new Date("2026-11-20T10:00:00"), c, horario)), "2026-11-20 14:30");
  igual(hhmm(fueraDeSilencio(new Date("2026-11-20T17:30:00"), c, horario)), "2026-11-20 17:30", "los bloques de estudio no silencian");
});
prueba("Silencio", "al terminar la noche, si empieza una clase, espera a que acabe", function () {
  const horario = [{ tipo: "clase", dia: 4, inicio: "07:00", fin: "08:00" }];
  igual(hhmm(fueraDeSilencio(new Date("2026-11-20T06:00:00"), Object.assign({}, SILENCIO, { silencioClases: true }), horario)), "2026-11-20 08:00");
});

// ---------- PEGAR UNA LISTA DE TARJETAS ----------
prueba("Tarjetas", "pegar una lista: una tarjeta por línea con distintos separadores", function () {
  const r = parsearListaTarjetas("¿Qué es DHCP? - Reparte direcciones IP\nPuerto de HTTPS = 443\n- Capital de Francia: París\n\nlínea sin separador\nIPv4\t32 bits");
  igual(r.tarjetas, [
    { pregunta: "¿Qué es DHCP?", respuesta: "Reparte direcciones IP" },
    { pregunta: "Puerto de HTTPS", respuesta: "443" },
    { pregunta: "Capital de Francia", respuesta: "París" },
    { pregunta: "IPv4", respuesta: "32 bits" }]);
  igual(r.malas, 1);
});
prueba("Tarjetas", "un guion dentro de una palabra no corta la tarjeta", function () {
  igual(parsearListaTarjetas("Wi-Fi - red inalámbrica").tarjetas, [{ pregunta: "Wi-Fi", respuesta: "red inalámbrica" }]);
});


// ---------- NOVEDADES 3.8 ----------
prueba("Rangos", "un test da 3 XP por punto de nota", function () {
  estado.testsHechos = [{ fecha: "2026-11-10", nota: 8, bien: 8, preguntas: 10 }, { fecha: "2026-11-10", nota: 5.5, bien: 11, preguntas: 20 }];
  igual(xpTotal(), 24 + 17);
});
prueba("Tarjetas", "compartir y volver a pegar da las mismas tarjetas", function () {
  estado.tarjetas = [
    { id: "a", asignatura: "Redes", pregunta: "¿Qué es DHCP?", respuesta: "Reparte IP", caja: 1, proxima: hoy() },
    { id: "b", asignatura: "Redes", pregunta: "Wi-Fi - estándar", respuesta: "802.11 = inalámbrico", caja: 1, proxima: hoy() },
    { id: "c", asignatura: "Redes", pregunta: "Puerto de HTTPS: cuál", respuesta: "443", caja: 1, proxima: hoy() },
    { id: "d", asignatura: "Otra", pregunta: "No sale", respuesta: "x", caja: 1, proxima: hoy() }];
  const texto = textoCompartirTarjetas("Redes");
  cierto(texto.indexOf("📚 Tarjetas de Redes") === 0);
  const r = parsearListaTarjetas(texto);
  igual(r.malas, 0);
  igual(r.tarjetas.map(function (t) { return t.respuesta; }), ["Reparte IP", "802.11=inalámbrico", "443"]);
  igual(r.tarjetas[0].pregunta, "¿Qué es DHCP?");
});
prueba("Repaso exprés", "sale con un examen hoy o mañana, no pasado mañana", function () {
  estado.examenes = [{ id: "e", asignatura: "Redes", fecha: sumarDias(hoy(), 2), hora: "" }];
  igual(examenParaRepasoExpres(hoy()), null);
  estado.examenes[0].fecha = sumarDias(hoy(), 1);
  igual(examenParaRepasoExpres(hoy()).asignatura, "Redes");
});
prueba("Consejos", "enseña uno que no has usado, y el siguiente a los 2 días", function () {
  estado.consejos = { vistos: [], ultimo: null, actual: null };
  const primero = consejoDeHoy("2026-11-10");
  igual(primero.id, "test");
  igual(consejoDeHoy("2026-11-10").id, "test", "sigue saliendo hasta que lo cierras");
  cerrarConsejo("2026-11-10");
  igual(consejoDeHoy("2026-11-11"), null, "al día siguiente no");
  igual(consejoDeHoy("2026-11-12").id, "rapido");
});
prueba("Consejos", "no enseña lo que ya usas", function () {
  estado.consejos = { vistos: [], ultimo: null, actual: null };
  estado.testsHechos = [{ fecha: hoy(), nota: 7, bien: 7, preguntas: 10 }];
  igual(consejoDeHoy("2026-11-10").id, "rapido");
});


// ---------- TEST Y TARJETAS PARA LA ESO ----------
prueba("Modo escribir", "acepta mayúsculas, signos y artículos", function () {
  igual(compararRespuesta("París", "parís"), "si");
  igual(compararRespuesta("the dog", "dog"), "si");
  igual(compararRespuesta("  ¡Mitocondria! ", "La mitocondria"), "si");
});
prueba("Modo escribir", "una tilde o una letra mal es «casi»", function () {
  igual(compararRespuesta("paris", "París"), "casi");
  igual(compararRespuesta("fotosintesis", "fotosíntesis"), "casi");
  igual(compararRespuesta("beatiful", "beautiful"), "casi");
});
prueba("Modo escribir", "otra palabra es «no» y vale cualquiera de varias opciones", function () {
  igual(compararRespuesta("gato", "perro"), "no");
  igual(compararRespuesta("", "perro"), "no");
  igual(compararRespuesta("coche", "car / coche"), "si");
  igual(compararRespuesta("rojo", "red, rojo"), "si");
});
prueba("Modo escribir", "las respuestas largas las compara el alumno", function () {
  igual(compararRespuesta("algo", "Un servicio que reparte direcciones IP a los equipos de la red"), null);
});
prueba("Test de tarjetas", "cada tarjeta es una pregunta con respuestas de otras tarjetas", function () {
  const ts = ["perro-dog", "gato-cat", "casa-house", "rojo-red", "azul-blue"].map(function (x, i) {
    const p = x.split("-"); return { id: "t" + i, asignatura: "Inglés", pregunta: p[0], respuesta: p[1], caja: 1, proxima: hoy() };
  });
  const qs = generarTestDeTarjetas(ts, 10, azarFijo());
  igual(qs.length, 5);
  for (const q of qs) {
    const t = ts.find(function (x) { return x.id === q.tarjetaId; });
    igual(q.opciones[q.correcta], t.respuesta);
    igual(q.opciones.length, 4);
    igual(new Set(q.opciones).size, 4);
  }
});
prueba("Test de tarjetas", "con menos de 4 respuestas distintas no se puede", function () {
  igual(generarTestDeTarjetas([{ id: "a", pregunta: "1", respuesta: "x" }, { id: "b", pregunta: "2", respuesta: "y" }, { id: "c", pregunta: "3", respuesta: "x" }], 10, azarFijo()), []);
});
prueba("Test", "repetir los fallos: misma respuesta buena aunque cambien de sitio", function () {
  const qs = generarExamen(APUNTES, 10, azarFijo());
  const otra = remezclarPreguntas(qs, azarFijo());
  igual(otra.length, qs.length);
  for (const q of otra) {
    const original = qs.find(function (x) { return x.enunciado === q.enunciado; });
    igual(q.opciones[q.correcta], original.opciones[original.correcta]);
  }
});
prueba("Tarjetas de apuntes", "saca tarjetas de definiciones y frases", function () {
  const apuntes = "El servidor es un equipo que ofrece servicios a otros equipos de la red.\n" +
    "El cliente es un equipo que pide servicios a un servidor de la red.\n" +
    "La Revolución Francesa comenzó en 1789 con la toma de la Bastilla.\n" +
    "Napoleón fue derrotado definitivamente en la batalla de Waterloo en 1815.";
  const ts = tarjetasDesdeApuntes(apuntes, 20, azarFijo());
  cierto(ts.length >= 2, "salen " + ts.length);
  cierto(ts.some(function (t) { return t.pregunta === "¿Qué es el servidor?"; }), JSON.stringify(ts));
  cierto(ts.every(function (t) { return t.pregunta && t.respuesta; }));
});
prueba("Apuntes", "se guardan por asignatura y se conservan los de antes", function () {
  estado.testApuntes = "apuntes viejos";
  estado.testAsignatura = "Historia";
  igual(apuntesDe("Historia"), "apuntes viejos");
  guardarApuntes("Inglés", "vocabulario");
  igual([apuntesDe("Inglés"), apuntesDe("Historia"), apuntesDe("Física")], ["vocabulario", "apuntes viejos", ""]);
  guardarApuntes("Inglés", "");
  igual(Object.keys(estado.apuntes), ["Historia"]);
});

// ---------- Curso: fechas, evaluaciones y resúmenes ----------
prueba("Curso", "las fechas por defecto dependen del curso (septiembre a junio)", function () {
  const nov = fechasCurso("2026-11-22");
  igual([nov.curso, nov.fin1, nov.fin2, nov.pau], [2026, "2026-12-22", "2027-03-19", "2027-06-01"]);
  igual(fechasCurso("2027-02-10").curso, 2026);
  igual(fechasCurso("2027-09-15").curso, 2027);
});
prueba("Curso", "se usan las fechas propias solo si son de este curso", function () {
  estado.fechasCurso = { curso: 2026, fin1: "2026-12-19" };
  igual(fechasCurso("2026-11-22").fin1, "2026-12-19");
  igual(fechasCurso("2027-10-01").fin1, "2027-12-22");
});
prueba("Curso", "sabe en qué evaluación estamos", function () {
  igual(evaluacionActual("2026-11-22").numero, 1);
  igual(evaluacionActual("2026-12-23").numero, 2);
  igual(evaluacionActual("2027-04-01").numero, 3);
  igual(evaluacionActual("2027-07-15"), null);
});
prueba("Curso", "el aviso de racha avisa del protector", function () {
  cierto(textoAvisoRacha(5, true).includes("5 días"));
  cierto(textoAvisoRacha(5, true).includes("protector"));
  cierto(!textoAvisoRacha(1, false).includes("protector"));
  cierto(textoAvisoRacha(1, false).includes("1 día "));
});
prueba("Curso", "mejor racha y resumen de un periodo", function () {
  estado.sesiones = [
    { fecha: "2026-10-01", min: 30, asignatura: "Historia" },
    { fecha: "2026-10-02", min: 20, asignatura: "Inglés" },
    { fecha: "2026-10-03", min: 40, asignatura: "Historia" },
    { fecha: "2026-10-05", min: 10, asignatura: "Inglés" },
    { fecha: "2026-12-30", min: 99, asignatura: "Física" }
  ];
  estado.testsHechos = [{ fecha: "2026-10-02", nota: 7.5 }, { fecha: "2026-10-04", nota: 9 }];
  estado.repasos = { "2026-10-03": 12, "2027-01-01": 5 };
  const r = resumenPeriodo("2026-09-08", "2026-12-22");
  igual([r.minutos, r.dias, r.asignaturaTop, r.minutosTop, r.mejorRacha, r.tests, r.mejorNota, r.tarjetas],
    [100, 4, "Historia", 70, 3, 2, 9, 12]);
});
prueba("Curso", "solo avisa del resumen cerca del fin y si no lo has visto", function () {
  estado.sesiones = [{ fecha: "2026-10-01", min: 30, asignatura: "Historia" }];
  igual(evaluacionParaAvisar("2026-11-22"), null);
  igual(evaluacionParaAvisar("2026-12-20").numero, 1);
  igual(evaluacionParaAvisar("2027-01-03").numero, 1);
  estado.resumenesVistos = ["2026-1"];
  igual(evaluacionParaAvisar("2026-12-20"), null);
});

// ---------- Ejecutar todas ----------
function ejecutarPruebas() {
  const guardado = estado;
  const resultados = [];
  for (const p of PRUEBAS) {
    estado = datosVacios();
    try {
      p.fn();
      resultados.push({ grupo: p.grupo, nombre: p.nombre, ok: true });
    } catch (e) {
      resultados.push({ grupo: p.grupo, nombre: p.nombre, ok: false, detalle: e.message });
    }
  }
  estado = guardado;
  return resultados;
}
