import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, AlertTriangle, Truck, ShoppingCart } from "lucide-react";
import { urunleriGetir, dusukStokGetir } from "../api/urunApi";
import { tedarikcileriGetir } from "../api/tedarikciApi";
import { siparisleriGetir } from "../api/satinalmaApi";

function Panel() {
  const [veri, setVeri] = useState({
    urun: 0,
    dusukStok: 0,
    tedarikci: 0,
    bekleyen: 0,
  });
  const [dusukListe, setDusukListe] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const veriGetir = async () => {
      try {
        const [urunRes, dusukRes, tedarikciRes, siparisRes] = await Promise.all(
          [
            urunleriGetir(),
            dusukStokGetir(),
            tedarikcileriGetir(),
            siparisleriGetir(),
          ],
        );
        setVeri({
          urun: urunRes.data.length,
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
      baslik: "Toplam Ürün",
      deger: veri.urun,
      ikon: <Package size={22} />,
      link: "/urunler",
      renk: "mavi",
    },
    {
      baslik: "Düşük Stok",
      deger: veri.dusukStok,
      ikon: <AlertTriangle size={22} />,
      link: "/urunler",
      renk: "kirmizi",
      nabiz: veri.dusukStok > 0,
    },
    {
      baslik: "Tedarikçi",
      deger: veri.tedarikci,
      ikon: <Truck size={22} />,
      link: "/tedarikciler",
      renk: "yesil",
    },
    {
      baslik: "Bekleyen Sipariş",
      deger: veri.bekleyen,
      ikon: <ShoppingCart size={22} />,
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

      <h2 style={{ marginTop: "32px" }}>Kritik Seviyedeki Ürünler</h2>
      {dusukListe.length === 0 ? (
        <div className="bos-durum">Kritik seviyenin altında ürün yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Mevcut</th>
              <th>Kritik Seviye</th>
            </tr>
          </thead>
          <tbody>
            {dusukListe.map((u) => (
              <tr key={u.id}>
                <td>{u.ad}</td>
                <td>
                  {u.miktar} {u.birim}
                </td>
                <td>
                  {u.kritik_seviye} {u.birim}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Panel;
