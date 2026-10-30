import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), '')

function nuevoCelular() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
}

// Funcional tiene 1 lugar libre en la semilla. 15 personas tocan Reservar
// al mismo tiempo: entra una sola.
test('el último lugar se lo lleva una sola persona', async () => {
  const celulares = Array.from({ length: 15 }, nuevoCelular)
  await Promise.all(celulares.map((c) => c.auth.signInAnonymously()))

  const { data: clases } = await celulares[0].rpc('clases_de_hoy')
  const funcional = clases.find((c) => c.disciplina === 'Funcional')
  expect(funcional.cupo - funcional.ocupados).toBe(1)

  const respuestas = await Promise.all(
    celulares.map((c) => c.rpc('reservar', { p_clase: funcional.id })),
  )
  const entraron = respuestas.filter((r) => !r.error)
  const rechazos = respuestas.filter((r) => r.error).map((r) => r.error.message)

  expect(entraron).toHaveLength(1)
  expect(rechazos).toEqual(Array(14).fill('clase_completa'))

  // Reservar dos veces devuelve la misma reserva.
  const ganador = celulares[respuestas.indexOf(entraron[0])]
  const otraVez = await ganador.rpc('reservar', { p_clase: funcional.id })
  expect(otraVez.data).toBe(entraron[0].data)

  const { data: despues } = await celulares[0].rpc('clases_de_hoy')
  expect(despues.find((c) => c.id === funcional.id).ocupados).toBe(funcional.cupo)
})
