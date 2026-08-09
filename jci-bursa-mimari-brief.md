# JCI Bursa Eşleştirme Sistemi — Teknik Mimari Brief

Bu doküman, Claude Code'a proje klasöründe doğrudan verilebilecek bir uygulama planıdır. Amaç: JCI Bursa'ya yeni katılan üyeleri, mevcut sicildeki üyelerle otomatik ve ölçeklenebilir şekilde eşleştiren bir sistem kurmak.

---

## 1. Proje Özeti

- Üyeler bir başvuru formu doldurur (sektör, uzmanlık, sunduğu destek, aradığı destek, bio).
- Kayıt anında sistem, mevcut sicildeki en uygun 3-5 kişiyi otomatik bulur ve **karşılıklı** gerekçe üretir ("sen ondan şunu alabilirsin / sen ona şunu verebilirsin").
- Ölçek hedefi: 300+ üyeye kadar hızlı ve düşük maliyetli çalışmalı → bu yüzden saf "her üyeyle LLM karşılaştırması" yerine **iki aşamalı mimari** kullanılacak.

---

## 2. Veri Modeli (Postgres / Supabase)

```sql
-- Üyeler
create table members (
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

-- Embedding'ler (pgvector extension gerekli)
create extension if not exists vector;

create table member_embeddings (
  member_id uuid primary key references members(id) on delete cascade,
  profile_embedding vector(1536),         -- "offers + expertise + bio" birleşik metin
  need_embedding vector(1536),            -- sadece "needs" metni
  updated_at timestamptz default now()
);

-- Eşleşmeler (yönlü/asimetrik: A->B ve B->A ayrı satır olabilir)
create table matches (
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
create table match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  rated_by uuid references members(id),
  useful boolean,
  created_at timestamptz default now()
);
```

**Not (KVKK):** LLM'e gönderilecek prompt'larda `name` yerine `registry_no` kullanılmalı. İsim eşleştirmesi sadece son adımda, kendi backend kodumuzda (LLM dışında) yapılmalı.

---

## 3. Mimari Akış

```
Yeni üye formu gönderir
        │
        ▼
1) Kayıt: members tablosuna INSERT
        │
        ▼
2) Embedding üret (OpenAI/Voyage/Cohere embedding API)
   → "expertise + offers + bio" → profile_embedding
   → "needs" → need_embedding
        │
        ▼
3) Ön filtreleme (pgvector cosine similarity)
   → yeni üyenin need_embedding'i ile mevcut herkesin profile_embedding'i karşılaştırılır
   → en yakın 15-20 aday bulunur (SQL sorgusu, LLM YOK, milisaniyeler)
        │
        ▼
4) İnce eleme (Claude API)
   → sadece bu 15-20 kişilik kısa liste + yeni üye Claude'a gönderilir
   → registry_no kullanılır, isim gönderilmez
   → çıktı: top 3-5 eşleşme + karşılıklı gerekçe + strength skoru
        │
        ▼
5) matches tablosuna yazılır, kullanıcıya gösterilir
        │
        ▼
6) Kullanıcı "faydalı mıydı?" butonuna basar → match_feedback'e yazılır
```

---

## 4. Aşama 3 Detayı: Embedding + pgvector Sorgusu

```sql
-- Yeni üyenin ihtiyacına en yakın 20 profili bul
select m.id, m.registry_no,
       1 - (me.profile_embedding <=> :new_need_embedding) as similarity
from members m
join member_embeddings me on me.member_id = m.id
where m.id != :new_member_id
order by me.profile_embedding <=> :new_need_embedding
limit 20;
```

`<=>` pgvector'ün cosine distance operatörüdür; index için:
```sql
create index on member_embeddings using ivfflat (profile_embedding vector_cosine_ops);
```

---

## 5. Aşama 4 Detayı: LLM İnce Eleme Prompt Şablonu

```
Sen JCI Bursa üyeleri arasında networking eşleştirmesi yapan bir asistansın.
Aşağıda bir "hedef üye" ve pgvector ile önceden filtrelenmiş 15-20 "aday üye" var.
Sadece isim yerine sicil numarası (registry_no) kullan.

Hedef üye: {registry_no, sector, expertise, offers, needs, bio}
Adaylar: [{registry_no, sector, expertise, offers, needs, bio}, ...]

Görev: En anlamlı 3-5 eşleşmeyi seç. Her biri için:
- strength (1-5)
- a_offers_b: hedef üyenin bu adaya sunabileceği somut destek (max 20 kelime)
- b_offers_a: bu adayın hedef üyeye sunabileceği somut destek (max 20 kelime)
- topics: ortak 1-3 konu

SADECE geçerli JSON array döndür, başka metin ekleme.
```

---

## 6. Geri Bildirim Döngüsü (v2 için)

- `match_feedback` tablosu büyüdükçe, "hangi sinyal daha çok işe yarıyor" (sektör benzerliği mi, ihtiyaç-arz eşleşmesi mi) basit bir ağırlıklı skor ile ayarlanabilir.
- İlk sürümde bunu otomatikleştirmeye gerek yok — sadece veri toplanması yeterli, birkaç ay sonra ağırlıklar elle/manuel gözden geçirilebilir.

---

## 7. Önerilen Stack

| Katman | Öneri |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Veritabanı | Supabase (Postgres + pgvector dahili) |
| Embedding | OpenAI `text-embedding-3-small` (ucuz, 1536 boyut) veya Voyage AI |
| Eşleştirme LLM'i | Claude API (`claude-sonnet-4-6`) |
| Hosting | Vercel |
| Domain | Namecheap/GoDaddy → Vercel'e DNS yönlendirme |

---

## 8. Claude Code'a Görev Sırası (bu haliyle verilebilir)

1. Next.js projesi kur, Supabase bağlantısını yapılandır (`.env` şablonu ile)
2. Yukarıdaki SQL şemasını migration olarak oluştur (`members`, `member_embeddings`, `matches`, `match_feedback`)
3. Üye kayıt formu + API route (`/api/members`, POST)
4. Kayıt sonrası embedding üretme fonksiyonu (`/lib/embeddings.ts`)
5. pgvector ön filtreleme sorgusunu çalıştıran fonksiyon (`/lib/match-candidates.ts`)
6. Claude API ince eleme çağrısını yapan fonksiyon (`/lib/refine-matches.ts`) — yukarıdaki prompt şablonunu kullanarak
7. Sonuçları `matches` tablosuna yazan ve kullanıcıya gösteren sayfa (`/dashboard`)
8. "Faydalı mıydı?" geri bildirim butonu + `/api/feedback` route
9. KVKK kontrolü: LLM'e giden hiçbir payload'da `name` alanının geçmediğini test et

---

**Kullanım:** Bu dosyayı proje klasörüne koyup Claude Code'a "bu brief'e göre projeyi adım adım kur" diyerek başlayabilirsin.
