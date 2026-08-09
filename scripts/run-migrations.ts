/**
 * supabase/migrations/*.sql dosyalarını sırayla, doğrudan Postgres
 * bağlantısı üzerinden çalıştırır. Supabase SQL Editor'e elle yapıştırma
 * ihtiyacını ortadan kaldırmak için var.
 *
 * Kullanım:
 *   DATABASE_URL="postgresql://postgres:<şifre>@db.<ref>.supabase.co:5432/postgres?sslmode=require" \
 *     npx tsx scripts/run-migrations.ts
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL ortam değişkeni tanımlı değil.");
    process.exit(1);
  }

  const dir = path.join(__dirname, "..", "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // connectionString'i elle parse edip ssl'i biz kontrol ediyoruz — pg,
  // URL'deki sslmode'u kendi ssl config'imizin önüne geçirip Supabase
  // pooler'ının self-signed sertifikasını reddedebiliyor.
  const u = new URL(connectionString);
  const client = new Client({
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), "utf-8");
      console.log(`→ Çalıştırılıyor: ${file}`);
      await client.query(sql);
      console.log(`✅ Tamamlandı: ${file}`);
    }
    console.log("\nTüm migration'lar başarıyla uygulandı.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration hatası:", err.message);
  process.exit(1);
});
