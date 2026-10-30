-- Ritmo · semilla de la demo
--
-- Carga las clases de hoy (hora de Argentina) con la ocupación de las
-- pantallas de base/. Se puede volver a correr para reiniciar la demo:
-- borra todas las clases, sus reservas y esperas, y las personas de relleno.

-- Personas de relleno: uuid fijos para poder borrarlas al reiniciar.
delete from auth.users
where id between '00000000-0000-0000-0000-000000000001'
             and '00000000-0000-0000-0000-000000000024';

truncate public.clases restart identity cascade;

insert into auth.users (
  instance_id, id, aud, role, is_anonymous, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated', true, now(), now(),
  '{}'::jsonb, '{}'::jsonb,
  '', '', '', ''
from generate_series(1, 24) n;

insert into public.clases
  (disciplina, variante, nivel, instructor, sala, empieza_en, duracion_min, cupo)
select
  v.disciplina, v.variante, coalesce(v.nivel, 'Todos los niveles'),
  v.instructor, v.sala,
  (public.hoy() + v.hora) at time zone 'America/Argentina/Buenos_Aires',
  v.duracion_min, v.cupo
from (values
  ('Spinning',      null,            null,                time '07:00', 45, 'Caro M.',      'Sala 1', 20),
  ('Yoga',          'Vinyasa suave', 'Todos los niveles', time '12:30', 60, 'Lu G.',        'Sala 2', 20),
  ('Funcional',     null,            null,                time '18:00', 50, 'Nico R.',      'Sala 1', 20),
  ('Clase en vivo', null,            null,                time '18:30', 45, 'Lucio C.',     'Sala Circle', 20),
  ('Spinning',      null,            null,                time '19:00', 45, 'Caro M.',      'Sala 1', 20),
  ('Pilates',       null,            null,                time '20:15', 60, 'Vale T.',      'Sala 2', 20)
) as v (disciplina, variante, nivel, hora, duracion_min, instructor, sala, cupo);

-- Reservas: personas 1..ocupados. Las primeras "confirmados" ya confirmaron
-- (números del panel en base/README.md).
insert into public.reservas (clase_id, persona_id, confirmada_en)
select
  c.id,
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  case when n <= o.confirmados then now() end
from public.clases c
join (values
  ('Spinning',  time '07:00', 20, 20),
  ('Yoga',      time '12:30', 17, 17),
  ('Funcional', time '18:00', 19, 19),
  ('Spinning',  time '19:00', 20, 18),
  ('Pilates',   time '20:15', 12,  0)
) as o (disciplina, hora, ocupados, confirmados)
  on o.disciplina = c.disciplina
 and o.hora = (c.empieza_en at time zone 'America/Argentina/Buenos_Aires')::time
cross join lateral generate_series(1, o.ocupados) n;

-- Spinning 19:00: 4 personas en espera (21 es la primera)
insert into public.esperas (clase_id, persona_id, anotada_en)
select
  c.id,
  ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  now() - (25 - n) * interval '1 minute'
from public.clases c
cross join generate_series(21, 24) n
where c.disciplina = 'Spinning'
  and (c.empieza_en at time zone 'America/Argentina/Buenos_Aires')::time = '19:00';
