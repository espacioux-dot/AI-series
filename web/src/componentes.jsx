import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { nombrePropio } from './supabase.js'

export function Avatar({ nombre }) {
  const [propio, setPropio] = useState(nombre ?? '')

  useEffect(() => {
    if (nombre) setPropio(nombre)
    else nombrePropio().then(setPropio)
  }, [nombre])

  return (
    <Link
      to="/reserva"
      className="avatar"
      title={propio}
      aria-label={propio ? `Mis reservas · ${propio}` : 'Mis reservas'}
    >
      <span aria-hidden="true">{propio.charAt(0)}</span>
    </Link>
  )
}

export function Logo() {
  return (
    <Link to="/clases" className="logo" aria-label="Ritmo · Ver clases">
      ritmo
    </Link>
  )
}

export function Cabecera({ nombre }) {
  return (
    <header className="cabecera">
      <Logo />
      <Avatar nombre={nombre} />
    </header>
  )
}

export function Barra({ ocupados, cupo, gruesa = false }) {
  const lleno = Math.min(1, ocupados / cupo)
  return (
    <span
      className={`barra${gruesa ? ' barra--gruesa' : ''}${lleno >= 1 ? ' barra--completa' : ''}`}
      style={{ '--lleno': lleno }}
      aria-hidden="true"
    />
  )
}

export function Aviso({ children, tono = 'error' }) {
  if (!children) return null
  return (
    <p className={`aviso aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Cargando() {
  return (
    <p className="cargando" role="status">
      Cargando…
    </p>
  )
}

export function lugares(n) {
  return n === 1 ? '1 lugar' : `${n} lugares`
}

export function personas(n) {
  return n === 1 ? '1 persona' : `${n} personas`
}
