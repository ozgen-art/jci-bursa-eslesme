/**
 * Basit tek-şifreli admin koruması. Node.js `crypto` yerine Web Crypto
 * (`crypto.subtle`) kullanıyoruz çünkü bu, hem middleware'in çalıştığı
 * Edge runtime'da hem de normal Node runtime'da mevcut — böylece
 * middleware.ts Edge'de sorunsuz çalışır.
 *
 * Not: `server-only` buraya import edilmiyor çünkü middleware.ts Edge
 * runtime'da çalışıyor ve server-only paketi orada kullanılamıyor.
 */

export const ADMIN_COOKIE_NAME = "jci_admin_session";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Doğru şifre girildiyse cookie'ye yazılacak token'ı üretir, yanlışsa null döner. */
export async function makeAdminToken(submittedPassword: string): Promise<string | null> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || submittedPassword !== adminPassword) return null;
  return sha256Hex(adminPassword);
}

/** Bir cookie değerinin şu anki ADMIN_PASSWORD'e karşılık gelen token ile eşleşip eşleşmediğini kontrol eder. */
export async function isValidAdminToken(token: string | undefined): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || !token) return false;
  return token === (await sha256Hex(adminPassword));
}
