import { createClient } from '@supabase/supabase-js'

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL
const CLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!URL_SUPABASE || !CLAVE_PUBLICA) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. En la compu salen de ' +
      'web/.env.development; en GitHub Pages, de las variables del repositorio.',
  )
}

export const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA)

const MENSAJES = {
  clase_completa: 'Se ocupó el último lugar. Podés sumarte a la lista de espera.',
  clase_empezada: 'La clase ya empezó.',
  clase_no_disponible: 'Esta clase ya no está disponible.',
  hay_lugar: 'Se liberó un lugar: ya podés reservarlo.',
  ya_tenes_lugar: 'Ya tenés tu lugar en esta clase.',
  sin_reserva: 'No encontramos tu reserva.',
  sin_sesion: 'Se cortó tu sesión. Volvé a cargar la página.',
}

const SIN_RED = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'

export class ErrorRitmo extends Error {
  constructor(mensaje, codigo = null) {
    super(mensaje)
    this.codigo = codigo
  }
}

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

// Reintenta solo si falló la red o el servidor (status 0 o 5xx). Los
// errores de negocio ("clase_completa") vuelven enseguida.
async function conReintentos(pedido) {
  for (let intento = 0; ; intento++) {
    const respuesta = await pedido()
    const { error } = respuesta
    // Las llamadas a la base traen status en la respuesta; las de login,
    // en el error.
    const status = respuesta.status ?? error?.status ?? 0
    const deRed = error && (status === 0 || status >= 500)
    if (!deRed || intento === 3) return respuesta
    await esperar(500 * 2 ** intento + Math.random() * 500)
  }
}

let sesion

// Login anónimo: la primera vez crea la persona, después reusa la
// sesión guardada en el navegador.
export function asegurarSesion() {
  sesion ??= (async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    const { data: nueva, error } = await conReintentos(() => supabase.auth.signInAnonymously())
    if (error) throw new ErrorRitmo(SIN_RED)
    return nueva.session
  })().catch((error) => {
    sesion = undefined
    throw error
  })
  return sesion
}

export async function llamar(funcion, argumentos, { conSesion = true } = {}) {
  if (conSesion) await asegurarSesion()
  const { data, error, status } = await conReintentos(() => supabase.rpc(funcion, argumentos))
  if (error) {
    const deRed = status === 0 || status >= 500
    if (deRed) throw new ErrorRitmo(SIN_RED, 'sin_red')
    throw new ErrorRitmo(MENSAJES[error.message] ?? SIN_RED, error.message)
  }
  return data
}

let nombre

// Nombre generado ("Alumna 37") para el avatar. Se pide una sola vez.
export function nombrePropio() {
  nombre ??= asegurarSesion()
    .then(() => supabase.from('perfiles').select('nombre_mostrado').single())
    .then(({ data }) => data?.nombre_mostrado ?? '')
    .catch(() => {
      nombre = undefined
      return ''
    })
  return nombre
}
