-- JCI Bursa Eşleştirme Sistemi — İlk şema
-- Mimari brief'teki bölüm 2'ye birebir karşılık gelir.

create extension if not exists "pgcrypto"; -- gen_random_uuid() için
create extension if not exists vector;      -- pgvector

-- Üyeler
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  registry_no text unique not null,       -- JCI-BUR-001
  name text not null,
  sector text not null,
  expertise text,
  offers text,                            -- verebileceği destek
  needs text,                             -- aradığı destek
  bio text,
  joined_at timestamptz default now()
);

-- Embedding'ler
create table if not exists member_embeddings (
  member_id uuid primary key references members(id) on delete cascade,
  profile_embedding vector(1536),         -- "offers + expertise + bio" birleşik metin
  need_embedding vector(1536),            -- sadece "needs" metni
  updated_at timestamptz default now()
);

-- Eşleşmeler (yönlü/asimetrik: A->B ve B->A ayrı satır olabilir)
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  member_a uuid references members(id) on delete cascade,
  member_b uuid references members(id) on delete cascade,
  strength int check (strength between 1 and 5),
  a_offers_b text,     -- A'nın B'ye sunabileceği (LLM üretir)
  b_offers_a text,     -- B'nin A'ya sunabileceği (LLM üretir)
  topics text[],
  created_at timestamptz default now(),
  unique (member_a, member_b)
);

-- Geri bildirim (algoritmayı kalibre etmek için)
create table if not exists match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  rated_by uuid references members(id),
  useful boolean,
  created_at timestamptz default now()
);

-- pgvector cosine similarity için HNSW index.
-- Not: İlk sürümde ivfflat denendi ama az satırla (lists=100'e karşı
-- birkaç üye) approximate arama neredeyse hiç sonuç döndürmüyordu —
-- ivfflat'ın `lists` parametresi veri boyutuna göre ayarlanmak zorunda.
-- HNSW veri boyutuna bağlı bir ayar gerektirmediği için küçük/büyük
-- üye sayısında da güvenilir sonuç verir (bkz. 0003_use_hnsw_index.sql).
create index if not exists member_embeddings_profile_idx
  on member_embeddings using hnsw (profile_embedding vector_cosine_ops);

create index if not exists members_registry_no_idx on members (registry_no);
