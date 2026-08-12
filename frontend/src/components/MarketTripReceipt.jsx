import { Printer, MessageCircle, X } from "lucide-react";
import Modal from "./Modal";

function paraFormat(sayi) {
  return Number(sayi).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Sunucudan "2026-08-10" biciminde metin geliyor. new Date() ile
// ayristirmak zaman dilimi kaymasi riski tasidigi icin metin dogrudan
// parcalaniyor.
function tarihYaz(metin) {
  if (!metin) return "";
  return metin.slice(0, 10).split("-").reverse().join(".");
}

function MarketTripReceipt({ acik, sefer, kalemler, kapat }) {
  if (!sefer) return null;

  const tamamlandi = sefer.durum === "tamamlandi";
  const pazarAdi = sefer.pazar_adi || sefer.pazar_kod;

  const satirlar = kalemler.map((kalem) => {
    const giden = Number(kalem.giden_miktar);
    const donen = Number(kalem.donen_miktar ?? 0);
    const satilan = tamamlandi ? giden - donen : 0;

    return {
      ...kalem,
      giden,
      donen,
      satilan,
      hasilat: satilan * Number(kalem.perakende_fiyat || 0),
    };
  });

  const toplamGiden = satirlar.reduce((t, s) => t + s.giden, 0);
  const toplamSatilan = satirlar.reduce((t, s) => t + s.satilan, 0);
  const toplamHasilat = satirlar.reduce((t, s) => t + s.hasilat, 0);

  const whatsappMetni = () => {
    const urunler = satirlar.map((s) =>
      tamamlandi
        ? `- ${s.urun_adi} ${s.boy}\n  Giden ${s.giden.toFixed(0)} · Dönen ${s.donen.toFixed(0)} · Satılan ${s.satilan.toFixed(0)}`
        : `- ${s.urun_adi} ${s.boy} ${Number(s.ambalaj_kg)}kg ${s.ambalaj_tipi}\n  ${s.giden.toFixed(0)} adet`,
    );

    return [
      `PAZAR SEVK FİŞİ ${sefer.fis_no}`,
      `Pazar: ${pazarAdi}`,
      `Tarih: ${tarihYaz(sefer.cikis_tarihi)}`,
      "",
      ...urunler,
      "",
      tamamlandi
        ? `SATILAN: ${toplamSatilan.toFixed(0)} adet`
        : `TOPLAM: ${toplamGiden.toFixed(0)} adet`,
    ].join("\n");
  };

  const whatsappGonder = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(whatsappMetni())}`,
      "_blank",
    );
  };

  return (
    <Modal
      acik={acik}
      kapat={kapat}
      baslik={`Pazar sevk fişi ${sefer.fis_no}`}
      temelSinif="fis"
    >
      <div className="fis-baslik">
        <div>
          <h3>PAZAR SEVK FİŞİ</h3>
          <span className="fis-no">{sefer.fis_no}</span>
        </div>
        <button className="ikincil ikon-btn fis-kapat" onClick={kapat}>
          <X size={16} />
        </button>
      </div>

      <div className="fis-bilgi">
        <div>
          <span>Pazar</span>
          <strong>{pazarAdi}</strong>
        </div>
        <div>
          <span>Çıkış</span>
          <strong>{tarihYaz(sefer.cikis_tarihi)}</strong>
        </div>
        <div>
          <span>Durum</span>
          <strong>{tamamlandi ? "Tamamlandı" : "Yolda"}</strong>
        </div>
      </div>

      <table className="fis-tablo">
        <thead>
          <tr>
            <th>Ürün</th>
            <th>Giden</th>
            {tamamlandi && <th>Dönen</th>}
            {tamamlandi && <th>Satılan</th>}
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => (
            <tr key={s.varyant_id}>
              <td>
                {s.urun_adi}
                <div className="fis-alt-bilgi">
                  {s.boy} · {Number(s.ambalaj_kg)}kg {s.ambalaj_tipi}
                </div>
              </td>
              <td>{s.giden.toFixed(0)}</td>
              {tamamlandi && <td>{s.donen.toFixed(0)}</td>}
              {tamamlandi && <td>{s.satilan.toFixed(0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="fis-toplam">
        <span>{tamamlandi ? "Satılan toplam" : "Götürülen toplam"}</span>
        <strong>
          {tamamlandi
            ? `${toplamSatilan.toFixed(0)} adet`
            : `${toplamGiden.toFixed(0)} adet`}
        </strong>
      </div>

      {tamamlandi && (
        <div className="fis-toplam">
          <span>Tahmini hasılat</span>
          <strong>{paraFormat(toplamHasilat)} ₺</strong>
        </div>
      )}

      <div className="fis-aksiyon">
        <button className="ikincil" onClick={() => window.print()}>
          <Printer size={15} /> Yazdır
        </button>
        <button onClick={whatsappGonder}>
          <MessageCircle size={15} /> WhatsApp ile Gönder
        </button>
      </div>
    </Modal>
  );
}

export default MarketTripReceipt;
