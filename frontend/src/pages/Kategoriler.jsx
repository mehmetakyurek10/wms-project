import { useEffect, useState } from "react";
import {
  kategorileriGetir,
  kategoriEkle,
  kategoriSil,
} from "../api/kategoriApi";
import { useToast } from "../context/ToastContext";
import OnayModal from "../components/OnayModal";

function Kategoriler() {
  const bildir = useToast();
  const [kategoriler, setKategoriler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [ad, setAd] = useState("");
  const [silinecek, setSilinecek] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const veriGetir = async () => {
    try {
      const response = await kategorileriGetir();
      setKategoriler(response.data);
    } catch (err) {
      setHata(err.response?.data?.hata || "Kategoriler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await kategoriEkle({ ad });
      setAd("");
      bildir("Kategori eklendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Kategori eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await kategoriSil(id);
      bildir("Kategori silindi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Silinemedi", "hata");
    }
  };

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <p className="hata-metni">{hata}</p>;

  return (
    <div>
      <h2>Kategoriler</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Kategori adı"
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          required
        />
        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Ekleniyor..." : "Ekle"}
        </button>
      </form>

      {kategoriler.length === 0 ? (
        <div className="bos-durum">Henüz kategori eklenmemiş.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Ürün Sayısı</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {kategoriler.map((kategori) => (
              <tr key={kategori.id}>
                <td>{kategori.ad}</td>
                <td>{kategori.urun_sayisi}</td>
                <td>
                  <button
                    onClick={() => setSilinecek(kategori)}
                    className="tehlike"
                    disabled={kategori.urun_sayisi > 0}
                    title={
                      kategori.urun_sayisi > 0
                        ? "Bu kategoriye bağlı ürünler var"
                        : "Kategoriyi sil"
                    }
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <OnayModal
        acik={silinecek !== null}
        baslik="Kategoriyi sil"
        mesaj={`"${silinecek?.ad}" kategorisi silinecek.`}
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default Kategoriler;
