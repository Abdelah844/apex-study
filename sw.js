// =====================================================
// APEX STUDY · SERVICE WORKER
// Programa que el navegador ejecuta aparte de la página.
// Guarda una copia de la app en el móvil para que funcione SIN internet
// y es quien muestra los avisos de Apix.
// Si cambias algún archivo, sube el número de VERSION.
// =====================================================

const VERSION = "apex-study-1.8.0";

const ARCHIVOS = [
  "./", "./index.html", "./manifest.json", "./app.js", "./mascota.js", "./horario.js", "./deberes.js", "./notas.js",
  "./iconos/icono-192.png", "./iconos/icono-512.png",
  "./manrope.woff", "./chakra-petch-medium.woff", "./chakra-petch-semibold.woff", "./chakra-petch-bold.woff"
];

// 1. Instalar: guarda los archivos
self.addEventListener("install", function (evento) {
  evento.waitUntil(caches.open(VERSION).then(function (cache) {
    return cache.addAll(ARCHIVOS.map(function (url) { return new Request(url, { cache: "reload" }); }));
  }));
  self.skipWaiting();
});

// 2. Activar: borra copias antiguas
self.addEventListener("activate", function (evento) {
  evento.waitUntil(caches.keys().then(function (nombres) {
    return Promise.all(nombres.filter(function (n) { return n !== VERSION; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// 3. Primero internet (para tener la última versión); si no hay, la copia guardada
self.addEventListener("fetch", function (evento) {
  if (evento.request.method !== "GET") return;
  if (new URL(evento.request.url).origin !== self.location.origin) return;
  evento.respondWith(fetch(evento.request, { cache: "no-cache" }).then(function (r) {
    if (r && r.ok) {
      const copia = r.clone();
      caches.open(VERSION).then(function (cache) { cache.put(evento.request, copia); });
    }
    return r;
  }).catch(function () {
    return caches.match(evento.request, { ignoreSearch: true }).then(function (g) { return g || caches.match("./index.html"); });
  }));
});

// 4. Llega un aviso desde Supabase (aunque la app esté cerrada): lo enseñamos
self.addEventListener("push", function (evento) {
  let datos = {};
  try { datos = evento.data.json(); } catch (e) { datos = { cuerpo: evento.data ? evento.data.text() : "" }; }
  evento.waitUntil(self.registration.showNotification(datos.titulo || "Apex Study", {
    body: datos.cuerpo || "",
    icon: "iconos/icono-192.png",
    badge: "iconos/icono-192.png",
    tag: datos.tag || "apex-study",       // misma etiqueta que el aviso local: así no sale repetido
    vibrate: [200, 100, 200],
    data: { plan: datos.plan || null }
  }));
});

// 5. Al tocar un aviso de Apix, abre la app (y si es de un plan, enseña su pantalla)
self.addEventListener("notificationclick", function (evento) {
  evento.notification.close();
  const plan = evento.notification.data ? evento.notification.data.plan : null;
  evento.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (ventanas) {
    for (const v of ventanas) {
      if ("focus" in v) {
        if (plan) v.postMessage({ plan: plan });
        return v.focus();
      }
    }
    return self.clients.openWindow(plan ? "./index.html?plan=" + plan : "./index.html");
  }));
});
