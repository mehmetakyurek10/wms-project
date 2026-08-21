import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { urunleriGetir, urunEkle, urunGuncelle, urunSil } from "../api/urunApi";
import { kategorileriGetir } from "../api/kategoriApi";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";
import OnayModal from "../components/OnayModal";
import ErrorState from "../components/ErrorState";
import { SAYFA_BOYUTU } from "../sabitler";

function Urunler() {
  const bildir = useToast();
  const [arama, setArama] = useState("");
  const [aranan, setAranan] = useState("");
  const [sayfa, setSayfa] = useState(1);
  const [form, setForm] = useState({ ad: "", kategori_id: "" });
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlemeForm, setDuzenlemeForm] = useState({});
  const [silinecek, setSilinecek] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const {
    data: urunler,
    total: toplam,
    loading: yukleniyor,
    error: hata,
    refresh: urunleriYukle,
  } = useFetch(
    () =>
      urunleriGetir({ ara: aranan || undefined, sayfa, limit: SAYFA_BOYUTU }),
    [aranan, sayfa],
    { initial: [], errorMessage: "Ürünler yüklenemedi" },
  );

  const { data: kategoriler } = useFetch(() => kategorileriGetir(), [], {
    initial: [],
    errorMessage: "Kategoriler yüklenemedi",
  });

  const toplamSayfa = Math.ceil(toplam / SAYFA_BOYUTU);

  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      setAranan(arama);
      setSayfa(1);
    }, 400);
    return () => clearTimeout(zamanlayici);
  }, [arama]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await urunEkle(form);
      setForm({ ad: "", kategori_id: "" });
      bildir("Ürün eklendi");
      urunleriYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Ürün eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  const duzenlemeyeBasla = (urun) => {
    setDuzenlenenId(urun.id);
    setDuzenlemeForm({ ad: urun.ad, kategori_id: urun.kategori_id || "" });
  };

  const duzenlemeKaydet = async (id) => {
    try {
      await urunGuncelle(id, duzenlemeForm);
      setDuzenlenenId(null);
      bildir("Ürün güncellendi");
      urunleriYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Güncellenemedi", "hata");
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await urunSil(id);
      bildir("Ürün silindi");
      if (urunler.length === 1 && sayfa > 1) {
        setSayfa(sayfa - 1);
      } else {
        urunleriYukle();
      }
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
  if (hata) return <ErrorState mesaj={hata} tekrarDene={urunleriYukle} />;

  return (
    <div>
      <h2>Ürünler (Çeşitler)</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Ürün adı</label>
          <input
            name="ad"
            placeholder="Örn. Kırma"
            value={form.ad}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-alan">
          <label>Kategori</label>
          <select
            name="kategori_id"
            value={form.kategori_id}
            onChange={handleChange}
          >
            <option value="">Seçiniz</option>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Ekleniyor..." : "Ekle"}
        </button>
      </form>

      <div className="arama-kutusu">
        <Search size={16} />
        <input
          placeholder="Ürün ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
        />
      </div>

      {urunler.length === 0 ? (
        <div className="bos-durum">
          {aranan
            ? `"${aranan}" için sonuç bulunamadı.`
            : "Henüz ürün eklenmemiş."}
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Ad</th>
                <th>Kategori</th>
                <th>Varyant</th>
                <th>Toplam Stok</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {urunler.map((urun) =>
                duzenlenenId === urun.id ? (
                  <tr key={urun.id}>
                    <td>
                      <input
                        value={duzenlemeForm.ad}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            ad: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={duzenlemeForm.kategori_id}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            kategori_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Seçiniz</option>
                        {kategoriler.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.ad}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{urun.varyant_sayisi}</td>
                    <td>{urun.toplam_stok}</td>
                    <td>
                      <button onClick={() => duzenlemeKaydet(urun.id)}>
                        Kaydet
                      </button>
                      <button
                        className="ikincil"
                        onClick={() => setDuzenlenenId(null)}
                      >
                        İptal
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={urun.id}>
                    <td>{urun.ad}</td>
                    <td>{urun.kategori_adi || "-"}</td>
                    <td>{urun.varyant_sayisi}</td>
                    <td>{urun.toplam_stok}</td>
                    <td>
                      <button onClick={() => duzenlemeyeBasla(urun)}>
                        Düzenle
                      </button>
                      <button
                        onClick={() => setSilinecek(urun)}
                        className="tehlike"
                        disabled={urun.varyant_sayisi > 0}
                        title={
                          urun.varyant_sayisi > 0
                            ? "Bu ürünün varyantları var"
                            : "Ürünü sil"
                        }
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          {toplam > SAYFA_BOYUTU && (
            <div className="sayfalama">
              <button
                onClick={() => setSayfa(sayfa - 1)}
                disabled={sayfa === 1}
              >
                Önceki
              </button>
              <span>
                Sayfa {sayfa} / {toplamSayfa} · Toplam {toplam} kayıt
              </span>
              <button
                onClick={() => setSayfa(sayfa + 1)}
                disabled={sayfa >= toplamSayfa}
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}

      <OnayModal
        acik={silinecek !== null}
        baslik="Ürünü sil"
        mesaj={`"${silinecek?.ad}" ürünü silinecek.`}
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default Urunler;
