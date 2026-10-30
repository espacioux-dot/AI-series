// Todas las horas en hora de Argentina y formato de 24 horas.
const ZONA = 'America/Argentina/Buenos_Aires'

const formatoHora = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const formatoDia = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function partes(fecha) {
  const p = Object.fromEntries(
    formatoDia.formatToParts(new Date(fecha)).map(({ type, value }) => [type, value]),
  )
  const dia = p.weekday.charAt(0).toUpperCase() + p.weekday.slice(1)
  return { dia, numero: p.day, mes: p.month }
}

export function hora(fecha) {
  return formatoHora.format(new Date(fecha))
}

export function diaLargo(fecha) {
  const { dia, numero, mes } = partes(fecha)
  return `${dia} ${numero} de ${mes}`
}

export function diaCorto(fecha) {
  const { dia, numero } = partes(fecha)
  return `${dia} ${numero}`
}

export function minutosYSegundos(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutos = Math.floor(total / 60)
  const segundos = String(total % 60).padStart(2, '0')
  return `${minutos}:${segundos}`
}
