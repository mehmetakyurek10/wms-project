import { useEffect, useState } from "react";
import {
  tedarikcileriGetir,
  tedarikciEkle,
  tedarikciGuncelle,
  tedarikciSil,
} from "../api/tedarikciApi";
import { useToast } from "../context/ToastContext";
import OnayModal from "../components/OnayModal";

function Tedarikciler() {
  const bildir = useToast();
  const [tedarikciler, setTedarikciler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [form, setForm] = useState({
    ad: "",
    yetkili_kisi: "",
    telefon: "",
    email: "",
    adres: "",
  });
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlemeForm, setDuzenlemeForm] = useState({});
  const [silinecek, setSilinecek] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const veriGetir = async () => {
    try {
      const response = await tedarikcileriGetir();
      setTedarikciler(response.data);
    } catch (err) {
      setHata(err.response?.data?.hata || "Tedarikçiler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await tedarikciEkle(form);
      setForm({ ad: "", yetkili_kisi: "", telefon: "", email: "", adres: "" });
      bildir("Tedarikçi eklendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Tedarikçi eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  const duzenlemeyeBasla = (tedarikci) => {
    setDuzenlenenId(tedarikci.id);
    setDuzenlemeForm({
      ad: tedarikci.ad,
      yetkili_kisi: tedarikci.yetkili_kisi || "",
      telefon: tedarikci.telefon || "",
      email: tedarikci.email || "",
      adres: tedarikci.adres || "",
    });
  };

  const duzenlemeKaydet = async (id) => {
    try {
      await tedarikciGuncelle(id, duzenlemeForm);
      setDuzenlenenId(null);
      bildir("Tedarikçi güncellendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Güncellenemedi", "hata");
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await tedarikciSil(id);
      bildir("Tedarikçi silindi");
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
      <h2>Tedarikçiler</h2>

      <form onSubmit={handleSubmit}>
        <input
          name="ad"
          placeholder="Tedarikçi adı"
          value={form.ad}
          onChange={handleChange}
          required
        />
        <input
          name="yetkili_kisi"
          placeholder="Yetkili kişi"
          value={form.yetkili_kisi}
          onChange={handleChange}
        />
        <input
          name="telefon"
          placeholder="Telefon"
          value={form.telefon}
          onChange={handleChange}
        />
        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
        />
        <input
          name="adres"
          placeholder="Adres"
          value={form.adres}
          onChange={handleChange}
        />
        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Ekleniyor..." : "Ekle"}
        </button>
      </form>

      {tedarikciler.length === 0 ? (
        <div className="bos-durum">Henüz tedarikçi eklenmemiş.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Yetkili</th>
              <th>Telefon</th>
              <th>Email</th>
              <th>Adres</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {tedarikciler.map((t) =>
              duzenlenenId === t.id ? (
                <tr key={t.id}>
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
                    <input
                      value={duzenlemeForm.yetkili_kisi}
                      onChange={(e) =>
                        setDuzenlemeForm({
                          ...duzenlemeForm,
                          yetkili_kisi: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={duzenlemeForm.telefon}
                      onChange={(e) =>
                        setDuzenlemeForm({
                          ...duzenlemeForm,
                          telefon: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={duzenlemeForm.email}
                      onChange={(e) =>
                        setDuzenlemeForm({
                          ...duzenlemeForm,
                          email: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={duzenlemeForm.adres}
                      onChange={(e) =>
                        setDuzenlemeForm({
                          ...duzenlemeForm,
                          adres: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button onClick={() => duzenlemeKaydet(t.id)}>
                      Kaydet
                    </button>
                    <button onClick={() => setDuzenlenenId(null)}>İptal</button>
                  </td>
                </tr>
              ) : (
                <tr key={t.id}>
                  <td>{t.ad}</td>
                  <td>{t.yetkili_kisi}</td>
                  <td>{t.telefon}</td>
                  <td>{t.email}</td>
                  <td>{t.adres}</td>
                  <td>
                    <button onClick={() => duzenlemeyeBasla(t)}>Düzenle</button>
                    <button onClick={() => setSilinecek(t)} className="tehlike">
                      Sil
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <OnayModal
        acik={silinecek !== null}
        baslik="Tedarikçiyi sil"
        mesaj={`"${silinecek?.ad}" tedarikçisi kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default Tedarikciler;
