// Revisa lo que se va a publicar (web/dist) y corta el build si encuentra
// una clave secreta de Supabase. La URL y la clave pública pueden estar en
// el frontend; la secreta y la service_role, nunca.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const CARPETA = new URL('../dist/', import.meta.url).pathname

function archivos(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(carpeta, e.name)) : [join(carpeta, e.name)],
  )
}

// Las claves viejas de Supabase son JWT: el rol está adentro, codificado.
function rolDeJwt(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role
  } catch {
    return null
  }
}

const problemas = []
for (const archivo of archivos(CARPETA)) {
  if (!/\.(js|html|css|json|map|txt)$/.test(archivo)) continue
  const texto = readFileSync(archivo, 'utf8')
  const nombre = archivo.slice(CARPETA.length)

  if (/sb_secret_[\w-]+/.test(texto)) {
    problemas.push(`${nombre}: tiene una clave secreta (sb_secret_…)`)
  }
  for (const [jwt] of texto.matchAll(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g)) {
    const rol = rolDeJwt(jwt)
    if (rol && rol !== 'anon') problemas.push(`${nombre}: tiene un token con rol "${rol}"`)
  }
}

if (problemas.length > 0) {
  console.error('\nNo se puede publicar: hay claves secretas en web/dist.\n')
  for (const p of problemas) console.error(`  · ${p}`)
  console.error('\nRevisá VITE_SUPABASE_PUBLISHABLE_KEY: tiene que ser la clave pública.\n')
  process.exit(1)
}

console.log('Revisión de claves: web/dist no tiene claves secretas.')
