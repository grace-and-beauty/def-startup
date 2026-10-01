-- Public-read bucket for business logos (docs/architecture.md §8, §11).
-- Uploads are performed by the server (service role) after validating type
-- (png / jpeg / webp) and size (≤ 1 MB) under logos/{business_id}/…, so no
-- storage.objects write policies for end users are needed.
--
-- Guarded: plain Postgres used in tests has no "storage" schema.
do $$
begin
  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'storage')
     and exists (
       select 1 from information_schema.tables
       where table_schema = 'storage' and table_name = 'buckets'
     )
  then
    execute $sql$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
      on conflict (id) do update
        set public = excluded.public,
            file_size_limit = excluded.file_size_limit,
            allowed_mime_types = excluded.allowed_mime_types
    $sql$;
  end if;
end;
$$;
