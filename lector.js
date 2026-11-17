// =====================================================
// APIX STUDY · LEER APUNTES DE ARCHIVOS
// Saca el texto de un archivo para el generador de test:
//   - Texto (.txt, .md): se lee directamente.
//   - Word (.docx): un .docx es un ZIP con el texto en "word/document.xml".
//   - PDF: con pdf.js (una librería gratis que se descarga la primera vez).
//   - Fotos: con Tesseract, que "lee" el texto de la imagen (OCR).
// Todo se hace en el móvil: tus apuntes no se envían a ningún sitio.
// =====================================================

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const MAX_MB = 25;

// Carga una librería de internet una sola vez
const scriptsCargados = {};
function cargarScript(url) {
  if (!scriptsCargados[url]) {
    scriptsCargados[url] = new Promise(function (ok, mal) {
      const s = document.createElement("script");
      s.src = url;
      s.onload = ok;
      s.onerror = function () {
        delete scriptsCargados[url];
        mal(new Error("Para leer este archivo hace falta internet la primera vez. Conéctate y vuelve a probar."));
      };
      document.head.appendChild(s);
    });
  }
  return scriptsCargados[url];
}

// ¿Qué tipo de archivo es? (por la extensión o por el tipo que dice el móvil)
function tipoArchivo(nombre, tipoMime) {
  const ext = String(nombre).toLowerCase().split(".").pop();
  if (ext === "pdf" || tipoMime === "application/pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (ext === "txt" || ext === "md" || /^text\//.test(tipoMime || "")) return "texto";
  if (/^image\//.test(tipoMime || "") || ["jpg", "jpeg", "png", "webp", "heic", "bmp"].includes(ext)) return "imagen";
  return "otro";
}

// ---------- Word (.docx) ----------
// Descomprime un trozo del ZIP (formato "deflate")
async function inflar(bytes) {
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(flujo).text();
}

// Busca un archivo dentro del ZIP y devuelve su texto
async function leerDelZip(buffer, buscado) {
  const datos = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // Al final del ZIP está el índice ("directorio central")
  let fin = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 66000; i--) {
    if (datos.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("Este archivo de Word está dañado o no es un .docx.");
  const total = datos.getUint16(fin + 10, true);
  let p = datos.getUint32(fin + 16, true);
  for (let n = 0; n < total; n++) {
    const metodo = datos.getUint16(p + 10, true);
    const tamano = datos.getUint32(p + 20, true);
    const largoNombre = datos.getUint16(p + 28, true);
    const largoExtra = datos.getUint16(p + 30, true);
    const largoComentario = datos.getUint16(p + 32, true);
    const local = datos.getUint32(p + 42, true);
    const nombre = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + largoNombre));
    if (nombre === buscado) {
      const inicio = local + 30 + datos.getUint16(local + 26, true) + datos.getUint16(local + 28, true);
      const trozo = bytes.subarray(inicio, inicio + tamano);
      return metodo === 0 ? new TextDecoder().decode(trozo) : await inflar(trozo);
    }
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  throw new Error("No encuentro el texto dentro de este Word.");
}

// Del XML de Word al texto: cada párrafo (<w:p>) en una línea
function textoDeWord(xml) {
  return xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function leerDocx(buffer) {
  return textoDeWord(await leerDelZip(buffer, "word/document.xml"));
}

// ---------- PDF ----------
async function leerPdf(buffer, progreso) {
  await cargarScript(PDFJS_URL);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    progreso("Leyendo página " + i + " de " + pdf.numPages + "…");
    const pagina = await pdf.getPage(i);
    const contenido = await pagina.getTextContent();
    for (const trozo of contenido.items) texto += trozo.str + (trozo.hasEOL ? "\n" : "");
    texto += "\n\n";
  }
  if (texto.replace(/\s/g, "").length < 50) {
    throw new Error("Este PDF parece una foto escaneada y no tiene texto. Haz capturas de las páginas y súbelas como imágenes.");
  }
  return texto;
}

// ---------- Fotos (OCR) ----------
async function leerImagen(archivo, progreso) {
  await cargarScript(TESSERACT_URL);
  progreso("Preparando el lector de fotos (la primera vez tarda un poco)…");
  const resultado = await window.Tesseract.recognize(archivo, "spa", {
    logger: function (m) {
      if (m.status === "recognizing text") progreso("Leyendo la foto… " + Math.round(m.progress * 100) + " %");
    }
  });
  const texto = resultado.data.text || "";
  if (texto.replace(/\s/g, "").length < 30) {
    throw new Error("No he podido leer texto en la foto. Hazla con buena luz, recta y que se vea solo la hoja.");
  }
  return texto;
}

// ---------- Leer cualquier archivo ----------
// progreso(texto): para enseñar cómo va
async function leerArchivo(archivo, progreso) {
  progreso = progreso || function () {};
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error("«" + archivo.name + "» pesa demasiado (máximo " + MAX_MB + " MB).");
  const tipo = tipoArchivo(archivo.name, archivo.type);
  if (tipo === "texto") return await archivo.text();
  if (tipo === "docx") return await leerDocx(await archivo.arrayBuffer());
  if (tipo === "pdf") return await leerPdf(await archivo.arrayBuffer(), progreso);
  if (tipo === "imagen") return await leerImagen(archivo, progreso);
  if (tipo === "doc") throw new Error("Los Word antiguos (.doc) no se pueden leer. Ábrelo y guárdalo como .docx o PDF.");
  throw new Error("«" + archivo.name + "» no es un tipo de archivo que pueda leer. Usa PDF, Word (.docx), una foto o texto.");
}

// Lee los archivos elegidos y añade su texto a la caja de apuntes
async function subirApuntes(archivos) {
  const caja = $("tsTexto");
  const aviso = $("tsLeyendo");
  const boton = document.querySelector('[data-act="crear-test"]');
  $("tsErr").textContent = "";
  boton.disabled = true;
  let leidos = 0;
  for (const archivo of archivos) {
    try {
      aviso.textContent = "Leyendo «" + archivo.name + "»…";
      const texto = (await leerArchivo(archivo, function (t) { aviso.textContent = t; })).trim();
      caja.value = (caja.value.trim() ? caja.value.trim() + "\n\n" : "") + texto;
      leidos++;
    } catch (e) {
      $("tsErr").textContent = e.message;
    }
  }
  aviso.textContent = leidos ? "✓ " + (leidos === 1 ? "Archivo leído" : leidos + " archivos leídos") + ". Revisa el texto y pulsa Crear examen." : "";
  boton.disabled = false;
  estado.testApuntes = caja.value.slice(0, 60000);
  guardar();
}

// El botón "Subir apuntes" abre el selector de archivos del móvil
document.addEventListener("change", function (ev) {
  if (ev.target.id === "tsArchivo" && ev.target.files.length) {
    subirApuntes(Array.from(ev.target.files));
    ev.target.value = "";   // para poder volver a elegir el mismo archivo
  }
});

const ACCIONES_LECTOR = {
  "subir-apuntes": function () { $("tsArchivo").click(); },
  "borrar-apuntes": function () {
    if (!$("tsTexto").value || !confirm("¿Borrar el texto de los apuntes?")) return;
    $("tsTexto").value = "";
    $("tsLeyendo").textContent = "";
    estado.testApuntes = "";
    guardar();
  }
};
