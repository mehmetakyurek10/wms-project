import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { urunleriGetir, urunEkle, urunGuncelle, urunSil } from "../api/urunApi";
import { kategorileriGetir } from "../api/kategoriApi";
import { useToast } from "../context/ToastContext";
import OnayModal from "../components/OnayModal";

const SAYFA_BOYUTU = 5;

function Urunler() {
  const bildir = useToast();
  const [urunler, setUrunler] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [arama, setArama] = useState("");
  const [aranan, setAranan] = useState("");
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);
  const [form, setForm] = useState({
    ad: "",
    kategori_id: "",
    miktar: "",
    birim: "kg",
    kritik_seviye: "",
  });
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlemeForm, setDuzenlemeForm] = useState({});
  const [silinecek, setSilinecek] = useState(null);

  const toplamSayfa = Math.ceil(toplam / SAYFA_BOYUTU);

  const veriGetir = async () => {
    try {
      const [urunRes, kategoriRes] = await Promise.all([
        urunleriGetir({ ara: aranan || undefined, sayfa, limit: SAYFA_BOYUTU }),
        kategorileriGetir(),
      ]);
      setUrunler(urunRes.data);
      setToplam(parseInt(urunRes.headers["x-toplam-kayit"], 10) || 0);
      setKategoriler(kategoriRes.data);
    } catch (err) {
      setHata("Ürünler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      setAranan(arama);
      setSayfa(1);
    }, 400);
    return () => clearTimeout(zamanlayici);
  }, [arama]);

  useEffect(() => {
    veriGetir();
  }, [aranan, sayfa]);

  const kategoriAdi = (id) => kategoriler.find((k) => k.id === id)?.ad || "-";

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await urunEkle(form);
      setForm({
        ad: "",
        kategori_id: "",
        miktar: "",
        birim: "kg",
        kritik_seviye: "",
      });
      bildir("Ürün eklendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Ürün eklenemedi", "hata");
    }
  };

  const duzenlemeyeBasla = (urun) => {
    setDuzenlenenId(urun.id);
    setDuzenlemeForm({
      ad: urun.ad,
      kategori_id: urun.kategori_id || "",
      miktar: urun.miktar,
      birim: urun.birim,
      kritik_seviye: urun.kritik_seviye,
    });
  };

  const duzenlemeKaydet = async (id) => {
    try {
      await urunGuncelle(id, duzenlemeForm);
      setDuzenlenenId(null);
      bildir("Ürün güncellendi");
      veriGetir();
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
        veriGetir();
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
  if (hata) return <p className="hata-metni">{hata}</p>;

  return (
    <div>
      <h2>Ürünler</h2>

      <form onSubmit={handleSubmit}>
        <input
          name="ad"
          placeholder="Ürün adı"
          value={form.ad}
          onChange={handleChange}
          required
        />
        <select
          name="kategori_id"
          value={form.kategori_id}
          onChange={handleChange}
        >
          <option value="">Kategori seç</option>
          {kategoriler.map((k) => (
            <option key={k.id} value={k.id}>
              {k.ad}
            </option>
          ))}
        </select>
        <input
          name="miktar"
          type="number"
          step="0.01"
          placeholder="Miktar"
          value={form.miktar}
          onChange={handleChange}
        />
        <input
          name="birim"
          placeholder="Birim"
          value={form.birim}
          onChange={handleChange}
        />
        <input
          name="kritik_seviye"
          type="number"
          step="0.01"
          placeholder="Kritik seviye"
          value={form.kritik_seviye}
          onChange={handleChange}
        />
        <button type="submit">Ekle</button>
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
                <th>Miktar</th>
                <th>Birim</th>
                <th>Kritik Seviye</th>
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
                        <option value="">Kategori seç</option>
                        {kategoriler.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.ad}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={duzenlemeForm.miktar}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            miktar: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={duzenlemeForm.birim}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            birim: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={duzenlemeForm.kritik_seviye}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            kritik_seviye: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <button onClick={() => duzenlemeKaydet(urun.id)}>
                        Kaydet
                      </button>
                      <button onClick={() => setDuzenlenenId(null)}>
                        İptal
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={urun.id}
                    className={
                      parseFloat(urun.miktar) <= parseFloat(urun.kritik_seviye)
                        ? "kritik"
                        : ""
                    }
                  >
                    <td>{urun.ad}</td>
                    <td>{kategoriAdi(urun.kategori_id)}</td>
                    <td>{urun.miktar}</td>
                    <td>{urun.birim}</td>
                    <td>{urun.kritik_seviye}</td>
                    <td>
                      <button onClick={() => duzenlemeyeBasla(urun)}>
                        Düzenle
                      </button>
                      <button
                        onClick={() => setSilinecek(urun)}
                        className="tehlike"
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
        mesaj={`"${silinecek?.ad}" ürünü kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default Urunler;
