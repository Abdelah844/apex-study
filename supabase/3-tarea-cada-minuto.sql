-- =====================================================
-- APEX STUDY · TAREA CADA MINUTO (paso 3)
-- Pega esto en Supabase → SQL Editor → Run, DESPUÉS de crear la función.
-- Cambia PON_AQUI_TU_CRON_SECRET por tu contraseña (la misma que el secreto CRON_SECRET).
-- =====================================================

-- pg_cron: ejecuta cosas cada cierto tiempo. pg_net: permite llamar a una URL desde la base de datos.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Si ya existía la tarea, la quitamos para crearla de nuevo (no da error si no existe)
select cron.unschedule(jobid) from cron.job where jobname = 'apex-study-avisos';

-- Cada minuto ('* * * * *') llama a la función enviar-avisos
select cron.schedule(
  'apex-study-avisos',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bwgukadlvyhogwtszlhl.supabase.co/functions/v1/enviar-avisos',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "PON_AQUI_TU_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
