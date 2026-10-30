-- Ritmo · permisos de lectura explícitos
--
-- En local, Supabase da lectura a las tablas nuevas sin pedirlo. Un
-- proyecto en la nube puede tener eso apagado. Con estos permisos la web
-- se comporta igual en los dos lados. Qué filas se ven lo sigue decidiendo
-- RLS (cada persona, solo lo suyo).

grant usage on schema public to anon, authenticated;

grant select on public.clases to anon, authenticated;
grant select on public.perfiles, public.reservas, public.esperas to authenticated;
