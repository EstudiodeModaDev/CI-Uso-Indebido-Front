-- Tablas de soporte para la Edge Function migrate-sharepoint-users.
-- Todas quedan con RLS habilitado y SIN policies para anon/authenticated:
-- solo la service_role key (usada por la función) puede leer/escribir, ya que
-- estas tablas contienen datos administrativos que no deben quedar expuestos
-- directamente al cliente. Si el frontend necesita leer su propio perfil,
-- agregar una policy explícita de SELECT con auth.uid() = user_id.

-- Nombres de tabla en mayúsculas: hay que crearlos y referenciarlos siempre
-- entre comillas dobles, porque Postgres pliega a minúsculas los identificadores
-- sin comillas (create table PERSONAS terminaría creando "personas").
create table if not exists public."PERSONAS" (
  user_id uuid primary key references auth.users (id) on delete cascade,
  numero_documento text,
  nombres text,
  apellidos text,
  cedula text,
  phone text,
  active boolean,
  updated_at timestamptz not null default now()
);

alter table public."PERSONAS" enable row level security;

create table if not exists public."USUARIOS" (
  -- Se relaciona con PERSONAS (no directo con auth.users) porque el índice
  -- de la función upsertea primero "PERSONAS" y después "USUARIOS", así que
  -- la fila de PERSONAS ya existe cuando se inserta la de USUARIOS.
  user_id uuid primary key references public."PERSONAS" (user_id) on delete cascade,
  position text,
  department text,
  hire_date date,
  manager_email text,
  cost_center text,
  updated_at timestamptz not null default now()
);

alter table public."USUARIOS" enable row level security;

-- Log de cada intento de creación/actualización por usuario, por corrida (run_id).
create table if not exists public.migration_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  email text not null,
  status text not null, -- created | existing | deactivated | reactivated | error
  message text,
  created_at timestamptz not null default now()
);

alter table public.migration_logs enable row level security;
create index if not exists migration_logs_run_id_idx on public.migration_logs (run_id);
create index if not exists migration_logs_email_idx on public.migration_logs (email);

-- Cursor de una sola fila: guarda el offset donde va el barrido incremental de la
-- lista de SharePoint, para que el cron pueda continuar de invocación en invocación
-- sin reprocesar todo cada vez ni perder el lugar si el tiempo de ejecución se corta.
create table if not exists public.migration_cursor (
  id smallint primary key default 1 check (id = 1),
  next_offset integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.migration_cursor enable row level security;

insert into public.migration_cursor (id, next_offset)
values (1, 0)
on conflict (id) do nothing;
