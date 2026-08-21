import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Wrench,
  ShoppingCart,
  Receipt,
  Download,
} from "lucide-react";
import { gunlukRapor } from "../api/raporApi";
import { yerelTarih } from "../utils/date";
import { csvIndir } from "../utils/csv";
import useFetch from "../hooks/useFetch";
import ErrorState from "../components/ErrorState";

function Raporlar() {
  const [parametreler, setParametreler] = useSearchParams();
  const bugun = yerelTarih();

  const baslangic = parametreler.get("baslangic") || bugun;
  const bitis = parametreler.get("bitis") || bugun;

  const [form, setForm] = useState({ baslangic, bitis });

  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      if (form.baslangic === baslangic && form.bitis === bitis) return;

      const sonraki = new URLSearchParams(parametreler);
      sonraki.set("baslangic", form.baslangic);
      sonraki.set("bitis", form.bitis);
      setParametreler(sonraki, { replace: true });
    }, 500);

    return () => clearTimeout(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.baslangic, form.bitis]);

  const {
    data: rapor,
    fetching: yukleniyor,
    error: hata,
    refresh: raporuYenile,
  } = useFetch(() => gunlukRapor({ baslangic, bitis }), [baslangic, bitis], {
    initial: null,
    errorMessage: "Rapor yüklenemedi",
  });

  const ozetBul = (tip) =>
    rapor?.ozet.find((o) => o.tip === tip) || {
      islem_sayisi: 0,
      toplam_miktar: 0,
    };

  if (hata) return <ErrorState mesaj={hata} tekrarDene={raporuYenile} />;

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
          deger: rapor.satinalma.adet,
          alt: `${Number(rapor.satinalma.tutar).toLocaleString("tr-TR")} ₺`,
          ikon: <ShoppingCart size={22} />,
          renk: "mavi",
        },
        {
          baslik: "Satış",
          deger: rapor.satis.adet,
          alt: `${Number(rapor.satis.tutar).toLocaleString("tr-TR")} ₺`,
          ikon: <Receipt size={22} />,
          renk: "mor",
        },
      ]
    : [];

  const dosyaEki = baslangic === bitis ? baslangic : `${baslangic}_${bitis}`;

  const calisanlariAktar = () => {
    csvIndir(
      `calisan-islemleri-${dosyaEki}.csv`,
      ["Çalışan", "Toplam İşlem", "Giriş", "Çıkış", "Düzeltme"],
      rapor.kullanicilar.map((k) => [
        k.kullanici_adi,
        k.islem_sayisi,
        k.giris,
        k.cikis,
        k.duzeltme,
      ]),
    );
  };

  const kalemleriAktar = () => {
    csvIndir(
      `stok-kalemleri-${dosyaEki}.csv`,
      ["Ürün", "Boy", "Ambalaj", "Hareket", "Toplam Giriş", "Toplam Çıkış"],
      rapor.kalemler.map((k) => [
        k.urun_adi,
        k.boy,
        `${k.ambalaj_kg}kg ${k.ambalaj_tipi}`,
        k.hareket_sayisi,
        k.toplam_giris,
        k.toplam_cikis,
      ]),
    );
  };

  return (
    <div>
      <h2>Raporlar</h2>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="form-alan">
          <label>Başlangıç</label>
          <input
            type="date"
            value={form.baslangic}
            onChange={(e) => setForm({ ...form, baslangic: e.target.value })}
          />
        </div>
        <div className="form-alan">
          <label>Bitiş</label>
          <input
            type="date"
            value={form.bitis}
            onChange={(e) => setForm({ ...form, bitis: e.target.value })}
          />
        </div>
        <button
          type="button"
          className="ikincil"
          onClick={() => setForm({ baslangic: bugun, bitis: bugun })}
        >
          Bugün
        </button>
      </form>

      {yukleniyor || !rapor ? (
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
            <>
              <div className="filtre-cubugu">
                <button
                  type="button"
                  className="ikincil"
                  onClick={calisanlariAktar}
                >
                  <Download size={15} />
                  CSV indir
                </button>
              </div>
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
            </>
          )}

          <h2 className="bolum-basligi">En Çok Hareket Gören Stok Kalemleri</h2>
          {rapor.kalemler.length === 0 ? (
            <div className="bos-durum">Bu tarih aralığında hareket yok.</div>
          ) : (
            <>
              <div className="filtre-cubugu">
                <button
                  type="button"
                  className="ikincil"
                  onClick={kalemleriAktar}
                >
                  <Download size={15} />
                  CSV indir
                </button>
              </div>
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
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Raporlar;
