import { useEffect, useRef, useState } from 'react'
import { Aviso, Cargando } from '../componentes.jsx'
import { diaLargo, hora } from '../hora.js'
import { llamar, supabase } from '../supabase.js'

// Panel del estudio: solo lectura y sin login. Es la única pantalla con
// tiempo real: la base avisa por el canal "panel" cada vez que cambia una
// reserva o la lista de espera, y el panel vuelve a pedir los datos.
export default function Panel() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [enVivo, setEnVivo] = useState(false)
  const pendiente = useRef(null)

  useEffect(() => {
    let vivo = true

    async function cargar() {
      try {
        const nuevos = await llamar('panel', undefined, { conSesion: false })
        if (vivo) {
          setDatos(nuevos)
          setError(null)
        }
      } catch (e) {
        if (vivo) setError(e)
      }
    }

    // Junta los avisos que llegan seguidos en un solo pedido.
    function alCambiar() {
      clearTimeout(pendiente.current)
      pendiente.current = setTimeout(cargar, 250)
    }

    cargar()
    const canal = supabase
      .channel('panel', { config: { private: false } })
      .on('broadcast', { event: 'cambio' }, alCambiar)
      .subscribe((estado) => {
        if (!vivo) return
        setEnVivo(estado === 'SUBSCRIBED')
        if (estado === 'SUBSCRIBED') cargar()
      })
    // Respaldo por si se corta el tiempo real.
    const respaldo = setInterval(cargar, 30000)

    return () => {
      vivo = false
      clearTimeout(pendiente.current)
      clearInterval(respaldo)
      supabase.removeChannel(canal)
    }
  }, [])

  return (
    <main className="panel">
      <header className="panel__cabecera">
        <div>
          <p className="logo">ritmo</p>
          <h1 className="titulo">Panel del estudio</h1>
          <p className="texto-secundario">Sede Palermo · {diaLargo(Date.now())}</p>
        </div>
        <p className={`en-vivo${enVivo ? ' en-vivo--si' : ''}`} role="status">
          <span aria-hidden="true" />
          {enVivo ? 'En vivo' : 'Conectando…'}
        </p>
      </header>

      <Aviso>{error?.message}</Aviso>
      {!datos && !error && <Cargando />}

      <div className="panel__grilla">
        {datos?.clases.map((clase) => (
          <ClasePanel key={clase.id} clase={clase} />
        ))}
      </div>
    </main>
  )
}

function ClasePanel({ clase }) {
  const confirmadas = clase.reservas.filter((r) => r.confirmada)
  const pendientes = clase.reservas.filter((r) => !r.confirmada)
  const titulo = `panel-clase-${clase.id}`

  return (
    <section className="panel__clase" aria-labelledby={titulo}>
      <h2 id={titulo}>
        <span>{hora(clase.empieza_en)}</span> {clase.disciplina}
      </h2>
      <p className="texto-secundario">
        {clase.instructor} · {clase.sala} · {clase.duracion_min} min
      </p>

      <dl className="panel__numeros">
        <div>
          <dt>Confirmados</dt>
          <dd data-testid="confirmados">
            {confirmadas.length} de {clase.cupo}
          </dd>
        </div>
        <div>
          <dt>Reservas</dt>
          <dd data-testid="reservas">
            {clase.reservas.length} de {clase.cupo}
          </dd>
        </div>
        <div>
          <dt>En espera</dt>
          <dd data-testid="en-espera">{clase.espera.length}</dd>
        </div>
      </dl>

      <span
        className="barra barra--gruesa barra--doble"
        style={{
          '--lleno': Math.min(1, clase.reservas.length / clase.cupo),
          '--confirmado': Math.min(1, confirmadas.length / clase.cupo),
        }}
        aria-hidden="true"
      />

      <Nombres titulo="Confirmados" nombres={confirmadas.map((r) => r.nombre)} />
      <Nombres titulo="Sin confirmar" nombres={pendientes.map((r) => r.nombre)} />
      <Nombres
        titulo="Lista de espera"
        ordenada
        nombres={clase.espera.map((e) =>
          e.estado === 'ofertada'
            ? `${e.nombre} · oferta hasta las ${hora(e.oferta_vence_en)}`
            : e.nombre,
        )}
      />
    </section>
  )
}

function Nombres({ titulo, nombres, ordenada = false }) {
  if (nombres.length === 0) return null
  const Lista = ordenada ? 'ol' : 'ul'
  return (
    <div className="panel__nombres">
      <h3>
        {titulo} <span>({nombres.length})</span>
      </h3>
      <Lista>
        {nombres.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </Lista>
    </div>
  )
}
