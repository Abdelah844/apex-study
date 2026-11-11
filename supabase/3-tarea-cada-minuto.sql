-- =====================================================
-- APIX STUDY · CONFIGURACIÓN Y TAREA CADA MINUTO (paso 3)
-- Pega esto en Supabase → SQL Editor → Run.
-- =====================================================

-- Tabla donde la función guarda sus claves de avisos (solo la lee el servidor)
create table if not exists public.study_config (
  clave text primary key,
  valor jsonb not null
);
alter table public.study_config enable row level security;

-- pg_cron: ejecuta cosas cada cierto tiempo. pg_net: permite llamar a una URL desde la base de datos.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Si ya existía la tarea, la quitamos para crearla de nuevo
select cron.unschedule(jobid) from cron.job where jobname = 'apex-study-avisos';

-- Cada minuto ('* * * * *') llama a la función study-enviar-avisos
select cron.schedule(
  'apex-study-avisos',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bwgukadlvyhogwtszlhl.supabase.co/functions/v1/study-enviar-avisos',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
