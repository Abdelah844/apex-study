-- =====================================================
-- APEX STUDY · AVISOS PUSH (paso 1)
-- Pega todo esto en Supabase → SQL Editor → Run.
-- Crea la tabla donde se guardan los avisos pendientes
-- y dos funciones que la app usa para programarlos o cancelarlos.
-- =====================================================

-- Tabla de avisos: a qué móvil (endpoint), cuándo y qué texto
create table if not exists public.study_avisos (
  id bigint generated always as identity primary key,
  endpoint text not null,              -- "dirección" del móvil para recibir avisos
  suscripcion jsonb not null,          -- datos completos para poder enviarle el aviso
  plan_id text not null,               -- el plan de estudio al que pertenece
  cuando timestamptz not null,         -- hora a la que hay que avisar
  titulo text not null,
  cuerpo text not null,
  enviado boolean not null default false,
  creado timestamptz not null default now(),
  unique (endpoint, plan_id)           -- un aviso por plan y móvil
);

create index if not exists study_avisos_pendientes on public.study_avisos (cuando) where not enviado;

-- Seguridad: activamos RLS y NO ponemos políticas.
-- Así nadie puede leer ni tocar la tabla directamente desde la app:
-- solo a través de las dos funciones de abajo.
alter table public.study_avisos enable row level security;

-- Programar (o cambiar) el aviso de un plan
create or replace function public.study_programar_aviso(
  p_endpoint text, p_suscripcion jsonb, p_plan text,
  p_cuando timestamptz, p_titulo text, p_cuerpo text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Solo direcciones de los servicios de avisos reales (Google, Mozilla, Apple, Microsoft)
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'Dirección de avisos no válida';
  end if;
  if length(p_endpoint) > 1000 or length(p_plan) > 40 or length(p_titulo) > 80 or length(p_cuerpo) > 300 then
    raise exception 'Datos demasiado largos';
  end if;
  if p_cuando > now() + interval '366 days' then
    raise exception 'Fecha demasiado lejana';
  end if;
  -- Máximo 200 avisos pendientes por móvil (para que nadie llene la tabla)
  if (select count(*) from study_avisos where endpoint = p_endpoint and not enviado) >= 200 then
    raise exception 'Demasiados avisos pendientes';
  end if;

  insert into study_avisos (endpoint, suscripcion, plan_id, cuando, titulo, cuerpo)
  values (p_endpoint, p_suscripcion, p_plan, p_cuando, p_titulo, p_cuerpo)
  on conflict (endpoint, plan_id) do update
    set suscripcion = excluded.suscripcion, cuando = excluded.cuando,
        titulo = excluded.titulo, cuerpo = excluded.cuerpo, enviado = false;
end $$;

-- Cancelar el aviso de un plan (o todos los de ese móvil si p_plan es null)
create or replace function public.study_cancelar_aviso(p_endpoint text, p_plan text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from study_avisos
  where endpoint = p_endpoint and (p_plan is null or plan_id = p_plan);
end $$;

-- Permisos: la app (anon) solo puede usar estas dos funciones
revoke all on function public.study_programar_aviso(text, jsonb, text, timestamptz, text, text) from public;
revoke all on function public.study_cancelar_aviso(text, text) from public;
grant execute on function public.study_programar_aviso(text, jsonb, text, timestamptz, text, text) to anon, authenticated;
grant execute on function public.study_cancelar_aviso(text, text) to anon, authenticated;
