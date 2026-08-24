require("dotenv").config({ quiet: true });

const ZORUNLU = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];

const eksikler = ZORUNLU.filter((anahtar) => !process.env[anahtar]);

if (eksikler.length) {
  console.error(
    `[BAŞLATMA HATASI] Eksik ortam değişkenleri: ${eksikler.join(", ")}`,
  );
  console.error("backend/.env.example dosyasını örnek alın.");
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error("[BAŞLATMA HATASI] JWT_SECRET en az 32 karakter olmalıdır.");
  console.error("Üretmek için: openssl rand -base64 48");
  process.exit(1);
}

const uretim = process.env.NODE_ENV === "production";

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((k) => k.trim())
  : ["http://localhost:5173"];

// Tarayicilar Secure cerezi yalnizca guvenli kaynaklardan kabul eder.
// localhost ve 127.0.0.1 istisnadir; onlar duz HTTP olsa da guvenilir sayilir.
const guvenilirYerel = (adres) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(adres);

const cookieSecure =
  process.env.COOKIE_SECURE === undefined
    ? uretim
    : process.env.COOKIE_SECURE === "true";

const guvensizAdresler = corsOrigin.filter(
  (adres) => adres.startsWith("http://") && !guvenilirYerel(adres),
);

if (cookieSecure && guvensizAdresler.length) {
  console.error(
    `[BAŞLATMA HATASI] Çerez "secure" bayrağı açık ama uygulama HTTPS dışından yayınlanıyor: ${guvensizAdresler.join(", ")}`,
  );
  console.error(
    "Tarayıcı oturum çerezini saklamaz; kullanıcılar 15 dakikada bir giriş ekranına atılır.",
  );
  console.error(
    "Çözüm: nginx'e TLS ekleyin, ya da güvenli bir iç ağdaysanız COOKIE_SECURE=false verin.",
  );
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  ortam: process.env.NODE_ENV || "development",
  uretim,
  cookieSecure,
  corsOrigin,
};
