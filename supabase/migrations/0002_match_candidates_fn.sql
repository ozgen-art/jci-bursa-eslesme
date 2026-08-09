-- Aşama 3: pgvector ön filtreleme sorgusunu bir RPC fonksiyonu olarak tanımlıyoruz.
-- Supabase JS client, ham `<=>` operatörünü sorgu builder'ı üzerinden
-- çalıştıramadığı için bunu bir Postgres fonksiyonu olarak sunuyoruz.
-- Brief bölüm 4'teki sorgunun birebir karşılığıdır.

create or replace function match_candidates(
  p_new_member_id uuid,
  p_need_embedding vector(1536),
  p_limit int default 20
)
returns table (
  id uuid,
  registry_no text,
  similarity float
)
language sql
stable
as $$
  select m.id, m.registry_no,
         1 - (me.profile_embedding <=> p_need_embedding) as similarity
  from members m
  join member_embeddings me on me.member_id = m.id
  where m.id != p_new_member_id
    and me.profile_embedding is not null
  order by me.profile_embedding <=> p_need_embedding
  limit p_limit;
$$;
