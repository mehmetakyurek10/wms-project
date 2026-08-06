import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  stokHareketleriniGetir,
  stokHareketiEkle,
} from "../api/stokHareketleri";
import { varyantlariGetir } from "../api/varyantApi";
import { lokasyonlariGetir } from "../api/lokasyonApi";
import { getStockUnits } from "../api/stockUnitApi";
import Etiket from "../components/Etiket";
import LokasyonSecici from "../components/LokasyonSecici";
import { useToast } from "../context/ToastContext";

const SAYFA_BOYUTU = 20;

const BOS_FILTRE = {
  varyant_id: "",
  tip: "",
  sebep: "",
  baslangic: "",
  bitis: "",
};

function StokHareketleri() {
  const bildir = useToast();
  const [hareketler, setHareketler] = useState([]);
  const [varyantlar, setVaryantlar] = useState([]);
  const [lokasyonlar, setLokasyonlar] = useState([]);
  const [birimler, setBirimler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [filtre, setFiltre] = useState(BOS_FILTRE);
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);

  const [form, setForm] = useState({
    varyant_id: "",
    lokasyon_id: "",
    birim_id: "",
    tip: "giris",
    sebep: "manuel",
    miktar: "",
    birim: "adet",
    aciklama: "",
  });

  const toplamSayfa = Math.ceil(toplam / SAYFA_BOYUTU);
  const filtreVar = Object.values(filtre).some((deger) => deger !== "");

  const tanimlariYukle = async () => {
    try {
      const [varyantRes, lokasyonRes] = await Promise.all([
        varyantlariGetir(),
        lokasyonlariGetir(),
      ]);
      setVaryantlar(varyantRes.data);
      setLokasyonlar(lokasyonRes.data.filter((l) => l.aktif));
      setForm((f) =>
        f.varyant_id ? f : { ...f, varyant_id: varyantRes.data[0]?.id || "" },
      );
    } catch (err) {
      setHata(err.response?.data?.hata || "Tanımlar yüklenemedi");
    }
  };

  const hareketleriYukle = async () => {
    try {
      const response = await stokHareketleriniGetir({
        ...filtre,
        sayfa,
        limit: SAYFA_BOYUTU,
      });
      setHareketler(response.data);
      setToplam(parseInt(response.headers["x-toplam-kayit"], 10) || 0);
    } catch (err) {
      setHata(err.response?.data?.hata || "Hareketler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    tanimlariYukle();
  }, []);

  useEffect(() => {
    hareketleriYukle();
  }, [filtre, sayfa]);

  useEffect(() => {
    if (form.tip !== "cikis" || !form.varyant_id) {
      setBirimler([]);
      return;
    }
    getStockUnits({ varyant_id: form.varyant_id })
      .then((res) => setBirimler(res.data.filter((b) => Number(b.miktar) > 0)))
      .catch(() => setBirimler([]));
  }, [form.varyant_id, form.tip]);

  const filtreDegisti = (e) => {
    setFiltre({ ...filtre, [e.target.name]: e.target.value });
    setSayfa(1);
  };

  const secilenVaryant = varyantlar.find(
    (v) => v.id === parseInt(form.varyant_id, 10),
  );
  const ambalajKg = Number(secilenVaryant?.ambalaj_kg) || 1;
  const miktarAdet =
    form.birim === "kg"
      ? Number(form.miktar || 0) / ambalajKg
      : Number(form.miktar || 0);

  const handleChange = (e) => {
    const yeniForm = { ...form, [e.target.name]: e.target.value };
    if (e.target.name === "varyant_id" || e.target.name === "tip") {
      yeniForm.lokasyon_id = "";
      yeniForm.birim_id = "";
    }
    setForm(yeniForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await stokHareketiEkle({
        varyant_id: form.varyant_id,
        lokasyon_id: form.lokasyon_id,
        birim_id: form.birim_id,
        tip: form.tip,
        sebep: form.sebep,
        miktar: miktarAdet,
        aciklama: form.aciklama,
      });
      setForm({ ...form, miktar: "", aciklama: "", birim_id: "" });
      bildir("Stok hareketi kaydedildi");
      hareketleriYukle();
      tanimlariYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Hareket eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
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

  const cikisModu = form.tip === "cikis";

  return (
    <div>
      <h2>Stok Hareketleri</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Varyant</label>
          <select
            name="varyant_id"
            value={form.varyant_id}
            onChange={handleChange}
            required
          >
            <option value="">Seçiniz</option>
            {varyantlar.map((v) => (
              <option key={v.id} value={v.id}>
                {v.urun_adi} · {v.boy} · {Number(v.ambalaj_kg)}kg{" "}
                {v.ambalaj_tipi}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Hareket tipi</label>
          <select name="tip" value={form.tip} onChange={handleChange}>
            <option value="giris">Giriş</option>
            <option value="cikis">Çıkış</option>
          </select>
        </div>

        {cikisModu ? (
          <div className="form-alan">
            <label>Hangi birimden</label>
            <select
              name="birim_id"
              value={form.birim_id}
              onChange={handleChange}
              required
            >
              <option value="">
                {birimler.length === 0 ? "Bu varyantın stoğu yok" : "Seçiniz"}
              </option>
              {birimler.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tip === "palet" ? b.kod : "Dökme"} · {b.lokasyon_kod} ·{" "}
                  {Number(b.miktar).toFixed(0)} adet
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-alan">
            <label>Nereye</label>
            <LokasyonSecici
              ad="lokasyon_id"
              deger={form.lokasyon_id}
              degisti={handleChange}
              lokasyonlar={lokasyonlar}
              zorunlu
            />
          </div>
        )}

        <div className="form-alan">
          <label>Sebep</label>
          <select name="sebep" value={form.sebep} onChange={handleChange}>
            <option value="manuel">Manuel</option>
            <option value="satinalma">Satınalma</option>
            <option value="satis">Satış</option>
            <option value="sayim">Sayım</option>
            <option value="fire">Fire</option>
            <option value="iade">İade</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Miktar</label>
          <div className="miktar-girisi">
            <input
              name="miktar"
              type="number"
              step="0.01"
              value={form.miktar}
              onChange={handleChange}
              required
            />
            <select name="birim" value={form.birim} onChange={handleChange}>
              <option value="adet">adet</option>
              <option value="kg">kg</option>
            </select>
          </div>
          {form.birim === "kg" && Number(form.miktar) > 0 && (
            <span className="kucuk-not">
              = {miktarAdet.toFixed(2)} adet ({ambalajKg}kg ambalaj)
            </span>
          )}
        </div>

        <div className="form-alan">
          <label>Açıklama</label>
          <input
            name="aciklama"
            placeholder="İsteğe bağlı"
            value={form.aciklama}
            onChange={handleChange}
          />
        </div>

        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>

      <div className="filtre-cubugu">
        <div className="form-alan">
          <label>Varyant</label>
          <select
            name="varyant_id"
            value={filtre.varyant_id}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            {varyantlar.map((v) => (
              <option key={v.id} value={v.id}>
                {v.urun_adi} · {v.boy}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Tip</label>
          <select name="tip" value={filtre.tip} onChange={filtreDegisti}>
            <option value="">Tümü</option>
            <option value="giris">Giriş</option>
            <option value="cikis">Çıkış</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Sebep</label>
          <select name="sebep" value={filtre.sebep} onChange={filtreDegisti}>
            <option value="">Tümü</option>
            <option value="manuel">Manuel</option>
            <option value="satinalma">Satınalma</option>
            <option value="satis">Satış</option>
            <option value="sayim">Sayım</option>
            <option value="fire">Fire</option>
            <option value="iade">İade</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Başlangıç</label>
          <input
            type="date"
            name="baslangic"
            value={filtre.baslangic}
            onChange={filtreDegisti}
          />
        </div>

        <div className="form-alan">
          <label>Bitiş</label>
          <input
            type="date"
            name="bitis"
            value={filtre.bitis}
            onChange={filtreDegisti}
          />
        </div>

        {filtreVar && (
          <button
            className="ikincil ikon-btn"
            onClick={() => {
              setFiltre(BOS_FILTRE);
              setSayfa(1);
            }}
            title="Filtreleri temizle"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {hareketler.length === 0 ? (
        <div className="bos-durum">
          {filtreVar
            ? "Bu filtrelere uyan hareket yok."
            : "Henüz stok hareketi yok."}
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Ürün</th>
                <th>Varyant</th>
                <th>Lokasyon</th>
                <th>Tip</th>
                <th>Sebep</th>
                <th>Miktar</th>
                <th>Açıklama</th>
                <th>İşlemi Yapan</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.tarih).toLocaleString("tr-TR")}</td>
                  <td>{h.urun_adi}</td>
                  <td>
                    {h.boy} · {Number(h.ambalaj_kg)}kg {h.ambalaj_tipi}
                  </td>
                  <td>{h.lokasyon_kod || "-"}</td>
                  <td>
                    <Etiket deger={h.tip} />
                  </td>
                  <td>
                    <Etiket deger={h.sebep} />
                  </td>
                  <td>{Number(h.miktar).toFixed(0)}</td>
                  <td>{h.aciklama}</td>
                  <td>{h.kullanici_adi || "-"}</td>
                </tr>
              ))}
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
    </div>
  );
}

export default StokHareketleri;
