// =====================================================
// APEX STUDY · APIX, LA MASCOTA (versión estudio)
// Es el mismo Apix de Apex Gym, pero con gafas y libro cuando estudia.
// - apixSVG(humor) lo dibuja según el humor.
// - estadoMascota() decide qué humor y qué mensaje tiene en Inicio.
// =====================================================

const FRASE_PALABRA = "Tienes que cumplir con tu palabra.";

// Frases que dice Apix mientras estudias (cambian cada 5 minutos)
const FRASES_ESTUDIO = [
  "¡Tú puedes! Sigue así.",
  "Cada minuto cuenta.",
  "Concéntrate, lo estás haciendo genial.",
  "El esfuerzo de hoy es el aprobado de mañana.",
  "Nada de móvil: solo tú y tu objetivo.",
  "Paso a paso se sube la montaña.",
  "Lo que estudias hoy, mañana te sale solo.",
  "La disciplina gana a la motivación."
];

// Frases de Inicio cuando no hay nada especial
const FRASES_HOLA = [
  "¡Hola! Soy Apix. ¿Qué aprendemos hoy?",
  "Un poco cada día y llegarás lejos.",
  "Apunta tus exámenes y planifica cuándo empiezas. Yo te aviso.",
  "Hoy es buen día para aprender algo nuevo."
];

// Elige una frase según el día (así no cambia cada vez que abres la app)
function fraseDelDia(lista) {
  const dia = Math.floor(Date.now() / 86400000);
  return lista[dia % lista.length];
}

// Humor y mensaje de Apix en la pantalla de Inicio.
// Orden: estudiaste hoy → plan incumplido → plan para hoy → examen cerca → racha perdida → normal
function estadoMascota() {
  const hoyF = hoy();
  const ahora = new Date();

  // 1. Hoy ya has estudiado: Apix se pone amarillo (es el premio)
  const minHoy = minutosDelDia(hoyF);
  if (minHoy > 0) {
    return { humor: "campeon", mensaje: "¡Hoy llevas " + minHoy + " min de estudio! Así se cumple la palabra. ¡Estoy que brillo!" };
  }

  // 2. Un plan de hoy cuya hora ya pasó y no lo has cumplido: Apix se enfada
  const incumplido = estado.planes.find(function (p) {
    return p.fecha === hoyF && !p.hecho && fechaHoraPlan(p) < ahora;
  });
  if (incumplido) {
    return {
      humor: "enfadado",
      mensaje: "Dijiste que a las " + incumplido.hora + " empezarías «" + incumplido.objetivo + "». " + FRASE_PALABRA,
      plan: incumplido.id
    };
  }

  // 3. Un plan para más tarde hoy: Apix te lo recuerda
  const pendiente = planesDelDia(hoyF).find(function (p) { return !p.hecho; });
  if (pendiente) {
    return {
      humor: "anima",
      mensaje: "Hoy a las " + pendiente.hora + " empiezas «" + pendiente.objetivo + "». " + FRASE_PALABRA,
      plan: pendiente.id
    };
  }

  // 4. Un examen en 3 días o menos
  const examen = proximosExamenes()[0];
  if (examen && diasEntre(hoyF, examen.fecha) <= 3) {
    const d = diasEntre(hoyF, examen.fecha);
    const cuando = d === 0 ? "es HOY" : d === 1 ? "es mañana" : "es en " + d + " días";
    return { humor: "anima", mensaje: "El examen de " + examen.asignatura + " " + cuando + ". ¡A repasar!" };
  }

  // 5. Racha perdida (estudiabas y ayer no lo hiciste)
  const perdida = rachaPerdida();
  if (perdida >= 2) {
    return { humor: "enfadado", mensaje: "¡¿Cómo que has perdido la racha?! " + perdida + " días seguidos… Hoy la recuperamos, ¿vale?" };
  }

  // 6. Normal
  return { humor: "estudia", mensaje: fraseDelDia(FRASES_HOLA) };
}

// ---------- Dibujo de Apix ----------
// Bolita suave morada con brillo, bracitos y patitas (igual que en Apex Gym).
// Humores: contento, estudia, anima, enfadado, celebra, campeon, descanso, cuida
function apixSVG(humor, tam) {
  const h = humor || "contento";
  const enfadado = h === "enfadado";
  const feliz = h === "campeon" || h === "celebra";
  const estudia = h === "estudia";

  // Colores del cuerpo: morado normal, rojo si se enfada y amarillo si está feliz
  let claro = "#C9B2FF";
  let medio = "#8A5CFF";
  let borde = "#5B2BE0";
  if (enfadado) { claro = "#FF9A9A"; medio = "#FF4D4D"; borde = "#C81E2E"; }
  if (feliz) { claro = "#FFF4B8"; medio = "#FFD23F"; borde = "#E0A100"; }
  const tinta = "#1F2B2B";
  const id = "as-" + h;   // id del degradado (uno por humor)

  let s = '<svg class="apix apix-' + h + ' ' + (tam || "") + '" viewBox="0 -16 120 136" role="img" aria-label="Apix, la mascota de Apex Study">';
  s += '<defs><radialGradient id="' + id + '" cx="40%" cy="30%" r="80%">' +
       '<stop offset="0" stop-color="' + claro + '"/><stop offset=".6" stop-color="' + medio + '"/><stop offset="1" stop-color="' + borde + '"/></radialGradient></defs>';

  // Sombra y patas
  s += '<ellipse cx="60" cy="110" rx="34" ry="4" fill="#000" opacity=".15"/>' +
       '<ellipse cx="43" cy="104" rx="9" ry="6" fill="' + borde + '"/><ellipse cx="77" cy="104" rx="9" ry="6" fill="' + borde + '"/>';
  // Brazos a los lados (si estudia, los pone luego sujetando el libro)
  if (!estudia) {
    s += '<ellipse cx="16" cy="80" rx="6" ry="8" fill="' + borde + '"/><ellipse cx="104" cy="80" rx="6" ry="8" fill="' + borde + '"/>';
  }
  // Cuerpo y brillo
  s += '<path d="M16,82 C14,44 38,22 60,22 C82,22 106,44 104,82 C103,98 86,104 60,104 C34,104 17,98 16,82 Z" fill="url(#' + id + ')"/>' +
       '<ellipse cx="42" cy="36" rx="12" ry="6" fill="#fff" opacity=".75" transform="rotate(-22 42 36)"/>';

  // Fuego cuando se enfada
  if (enfadado) s += '<g class="apix-fuego">' +
    '<path d="M60,-14 C66,-4 78,0 76,14 C75,22 68,27 60,27 C52,27 45,22 44,14 C43,4 52,2 52,-6 C55,-2 57,0 58,4 C60,-2 58,-8 60,-14 Z" fill="#FF3B1F"/>' +
    '<path d="M60,-2 C64,5 71,8 70,16 C69,22 65,26 60,26 C55,26 51,22 50,16 C50,10 55,8 56,3 C58,6 59,8 60,10 C61,6 60,2 60,-2 Z" fill="#FF8A00"/>' +
    '<path d="M60,9 C63,13 66,16 65,20 C64,24 62,26 60,26 C58,26 56,24 55,20 C55,16 58,14 60,9 Z" fill="#FFD84A"/></g>';
  // Cinta de motivación
  if (h === "anima") s += '<path d="M22,46 Q60,34 98,46 L97,54 Q60,42 23,54 Z" fill="#FF8A3D"/><path d="M96,48 l13,-5 l-4,11 z" fill="#FF8A3D"/>';
  // Corona y confeti
  if (feliz) s += '<path d="M47,24 L50,12 L56,19 L60,8 L64,19 L70,12 L73,24 Z" fill="#FFD25A" stroke="#C9971A" stroke-width="1.5" stroke-linejoin="round"/>' +
                  '<circle cx="18" cy="34" r="2.5" fill="#FFD25A"/><circle cx="104" cy="30" r="2.5" fill="#FF8FB1"/><circle cx="108" cy="50" r="2" fill="#7FB8FF"/>';

  // Ojos
  if (h === "descanso") {
    s += '<path d="M39,64 q7,5 14,0 M67,64 q7,5 14,0" fill="none" stroke="' + tinta + '" stroke-width="3" stroke-linecap="round"/>' +
         '<text x="90" y="30" font-family="sans-serif" font-weight="800" font-size="13" fill="#7A4DFF">z</text><text x="100" y="18" font-family="sans-serif" font-weight="800" font-size="10" fill="#7A4DFF">z</text>';
  } else if (feliz) {
    s += '<path d="M39,66 q7,-8 14,0 M67,66 q7,-8 14,0" fill="none" stroke="' + tinta + '" stroke-width="3.5" stroke-linecap="round"/>';
  } else {
    const baja = h === "cuida" ? 2 : 0;
    s += '<circle cx="46" cy="' + (63 + baja) + '" r="8" fill="' + tinta + '"/><circle cx="74" cy="' + (63 + baja) + '" r="8" fill="' + tinta + '"/>' +
         '<circle cx="49" cy="' + (60 + baja) + '" r="2.8" fill="#fff"/><circle cx="77" cy="' + (60 + baja) + '" r="2.8" fill="#fff"/>' +
         '<circle cx="43.5" cy="' + (66 + baja) + '" r="1.3" fill="#fff"/><circle cx="71.5" cy="' + (66 + baja) + '" r="1.3" fill="#fff"/>';
  }

  // Gafas de estudiar
  if (estudia) {
    s += '<g fill="rgba(255,255,255,.18)" stroke="' + tinta + '" stroke-width="2.6">' +
         '<circle cx="46" cy="63" r="12.5"/><circle cx="74" cy="63" r="12.5"/></g>' +
         '<path d="M58.5,62 Q60,59.5 61.5,62" fill="none" stroke="' + tinta + '" stroke-width="2.6" stroke-linecap="round"/>';
  }

  // Cejas
  if (enfadado) s += '<path d="M37,48 L53,54 M83,48 L67,54" stroke="' + tinta + '" stroke-width="3.5" stroke-linecap="round"/>';
  else if (h === "anima") s += '<path d="M39,49 L52,53 M81,49 L68,53" stroke="' + tinta + '" stroke-width="3.5" stroke-linecap="round"/>';
  else if (h === "cuida") s += '<path d="M40,52 L50,48 M80,52 L70,48" stroke="#3A1A99" stroke-width="3" stroke-linecap="round"/>';
  else if (estudia) s += '<path d="M39,45 L49,46 M81,45 L71,46" stroke="#3A1A99" stroke-width="3" stroke-linecap="round"/>';
  else if (h !== "descanso") s += '<path d="M41,49 L48,51 M79,49 L72,51" stroke="#3A1A99" stroke-width="3" stroke-linecap="round"/>';

  // Mofletes
  if (!enfadado) s += '<ellipse cx="33" cy="77" rx="7" ry="4.5" fill="#FF9C9C" opacity=".75"/><ellipse cx="87" cy="77" rx="7" ry="4.5" fill="#FF9C9C" opacity=".75"/>';

  // Boca
  if (enfadado) s += '<path d="M52,82 Q60,76 68,82" fill="none" stroke="' + tinta + '" stroke-width="3" stroke-linecap="round"/>' +
                     '<path d="M8,40 q4,-7 0,-13 M112,40 q-4,-7 0,-13" fill="none" stroke="#E02B3C" stroke-width="3" stroke-linecap="round"/>';
  else if (feliz) s += '<path d="M52,76 Q60,88 68,76 Z" fill="' + tinta + '"/><path d="M56,81 Q60,85 64,81" fill="#FF7A8F"/>';
  else if (h === "anima") s += '<path d="M50,76 Q60,87 70,76 Z" fill="' + tinta + '"/>';
  else if (h === "cuida") s += '<path d="M54,80 Q60,78 66,80" fill="none" stroke="' + tinta + '" stroke-width="2.5" stroke-linecap="round"/>';
  else if (h === "descanso") s += '<ellipse cx="60" cy="79" rx="3" ry="2.5" fill="' + tinta + '"/>';
  else s += '<path d="M54,78 Q60,83 66,78" fill="none" stroke="' + tinta + '" stroke-width="2.5" stroke-linecap="round"/>';

  // Libro abierto sujeto con los bracitos
  if (estudia) {
    s += '<path d="M60,88 Q48,84 34,86 L34,103 Q48,101 60,105 Z" fill="#F4F1FF" stroke="#3A1A99" stroke-width="1.5" stroke-linejoin="round"/>' +
         '<path d="M60,88 Q72,84 86,86 L86,103 Q72,101 60,105 Z" fill="#E6E0FF" stroke="#3A1A99" stroke-width="1.5" stroke-linejoin="round"/>' +
         '<path d="M39,91 h15 M39,95 h15 M66,91 h15 M66,95 h15" stroke="#B9A8F0" stroke-width="1.4" stroke-linecap="round"/>' +
         '<ellipse cx="33" cy="95" rx="6" ry="7" fill="' + borde + '"/><ellipse cx="87" cy="95" rx="6" ry="7" fill="' + borde + '"/>';
  }
  return s + '</svg>';
}
