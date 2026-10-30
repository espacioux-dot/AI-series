import { devices, expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { como, reiniciar, sql } from './preparar.js'

// Casos que las pantallas de base/ no muestran. Cada prueba arma la
// situación en la base, comprueba lo que ve la persona y guarda una
// captura en capturas/casos/.

const CARPETA = fileURLToPath(new URL('../../capturas/casos/', import.meta.url))
const SUPABASE = 'http://127.0.0.1:54321/**'

// Ids fijos de la semilla
const FUNCIONAL = 3
const CLASE_EN_VIVO = 4
const SPINNING_19 = 5

test.beforeEach(() => reiniciar())

async function celular(browser, ruta = '/clases', { sinRed = false } = {}) {
  const contexto = await browser.newContext({ ...devices['Pixel 7'] })
  if (sinRed) await contexto.route(SUPABASE, (r) => r.abort())
  const pagina = await contexto.newPage()
  await pagina.goto(ruta)
  return pagina
}

async function miId(pagina) {
  const leer = () =>
    pagina.evaluate(() => {
      const clave = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
      return clave ? JSON.parse(localStorage.getItem(clave)).user.id : null
    })
  await expect.poll(leer).not.toBeNull()
  return leer()
}

function foto(pagina, nombre) {
  return pagina.screenshot({ path: `${CARPETA}${nombre}.png`, fullPage: true })
}

function tarjeta(pagina, clase) {
  return pagina.locator('li', { has: pagina.locator(`a[href="/clases/${clase}"]`) })
}

function persona(n) {
  return `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
}

// Id de la persona de relleno n, dentro de SQL.
const ID_N = `('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid`

// La semilla tiene 24 personas de relleno: con 10 lugares quedan 14 para
// las listas de espera.
function llenarClaseEnVivo() {
  sql(`update public.clases set cupo = 10 where id = ${CLASE_EN_VIVO}`)
  sql(`insert into public.reservas (clase_id, persona_id)
       select ${CLASE_EN_VIVO}, ${ID_N} from generate_series(1, 10) n`)
}

// Deja a la persona del celular sola en la lista de Spinning 19:00, sin
// nadie antes. Con otra = true, la persona 22 se anota después.
async function anotarEnSpinning(cel, { otra = false } = {}) {
  for (const n of [21, 22, 23, 24]) como(n, `public.salir_de_espera(${SPINNING_19})`)
  await cel.goto(`/clases/${SPINNING_19}`)
  await cel.getByRole('button', { name: 'Sumarme a la lista' }).click()
  await expect(cel.getByText('Salir de la lista')).toBeVisible()
  if (otra) como(22, `public.sumarme_a_espera(${SPINNING_19})`)
}

function vencerOfertas() {
  sql(`update public.esperas set oferta_vence_en = now() - interval '1 second'
       where estado = 'ofertada';
       select public.vencer_ofertas_pendientes();`)
}

test('reservar: otra persona ocupó el último lugar mientras mirabas', async ({ browser }) => {
  const cel = await celular(browser)
  const funcional = tarjeta(cel, FUNCIONAL)
  await expect(funcional.getByText('1 lugar')).toBeVisible()

  como(20, `public.reservar(${FUNCIONAL})`)
  await funcional.getByRole('button', { name: 'Reservar' }).click()

  await expect(cel.getByRole('alert')).toHaveText(
    'Se ocupó el último lugar. Podés sumarte a la lista de espera.',
  )
  await expect(funcional.getByRole('link', { name: 'Espera' })).toBeVisible()
  await foto(cel, 'reservar-1-ultimo-lugar-ocupado')
})

test('reservar: se corta la conexión', async ({ browser }) => {
  const cel = await celular(browser)
  const enVivo = tarjeta(cel, CLASE_EN_VIVO)
  await expect(enVivo.getByRole('button', { name: 'Reservar' })).toBeVisible()

  await cel.context().route(`${SUPABASE}/rpc/reservar`, (r) => r.abort())
  await enVivo.getByRole('button', { name: 'Reservar' }).click()
  await expect(enVivo.getByRole('button', { name: 'Reservando…' })).toBeDisabled()
  await foto(cel, 'reservar-2a-reintentando')

  await expect(cel.getByRole('alert')).toHaveText(
    'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.',
    { timeout: 15000 },
  )
  await expect(enVivo.getByRole('button', { name: 'Reservar' })).toBeEnabled()
  await foto(cel, 'reservar-2b-sin-conexion')
})

test('reservar: la clase empezó mientras mirabas', async ({ browser }) => {
  const cel = await celular(browser)
  const enVivo = tarjeta(cel, CLASE_EN_VIVO)
  await expect(enVivo.getByRole('button', { name: 'Reservar' })).toBeVisible()

  sql(`update public.clases set empieza_en = now() - interval '1 minute' where id = ${CLASE_EN_VIVO}`)
  await enVivo.getByRole('button', { name: 'Reservar' }).click()

  await expect(cel.getByRole('alert')).toHaveText('La clase ya empezó.')
  await expect(enVivo.getByText('Ya empezó')).toBeVisible()
  await foto(cel, 'reservar-3-clase-empezo')
})

test('reservar: abrir la web sin conexión', async ({ browser }) => {
  const cel = await celular(browser, '/clases', { sinRed: true })
  await expect(cel.getByRole('alert')).toHaveText(
    'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.',
    { timeout: 15000 },
  )
  await foto(cel, 'reservar-4-sin-conexion-al-abrir')
})

test('reservar: link a una clase que no es de hoy', async ({ browser }) => {
  const cel = await celular(browser, '/clases/999')
  await expect(cel.getByText('Esta clase no está en la grilla de hoy.')).toBeVisible()
  await foto(cel, 'reservar-5-clase-que-no-es-de-hoy')
})

test('liberar: con lista de espera el lugar pasa al primero', async ({ browser }) => {
  const cel = await celular(browser)
  const yo = await miId(cel)
  sql(`update public.reservas set persona_id = '${yo}'
       where clase_id = ${SPINNING_19} and persona_id = '${persona(20)}'`)
  await cel.reload()

  const spinning = tarjeta(cel, SPINNING_19)
  await spinning.getByRole('button', { name: 'Cancelar' }).click()

  await expect(cel.getByText(/^Liberaste tu lugar en Spinning de las \d\d:\d\d\.$/)).toBeVisible()
  await expect(spinning.getByText('4 en espera')).toBeVisible()
  await expect(spinning.getByRole('link', { name: 'Espera' })).toBeVisible()
  expect(sql(`select estado from public.esperas where persona_id = '${persona(21)}'`)).toBe('ofertada')
  await foto(cel, 'liberar-1-con-lista-de-espera')
})

test('liberar: con la clase empezada no se ofrece a nadie', async ({ browser }) => {
  const cel = await celular(browser)
  const yo = await miId(cel)
  llenarClaseEnVivo()
  sql(`update public.reservas set persona_id = '${yo}'
       where clase_id = ${CLASE_EN_VIVO} and persona_id = '${persona(10)}'`)
  como(21, `public.sumarme_a_espera(${CLASE_EN_VIVO})`)
  sql(`update public.clases set empieza_en = now() - interval '5 minutes' where id = ${CLASE_EN_VIVO}`)

  await cel.goto(`/reserva?clase=${CLASE_EN_VIVO}`)
  await cel.getByRole('button', { name: 'Liberar mi lugar' }).click()

  await expect(cel.getByText('Listo, liberaste tu lugar. ¡Gracias por avisar!')).toBeVisible()
  expect(
    sql(`select estado from public.esperas
         where clase_id = ${CLASE_EN_VIVO} and persona_id = '${persona(21)}'`),
  ).toBe('esperando')
  await foto(cel, 'liberar-2-clase-empezada')
})

test('esperar: clase completa sin nadie en espera', async ({ browser }) => {
  llenarClaseEnVivo()
  const cel = await celular(browser, `/clases/${CLASE_EN_VIVO}`)
  await expect(cel.getByText('Nadie en espera todavía')).toBeVisible()
  await foto(cel, 'esperar-1-completa-sin-espera')

  // Alguien libera justo antes de que toque "Sumarme a la lista".
  como(1, `public.liberar(${CLASE_EN_VIVO})`)
  await cel.getByRole('button', { name: 'Sumarme a la lista' }).click()

  await expect(cel.getByRole('alert')).toHaveText('Se liberó un lugar: ya podés reservarlo.')
  await expect(cel.getByRole('button', { name: 'Reservar lugar' })).toBeVisible()
  await foto(cel, 'esperar-2-se-libero-justo')
})

test('esperar: lista larga', async ({ browser }) => {
  llenarClaseEnVivo()
  sql(`insert into public.esperas (clase_id, persona_id, anotada_en)
       select ${CLASE_EN_VIVO}, ${ID_N}, now() - (20 - n) * interval '1 minute'
       from generate_series(11, 19) n`)
  const cel = await celular(browser, `/clases/${CLASE_EN_VIVO}`)
  await cel.getByRole('button', { name: 'Sumarme a la lista' }).click()

  await expect(cel.getByText(/Estás 10\.º de 10\./)).toBeVisible()
  await foto(cel, 'esperar-3-lista-larga')
})

test('esperar: la oferta se ve desde la lista de clases', async ({ browser }) => {
  const cel = await celular(browser)
  await anotarEnSpinning(cel)
  como(1, `public.liberar(${SPINNING_19})`)

  await cel.goto('/clases')
  await expect(cel.getByText('Se liberó un lugar')).toBeVisible()
  const spinning = tarjeta(cel, SPINNING_19)
  await expect(spinning.getByText('Es tu turno')).toBeVisible()
  await expect(spinning.getByRole('link', { name: 'Tomarlo' })).toBeVisible()
  await foto(cel, 'esperar-4-oferta-en-la-lista')
})

test('esperar: oferta cuando falta poco para la clase', async ({ browser }) => {
  const cel = await celular(browser)
  await anotarEnSpinning(cel)
  sql(`update public.clases set empieza_en = now() + interval '12 minutes' where id = ${SPINNING_19}`)
  como(1, `public.liberar(${SPINNING_19})`)

  await cel.goto(`/reserva?clase=${SPINNING_19}`)
  await expect(cel.getByText(/^para tomarlo: la clase empieza a las \d\d:\d\d\.$/)).toBeVisible()
  await expect(cel.getByRole('timer')).toHaveText(/^1[12]:\d\d$/)
  await foto(cel, 'esperar-5-oferta-clase-por-empezar')
})

test('esperar: toca "Tomar el lugar" justo después de que venció', async ({ browser }) => {
  const cel = await celular(browser)
  await anotarEnSpinning(cel, { otra: true })
  como(1, `public.liberar(${SPINNING_19})`)
  await cel.goto(`/reserva?clase=${SPINNING_19}`)
  await expect(cel.getByRole('button', { name: 'Tomar el lugar' })).toBeVisible()

  vencerOfertas()
  await cel.getByRole('button', { name: 'Tomar el lugar' }).click()

  await expect(cel.getByRole('alert')).toHaveText(
    'El lugar ya no está disponible. Seguís en la lista por si se libera otro.',
  )
  await expect(cel.getByText('El lugar pasó a la siguiente persona')).toBeVisible()
  await foto(cel, 'esperar-6-tomar-cuando-vencio')
})

test('esperar: "No puedo, gracias" pasa a la persona al final', async ({ browser }) => {
  const cel = await celular(browser)
  await anotarEnSpinning(cel, { otra: true })
  como(1, `public.liberar(${SPINNING_19})`)
  await cel.goto(`/reserva?clase=${SPINNING_19}`)
  await cel.getByRole('button', { name: 'No puedo, gracias' }).click()

  await expect(
    cel.getByText('Listo, le pasamos el lugar a la siguiente persona. Seguís en la lista, al final.'),
  ).toBeVisible()
  await expect(cel.getByText(/Estás 2\.º\./)).toBeVisible()
  expect(sql(`select estado from public.esperas where persona_id = '${persona(22)}' and estado <> 'salio'`)).toBe(
    'ofertada',
  )
  await foto(cel, 'esperar-7-no-puedo')
})

test('esperar: vence la oferta y no hay nadie más: el lugar queda libre', async ({ browser }) => {
  const cel = await celular(browser)
  await anotarEnSpinning(cel)
  como(1, `public.liberar(${SPINNING_19})`)
  vencerOfertas()

  await cel.goto(`/reserva?clase=${SPINNING_19}`)
  await expect(cel.getByText('Se venció el tiempo para tomarlo')).toBeVisible()
  await expect(cel.getByText('Hay 1 lugar libre')).toBeVisible()
  await foto(cel, 'esperar-8-vencio-y-quedo-libre')

  await cel.getByRole('button', { name: 'Reservar lugar' }).click()
  await expect(cel.getByText('¡Listo! El lugar es tuyo.')).toBeVisible()
  await expect(cel.getByText('Confirmación pendiente')).toBeVisible()
  await foto(cel, 'esperar-9-tomo-el-lugar-libre')
})

test('esperar: la clase empieza y nunca se liberó un lugar', async ({ browser }) => {
  const cel = await celular(browser)
  await anotarEnSpinning(cel)
  sql(`update public.clases set empieza_en = now() - interval '1 minute' where id = ${SPINNING_19}`)

  await cel.goto('/reserva')
  await expect(cel.getByText('Todavía no tenés reservas')).toBeVisible()
  await foto(cel, 'esperar-10-clase-empezo-en-espera')
})
