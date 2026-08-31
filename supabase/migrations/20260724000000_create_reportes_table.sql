-- Tabla para registrar los reportes de uso indebido sobre codigos OTP.
-- A diferencia de las tablas de soporte de migrate-sharepoint-users, esta es
-- una tabla de uso normal de la aplicacion: cualquier usuario autenticado
-- puede crear un reporte y consultarlos, por lo que sí lleva policies para
-- el rol "authenticated" (en vez de dejarla restringida a service_role).
create table if not exists public."REPORTES" (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  numero_documento text not null,
  nombre_persona text not null,
  razon text not null,
  id_usuario_reporta uuid not null default auth.uid() references auth.users (id),
  fecha_creacion timestamptz not null default now()
);

alter table public."REPORTES" enable row level security;

create index if not exists reportes_numero_documento_idx on public."REPORTES" (numero_documento);

create policy "Usuarios autenticados pueden crear reportes"
  on public."REPORTES"
  for insert
  to authenticated
  with check (id_usuario_reporta = auth.uid());

create policy "Usuarios autenticados pueden ver reportes"
  on public."REPORTES"
  for select
  to authenticated
  using (true);
