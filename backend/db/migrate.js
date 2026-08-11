const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const KLASOR = path.join(__dirname, "migrations");

async function calistir() {
  if (!process.env.DB_NAME) {
    console.error(
      "[migrate] DB_NAME tanimli degil. .env dosyasini kontrol edin.",
    );
    process.exit(1);
  }

  const baglanti = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    multipleStatements: true,
  });

  console.log(`[migrate] Veritabani: ${process.env.DB_NAME}`);

  try {
    await baglanti.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        surum VARCHAR(255) NOT NULL PRIMARY KEY,
        uygulanma_tarihi TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [kayitlar] = await baglanti.query(
      "SELECT surum FROM schema_migrations",
    );
    const uygulandi = new Set(kayitlar.map((r) => r.surum));

    const dosyalar = fs
      .readdirSync(KLASOR)
      .filter((ad) => ad.endsWith(".sql"))
      .sort();

    const bekleyenler = dosyalar.filter((ad) => !uygulandi.has(ad));

    if (!bekleyenler.length) {
      console.log(`[migrate] Veritabani guncel (${dosyalar.length} surum).`);
      return;
    }

    console.log(`[migrate] ${bekleyenler.length} bekleyen surum var.`);

    for (const ad of bekleyenler) {
      const sql = fs.readFileSync(path.join(KLASOR, ad), "utf8");
      process.stdout.write(`[migrate] ${ad} ... `);

      // MySQL'de DDL ifadeleri ortuk commit uretir; transaction icine
      // alinsa bile bir surum yarida kalirsa geri alinamaz. Bu yuzden her
      // dosya tek bir mantiksal degisiklikle sinirli tutulmali ve
      // calistirmadan once yedek alinmali.
      await baglanti.query(sql);
      await baglanti.query("INSERT INTO schema_migrations (surum) VALUES (?)", [
        ad,
      ]);

      console.log("tamam");
    }

    console.log("[migrate] Bitti.");
  } finally {
    await baglanti.end();
  }
}

calistir().catch((hata) => {
  console.error("[migrate] HATA:", hata.message);
  process.exit(1);
});
