// =====================================================
// APEX STUDY · FUNCIÓN "enviar-avisos" (paso 2)
// Va en Supabase → Edge Functions. Se ejecuta cada minuto (lo programa el paso 3).
// Busca los avisos cuya hora ya ha llegado y los envía a los móviles.
// Necesita estos secretos (Edge Functions → Secrets):
//   VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTACTO, CRON_SECRET
// =====================================================

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// Clave de servidor: la pone Supabase solo. Los proyectos nuevos la guardan en
// SUPABASE_SECRET_KEYS (una lista); los antiguos en SUPABASE_SERVICE_ROLE_KEY.
function claveServidor(): string {
  const lista = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (lista) {
    try {
      const claves = Object.values(JSON.parse(lista)) as string[];
      if (claves.length) return claves[0];
    } catch (_e) { /* si no se puede leer, usamos la otra */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

// Conexión a la base de datos con permisos de servidor
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, claveServidor());

// Las claves VAPID demuestran que el aviso lo manda tu app y no otra
webpush.setVapidDetails(
  Deno.env.get("VAPID_CONTACTO")!,
  Deno.env.get("VAPID_PUBLICA")!,
  Deno.env.get("VAPID_PRIVADA")!,
);

Deno.serve(async (req) => {
  // Solo la tarea programada (que conoce la contraseña) puede ejecutar esta función
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("No autorizado", { status: 401 });
  }

  const ahora = Date.now();

  // 1. Avisos pendientes cuya hora ya ha llegado
  const { data: avisos, error } = await supabase
    .from("study_avisos")
    .select("*")
    .eq("enviado", false)
    .lte("cuando", new Date(ahora).toISOString())
    .limit(200);

  if (error) return new Response(error.message, { status: 500 });

  let enviados = 0;
  for (const aviso of avisos) {
    // Si llega con más de 2 horas de retraso, ya no tiene sentido avisar
    const retraso = ahora - new Date(aviso.cuando).getTime();
    if (retraso < 2 * 3600 * 1000) {
      try {
        const datos = JSON.stringify({
          titulo: aviso.titulo,
          cuerpo: aviso.cuerpo,
          plan: aviso.plan_id,
          tag: "plan-" + aviso.plan_id,
        });
        await webpush.sendNotification(aviso.suscripcion, datos, { TTL: 3600, urgency: "high" });
        enviados++;
      } catch (e) {
        // 404 o 410: ese móvil ya no acepta avisos (desinstaló la app o los quitó)
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) {
          await supabase.from("study_avisos").delete().eq("endpoint", aviso.endpoint);
          continue;
        }
        console.error("Error al enviar", codigo, e);
      }
    }
    // 2. Lo marcamos como enviado para no repetirlo
    await supabase.from("study_avisos").update({ enviado: true }).eq("id", aviso.id);
  }

  // 3. Limpieza: borramos avisos enviados hace más de 7 días
  await supabase
    .from("study_avisos")
    .delete()
    .eq("enviado", true)
    .lt("cuando", new Date(ahora - 7 * 86400 * 1000).toISOString());

  return new Response(JSON.stringify({ enviados }), {
    headers: { "Content-Type": "application/json" },
  });
});
