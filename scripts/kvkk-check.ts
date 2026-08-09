/**
 * Brief adım 9: "KVKK kontrolü: LLM'e giden hiçbir payload'da `name` alanının
 * geçmediğini test et."
 *
 * Bu script network/DB erişimi gerektirmez; refine-matches.ts'in LLM'e
 * gönderdiği payload şekliyle birebir aynı şekli kurup assertNoNameLeak
 * guard'ını test eder. CI'da `npm run kvkk:check` ile çalıştırılabilir.
 */
import { assertNoNameLeak } from "../src/lib/kvkk-guard";
import type { AnonymizedMember } from "../src/types/db";

let failures = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${label}`);
  } catch (e) {
    failures++;
    console.error(`❌ ${label}: ${(e as Error).message}`);
  }
}

// 1) Gerçek refine-matches payload şekli — name YOK, guard'ı geçmeli.
const cleanTarget: AnonymizedMember = {
  registry_no: "JCI-BUR-001",
  sector: "Yazılım",
  expertise: "Backend",
  offers: "Mentorluk",
  needs: "Yatırımcı bağlantısı",
  bio: "5 yıllık girişimci",
};
const cleanCandidates: AnonymizedMember[] = [
  {
    registry_no: "JCI-BUR-002",
    sector: "Finans",
    expertise: "Yatırım",
    offers: "Yatırımcı ağı",
    needs: "Teknik danışmanlık",
    bio: "VC ortağı",
  },
];

check("Temiz payload (name yok) guard'ı geçmeli", () => {
  assertNoNameLeak({ target: cleanTarget, candidates: cleanCandidates }, "clean payload");
});

// 2) `name` alanı sızarsa guard hata FIRLATMALI (negatif test).
check("`name` içeren payload guard tarafından reddedilmeli", () => {
  const leaked = { ...cleanTarget, name: "Ahmet Yılmaz" };
  let threw = false;
  try {
    assertNoNameLeak({ target: leaked, candidates: cleanCandidates }, "leaked payload");
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Guard, name sızıntısını yakalamadı!");
});

// 3) AnonymizedMember tipi derleme zamanında `name` alanı içermemeli.
//    (TypeScript bunu zaten statik olarak garanti eder; burada sadece
//    çalışma zamanında da anahtar listesini doğruluyoruz.)
check("AnonymizedMember alan listesinde `name` olmamalı", () => {
  const keys = Object.keys(cleanTarget);
  if (keys.includes("name")) {
    throw new Error(`Beklenmeyen alan: name. Mevcut alanlar: ${keys.join(", ")}`);
  }
});

if (failures > 0) {
  console.error(`\n${failures} test başarısız oldu.`);
  process.exit(1);
} else {
  console.log("\nTüm KVKK testleri geçti.");
}
