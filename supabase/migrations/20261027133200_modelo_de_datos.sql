-- Ritmo · modelo de datos
--
-- Los lugares libres no se guardan: se calculan contando reservas activas y
-- ofertas vigentes. La app no escribe directo en ninguna tabla; las escrituras
-- llegan en la próxima migración como funciones que bloquean la clase.

-- Plazo para tomar un lugar liberado (R5). Es el único lugar donde vive:
-- para cambiarlo en la demo, se reemplaza esta función.
create function public.plazo_oferta() returns interval
language sql stable
as $$ select interval '30 minutes' $$;

-- Fecha de hoy en Argentina. La app solo muestra las clases de este día.
create function public.hoy() returns date
language sql stable
as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

create table public.clases (
  id bigint generated always as identity primary key,
  disciplina text not null,
  variante text,
  nivel text not null default 'Todos los niveles',
  instructor text not null,
  sala text not null,
  empieza_en timestamptz not null,
  duracion_min int not null check (duracion_min > 0),
  cupo int not null check (cupo > 0)
);

create index clases_empieza_en_idx on public.clases (empieza_en);

-- Uno por cada usuario anónimo. El nombre lo genera la base ("Alumna 37"),
-- nunca lo escribe la persona.
create sequence public.perfiles_numero_seq;

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  numero bigint not null unique,
  nombre_mostrado text not null,
  creado_en timestamptz not null default now()
);

create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  n bigint := nextval('public.perfiles_numero_seq');
begin
  insert into public.perfiles (id, numero, nombre_mostrado)
  values (
    new.id,
    n,
    case when random() < 0.5 then 'Alumna ' else 'Alumno ' end || n
  );
  return new;
end;
$$;

create trigger crear_perfil
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Liberar (o cancelar, que es lo mismo) no borra la fila: la pasa a
-- "liberada". La persona puede volver a reservar con una fila nueva.
create table public.reservas (
  id bigint generated always as identity primary key,
  clase_id bigint not null references public.clases (id) on delete cascade,
  persona_id uuid not null references public.perfiles (id) on delete cascade,
  estado text not null default 'activa' check (estado in ('activa', 'liberada')),
  creada_en timestamptz not null default now(),
  confirmada_en timestamptz,
  liberada_en timestamptz,
  check ((estado = 'liberada') = (liberada_en is not null))
);

-- Una reserva activa por persona y clase. También sirve para contar las
-- reservas activas de una clase.
create unique index reservas_una_activa_por_persona
  on public.reservas (clase_id, persona_id)
  where estado = 'activa';

create index reservas_persona_idx on public.reservas (persona_id);

-- Una fila por persona anotada. La oferta es un estado de la fila:
--   esperando -> ofertada -> tomo
--   ofertada  -> esperando (vence o la rechaza: vuelve al final con
--                anotada_en = now())
--   esperando | ofertada -> salio
-- oferta_vencio_en queda cargada cuando la última oferta venció sin
-- respuesta, para mostrar "El lugar pasó a la siguiente persona".
create table public.esperas (
  id bigint generated always as identity primary key,
  clase_id bigint not null references public.clases (id) on delete cascade,
  persona_id uuid not null references public.perfiles (id) on delete cascade,
  estado text not null default 'esperando'
    check (estado in ('esperando', 'ofertada', 'tomo', 'salio')),
  anotada_en timestamptz not null default now(),
  oferta_vence_en timestamptz,
  oferta_vencio_en timestamptz,
  check ((estado = 'ofertada') = (oferta_vence_en is not null))
);

-- Una espera abierta por persona y clase.
create unique index esperas_una_abierta_por_persona
  on public.esperas (clase_id, persona_id)
  where estado in ('esperando', 'ofertada');

-- Orden de la fila: el primero es el de anotada_en más viejo.
create index esperas_fila_idx
  on public.esperas (clase_id, anotada_en, id)
  where estado = 'esperando';

create index esperas_ofertas_vigentes_idx
  on public.esperas (oferta_vence_en)
  where estado = 'ofertada';

create index esperas_persona_idx on public.esperas (persona_id);

alter table public.clases enable row level security;
alter table public.perfiles enable row level security;
alter table public.reservas enable row level security;
alter table public.esperas enable row level security;

-- Los usuarios anónimos de Supabase usan el rol "authenticated".
create policy "Las clases las ve cualquiera"
  on public.clases for select to anon, authenticated
  using (true);

create policy "Cada persona ve su perfil"
  on public.perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Cada persona ve sus reservas"
  on public.reservas for select to authenticated
  using (persona_id = (select auth.uid()));

create policy "Cada persona ve sus esperas"
  on public.esperas for select to authenticated
  using (persona_id = (select auth.uid()));

-- Sin políticas de escritura, RLS ya rechaza todo. Además se quitan los
-- permisos para que el rechazo no dependa solo de RLS.
revoke insert, update, delete, truncate
  on public.clases, public.perfiles, public.reservas, public.esperas
  from anon, authenticated;

revoke all on sequence public.perfiles_numero_seq from anon, authenticated;

revoke execute on function public.crear_perfil() from public, anon, authenticated;
