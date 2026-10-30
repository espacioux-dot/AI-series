import { useCallback, useEffect, useRef, useState } from 'react'
import { llamar } from './supabase.js'

export const cargarClases = () => llamar('clases_de_hoy')
export const cargarMisCosas = () => llamar('mis_cosas')

// Los celulares no usan tiempo real: consultan cada 5 a 10 segundos, con
// un desfase al azar para que 500 personas no pidan todas a la vez.
export function useConsulta(cargar) {
  const [estado, setEstado] = useState({ datos: null, error: null })
  const ultimo = useRef(0)

  const refrescar = useCallback(async () => {
    const numero = ++ultimo.current
    try {
      const datos = await cargar()
      if (numero === ultimo.current) setEstado({ datos, error: null })
    } catch (error) {
      if (numero === ultimo.current) setEstado((antes) => ({ ...antes, error }))
    }
  }, [cargar])

  useEffect(() => {
    let vivo = true
    let reloj

    const ciclo = async () => {
      if (!document.hidden) await refrescar()
      if (vivo) reloj = setTimeout(ciclo, 5000 + Math.random() * 5000)
    }
    const alVolver = () => {
      if (!document.hidden) refrescar()
    }

    ciclo()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vivo = false
      clearTimeout(reloj)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [refrescar])

  return { ...estado, refrescar }
}

// Hora del servidor que avanza cada segundo. Corrige el reloj del celular
// con la diferencia contra el "ahora" que devolvió la base.
export function useAhoraDelServidor(ahoraServidor) {
  const [desfase, setDesfase] = useState(0)
  const [, setTic] = useState(0)

  useEffect(() => {
    if (ahoraServidor) setDesfase(new Date(ahoraServidor).getTime() - Date.now())
  }, [ahoraServidor])

  useEffect(() => {
    const reloj = setInterval(() => setTic((t) => t + 1), 1000)
    return () => clearInterval(reloj)
  }, [])

  return Date.now() + desfase
}
