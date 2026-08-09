# JCI Bursa Eşleştirme Sistemi

`jci-bursa-mimari-brief.md` dosyasındaki mimariye göre kurulmuş uygulama.
Yeni üyeleri, mevcut sicildeki en uygun 3-5 kişiyle otomatik ve karşılıklı
gerekçeli şekilde eşleştirir.

## Mimari Özeti

```
Başvuru formu → INSERT (members) → Embedding üret (OpenAI)
   → pgvector ön filtreleme (en yakın 15-20 aday, LLM yok)
   → Claude ile ince eleme (top 3-5 + karşılıklı gerekçe)
   → matches tablosuna yaz → dashboard'da göster → geri bildirim topla
```

Detay için proje kökündeki `jci-bursa-mimari-brief.md`'ye bakın.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **Supabase** (Postgres + `pgvector`)
- **OpenAI** `text-embedding-3-small` — embedding üretimi
- **Claude API** (`claude-sonnet-4-6`) — ince eleme / eşleştirme gerekçesi

## Kurulum

### 1. Bağımlılıklar

Bu makinede Node.js kurulu değildi; proje [nodejs.org](https://nodejs.org)'dan
**Node.js 22 LTS** ile test edildi. Kalıcı kurulum için:

```bash
brew install node@22
```

veya [nvm](https://github.com/nvm-sh/nvm) kullanıyorsan:

```bash
nvm install 22 && nvm use 22
```

Sonra proje bağımlılıklarını kur:

```bash
npm install
```

### 2. Supabase projesi

1. [supabase.com](https://supabase.com)'da yeni proje oluştur.
2. Proje ayarları > API sayfasından `Project URL`, `anon public` key ve
   `service_role` key'i al.
3. `.env.example` dosyasını `.env.local` olarak kopyala ve değerleri doldur:

   ```bash
   cp .env.example .env.local
   ```

4. Migration'ları çalıştır. Supabase SQL Editor'de sırasıyla:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_match_candidates_fn.sql`

   (Supabase CLI kuruluysa: `supabase db push` ile de uygulanabilir.)

### 3. API anahtarları

- `OPENAI_API_KEY` — [platform.openai.com](https://platform.openai.com) (embedding için zorunlu)
- `ANTHROPIC_API_KEY` — [console.anthropic.com](https://console.anthropic.com) (sadece `ENABLE_AI_REFINEMENT=true` iken zorunlu)

**Aşama 4 (ince eleme) modu:** `ENABLE_AI_REFINEMENT=false` (varsayılan) iken
Claude'a hiç gidilmez; pgvector'ün bulduğu ilk 5 aday, ham `offers`
metinleriyle ve similarity'den ölçeklenmiş bir `strength` (1-5) ile
doğrudan `matches` tablosuna yazılır (bkz. [src/lib/naive-matches.ts](src/lib/naive-matches.ts)).
`true` yapıp `ANTHROPIC_API_KEY`'i doldurunca hiçbir kod değişikliği
gerekmeden Claude ile karşılıklı gerekçeli ince eleme ([src/lib/refine-matches.ts](src/lib/refine-matches.ts)) devreye girer.

### 4. Geliştirme sunucusu

```bash
npm run dev
```

- `/basvuru` — üye başvuru formu (kayıt + anlık eşleştirme sonucu)
- `/dashboard?member=<id>` — bir üyenin eşleşmelerini ve geri bildirim
  butonlarını gösterir

## Proje Yapısı

```
supabase/migrations/          SQL şema + match_candidates() RPC fonksiyonu
src/lib/supabase-admin.ts     Service-role Supabase client (server-only)
src/lib/embeddings.ts         OpenAI ile profile/need embedding üretimi
src/lib/match-candidates.ts   pgvector ön filtreleme (Aşama 3)
src/lib/refine-matches.ts     Claude ile ince eleme (Aşama 4, KVKK guard'lı)
src/lib/kvkk-guard.ts         LLM payload'ında `name` sızıntısını engeller
src/app/api/members/route.ts  Kayıt → embedding → filtreleme → ince eleme akışı
src/app/api/feedback/route.ts "Faydalı mıydı?" geri bildirimi
src/app/basvuru/page.tsx      Başvuru formu
src/app/dashboard/page.tsx    Eşleşmeler + geri bildirim UI
scripts/kvkk-check.ts         KVKK testi (npm run kvkk:check)
```

## KVKK Notu

LLM'e (Claude) gönderilen hiçbir payload'da `name` alanı **bulunmaz** —
sadece `registry_no` kullanılır. İsim eşleştirmesi tamamen backend'de
(`/api/members/route.ts` içinde, LLM dışında) yapılır. Bunu doğrulamak için:

```bash
npm run kvkk:check
```

Bu test, `AnonymizedMember` tipinin derleme zamanında `name` alanı
içermediğini ve `assertNoNameLeak` guard'ının bir sızıntı durumunda
hata fırlattığını doğrular.

## Bilinen Sınırlamalar / v2 Fikirleri

- `match_feedback` verisi büyüdükçe sinyal ağırlıkları (sektör benzerliği vs.
  ihtiyaç-arz eşleşmesi) elle gözden geçirilip kalibre edilebilir (brief §6).
- `ivfflat` index'i üye sayısı arttıkça `lists` parametresi ile yeniden
  ayarlanabilir/`reindex` edilebilir.
- Şu an kayıt sırasında eşleştirme senkron çalışıyor; üye sayısı arttıkça
  bu adım bir background job/queue'ya taşınabilir.
