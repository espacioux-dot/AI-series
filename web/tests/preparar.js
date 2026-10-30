import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Deja la base como la semilla (clases de hoy, sin reservas de pruebas
// anteriores). Borra datos, así que solo corre contra la base local.
const BASE = process.env.RITMO_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SEMILLA = fileURLToPath(new URL('../../supabase/seed.sql', import.meta.url))

if (!/@(127\.0\.0\.1|localhost):/.test(BASE)) {
  throw new Error('Las pruebas reinician la semilla: solo corren contra Supabase local.')
}

const opciones = {
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' },
}

export function sql(consulta) {
  return execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', BASE, '-c', consulta], opciones)
    .toString()
    .trim()
}

// Las pruebas no dependen de la hora: las clases de la tarde que ya
// empezaron se corren a dentro de una hora, en el mismo orden. Spinning
// 07:00 y Yoga 12:30 quedan como "ya empezó". Si la corrida pasa la
// medianoche, la clase deja de ser de hoy y las pruebas fallan.
export function reiniciar() {
  execFileSync('psql', ['-q', '-v', 'ON_ERROR_STOP=1', BASE, '-f', SEMILLA], opciones)
  sql(`
    update public.clases
    set empieza_en = greatest(empieza_en, now() + interval '1 hour' + id * interval '10 minutes')
    where disciplina <> 'Yoga'
      and (empieza_en at time zone 'America/Argentina/Buenos_Aires')::time > '12:30'
  `)
}

// Hace una acción como una de las personas de relleno de la semilla (1 a 24).
export function como(persona, llamada) {
  const id = `00000000-0000-0000-0000-${String(persona).padStart(12, '0')}`
  return sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated"}', true);
    select ${llamada};
    commit;
  `)
}

export default function preparar() {
  reiniciar()
}
