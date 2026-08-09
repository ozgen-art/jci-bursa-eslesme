import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Ana dizinde (ör. ~/package-lock.json) yanlışlıkla oluşabilecek bir
  // lockfile yüzünden Next.js'in workspace root'unu yanlış algılamasını
  // önlemek için proje kökünü açıkça belirtiyoruz.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
