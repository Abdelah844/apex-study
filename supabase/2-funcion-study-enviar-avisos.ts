// =====================================================
// APEX STUDY · FUNCIÓN "study-enviar-avisos"
// Va en Supabase → Edge Functions (con "Verify JWT" apagado).
// Tiene un nombre distinto a la de Apex Gym ("enviar-avisos") porque
// las dos apps comparten el mismo proyecto de Supabase.
//
// - GET  ...?clave=1  → devuelve la clave pública de avisos (la usa la app)
// - POST (cada minuto, desde la tarea programada) → envía los avisos cuya hora ha llegado
//
// No necesita secretos: la primera vez crea sus propias claves VAPID
// y las guarda en la tabla study_config (que solo puede leer el servidor).
// =====================================================

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// Clave de servidor: la pone Supabase solo (proyectos nuevos y antiguos)
function claveServidor(): string {
  const lista = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (lista) {
    try {
      const claves = Object.values(JSON.parse(lista)) as string[];
      if (claves.length) return claves[0];
    } catch (_e) { /* usamos la otra */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, claveServidor());

// Permite que la web de GitHub Pages pueda pedir la clave pública
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

// Lee las claves VAPID; si aún no existen, las crea y las guarda
async function clavesVapid(): Promise<{ publicKey: string; privateKey: string }> {
  const { data } = await supabase.from("study_config").select("valor").eq("clave", "vapid").maybeSingle();
  if (data) return data.valor;
  const nuevas = webpush.generateVAPIDKeys();
  // "ignoreDuplicates": si otra llamada las creó a la vez, nos quedamos con aquellas
  await supabase.from("study_config").upsert({ clave: "vapid", valor: nuevas }, { onConflict: "clave", ignoreDuplicates: true });
  const { data: guardadas } = await supabase.from("study_config").select("valor").eq("clave", "vapid").single();
  return guardadas!.valor;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const claves = await clavesVapid();

  // La app pide la clave pública para apuntar el móvil a los avisos
  if (req.method === "GET") {
    return new Response(JSON.stringify({ publica: claves.publicKey }), { headers: CORS });
  }

  webpush.setVapidDetails("mailto:apexgymscx@gmail.com", claves.publicKey, claves.privateKey);
  const ahora = Date.now();

  // 1. Avisos pendientes cuya hora ya ha llegado
  const { data: avisos, error } = await supabase
    .from("study_avisos")
    .select("*")
    .eq("enviado", false)
    .lte("cuando", new Date(ahora).toISOString())
    .limit(200);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });

  let enviados = 0;
  const fallos: string[] = [];
  for (const aviso of avisos) {
    // Si llega con más de 2 horas de retraso, ya no avisamos
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
        const codigo = (e as { statusCode?: number }).statusCode;
        // 404 o 410: ese móvil ya no acepta avisos (desinstaló la app o los quitó)
        if (codigo === 404 || codigo === 410) {
          await supabase.from("study_avisos").delete().eq("endpoint", aviso.endpoint);
          continue;
        }
        fallos.push(codigo + " " + String((e as { body?: string }).body || e).slice(0, 120));
        console.error("Error al enviar", codigo, e);
      }
    }
    // 2. Marcado como enviado para no repetirlo
    await supabase.from("study_avisos").update({ enviado: true }).eq("id", aviso.id);
  }

  // 3. Limpieza: borra avisos enviados hace más de 7 días
  await supabase
    .from("study_avisos")
    .delete()
    .eq("enviado", true)
    .lt("cuando", new Date(ahora - 7 * 86400 * 1000).toISOString());

  return new Response(JSON.stringify({ enviados, fallos }), { headers: CORS });
});
