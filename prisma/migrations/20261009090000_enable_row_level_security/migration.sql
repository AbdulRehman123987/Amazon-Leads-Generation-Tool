-- Supabase exposes every table in the `public` schema through a public REST
-- API that its `anon` and `authenticated` roles can read and write. With row
-- level security enabled and no policies, those roles see nothing, while this
-- app — which connects directly as the tables' owner — is unaffected (owners
-- bypass RLS). Harmless on plain Postgres.
ALTER TABLE "ScrapeJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Brand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaAdBrand" ENABLE ROW LEVEL SECURITY;
