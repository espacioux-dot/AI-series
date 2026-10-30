import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar, Aviso, Barra, Cargando, lugares } from '../componentes.jsx'
import { cargarClases, useConsulta } from '../consultas.js'
import { diaLargo, hora } from '../hora.js'
import { llamar } from '../supabase.js'

export default function Clases() {
  const { datos: clases, error, refrescar } = useConsulta(cargarClases)
  const [filtro, setFiltro] = useState('Todas')
  const [enCurso, setEnCurso] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [hecho, setHecho] = useState(null)

  async function accion(funcion, clase) {
    setEnCurso(clase.id)
    setAviso(null)
    setHecho(null)
    try {
      await llamar(funcion, { p_clase: clase.id })
      if (funcion === 'liberar') {
        setHecho(`Liberaste tu lugar en ${clase.disciplina} de las ${hora(clase.empieza_en)}.`)
      }
    } catch (e) {
      setAviso(e.message)
    }
    await refrescar()
    setEnCurso(null)
  }

  const disciplinas = ['Todas', ...new Set((clases ?? []).map((c) => c.disciplina))]
  const visibles = (clases ?? []).filter((c) => filtro === 'Todas' || c.disciplina === filtro)
  const ofrecida = (clases ?? []).find((c) => c.mi_estado === 'ofertada')

  return (
    <main className="pantalla">
      <header className="cabecera cabecera--clases">
        <div>
          <p className="sede">Sede Palermo</p>
          <h1 className="titulo">Clases</h1>
        </div>
        <Avatar />
      </header>

      {ofrecida && (
        <div className="oferta-aviso" role="status">
          <p>
            <strong>Se liberó un lugar</strong>
            {ofrecida.disciplina} · {hora(ofrecida.empieza_en)}
          </p>
          <Link className="boton" to={`/reserva?clase=${ofrecida.id}`}>
            Tomarlo
          </Link>
        </div>
      )}

      <div className="chips" role="group" aria-label="Filtrar por disciplina">
        {disciplinas.map((d) => (
          <button
            key={d}
            type="button"
            className="chip"
            aria-pressed={filtro === d}
            onClick={() => setFiltro(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="fila-dia">
        <h2>{diaLargo(Date.now())}</h2>
        {clases && <span>{visibles.length === 1 ? '1 clase' : `${visibles.length} clases`}</span>}
      </div>

      <Aviso>{aviso ?? (error && !clases ? error.message : null)}</Aviso>
      <Aviso tono="ok">{hecho}</Aviso>
      {!clases && !error && <Cargando />}

      <ul className="lista-clases">
        {visibles.map((clase) => (
          <TarjetaClase
            key={clase.id}
            clase={clase}
            ocupada={enCurso === clase.id}
            onReservar={() => accion('reservar', clase)}
            onCancelar={() => accion('liberar', clase)}
          />
        ))}
      </ul>
    </main>
  )
}

function TarjetaClase({ clase, ocupada, onReservar, onCancelar }) {
  const libres = clase.cupo - clase.ocupados
  const mia = clase.mi_estado === 'reservada'
  const ofrecida = clase.mi_estado === 'ofertada'
  const enEspera = clase.mi_estado === 'esperando'
  const empezo = new Date(clase.empieza_en).getTime() <= Date.now()

  let estado = 'Completa'
  let tono = 'violeta'
  if (ofrecida) {
    estado = 'Es tu turno'
  } else if (empezo && !mia) {
    estado = 'Ya empezó'
    tono = 'gris'
  } else if (libres > 0) {
    estado = lugares(libres)
    tono = 'verde'
  } else if (!mia && clase.en_espera > 0) {
    estado = `${clase.en_espera} en espera`
  }

  let boton = null
  if (mia) {
    boton = (
      <button type="button" className="boton boton--gris" disabled={ocupada} onClick={onCancelar}>
        {ocupada ? 'Cancelando…' : 'Cancelar'}
      </button>
    )
  } else if (ofrecida) {
    boton = (
      <Link className="boton boton--primario" to={`/reserva?clase=${clase.id}`}>
        Tomarlo
      </Link>
    )
  } else if (enEspera) {
    boton = (
      <Link className="boton boton--borde" to={`/reserva?clase=${clase.id}`}>
        En espera
      </Link>
    )
  } else if (empezo) {
    boton = null
  } else if (libres > 0) {
    boton = (
      <button type="button" className="boton boton--primario" disabled={ocupada} onClick={onReservar}>
        {ocupada ? 'Reservando…' : 'Reservar'}
      </button>
    )
  } else {
    boton = (
      <Link className="boton boton--borde" to={`/clases/${clase.id}`}>
        Espera
      </Link>
    )
  }

  return (
    <li className={`tarjeta${mia ? ' tarjeta--mia' : ''}`}>
      <div className="tarjeta__hora">
        <strong>{hora(clase.empieza_en)}</strong>
        <span>{clase.duracion_min} min</span>
      </div>
      <div className="tarjeta__cuerpo">
        <h3 className="tarjeta__titulo">
          <Link to={`/clases/${clase.id}`} className="tarjeta__enlace">
            {clase.disciplina}
          </Link>
          {mia && <span className="etiqueta etiqueta--violeta">Reservada</span>}
        </h3>
        <p className="tarjeta__detalle">
          {clase.instructor} · {clase.sala}
        </p>
        <p className="tarjeta__cupo">
          <Barra ocupados={clase.ocupados} cupo={clase.cupo} />
          <span className={`estado estado--${tono}`}>{estado}</span>
        </p>
      </div>
      {boton && <div className="tarjeta__accion">{boton}</div>}
    </li>
  )
}
