// =====================================================
// APEX STUDY · SONIDOS PARA CONCENTRARSE
// No usamos archivos de audio: el sonido se "fabrica" en el momento
// con la Web Audio API a partir de ruido (como el de una tele sin señal),
// filtrado para que suene a lluvia, a olas o a un zumbido suave.
// =====================================================

const SONIDOS = {
  nada:   { nombre: "Silencio", icono: "🔇" },
  lluvia: { nombre: "Lluvia",   icono: "🌧️" },
  olas:   { nombre: "Olas",     icono: "🌊" },
  marron: { nombre: "Ruido suave", icono: "🟤" }
};

let audio = null;   // { ctx, nodos } mientras suena algo

// Crea 2 segundos de ruido aleatorio. "marron" = más grave y suave
function bufferRuido(ctx, tipo) {
  const largo = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  let ultimo = 0;
  for (let i = 0; i < largo; i++) {
    const blanco = Math.random() * 2 - 1;
    if (tipo === "marron") {
      // Ruido marrón: cada muestra se parece a la anterior (suena grave)
      ultimo = (ultimo + 0.02 * blanco) / 1.02;
      datos[i] = ultimo * 3.5;
    } else {
      datos[i] = blanco;
    }
  }
  return buffer;
}

function sonar(tipo) {
  pararSonido();
  if (tipo === "nada" || !window.AudioContext) return;
  const ctx = new AudioContext();
  const fuente = ctx.createBufferSource();
  fuente.buffer = bufferRuido(ctx, tipo === "lluvia" ? "blanco" : "marron");
  fuente.loop = true;   // se repite sin parar

  const volumen = ctx.createGain();
  const filtro = ctx.createBiquadFilter();
  const nodos = [fuente];

  if (tipo === "lluvia") {
    // Lluvia: ruido blanco sin los graves ni los agudos más molestos
    filtro.type = "bandpass"; filtro.frequency.value = 1400; filtro.Q.value = 0.6;
    volumen.gain.value = 0.18;
  } else if (tipo === "olas") {
    // Olas: ruido grave cuyo volumen sube y baja despacio (una ola cada ~8 s)
    filtro.type = "lowpass"; filtro.frequency.value = 700;
    volumen.gain.value = 0.25;
    const ola = ctx.createOscillator();
    const fuerza = ctx.createGain();
    ola.frequency.value = 0.12;
    fuerza.gain.value = 0.2;
    ola.connect(fuerza).connect(volumen.gain);
    ola.start();
    nodos.push(ola);
  } else {
    filtro.type = "lowpass"; filtro.frequency.value = 500;
    volumen.gain.value = 0.35;
  }

  fuente.connect(filtro).connect(volumen).connect(ctx.destination);
  fuente.start();
  audio = { ctx: ctx, nodos: nodos };
}

function pararSonido() {
  if (!audio) return;
  try { audio.ctx.close(); } catch (e) { /* ya estaba cerrado */ }
  audio = null;
}

// Botones de sonido para la pantalla de concentración
function botonesSonido() {
  const elegido = estado.sonido || "nada";
  let html = '<div class="chips sonidos">';
  for (const clave in SONIDOS) {
    html += '<button class="chip ' + (clave === elegido ? "on" : "") + '" data-act="sonido" data-s="' + clave + '">' +
      SONIDOS[clave].icono + ' ' + SONIDOS[clave].nombre + '</button>';
  }
  return html + '</div>';
}

const ACCIONES_SONIDOS = {
  "sonido": function (b) {
    estado.sonido = b.dataset.s;
    guardar();
    sonar(estado.sonido);
    document.querySelectorAll('[data-act="sonido"]').forEach(function (c) { c.classList.toggle("on", c === b); });
  }
};
