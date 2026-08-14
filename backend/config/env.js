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

module.exports = {
  port: Number(process.env.PORT) || 3000,
  ortam: process.env.NODE_ENV || "development",
  uretim: process.env.NODE_ENV === "production",
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((k) => k.trim())
    : ["http://localhost:5173"],
};
