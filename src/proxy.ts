import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminToken } from "@/lib/admin-auth";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function proxy(req: NextRequest) {
  // Login sayfasının kendisi her zaman erişilebilir olmalı (aksi halde
  // giriş yapacak yer kalmaz).
  if (req.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const valid = await isValidAdminToken(token);

  if (!valid) {
    // ADMIN_PASSWORD tanımsızsa da buraya düşer — yani panel varsayılan
    // olarak KAPALI, açık bırakmak için env değişkeni zorunlu.
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
