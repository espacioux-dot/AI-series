# Ritmo · web de reservas

Web mobile-first para un estudio de fitness: ver clases con cupos, reservar, liberar el lugar y lista de espera. El PRD está en `base/prd-ritmo-v1.md` y las pantallas de referencia en `base/pantallas/` y `base/estados/`.

## Stack

- Frontend: Vite + React en `web/`. Se publica en GitHub Pages con el workflow de `.github/workflows/deploy.yml`.
- Backend: Supabase (Postgres, login anónimo, Realtime). Migraciones en `supabase/migrations/`.

## Reglas del negocio que no se negocian

- Los lugares libres se calculan contando reservas. No se guardan en ningún lado.
- Reservar, cancelar y tomar un lugar liberado pasan por funciones de la base que bloquean la clase mientras cuentan. Nunca contar lugares en el celular.
- Cuando alguien libera un lugar, se le ofrece al primero de la lista de espera. La oferta vence a los 30 minutos (R5) y pasa al siguiente.
- Cada persona ve y modifica solo sus reservas. La tabla de reservas no acepta escrituras directas desde la app.
- Login anónimo (R8: entrar sin crear contraseña). Los nombres que se muestran son generados ("Alumna 37"), nunca escritos por la persona.

## Pensado para 500 personas a la vez en el plan gratis de Supabase

- Tiempo real solo en el panel del estudio. Los celulares consultan su estado cada 5 a 10 segundos con un desfase al azar.
- Las llamadas del celular reintentan si falla la red. Reservar dos veces devuelve la misma reserva.

## Claves

- La URL y la clave pública de Supabase pueden estar en el frontend.
- La clave secreta nunca va al repo ni al frontend. Vive en `.env.local`, que está en `.gitignore`.

## Textos

- Español rioplatense, en segunda persona, sin jerga interna del estudio.
- Horas siempre en hora de Argentina y en formato de 24 horas.
- Contraste WCAG AA y áreas táctiles de 44 px como mínimo.
