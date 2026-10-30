import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Aviso, Cabecera, Cargando, lugares, personas } from '../componentes.jsx'
import { cargarMisCosas, useAhoraDelServidor, useConsulta } from '../consultas.js'
import { hora, minutosYSegundos } from '../hora.js'
import { llamar } from '../supabase.js'

const TRES_HORAS = 3 * 60 * 60 * 1000

const HECHO = {
  reservar: '¡Listo! El lugar es tuyo.',
  liberar: 'Listo, liberaste tu lugar. ¡Gracias por avisar!',
  rechazar_oferta: 'Listo, le pasamos el lugar a la siguiente persona. Seguís en la lista, al final.',
  salir_de_espera: 'Saliste de la lista de espera.',
}

// Muestra lo más urgente (oferta, después reserva, después espera) y lista
// el resto. Con ?clase=ID muestra esa en primer lugar.
export default function MiReserva() {
  const { datos, error, refrescar } = useConsulta(cargarMisCosas)
  const ahora = useAhoraDelServidor(datos?.ahora)
  const [parametros] = useSearchParams()
  const [enCurso, setEnCurso] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [hecho, setHecho] = useState(null)

  async function accion(funcion, clase) {
    setEnCurso(funcion)
    setAviso(null)
    setHecho(null)
    try {
      await llamar(funcion, { p_clase: clase.id })
      setHecho(HECHO[funcion] ?? null)
    } catch (e) {
      // Desde acá solo se reserva un lugar ofrecido o uno que quedó libre:
      // si ya no está, la persona sigue en la lista.
      setAviso(
        funcion === 'reservar' && e.codigo === 'clase_completa'
          ? 'El lugar ya no está disponible. Seguís en la lista por si se libera otro.'
          : e.message,
      )
    }
    await refrescar()
    setEnCurso(null)
  }

  if (!datos) {
    return (
      <main className="pantalla">
        <Cabecera />
        <Aviso>{error?.message}</Aviso>
        {!error && <Cargando />}
      </main>
    )
  }

  const items = datos.items
  const pedido = Number(parametros.get('clase'))
  const principal = items.find((i) => i.clase.id === pedido) ?? items[0]
  const resto = items.filter((i) => i !== principal)

  const props = { item: principal, ahora, enCurso, accion }
  let contenido
  if (!principal) {
    contenido = <SinReservas />
  } else if (principal.tipo === 'reserva') {
    contenido = <Reserva {...props} />
  } else if (principal.tipo === 'oferta' && new Date(principal.oferta_vence_en).getTime() > ahora) {
    contenido = <Oferta {...props} plazoSeg={datos.plazo_oferta_seg} />
  } else if (principal.tipo === 'oferta' || principal.oferta_vencio_en) {
    contenido = <OfertaVencida {...props} />
  } else {
    contenido = <Espera {...props} />
  }

  return (
    <main className="pantalla">
      <Cabecera nombre={datos.nombre} />
      <Aviso>{aviso}</Aviso>
      <Aviso tono="ok">{hecho}</Aviso>
      {contenido}
      {resto.length > 0 && (
        <section className="resto" aria-labelledby="resto-titulo">
          <h2 id="resto-titulo">También tenés</h2>
          <ul>
            {resto.map((i) => (
              <li key={i.clase.id}>
                <Link to={`/reserva?clase=${i.clase.id}`} className="resto__item">
                  <span>
                    {i.clase.disciplina} · {hora(i.clase.empieza_en)}
                  </span>
                  <span className="texto-secundario">{resumen(i)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

function resumen(item) {
  if (item.tipo === 'oferta') return 'Se liberó un lugar'
  if (item.tipo === 'reserva') return item.confirmada ? 'Confirmada' : 'Confirmación pendiente'
  return `En espera · ${item.posicion}.º`
}

function Reserva({ item, ahora, enCurso, accion }) {
  const { clase, confirmada } = item
  const recordatorio = new Date(clase.empieza_en).getTime() - TRES_HORAS
  const espera =
    clase.en_espera > 0
      ? `hay ${personas(clase.en_espera)} en lista de espera.`
      : 'así lo aprovecha otra persona.'

  return (
    <>
      {confirmada ? (
        <span className="etiqueta etiqueta--verde">Confirmada</span>
      ) : (
        <span className="etiqueta etiqueta--ambar">Confirmación pendiente</span>
      )}
      <h1 className="titulo-grande">Hoy, {hora(clase.empieza_en)}</h1>
      <p className="subtitulo">
        {clase.disciplina} · {clase.duracion_min} min
      </p>
      <p className="texto-secundario">
        {clase.sala} · con {clase.instructor}
      </p>

      <section className="caja" aria-labelledby="venis-titulo">
        {confirmada ? (
          <>
            <h2 id="venis-titulo">¡Te esperamos!</h2>
            <p>Si al final no podés, liberá tu lugar: {espera}</p>
          </>
        ) : (
          <>
            <h2 id="venis-titulo">¿Venís a la clase?</h2>
            <p>Si no podés, liberá tu lugar: {espera}</p>
            <button
              type="button"
              className="boton boton--primario boton--ancho"
              disabled={enCurso !== null}
              onClick={() => accion('confirmar', clase)}
            >
              {enCurso === 'confirmar' ? 'Confirmando…' : 'Confirmo'}
            </button>
          </>
        )}
        <button
          type="button"
          className="boton boton--borde boton--ancho"
          disabled={enCurso !== null}
          onClick={() => accion('liberar', clase)}
        >
          {enCurso === 'liberar' ? 'Liberando…' : 'Liberar mi lugar'}
        </button>
      </section>

      {ahora < recordatorio && (
        <p className="nota">
          <span className="nota__icono" aria-hidden="true">
            ✓
          </span>
          Te vamos a recordar por WhatsApp a las {hora(recordatorio)}
        </p>
      )}
    </>
  )
}

function Oferta({ item, ahora, enCurso, accion, plazoSeg }) {
  const { clase } = item
  const vence = new Date(item.oferta_vence_en).getTime()
  const restante = vence - ahora
  const fraccion = Math.min(1, restante / (plazoSeg * 1000))
  // Si falta menos que el plazo, la oferta vence cuando empieza la clase.
  const hastaQueEmpieza = vence === new Date(clase.empieza_en).getTime()

  return (
    <>
      <span className="etiqueta etiqueta--violeta">Lista de espera</span>
      <h1 className="titulo-medio">Se liberó un lugar</h1>
      <p className="texto-secundario">
        {clase.disciplina} · Hoy {hora(clase.empieza_en)} · {clase.sala}
      </p>

      <div className="caja caja--centrada">
        <p>Tenés</p>
        <p className="cuenta" role="timer" aria-live="off">
          {minutosYSegundos(restante)}
        </p>
        <p>
          {hastaQueEmpieza
            ? `para tomarlo: la clase empieza a las ${hora(clase.empieza_en)}.`
            : 'para tomarlo. Después pasa al siguiente.'}
        </p>
        <span className="barra barra--gruesa" style={{ '--lleno': fraccion }} aria-hidden="true" />
      </div>

      <button
        type="button"
        className="boton boton--primario boton--ancho"
        disabled={enCurso !== null}
        onClick={() => accion('reservar', clase)}
      >
        {enCurso === 'reservar' ? 'Tomando el lugar…' : 'Tomar el lugar'}
      </button>
      <button
        type="button"
        className="boton boton--texto boton--ancho"
        disabled={enCurso !== null}
        onClick={() => accion('rechazar_oferta', clase)}
      >
        No puedo, gracias
      </button>
    </>
  )
}

// Puede quedar un lugar libre con gente en la lista: por ejemplo, si la
// única persona en espera dejó vencer su oferta. Ese lugar es de quien lo
// tome primero.
function LugarLibre({ clase, enCurso, accion }) {
  const libres = clase.cupo - clase.ocupados
  if (libres <= 0) return null
  return (
    <section className="caja" aria-labelledby="libre-titulo">
      <h2 id="libre-titulo">{libres === 1 ? 'Hay 1 lugar libre' : `Hay ${lugares(libres)} libres`}</h2>
      <p>Es de quien lo reserve primero.</p>
      <button
        type="button"
        className="boton boton--primario boton--ancho"
        disabled={enCurso !== null}
        onClick={() => accion('reservar', clase)}
      >
        {enCurso === 'reservar' ? 'Reservando…' : 'Reservar lugar'}
      </button>
    </section>
  )
}

function Espera({ item, enCurso, accion }) {
  const { clase, posicion } = item
  const total = clase.en_espera

  return (
    <div className="columna">
      <span className="etiqueta etiqueta--violeta">Lista de espera</span>
      <h1 className="titulo-medio">
        {clase.disciplina} · {hora(clase.empieza_en)}
      </h1>
      <LugarLibre clase={clase} enCurso={enCurso} accion={accion} />
      {total <= 6 && (
        <ol className="posiciones" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <li key={i} className={i + 1 === posicion ? 'posiciones--mia' : undefined}>
              {i + 1}º
            </li>
          ))}
        </ol>
      )}
      <p className="texto-secundario">
        Estás {posicion}.º{total > 6 ? ` de ${total}` : ''}. Si se libera un lugar, te lo ofrecemos
        acá.
      </p>
      <button
        type="button"
        className="boton boton--texto boton--ancho boton--al-pie"
        disabled={enCurso !== null}
        onClick={() => accion('salir_de_espera', clase)}
      >
        Salir de la lista
      </button>
    </div>
  )
}

function OfertaVencida({ item, enCurso, accion }) {
  return (
    <div className="vacio vacio--izquierda">
      <span className="vacio__icono vacio__icono--gris" aria-hidden="true">
        ○
      </span>
      {item.clase.cupo > item.clase.ocupados ? (
        <>
          <h1 className="titulo-medio">Se venció el tiempo para tomarlo</h1>
          <p className="texto-secundario">
            Nadie más lo pidió, así que el lugar sigue libre. Seguís en la lista.
          </p>
        </>
      ) : (
        <>
          <h1 className="titulo-medio">El lugar pasó a la siguiente persona</h1>
          <p className="texto-secundario">
            Se venció el tiempo para tomarlo. Seguís en la lista por si se libera otro.
          </p>
        </>
      )}
      <LugarLibre clase={item.clase} enCurso={enCurso} accion={accion} />
      <Link to="/clases" className="boton boton--borde boton--ancho">
        Ver otras clases
      </Link>
      <button
        type="button"
        className="boton boton--texto boton--ancho"
        disabled={enCurso !== null}
        onClick={() => accion('salir_de_espera', item.clase)}
      >
        Salir de la lista
      </button>
    </div>
  )
}

function SinReservas() {
  return (
    <div className="vacio">
      <span className="vacio__icono" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="5" width="22" height="19" rx="4" stroke="currentColor" strokeWidth="2.5" />
          <path d="M3 11h22" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      </span>
      <h1 className="titulo-medio">Todavía no tenés reservas</h1>
      <p className="texto-secundario">Elegí una clase y reservá tu lugar en un toque.</p>
      <Link to="/clases" className="boton boton--primario boton--ancho">
        Ver clases
      </Link>
    </div>
  )
}
