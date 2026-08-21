const GUN_KALIBI = /^\d{4}-\d{2}-\d{2}$/;

function yerelTarih(tarih = new Date()) {
  const yil = tarih.getFullYear();
  const ay = String(tarih.getMonth() + 1).padStart(2, "0");
  const gun = String(tarih.getDate()).padStart(2, "0");
  return `${yil}-${ay}-${gun}`;
}

function yerelZaman(tarih = new Date()) {
  const iki = (sayi) => String(sayi).padStart(2, "0");
  const saat = `${iki(tarih.getHours())}:${iki(tarih.getMinutes())}:${iki(tarih.getSeconds())}`;
  return `${yerelTarih(tarih)} ${saat}`;
}

function ertesiGun(gunMetni) {
  const [yil, ay, gun] = gunMetni.split("-").map(Number);
  return yerelTarih(new Date(yil, ay - 1, gun + 1));
}

function gecerliGunMu(deger) {
  return typeof deger === "string" && GUN_KALIBI.test(deger);
}

module.exports = { yerelTarih, yerelZaman, ertesiGun, gecerliGunMu };
