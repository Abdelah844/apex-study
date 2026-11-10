// =====================================================
// Ejecuta las pruebas de Apex Study sin navegador.
// Uso (desde la carpeta del proyecto):  node test/correr.js
// Devuelve código de salida 1 si alguna prueba falla.
// =====================================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Almacenamiento falso que se comporta como localStorage
class AlmacenFalso {
  constructor() { this._datos = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._datos, k) ? this._datos[k] : null; }
  setItem(k, v) { this._datos[k] = String(v); }
  removeItem(k) { delete this._datos[k]; }
}

const contexto = { console: console, localStorage: new AlmacenFalso(), Math: Math, Date: Date, JSON: JSON, Intl: Intl,
  document: { addEventListener: function () {} } };   // planificador.js escucha cambios en la página
vm.createContext(contexto);

const raiz = path.join(__dirname, "..");
// Solo los archivos de lógica (los de pantallas necesitan navegador)
const LOGICA = ["datos.js", "mascota.js", "horario.js", "deberes.js", "notas.js", "tarjetas.js", "avisos.js", "planificador.js"];
for (const archivo of LOGICA.concat(["test/pruebas.js"])) {
  vm.runInContext(fs.readFileSync(path.join(raiz, archivo), "utf8"), contexto, { filename: archivo });
}

const inicio = Date.now();
const resultados = vm.runInContext("ejecutarPruebas()", contexto);

// ---------- Comprobaciones de archivos (necesitan leer el disco) ----------
function comprobar(grupo, nombre, fn) {
  try { fn(); resultados.push({ grupo: grupo, nombre: nombre, ok: true }); }
  catch (e) { resultados.push({ grupo: grupo, nombre: nombre, ok: false, detalle: e.message }); }
}
const leer = function (f) { return fs.readFileSync(path.join(raiz, f), "utf8"); };
const existe = function (f) { return fs.existsSync(path.join(raiz, f)); };

comprobar("App instalable", "manifest.json es correcto y sus iconos existen", function () {
  const m = JSON.parse(leer("manifest.json"));
  if (!m.name || !m.start_url || !m.icons.length) throw new Error("faltan campos");
  for (const i of m.icons) if (!existe(i.src)) throw new Error("falta " + i.src);
});
comprobar("App instalable", "todo lo que guarda sw.js para usar sin internet existe", function () {
  const sw = leer("sw.js");
  const lista = sw.slice(sw.indexOf("ARCHIVOS"), sw.indexOf("];")).match(/"\.\/([^"]*)"/g).map(function (x) { return x.slice(3, -1); });
  const faltan = lista.filter(function (f) { return f && !existe(f); });
  if (faltan.length) throw new Error("faltan: " + faltan.join(", "));
});
comprobar("App instalable", "index.html carga todos los archivos, datos.js el primero y app.js el último", function () {
  const scripts = (leer("index.html").match(/<script src="([^"]+)"/g) || []).map(function (x) { return x.slice(13, -1); });
  for (const s of scripts) if (!existe(s)) throw new Error("falta " + s);
  if (scripts[0] !== "datos.js") throw new Error("el primero es " + scripts[0]);
  if (scripts[scripts.length - 1] !== "app.js") throw new Error("el último es " + scripts[scripts.length - 1]);
  // Y sw.js tiene que guardarlos todos
  const sw = leer("sw.js");
  for (const s of scripts) if (!sw.includes('"./' + s + '"')) throw new Error("sw.js no guarda " + s);
});
comprobar("Botones", "cada botón (data-act) tiene su acción", function () {
  const codigo = fs.readdirSync(raiz).filter(function (f) { return f.endsWith(".js"); }).map(leer).join("\n") + leer("index.html");
  const usados = new Set((codigo.match(/data-act="([a-z0-9-]+)"/g) || []).map(function (x) { return x.slice(10, -1); }));
  const definidos = new Set((codigo.match(/"([a-z0-9-]+)":\s*function/g) || []).map(function (x) { return x.split('"')[1]; }));
  usados.delete("nombre");   // aparece en un comentario
  const faltan = [...usados].filter(function (a) { return !definidos.has(a); });
  if (faltan.length) throw new Error("sin acción: " + faltan.join(", "));
});
comprobar("Accesibilidad", "se puede hacer zoom con dos dedos", function () {
  if (/user-scalable=no|maximum-scale=1/.test(leer("index.html"))) throw new Error("el zoom está bloqueado");
});
comprobar("Privacidad", "existe la política de privacidad y está enlazada en Ajustes", function () {
  if (!existe("privacidad.html")) throw new Error("falta privacidad.html");
  if (!leer("ajustes.js").includes("privacidad.html")) throw new Error("no está enlazada");
});

// ---------- Resultado ----------
let fallos = 0, grupo = "";
for (const r of resultados) {
  if (r.grupo !== grupo) { grupo = r.grupo; console.log("\n" + grupo); }
  console.log((r.ok ? "  ✓ " : "  ✗ ") + r.nombre + (r.ok ? "" : "\n      → " + r.detalle));
  if (!r.ok) fallos++;
}
console.log("\n" + (resultados.length - fallos) + " de " + resultados.length + " pruebas correctas (" + (Date.now() - inicio) + " ms)");
process.exit(fallos ? 1 : 0);
