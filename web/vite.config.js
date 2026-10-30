import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages no conoce las rutas de la app: si alguien abre
// .../ritmo/reserva, busca ese archivo y devuelve su página 404. Copiando
// index.html como 404.html, esa "página de error" es la app, que lee la
// dirección y muestra la pantalla correcta.
function paginaNoEncontradaEsLaApp() {
  let carpeta
  return {
    name: 'pagina-no-encontrada-es-la-app',
    apply: 'build',
    configResolved(config) {
      carpeta = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(resolve(carpeta, 'index.html'), resolve(carpeta, '404.html'))
    },
  }
}

export default defineConfig({
  // En GitHub Pages el sitio vive en /<nombre-del-repo>/. El workflow lo
  // pasa en VITE_BASE; en la compu queda en la raíz.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), paginaNoEncontradaEsLaApp()],
})
