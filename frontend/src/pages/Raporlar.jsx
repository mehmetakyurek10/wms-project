import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Wrench,
  ShoppingCart,
} from "lucide-react";
import { gunlukRapor } from "../api/raporApi";
import Etiket from "../components/Etiket";

const bugun = () => new Date().toISOString().slice(0, 10);

function Raporlar() {
  const [baslangic, setBaslangic] = useState(bugun());
  const [bitis, setBitis] = useState(bugun());
  const [rapor, setRapor] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");

  const veriGetir = async () => {
    setYukleniyor(true);
    try {
      const response = await gunlukRapor({ baslangic, bitis });
      setRapor(response.data);
      setHata("");
    } catch (err) {
      setHata("Rapor yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, [baslangic, bitis]);

  const ozetBul = (tip) =>
    rapor?.ozet.find((o) => o.tip === tip) || {
      islem_sayisi: 0,
      toplam_miktar: 0,
    };

  if (hata) return <p className="hata-metni">{hata}</p>;

  const kartlar = rapor
    ? [
        {
          baslik: "Giriş",
          deger: ozetBul("giris").islem_sayisi,
          alt: `${ozetBul("giris").toplam_miktar} adet`,
          ikon: <ArrowDownToLine size={22} />,
          renk: "yesil",
        },
        {
          baslik: "Çıkış",
          deger: ozetBul("cikis").islem_sayisi,
          alt: `${ozetBul("cikis").toplam_miktar} adet`,
          ikon: <ArrowUpFromLine size={22} />,
          renk: "kirmizi",
        },
        {
          baslik: "Düzeltme",
          deger: ozetBul("duzeltme").islem_sayisi,
          alt: `${ozetBul("duzeltme").toplam_miktar} adet`,
          ikon: <Wrench size={22} />,
          renk: "turuncu",
        },
        {
          baslik: "Satınalma",
          deger: rapor.siparis.adet,
          alt: `${Number(rapor.siparis.tutar).toLocaleString("tr-TR")} ₺`,
          ikon: <ShoppingCart size={22} />,
          renk: "mavi",
        },
      ]
    : [];

  return (
    <div>
      <h2>Raporlar</h2>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="form-alan">
          <label>Başlangıç</label>
          <input
            type="date"
            value={baslangic}
            onChange={(e) => setBaslangic(e.target.value)}
          />
        </div>
        <div className="form-alan">
          <label>Bitiş</label>
          <input
            type="date"
            value={bitis}
            onChange={(e) => setBitis(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="ikincil"
          onClick={() => {
            setBaslangic(bugun());
            setBitis(bugun());
          }}
        >
          Bugün
        </button>
      </form>

      {yukleniyor ? (
        <div className="yukleniyor-kutu">
          <div className="spinner" />
          <span>Yükleniyor...</span>
        </div>
      ) : (
        <>
          <div className="kart-grid">
            {kartlar.map((k) => (
              <div key={k.baslik} className={`kart kart-${k.renk}`}>
                <div className="kart-ikon">{k.ikon}</div>
                <div>
                  <div className="kart-deger">{k.deger}</div>
                  <div className="kart-baslik">
                    {k.baslik} · {k.alt}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="bolum-basligi">Çalışan Bazlı İşlemler</h2>
          {rapor.kullanicilar.length === 0 ? (
            <div className="bos-durum">Bu tarih aralığında işlem yok.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Çalışan</th>
                  <th>Toplam İşlem</th>
                  <th>Giriş</th>
                  <th>Çıkış</th>
                  <th>Düzeltme</th>
                </tr>
              </thead>
              <tbody>
                {rapor.kullanicilar.map((k) => (
                  <tr key={k.kullanici_adi}>
                    <td>{k.kullanici_adi}</td>
                    <td>{k.islem_sayisi}</td>
                    <td>{k.giris}</td>
                    <td>{k.cikis}</td>
                    <td>{k.duzeltme}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="bolum-basligi">En Çok Hareket Gören Stok Kalemleri</h2>
          {rapor.kalemler.length === 0 ? (
            <div className="bos-durum">Bu tarih aralığında hareket yok.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Varyant</th>
                  <th>Hareket</th>
                  <th>Toplam Giriş</th>
                  <th>Toplam Çıkış</th>
                </tr>
              </thead>
              <tbody>
                {rapor.kalemler.map((k, i) => (
                  <tr key={i}>
                    <td>{k.urun_adi}</td>
                    <td>
                      {k.boy} · {k.ambalaj_kg}kg {k.ambalaj_tipi}
                    </td>
                    <td>{k.hareket_sayisi}</td>
                    <td>{k.toplam_giris}</td>
                    <td>{k.toplam_cikis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default Raporlar;
