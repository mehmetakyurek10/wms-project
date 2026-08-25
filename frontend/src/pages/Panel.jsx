import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Package, AlertTriangle, Truck, ShoppingCart } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { urunleriGetir } from "../api/urunApi";
import { dusukStokGetir, varyantlariGetir } from "../api/varyantApi";
import { tedarikcileriGetir } from "../api/tedarikciApi";
import { siparisleriGetir } from "../api/satinalmaApi";
import { panelGrafikleri } from "../api/dashboardApi";
import useTema from "../hooks/useTema";
import useFetch from "../hooks/useFetch";
import ErrorState from "../components/ErrorState";

const RENK_GIRIS = "#22c55e";
const RENK_CIKIS = "#ef4444";
const RENK_BAR = "#3b82f6";
const RENK_DOLULUK = "#f59e0b";

const gunEtiketi = (gun) => {
  const [, ay, gunNo] = gun.split("-");
  return `${gunNo}.${ay}`;
};

const sayiBicimle = (deger) => Number(deger).toLocaleString("tr-TR");

const basliktanSayi = (response) =>
  parseInt(response.headers["x-toplam-kayit"], 10) || 0;

const BOS_PANEL = {
  sayaclar: { urun: 0, varyant: 0, dusukStok: 0, tedarikci: 0, bekleyen: 0 },
  dusukListe: [],
  grafik: null,
};

// Sayaclar icin tum liste indirilmiyor: limit 1 gonderilip toplam
// X-Toplam-Kayit basligindan okunuyor. Aksi halde sunucunun 500 kayitlik
// varsayilan siniri sayaci sessizce 500'de dondururdu.
const panelVerisiGetir = async () => {
  const [urunRes, varyantRes, dusukRes, tedarikciRes, bekleyenRes, grafikRes] =
    await Promise.all([
      urunleriGetir({ limit: 1 }),
      varyantlariGetir({ limit: 1 }),
      dusukStokGetir(),
      tedarikcileriGetir({ limit: 1 }),
      siparisleriGetir({ bekleyen: 1, limit: 1 }),
      panelGrafikleri(),
    ]);

  return {
    data: {
      sayaclar: {
        urun: basliktanSayi(urunRes),
        varyant: basliktanSayi(varyantRes),
        dusukStok: dusukRes.data.length,
        tedarikci: basliktanSayi(tedarikciRes),
        bekleyen: basliktanSayi(bekleyenRes),
      },
      dusukListe: dusukRes.data,
      grafik: grafikRes.data,
    },
  };
};

function Panel() {
  const { renkler } = useTema();

  const grafikStili = useMemo(
    () => ({
      eksen: { fill: renkler.metinSoluk, fontSize: 12 },
      izgara: renkler.kenar,
      ipucu: {
        background: renkler.yuzey,
        border: `1px solid ${renkler.kenar}`,
        borderRadius: 8,
        color: renkler.metin,
      },
    }),
    [renkler],
  );

  const {
    data: panel,
    loading: yukleniyor,
    error: hata,
    refresh: veriGetir,
  } = useFetch(panelVerisiGetir, [], {
    initial: BOS_PANEL,
    errorMessage: "Panel verileri yüklenemedi",
  });

  const veri = panel.sayaclar;
  const dusukListe = panel.dusukListe;
  const grafik = panel.grafik;

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <ErrorState mesaj={hata} tekrarDene={veriGetir} />;

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
      link: "/varyantlar?sadece_dusuk=1",
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

  const gunluk = grafik?.gunlukHareketler ?? [];
  const enCok = grafik?.enCokHareket ?? [];
  const doluluk = grafik?.lokasyonDoluluk ?? [];
  const gunlukBos = gunluk.every((g) => g.giris === 0 && g.cikis === 0);

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

      <h2 className="bolum-basligi">
        Son {grafik?.gunSayisi ?? 14} Gün · Giriş / Çıkış
      </h2>
      {gunlukBos ? (
        <div className="bos-durum">Bu dönemde stok hareketi yok.</div>
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart
              data={gunluk}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={grafikStili.izgara}
              />
              <XAxis
                dataKey="gun"
                tickFormatter={gunEtiketi}
                tick={grafikStili.eksen}
              />
              <YAxis tick={grafikStili.eksen} />
              <Tooltip
                labelFormatter={gunEtiketi}
                formatter={(deger) => sayiBicimle(deger)}
                contentStyle={grafikStili.ipucu}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="giris"
                name="Giriş"
                stroke={RENK_GIRIS}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="cikis"
                name="Çıkış"
                stroke={RENK_CIKIS}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2 className="bolum-basligi">En Çok Hareket Gören Stok Kalemleri</h2>
      {enCok.length === 0 ? (
        <div className="bos-durum">Bu dönemde hareket yok.</div>
      ) : (
        <div style={{ width: "100%", height: 40 * enCok.length + 60 }}>
          <ResponsiveContainer>
            <BarChart
              data={enCok}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={grafikStili.izgara}
              />
              <XAxis
                type="number"
                tick={grafikStili.eksen}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="ad"
                width={170}
                tick={grafikStili.eksen}
                interval={0}
              />
              <Tooltip
                formatter={(deger) => [sayiBicimle(deger), "Hareket"]}
                contentStyle={grafikStili.ipucu}
              />
              <Bar
                dataKey="hareket_sayisi"
                name="Hareket"
                fill={RENK_BAR}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h2 className="bolum-basligi">Bölgelere Göre Stok Dağılımı</h2>
      {doluluk.length === 0 ? (
        <div className="bos-durum">Depoda stok bulunmuyor.</div>
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart
              data={doluluk}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={grafikStili.izgara}
              />
              <XAxis dataKey="bolge" tick={grafikStili.eksen} interval={0} />
              <YAxis tick={grafikStili.eksen} />
              <Tooltip
                formatter={(deger) => [sayiBicimle(deger), "Adet"]}
                contentStyle={grafikStili.ipucu}
              />
              <Bar
                dataKey="miktar"
                name="Adet"
                fill={RENK_DOLULUK}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

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
