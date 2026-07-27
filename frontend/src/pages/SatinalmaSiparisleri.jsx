import { useEffect, useState } from "react";
import {
  siparisleriGetir,
  siparisOlustur,
  siparisTeslimAl,
} from "../api/satinalmaApi";
import { tedarikcileriGetir } from "../api/tedarikciApi";
import { urunleriGetir } from "../api/urunApi";

function SatinalmaSiparisleri() {
  const [siparisler, setSiparisler] = useState([]);
  const [tedarikciler, setTedarikciler] = useState([]);
  const [urunler, setUrunler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [formHata, setFormHata] = useState("");

  const [tedarikciId, setTedarikciId] = useState("");
  const [kalemler, setKalemler] = useState([
    { urun_id: "", miktar: "", birim_fiyat: "" },
  ]);

  const veriGetir = async () => {
    try {
      const [siparisRes, tedarikciRes, urunRes] = await Promise.all([
        siparisleriGetir(),
        tedarikcileriGetir(),
        urunleriGetir(),
      ]);
      setSiparisler(siparisRes.data);
      setTedarikciler(tedarikciRes.data);
      setUrunler(urunRes.data);
      setTedarikciId((mevcut) => mevcut || tedarikciRes.data[0]?.id || "");
    } catch (err) {
      setHata("Veriler yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, []);

  const kalemDegistir = (index, alan, deger) => {
    const yeniKalemler = [...kalemler];
    yeniKalemler[index] = { ...yeniKalemler[index], [alan]: deger };
    setKalemler(yeniKalemler);
  };

  const kalemEkle = () => {
    setKalemler([...kalemler, { urun_id: "", miktar: "", birim_fiyat: "" }]);
  };

  const kalemSil = (index) => {
    setKalemler(kalemler.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormHata("");
    try {
      await siparisOlustur({
        tedarikci_id: tedarikciId,
        kalemler: kalemler.map((k) => ({
          urun_id: k.urun_id,
          miktar: parseFloat(k.miktar),
          birim_fiyat: parseFloat(k.birim_fiyat),
        })),
      });
      setKalemler([{ urun_id: "", miktar: "", birim_fiyat: "" }]);
      veriGetir();
    } catch (err) {
      setFormHata(err.response?.data?.hata || "Sipariş oluşturulamadı");
    }
  };

  const teslimAl = async (id) => {
    if (!window.confirm("Bu siparişi teslim almak istediğine emin misin?"))
      return;
    try {
      await siparisTeslimAl(id);
      veriGetir();
    } catch (err) {
      alert(err.response?.data?.hata || "Teslim alınamadı");
    }
  };

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <p style={{ color: "red" }}>{hata}</p>;

  return (
    <div>
      <h2>Satınalma Siparişleri</h2>

      <form
        onSubmit={handleSubmit}
        style={{ flexDirection: "column", alignItems: "stretch" }}
      >
        <div style={{ marginBottom: "10px" }}>
          <label>Tedarikçi: </label>
          <select
            value={tedarikciId}
            onChange={(e) => setTedarikciId(e.target.value)}
          >
            {tedarikciler.map((t) => (
              <option key={t.id} value={t.id}>
                {t.ad}
              </option>
            ))}
          </select>
        </div>

        {kalemler.map((kalem, index) => (
          <div
            key={index}
            style={{ display: "flex", gap: "10px", marginBottom: "8px" }}
          >
            <select
              value={kalem.urun_id}
              onChange={(e) => kalemDegistir(index, "urun_id", e.target.value)}
              required
            >
              <option value="">Ürün seç</option>
              {urunler.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ad}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Miktar"
              value={kalem.miktar}
              onChange={(e) => kalemDegistir(index, "miktar", e.target.value)}
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Birim Fiyat"
              value={kalem.birim_fiyat}
              onChange={(e) =>
                kalemDegistir(index, "birim_fiyat", e.target.value)
              }
              required
            />
            {kalemler.length > 1 && (
              <button
                type="button"
                className="tehlike"
                onClick={() => kalemSil(index)}
              >
                Kaldır
              </button>
            )}
          </div>
        ))}

        <div>
          <button type="button" onClick={kalemEkle}>
            + Kalem Ekle
          </button>
          <button type="submit">Siparişi Oluştur</button>
        </div>
        {formHata && <p style={{ color: "red" }}>{formHata}</p>}
      </form>

      <table border="1" cellPadding="8" style={{ marginTop: "20px" }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Tedarikçi</th>
            <th>Durum</th>
            <th>Toplam Tutar</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {siparisler.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.tedarikci_adi}</td>
              <td>{s.durum}</td>
              <td>{s.toplam_tutar}</td>
              <td>
                {s.durum !== "teslim_alindi" && s.durum !== "iptal" && (
                  <button onClick={() => teslimAl(s.id)}>Teslim Al</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SatinalmaSiparisleri;
