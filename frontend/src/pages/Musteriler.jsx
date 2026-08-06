import { useState } from "react";
import {
  musterileriGetir,
  musteriEkle,
  musteriGuncelle,
  musteriSil,
} from "../api/musteriApi";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";
import OnayModal from "../components/OnayModal";

function Musteriler() {
  const bildir = useToast();
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

  const {
    data: musteriler,
    loading: yukleniyor,
    error: hata,
    refresh: veriGetir,
  } = useFetch(() => musterileriGetir(), [], {
    initial: [],
    errorMessage: "Müşteriler yüklenemedi",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await musteriEkle(form);
      setForm({ ad: "", yetkili_kisi: "", telefon: "", email: "", adres: "" });
      bildir("Müşteri eklendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Müşteri eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  const duzenlemeyeBasla = (m) => {
    setDuzenlenenId(m.id);
    setDuzenlemeForm({
      ad: m.ad,
      yetkili_kisi: m.yetkili_kisi || "",
      telefon: m.telefon || "",
      email: m.email || "",
      adres: m.adres || "",
    });
  };

  const duzenlemeKaydet = async (id) => {
    try {
      await musteriGuncelle(id, duzenlemeForm);
      setDuzenlenenId(null);
      bildir("Müşteri güncellendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Güncellenemedi", "hata");
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await musteriSil(id);
      bildir("Müşteri silindi");
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
      <h2>Müşteriler</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Müşteri adı</label>
          <input name="ad" value={form.ad} onChange={handleChange} required />
        </div>
        <div className="form-alan">
          <label>Yetkili kişi</label>
          <input
            name="yetkili_kisi"
            value={form.yetkili_kisi}
            onChange={handleChange}
          />
        </div>
        <div className="form-alan">
          <label>Telefon</label>
          <input
            name="telefon"
            placeholder="5xx xxx xx xx"
            value={form.telefon}
            onChange={handleChange}
          />
        </div>
        <div className="form-alan">
          <label>E-posta</label>
          <input name="email" value={form.email} onChange={handleChange} />
        </div>
        <div className="form-alan">
          <label>Adres</label>
          <input name="adres" value={form.adres} onChange={handleChange} />
        </div>
        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Ekleniyor..." : "Ekle"}
        </button>
      </form>

      {musteriler.length === 0 ? (
        <div className="bos-durum">Henüz müşteri eklenmemiş.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Yetkili</th>
              <th>Telefon</th>
              <th>E-posta</th>
              <th>Adres</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {musteriler.map((m) =>
              duzenlenenId === m.id ? (
                <tr key={m.id}>
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
                    <button onClick={() => duzenlemeKaydet(m.id)}>
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
                <tr key={m.id}>
                  <td>{m.ad}</td>
                  <td>{m.yetkili_kisi}</td>
                  <td>{m.telefon}</td>
                  <td>{m.email}</td>
                  <td>{m.adres}</td>
                  <td>
                    <button onClick={() => duzenlemeyeBasla(m)}>Düzenle</button>
                    <button onClick={() => setSilinecek(m)} className="tehlike">
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
        baslik="Müşteriyi sil"
        mesaj={`"${silinecek?.ad}" müşterisi kalıcı olarak silinecek.`}
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default Musteriler;
