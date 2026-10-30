import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Aviso, Barra, Cargando, lugares, personas } from '../componentes.jsx'
import { cargarClases, useConsulta } from '../consultas.js'
import { diaCorto, hora } from '../hora.js'
import { llamar } from '../supabase.js'

export default function Detalle() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { datos: clases, error, refrescar } = useConsulta(cargarClases)
  const [enCurso, setEnCurso] = useState(false)
  const [aviso, setAviso] = useState(null)

  const clase = clases?.find((c) => c.id === Number(id))

  async function accion(funcion) {
    setEnCurso(true)
    setAviso(null)
    try {
      await llamar(funcion, { p_clase: clase.id })
      navegar(`/reserva?clase=${clase.id}`)
    } catch (e) {
      setAviso(e.message)
      await refrescar()
      setEnCurso(false)
    }
  }

  if (!clases) {
    return (
      <main className="pantalla">
        <Volver />
        <Aviso>{error?.message}</Aviso>
        {!error && <Cargando />}
      </main>
    )
  }

  if (!clase) {
    return (
      <main className="pantalla">
        <Volver />
        <p className="texto-secundario">Esta clase no está en la grilla de hoy.</p>
      </main>
    )
  }

  const libres = clase.cupo - clase.ocupados
  const mia = clase.mi_estado === 'reservada'
  const enEspera = clase.mi_estado === 'esperando' || clase.mi_estado === 'ofertada'
  const empezo = new Date(clase.empieza_en).getTime() <= Date.now()
  const completa = libres <= 0

  return (
    <main className="pantalla pantalla--con-pie">
      <Volver />

      <div className="portada">
        <h1>{clase.disciplina}</h1>
        <p>
          {clase.variante ? `${clase.variante} · ` : ''}
          {clase.duracion_min} min
        </p>
      </div>

      <h2 className="detalle__cuando">
        {diaCorto(clase.empieza_en)} · {hora(clase.empieza_en)}
      </h2>

      <dl className="datos">
        <div>
          <dt>Profe</dt>
          <dd>{clase.instructor}</dd>
        </div>
        <div>
          <dt>Sala</dt>
          <dd>{clase.sala}</dd>
        </div>
        <div>
          <dt>Nivel</dt>
          <dd>{clase.nivel}</dd>
        </div>
      </dl>

      <div className="cupo">
        <p className="cupo__fila">
          {completa ? (
            <strong className="estado estado--violeta">Clase completa</strong>
          ) : (
            <strong className="estado estado--verde">
              {libres === 1 ? 'Queda 1 lugar' : `Quedan ${lugares(libres)}`}
            </strong>
          )}
          <span>
            {clase.ocupados} de {clase.cupo}
          </span>
        </p>
        <Barra ocupados={clase.ocupados} cupo={clase.cupo} gruesa />
      </div>

      <Aviso>{aviso}</Aviso>

      {completa && !mia && !enEspera && !empezo && (
        <section className="caja" aria-labelledby="espera-titulo">
          <h3 id="espera-titulo">
            {clase.en_espera > 0 ? `${personas(clase.en_espera)} en espera` : 'Nadie en espera todavía'}
          </h3>
          <p>Si se libera un lugar, te lo ofrecemos acá.</p>
          <button
            type="button"
            className="boton boton--primario boton--ancho"
            disabled={enCurso}
            onClick={() => accion('sumarme_a_espera')}
          >
            {enCurso ? 'Sumándote…' : 'Sumarme a la lista'}
          </button>
        </section>
      )}

      <footer className="pie">
        {mia && (
          <>
            <Link className="boton boton--primario boton--ancho" to={`/reserva?clase=${clase.id}`}>
              Ver mi reserva
            </Link>
            <p>Ya tenés tu lugar en esta clase.</p>
          </>
        )}
        {enEspera && (
          <Link className="boton boton--primario boton--ancho" to={`/reserva?clase=${clase.id}`}>
            {clase.mi_estado === 'ofertada' ? 'Se liberó un lugar: tomarlo' : 'Ver mi lugar en la lista'}
          </Link>
        )}
        {!mia && !enEspera && empezo && <p>La clase ya empezó.</p>}
        {!mia && !enEspera && !empezo && !completa && (
          <>
            <button
              type="button"
              className="boton boton--primario boton--ancho"
              disabled={enCurso}
              onClick={() => accion('reservar')}
            >
              {enCurso ? 'Reservando…' : 'Reservar lugar'}
            </button>
            <p>Si no podés ir, lo liberás en un toque.</p>
          </>
        )}
      </footer>
    </main>
  )
}

function Volver() {
  return (
    <Link to="/clases" className="volver">
      <span aria-hidden="true">‹</span> Clases
    </Link>
  )
}
