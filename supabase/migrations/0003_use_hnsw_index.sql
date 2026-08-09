-- Bug fix: ivfflat index, üye sayısı azken (lists=100'e karşı birkaç satır)
-- neredeyse hiç sonuç döndürmüyor. ivfflat approximate bir index'tir ve
-- `lists` parametresi veri boyutuna göre ayarlanmalıdır; az veriyle
-- kümeleme anlamsızlaşıyor ve varsayılan `probes=1` çoğu satırı atlıyor.
-- (Bkz. testte: aynı sorgu index'siz doğru similarity döndürüyordu ama
-- ivfflat index'i kullanan ORDER BY ... LIMIT sorgusu boş dönüyordu.)
--
-- Çözüm: küçük veri setlerinde de doğru sonuç veren HNSW index'ine geçmek.
-- HNSW `lists` gibi veri boyutuna bağlı bir ayar gerektirmez.

drop index if exists member_embeddings_profile_idx;

create index if not exists member_embeddings_profile_idx
  on member_embeddings using hnsw (profile_embedding vector_cosine_ops);
