import { Printer, MessageCircle, X } from "lucide-react";

function paraFormat(sayi) {
  return Number(sayi).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Fis({ acik, tip, siparis, kalemler, kapat }) {
  if (!acik || !siparis) return null;

  const satis = tip === "satis";
  const baslik = satis ? "SATIŞ FİŞİ" : "ALIM FİŞİ";
  const cariEtiket = satis ? "Müşteri" : "Tedarikçi";
  const cariAdi = satis ? siparis.musteri_adi : siparis.tedarikci_adi;
  const telefon = satis ? siparis.musteri_telefon : siparis.tedarikci_telefon;
  const tarih = new Date(siparis.siparis_tarihi).toLocaleDateString("tr-TR");

  const toplam = kalemler.reduce(
    (t, k) => t + Number(k.miktar) * Number(k.birim_fiyat),
    0,
  );

  const whatsappMetni = () => {
    const satirlar = kalemler.map(
      (k) =>
        `- ${k.urun_adi} ${k.boy} ${k.ambalaj_kg}kg ${k.ambalaj_tipi}\n  ${k.miktar} x ${paraFormat(k.birim_fiyat)} TL = ${paraFormat(Number(k.miktar) * Number(k.birim_fiyat))} TL`,
    );

    return [
      `${baslik} #${siparis.id}`,
      `Tarih: ${tarih}`,
      `${cariEtiket}: ${cariAdi}`,
      "",
      ...satirlar,
      "",
      `TOPLAM: ${paraFormat(toplam)} TL`,
    ].join("\n");
  };

  const whatsappGonder = () => {
    const metin = encodeURIComponent(whatsappMetni());
    window.open(`https://wa.me/?text=${metin}`, "_blank");
  };

  return (
    <div className="modal-perde" onClick={kapat}>
      <div className="fis" onClick={(e) => e.stopPropagation()}>
        <div className="fis-baslik">
          <div>
            <h3>{baslik}</h3>
            <span className="fis-no">#{siparis.id}</span>
          </div>
          <button className="ikincil ikon-btn fis-kapat" onClick={kapat}>
            <X size={16} />
          </button>
        </div>

        <div className="fis-bilgi">
          <div>
            <span>Tarih</span>
            <strong>{tarih}</strong>
          </div>
          <div>
            <span>{cariEtiket}</span>
            <strong>{cariAdi}</strong>
          </div>
          {telefon && (
            <div>
              <span>Telefon</span>
              <strong>{telefon}</strong>
            </div>
          )}
        </div>

        <table className="fis-tablo">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Miktar</th>
              <th>Birim Fiyat</th>
              <th>Tutar</th>
            </tr>
          </thead>
          <tbody>
            {kalemler.map((k) => (
              <tr key={k.id}>
                <td>
                  {k.urun_adi}
                  <div className="fis-alt-bilgi">
                    {k.boy} · {k.ambalaj_kg}kg {k.ambalaj_tipi}
                  </div>
                </td>
                <td>{k.miktar}</td>
                <td>{paraFormat(k.birim_fiyat)} ₺</td>
                <td>
                  {paraFormat(Number(k.miktar) * Number(k.birim_fiyat))} ₺
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="fis-toplam">
          <span>Genel Toplam</span>
          <strong>{paraFormat(toplam)} ₺</strong>
        </div>

        <div className="fis-aksiyon">
          <button className="ikincil" onClick={() => window.print()}>
            <Printer size={15} /> Yazdır
          </button>
          <button onClick={whatsappGonder}>
            <MessageCircle size={15} /> WhatsApp ile Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

export default Fis;
