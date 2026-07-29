import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, AlertTriangle, Truck, ShoppingCart } from "lucide-react";
import { urunleriGetir } from "../api/urunApi";
import { dusukStokGetir, varyantlariGetir } from "../api/varyantApi";
import { tedarikcileriGetir } from "../api/tedarikciApi";
import { siparisleriGetir } from "../api/satinalmaApi";

function Panel() {
  const [veri, setVeri] = useState({
    urun: 0,
    varyant: 0,
    dusukStok: 0,
    tedarikci: 0,
    bekleyen: 0,
  });
  const [dusukListe, setDusukListe] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const veriGetir = async () => {
      try {
        const [urunRes, varyantRes, dusukRes, tedarikciRes, siparisRes] =
          await Promise.all([
            urunleriGetir(),
            varyantlariGetir(),
            dusukStokGetir(),
            tedarikcileriGetir(),
            siparisleriGetir(),
          ]);
        setVeri({
          urun: urunRes.data.length,
          varyant: varyantRes.data.length,
          dusukStok: dusukRes.data.length,
          tedarikci: tedarikciRes.data.length,
          bekleyen: siparisRes.data.filter(
            (s) => s.durum !== "teslim_alindi" && s.durum !== "iptal",
          ).length,
        });
        setDusukListe(dusukRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setYukleniyor(false);
      }
    };
    veriGetir();
  }, []);

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );

  const kartlar = [
    {
      baslik: "Ürün Çeşidi",
      deger: veri.urun,
      ikon: <Package size={22} />,
      link: "/urunler",
      renk: "mavi",
    },
    {
      baslik: "Stok Kalemi",
      deger: veri.varyant,
      ikon: <ShoppingCart size={22} />,
      link: "/varyantlar",
      renk: "yesil",
    },
    {
      baslik: "Düşük Stok",
      deger: veri.dusukStok,
      ikon: <AlertTriangle size={22} />,
      link: "/varyantlar",
      renk: "kirmizi",
      nabiz: veri.dusukStok > 0,
    },
    {
      baslik: "Bekleyen Sipariş",
      deger: veri.bekleyen,
      ikon: <Truck size={22} />,
      link: "/satinalma-siparisleri",
      renk: "turuncu",
    },
  ];

  return (
    <div>
      <h2>Genel Bakış</h2>

      <div className="kart-grid">
        {kartlar.map((k) => (
          <Link to={k.link} key={k.baslik} className={`kart kart-${k.renk}`}>
            <div className={`kart-ikon ${k.nabiz ? "nabiz" : ""}`}>
              {k.ikon}
            </div>
            <div>
              <div className="kart-deger">{k.deger}</div>
              <div className="kart-baslik">{k.baslik}</div>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="bolum-basligi">Kritik Seviyedeki Stok Kalemleri</h2>
      {dusukListe.length === 0 ? (
        <div className="bos-durum">Kritik seviyenin altında stok yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Varyant</th>
              <th>Mevcut</th>
              <th>Kritik Seviye</th>
            </tr>
          </thead>
          <tbody>
            {dusukListe.map((v) => (
              <tr key={v.id} className="kritik">
                <td>{v.urun_adi}</td>
                <td>
                  {v.boy} · {v.ambalaj_kg}kg {v.ambalaj_tipi}
                </td>
                <td>{v.miktar}</td>
                <td>{v.kritik_seviye}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Panel;
