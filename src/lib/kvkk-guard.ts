/**
 * KVKK koruması: LLM'e giden hiçbir payload'da `name` alanı bulunmamalı.
 * Bu, hem refine-matches.ts içinde runtime guard olarak hem de
 * scripts/kvkk-check.ts test script'inde kullanılır (bkz. brief adım 9).
 */
export function assertNoNameLeak(payload: unknown, context: string): void {
  const serialized = JSON.stringify(payload);
  // "name" anahtarını (case-insensitive) JSON key olarak arar, örn. "name":
  if (/"name"\s*:/i.test(serialized)) {
    throw new Error(
      `KVKK ihlali: "${context}" payload'ında "name" alanı tespit edildi. LLM'e isim gönderilemez.`
    );
  }
}
