-- Sicil numarası artık kullanıcıdan istenmiyor; başvuru formunda gösterilmiyor,
-- backend otomatik ve sıralı olarak üretiyor (JCI-BUR-001, JCI-BUR-002, ...).
-- registry_no kolonu ve KVKK guard'ı (LLM'e isim yerine bunun gönderilmesi)
-- aynen duruyor — sadece kaynağı formdan backend'e taşındı.

create sequence if not exists member_registry_seq start with 1;

create or replace function generate_registry_no()
returns text
language sql
as $$
  select 'JCI-BUR-' || lpad(nextval('member_registry_seq')::text, 3, '0');
$$;
