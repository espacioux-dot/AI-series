-- Ritmo · funciones de reservas, lista de espera y panel
--
-- Todo lo que escribe pasa por acá. Cada función bloquea la fila de la
-- clase antes de contar, así dos personas no pueden tomar el mismo lugar.
-- Los errores de negocio salen como excepciones con un código corto
-- ("clase_completa") que la web traduce.

-- Lugares libres = cupo − reservas activas − ofertas vigentes.
create function public.libres(p_clase bigint) returns int
language sql stable set search_path = ''
as $$
  select (
    c.cupo
    - (select count(*) from public.reservas r
       where r.clase_id = c.id and r.estado = 'activa')
    - (select count(*) from public.esperas e
       where e.clase_id = c.id and e.estado = 'ofertada')
  )::int
  from public.clases c
  where c.id = p_clase
$$;

-- Ofrece los lugares libres a los primeros de la lista, salvo a quienes
-- acaban de dejar vencer o rechazar una oferta (p_excluir). Si la clase ya
-- empezó, no ofrece nada. La oferta vence a los plazo_oferta() o cuando
-- empieza la clase, lo que pase primero.
create function public.repartir(p_clase bigint, p_excluir uuid[] default '{}')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_empieza timestamptz;
  v_espera bigint;
begin
  select empieza_en into v_empieza from public.clases where id = p_clase;
  if v_empieza <= now() then
    return;
  end if;

  while public.libres(p_clase) > 0 loop
    select id into v_espera
    from public.esperas
    where clase_id = p_clase
      and estado = 'esperando'
      and persona_id <> all (p_excluir)
    order by anotada_en, id
    limit 1;

    exit when v_espera is null;

    update public.esperas
    set estado = 'ofertada',
        oferta_vence_en = least(now() + public.plazo_oferta(), v_empieza),
        oferta_vencio_en = null
    where id = v_espera;
  end loop;
end;
$$;

-- Las ofertas vencidas vuelven al final de la lista y el lugar pasa al
-- siguiente. Si no hay nadie más, el lugar queda libre.
create function public.vencer_ofertas(p_clase bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_vencidas uuid[];
begin
  with vencidas as (
    update public.esperas
    set estado = 'esperando',
        anotada_en = now(),
        oferta_vence_en = null,
        oferta_vencio_en = now()
    where clase_id = p_clase
      and estado = 'ofertada'
      and oferta_vence_en <= now()
    returning persona_id
  )
  select coalesce(array_agg(persona_id), '{}') into v_vencidas from vencidas;

  if cardinality(v_vencidas) > 0 then
    perform public.repartir(p_clase, v_vencidas);
  end if;
end;
$$;

-- Bloquea la clase, comprueba que sea de hoy y vence las ofertas pasadas.
create function public.bloquear_clase(p_clase bigint) returns public.clases
language plpgsql security definer set search_path = ''
as $$
declare
  v_clase public.clases;
begin
  if auth.uid() is null then
    raise exception 'sin_sesion';
  end if;

  select * into v_clase from public.clases where id = p_clase for update;

  if not found
     or (v_clase.empieza_en at time zone 'America/Argentina/Buenos_Aires')::date
        <> public.hoy() then
    raise exception 'clase_no_disponible';
  end if;

  perform public.vencer_ofertas(p_clase);
  return v_clase;
end;
$$;

-- Barrido de respaldo para las ofertas que nadie tocó.
create function public.vencer_ofertas_pendientes() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_clase bigint;
begin
  for v_clase in
    select distinct clase_id from public.esperas
    where estado = 'ofertada' and oferta_vence_en <= now()
  loop
    perform 1 from public.clases where id = v_clase for update;
    perform public.vencer_ofertas(v_clase);
  end loop;
end;
$$;

-- Reservar también sirve para tomar un lugar ofrecido. Si la persona ya
-- tiene la reserva, devuelve la misma.
create function public.reservar(p_clase bigint) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_yo uuid := auth.uid();
  v_clase public.clases;
  v_reserva bigint;
  v_espera public.esperas;
begin
  v_clase := public.bloquear_clase(p_clase);

  select id into v_reserva from public.reservas
  where clase_id = p_clase and persona_id = v_yo and estado = 'activa';
  if found then
    return v_reserva;
  end if;

  if v_clase.empieza_en <= now() then
    raise exception 'clase_empezada';
  end if;

  select * into v_espera from public.esperas
  where clase_id = p_clase and persona_id = v_yo
    and estado in ('esperando', 'ofertada');

  -- El lugar ofrecido ya cuenta como ocupado: es de quien tiene la oferta.
  if v_espera.estado is distinct from 'ofertada'
     and public.libres(p_clase) <= 0 then
    raise exception 'clase_completa';
  end if;

  if v_espera.id is not null then
    update public.esperas
    set estado = 'tomo', oferta_vence_en = null
    where id = v_espera.id;
  end if;

  insert into public.reservas (clase_id, persona_id)
  values (p_clase, v_yo)
  returning id into v_reserva;

  return v_reserva;
end;
$$;

-- Cancelar y liberar son la misma acción.
create function public.liberar(p_clase bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.bloquear_clase(p_clase);

  update public.reservas
  set estado = 'liberada', liberada_en = now()
  where clase_id = p_clase and persona_id = auth.uid() and estado = 'activa';

  if found then
    perform public.repartir(p_clase);
  end if;
end;
$$;

create function public.confirmar(p_clase bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sin_sesion';
  end if;

  update public.reservas
  set confirmada_en = coalesce(confirmada_en, now())
  where clase_id = p_clase and persona_id = auth.uid() and estado = 'activa';

  if not found then
    raise exception 'sin_reserva';
  end if;
end;
$$;

create function public.sumarme_a_espera(p_clase bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_yo uuid := auth.uid();
  v_clase public.clases;
begin
  v_clase := public.bloquear_clase(p_clase);

  if exists (select 1 from public.esperas
             where clase_id = p_clase and persona_id = v_yo
               and estado in ('esperando', 'ofertada')) then
    return;
  end if;

  if exists (select 1 from public.reservas
             where clase_id = p_clase and persona_id = v_yo
               and estado = 'activa') then
    raise exception 'ya_tenes_lugar';
  end if;

  if v_clase.empieza_en <= now() then
    raise exception 'clase_empezada';
  end if;

  if public.libres(p_clase) > 0 then
    raise exception 'hay_lugar';
  end if;

  insert into public.esperas (clase_id, persona_id) values (p_clase, v_yo);
end;
$$;

create function public.salir_de_espera(p_clase bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_estado text;
begin
  perform public.bloquear_clase(p_clase);

  update public.esperas e
  set estado = 'salio', oferta_vence_en = null
  from (select id, estado from public.esperas
        where clase_id = p_clase and persona_id = auth.uid()
          and estado in ('esperando', 'ofertada')) antes
  where e.id = antes.id
  returning antes.estado into v_estado;

  if v_estado = 'ofertada' then
    perform public.repartir(p_clase);
  end if;
end;
$$;

-- "No puedo, gracias": vuelve al final de la lista y el lugar pasa al
-- siguiente.
create function public.rechazar_oferta(p_clase bigint) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.bloquear_clase(p_clase);

  update public.esperas
  set estado = 'esperando', anotada_en = now(), oferta_vence_en = null
  where clase_id = p_clase and persona_id = auth.uid() and estado = 'ofertada';

  if found then
    perform public.repartir(p_clase, array[auth.uid()]);
  end if;
end;
$$;

-- Pantalla "Clases del día": una sola llamada con los totales y el estado
-- de la persona en cada clase.
create function public.clases_de_hoy()
returns table (
  id bigint,
  disciplina text,
  variante text,
  nivel text,
  instructor text,
  sala text,
  empieza_en timestamptz,
  duracion_min int,
  cupo int,
  ocupados int,
  en_espera int,
  mi_estado text
)
language sql stable security definer set search_path = ''
as $$
  select
    c.id, c.disciplina, c.variante, c.nivel, c.instructor, c.sala,
    c.empieza_en, c.duracion_min, c.cupo,
    c.cupo - public.libres(c.id),
    (select count(*) from public.esperas e
     where e.clase_id = c.id and e.estado in ('esperando', 'ofertada'))::int,
    coalesce(
      (select 'reservada' from public.reservas r
       where r.clase_id = c.id and r.persona_id = auth.uid()
         and r.estado = 'activa'),
      (select e.estado from public.esperas e
       where e.clase_id = c.id and e.persona_id = auth.uid()
         and e.estado in ('esperando', 'ofertada'))
    )
  from public.clases c
  where c.empieza_en >= public.hoy()::timestamp at time zone 'America/Argentina/Buenos_Aires'
    and c.empieza_en < (public.hoy() + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'
  order by c.empieza_en
$$;

-- Pantalla "Mi reserva": reservas, esperas y ofertas de hoy de la persona,
-- más la hora del servidor para la cuenta regresiva.
create function public.mis_cosas() returns jsonb
language sql stable security definer set search_path = ''
as $$
  with mias as (
    select
      c.*,
      case
        when c.mi_estado = 'ofertada' then 'oferta'
        when c.mi_estado = 'reservada' then 'reserva'
        else 'espera'
      end as tipo,
      r.confirmada_en,
      e.oferta_vence_en,
      e.oferta_vencio_en,
      case when e.id is not null then
        (select count(*) + 1 from public.esperas o
         where o.clase_id = c.id and o.estado in ('esperando', 'ofertada')
           and (o.anotada_en, o.id) < (e.anotada_en, e.id))::int
      end as posicion
    from public.clases_de_hoy() c
    left join public.reservas r
      on r.clase_id = c.id and r.persona_id = auth.uid() and r.estado = 'activa'
    left join public.esperas e
      on e.clase_id = c.id and e.persona_id = auth.uid()
     and e.estado in ('esperando', 'ofertada')
    where c.mi_estado is not null
      and (c.mi_estado = 'reservada'
           and c.empieza_en + make_interval(mins => c.duracion_min) > now()
           or c.empieza_en > now())
  )
  select jsonb_build_object(
    'ahora', now(),
    'plazo_oferta_seg', extract(epoch from public.plazo_oferta())::int,
    'nombre', (select nombre_mostrado from public.perfiles where id = auth.uid()),
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'tipo', tipo,
        'clase', jsonb_build_object(
          'id', id, 'disciplina', disciplina, 'variante', variante,
          'instructor', instructor, 'sala', sala, 'empieza_en', empieza_en,
          'duracion_min', duracion_min, 'cupo', cupo, 'ocupados', ocupados,
          'en_espera', en_espera
        ),
        'confirmada', confirmada_en is not null,
        'oferta_vence_en', oferta_vence_en,
        'oferta_vencio_en', oferta_vencio_en,
        'posicion', posicion
      )
      order by
        case tipo when 'oferta' then 0 when 'reserva' then 1 else 2 end,
        empieza_en
    ), '[]'::jsonb)
  )
  from mias
$$;

-- Panel del estudio: solo lectura, sin login, solo nombres generados.
create function public.panel() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'ahora', now(),
    'clases', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', c.id, 'disciplina', c.disciplina, 'instructor', c.instructor,
        'sala', c.sala, 'empieza_en', c.empieza_en,
        'duracion_min', c.duracion_min, 'cupo', c.cupo,
        'reservas', (
          select coalesce(jsonb_agg(
            jsonb_build_object('nombre', p.nombre_mostrado,
                               'confirmada', r.confirmada_en is not null)
            order by r.creada_en, r.id), '[]'::jsonb)
          from public.reservas r
          join public.perfiles p on p.id = r.persona_id
          where r.clase_id = c.id and r.estado = 'activa'
        ),
        'espera', (
          select coalesce(jsonb_agg(
            jsonb_build_object('nombre', p.nombre_mostrado, 'estado', e.estado,
                               'oferta_vence_en', e.oferta_vence_en)
            order by e.anotada_en, e.id), '[]'::jsonb)
          from public.esperas e
          join public.perfiles p on p.id = e.persona_id
          where e.clase_id = c.id and e.estado in ('esperando', 'ofertada')
        )
      )
      order by c.empieza_en
    ), '[]'::jsonb)
  )
  from public.clases c
  where c.empieza_en >= public.hoy()::timestamp at time zone 'America/Argentina/Buenos_Aires'
    and c.empieza_en < (public.hoy() + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'
$$;

-- Avisa por Realtime (canal público "panel") que algo cambió. El panel
-- vuelve a pedir panel(). Si Realtime falla, la reserva sigue igual.
create function public.avisar_panel() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform realtime.send('{}'::jsonb, 'cambio', 'panel', false);
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger avisar_panel
  after insert or update or delete on public.reservas
  for each statement execute function public.avisar_panel();

create trigger avisar_panel
  after insert or update or delete on public.esperas
  for each statement execute function public.avisar_panel();

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'vencer-ofertas',
  '15 seconds',
  'select public.vencer_ofertas_pendientes()'
);

revoke execute on function
  public.libres(bigint),
  public.repartir(bigint, uuid[]),
  public.vencer_ofertas(bigint),
  public.bloquear_clase(bigint),
  public.vencer_ofertas_pendientes(),
  public.avisar_panel(),
  public.reservar(bigint),
  public.liberar(bigint),
  public.confirmar(bigint),
  public.sumarme_a_espera(bigint),
  public.salir_de_espera(bigint),
  public.rechazar_oferta(bigint),
  public.clases_de_hoy(),
  public.mis_cosas(),
  public.panel()
from public, anon, authenticated;

grant execute on function
  public.reservar(bigint),
  public.liberar(bigint),
  public.confirmar(bigint),
  public.sumarme_a_espera(bigint),
  public.salir_de_espera(bigint),
  public.rechazar_oferta(bigint),
  public.clases_de_hoy(),
  public.mis_cosas()
to authenticated;

grant execute on function public.panel() to anon, authenticated;
