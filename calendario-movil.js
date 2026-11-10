// =====================================================
// APEX STUDY · LLEVAR TODO AL CALENDARIO DEL MÓVIL
// Una web no puede crear widgets en la pantalla de inicio, pero el
// Calendario del móvil sí tiene widget. Así que creamos un archivo .ics
// (el formato estándar de calendarios) con exámenes, deberes, planes y
// horario, y el móvil lo añade a su Calendario. Además cada evento lleva
// su alarma, así que el móvil avisa aunque Apex Study esté cerrada.
// =====================================================

// "2026-11-10" + "18:30" → "20261110T183000" (hora del móvil)
function icsFechaHora(fecha, hora) {
  return fecha.replace(/-/g, "") + "T" + hora.replace(":", "") + "00";
}

function icsFecha(fecha) { return fecha.replace(/-/g, ""); }

// En los .ics hay que "escapar" comas, puntos y coma y saltos de línea
function icsTexto(t) {
  return String(t || "").replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

// Una alarma: "minutos" antes del inicio del evento
function icsAlarma(minutos, texto) {
  return ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsTexto(texto), "TRIGGER:-PT" + minutos + "M", "END:VALARM"];
}

function crearICS() {
  const c = configAvisos();
  const lineas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Apex Study//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Apex Study"];
  const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  // Minutos desde las 00:00 del día del evento hasta la hora "tarde" del día anterior
  const minTarde = 24 * 60 - aMinutos(c.tarde);

  function evento(uid, datos) {
    lineas.push("BEGIN:VEVENT", "UID:" + uid + "@apex-study", "DTSTAMP:" + ahora);
    for (const l of datos) lineas.push(l);
    lineas.push("END:VEVENT");
  }

  // Exámenes (todo el día, o a su hora si la tiene)
  for (const e of proximosExamenes()) {
    const titulo = "📅 Examen: " + e.asignatura + (e.tema ? " (" + e.tema + ")" : "");
    const datos = ["SUMMARY:" + icsTexto(titulo)];
    if (e.hora) {
      datos.push("DTSTART:" + icsFechaHora(e.fecha, e.hora), "DURATION:PT1H");
      datos.push(...icsAlarma(aMinutos(e.hora) + minTarde, "Mañana tienes " + titulo));
    } else {
      datos.push("DTSTART;VALUE=DATE:" + icsFecha(e.fecha), "DTEND;VALUE=DATE:" + icsFecha(sumarDias(e.fecha, 1)));
      datos.push(...icsAlarma(minTarde, "Mañana tienes " + titulo));
    }
    evento("ex-" + e.id, datos);
  }

  // Deberes sin hacer (el día de entrega)
  for (const d of deberesPendientes()) {
    if (d.fecha < hoy()) continue;
    evento("deb-" + d.id, [
      "SUMMARY:" + icsTexto("✏️ Entregar: " + d.titulo + (d.asignatura ? " (" + d.asignatura + ")" : "")),
      "DTSTART;VALUE=DATE:" + icsFecha(d.fecha), "DTEND;VALUE=DATE:" + icsFecha(sumarDias(d.fecha, 1)),
      ...icsAlarma(minTarde, "Mañana entregas " + d.titulo)
    ]);
  }

  // Planes de estudio pendientes
  for (const p of proximosPlanes()) {
    const datos = [
      "SUMMARY:" + icsTexto("📚 " + p.objetivo),
      "DESCRIPTION:" + icsTexto("Apix: " + FRASE_PALABRA),
      "DTSTART:" + icsFechaHora(p.fecha, p.hora), "DURATION:PT" + p.min + "M",
      ...icsAlarma(0, FRASE_PALABRA + " Toca: " + p.objetivo)
    ];
    if (p.antes) datos.push(...icsAlarma(p.antes, "En " + p.antes + " min: " + p.objetivo));
    evento("plan-" + p.id, datos);
  }

  // Horario semanal: se repite cada semana (RRULE = regla de repetición)
  const DIAS_ICS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  for (const b of estado.horario || []) {
    // Primer día a partir de hoy que cae en ese día de la semana
    let fecha = hoy();
    while ((new Date(fecha + "T12:00:00").getDay() + 6) % 7 !== b.dia) fecha = sumarDias(fecha, 1);
    const t = TIPOS[b.tipo] || TIPOS.otro;
    const datos = [
      "SUMMARY:" + icsTexto(t.icono + " " + b.titulo),
      "DTSTART:" + icsFechaHora(fecha, b.inicio), "DTEND:" + icsFechaHora(fecha, b.fin),
      "RRULE:FREQ=WEEKLY;BYDAY=" + DIAS_ICS[b.dia]
    ];
    if (avisaBloque(b)) datos.push(...icsAlarma(0, "Toca: " + b.titulo));
    evento("hor-" + b.id, datos);
  }

  lineas.push("END:VCALENDAR");
  return lineas.join("\r\n");
}

// Abre el menú de compartir del móvil con el archivo (o lo descarga si no se puede)
async function exportarCalendario() {
  const texto = crearICS();
  const total = (texto.match(/BEGIN:VEVENT/g) || []).length;
  if (!total) { toast("No hay nada que añadir todavía"); return; }
  const archivo = new File([texto], "apex-study.ics", { type: "text/calendar" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: "Apex Study" });
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return;   // ha cerrado el menú de compartir
  }
  // Plan B: descargar el archivo y abrirlo
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = "apex-study.ics";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  toast("📲 Abre el archivo descargado para añadir " + total + " eventos");
}
