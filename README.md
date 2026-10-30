# Ritmo

Web de reservas para un estudio de fitness. Muestra las clases del día con sus cupos, deja reservar y liberar el lugar, y maneja una lista de espera: cuando alguien libera, el lugar se le ofrece al primero de la lista, que tiene 30 minutos para tomarlo.

Se construyó con Claude Code en la sesión 3, "Del prototipo al producto real", de la serie de Espacio UX "De la idea al producto con IA". Parte del PRD y las pantallas de las sesiones 1 y 2, que están en `base/`.

**Ver la web:** https://espacioux-dot.github.io/AI-series/

- `/clases`: las clases del día, pensada para el celular.
- `/panel`: el panel del estudio, en vivo, para ver desde la compu.

Para entrar no hace falta crear una cuenta. Cada persona recibe un nombre generado, como "Alumna 37".

## Qué hay en el repo

| Carpeta | Qué tiene |
|---|---|
| `base/` | El PRD v1, las pantallas, los estados y la identidad visual de las sesiones 1 y 2. |
| `web/` | El frontend: Vite + React. |
| `supabase/` | La base: migraciones, permisos y la semilla con las clases de hoy. |
| `capturas/casos/` | Lo que ve la persona en los casos que las pantallas de `base/` no muestran. Las generan las pruebas. |
| `CLAUDE.md` | Las reglas del proyecto que Claude Code lee antes de trabajar. |

## Cómo funciona

- Los lugares libres no se guardan: se calculan contando las reservas.
- Reservar, liberar y tomar un lugar pasan por funciones de la base que bloquean la clase mientras cuentan. Así, dos personas no pueden quedarse con el mismo lugar.
- La app no escribe directo en ninguna tabla. Cada persona ve solo lo suyo.
- Los celulares consultan cada 5 a 10 segundos. El panel es lo único que usa tiempo real.

Está pensada para 500 personas a la vez en el plan gratis de Supabase. El resultado de la prueba de carga contra la nube: 0 errores, y reservar tardó 285 ms en el 95 % de los casos.

## Correrla en la compu

Hace falta Node 22, Docker y `psql`.

```bash
npx supabase start        # levanta Supabase local, con las migraciones y la semilla
cd web
npm install
npm run dev               # http://localhost:5173/clases
```

La semilla carga las clases con fecha de hoy. Para volver a empezar, con la base limpia:

```bash
npx supabase db reset
```

## Pruebas

```bash
cd web
npx playwright install chromium
npm run test:e2e
```

Las pruebas reinician la semilla antes de cada caso, así que solo corren contra Supabase local.

## Publicar

Cada push a `main` corre el workflow `.github/workflows/deploy.yml`, que construye la web y la publica en GitHub Pages. Para que ande hacen falta tres cosas:

1. En Settings → Pages, elegir GitHub Actions como origen.
2. En Settings → Secrets and variables → Actions → Variables, cargar `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`, del proyecto de Supabase en la nube.
3. En ese proyecto de Supabase, aplicar las migraciones (`npx supabase db push`), cargar `supabase/seed.sql` y activar el login anónimo.

## Claves

La URL y la clave pública de Supabase pueden estar en el frontend. La clave secreta nunca: no va al repo ni a la web. Si aparece en lo que se va a publicar, el build se corta.
