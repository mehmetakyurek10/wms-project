import { useEffect, useState } from "react";
import {
  siparisleriGetir,
  siparisOlustur,
  siparisTeslimAl,
} from "../api/satinalmaApi";
import { tedarikcileriGetir } from "../api/tedarikciApi";
import { varyantlariGetir } from "../api/varyantApi";
import Etiket from "../components/Etiket";
import { useToast } from "../context/ToastContext";
import OnayModal from "../components/OnayModal";

function SatinalmaSiparisleri() {
  const bildir = useToast();
  const [siparisler, setSiparisler] = useState([]);
  const [tedarikciler, setTedarikciler] = useState([]);
  const [varyantlar, setVaryantlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState("");
  const [teslimAlinacak, setTeslimAlinacak] = useState(null);

  const [tedarikciId, setTedarikciId] = useState("");
  const [kalemler, setKalemler] = useState([
    { varyant_id: "", miktar: "", birim_fiyat: "" },
  ]);

  const veriGetir = async () => {
    try {
      const [siparisRes, tedarikciRes, varyantRes] = await Promise.all([
        siparisleriGetir(),
        tedarikcileriGetir(),
        varyantlariGetir(),
      ]);
      setSiparisler(siparisRes.data);
      setTedarikciler(tedarikciRes.data);
      setVaryantlar(varyantRes.data);
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
    setKalemler([...kalemler, { varyant_id: "", miktar: "", birim_fiyat: "" }]);
  };

  const kalemSil = (index) => {
    setKalemler(kalemler.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await siparisOlustur({
        tedarikci_id: tedarikciId,
        kalemler: kalemler.map((k) => ({
          varyant_id: k.varyant_id,
          miktar: parseFloat(k.miktar),
          birim_fiyat: parseFloat(k.birim_fiyat),
        })),
      });
      setKalemler([{ varyant_id: "", miktar: "", birim_fiyat: "" }]);
      bildir("Satınalma siparişi oluşturuldu");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Sipariş oluşturulamadı", "hata");
    }
  };

  const teslimAlOnayla = async () => {
    const id = teslimAlinacak.id;
    setTeslimAlinacak(null);
    try {
      await siparisTeslimAl(id);
      bildir("Sipariş teslim alındı, stoklar güncellendi");
      veriGetir();
    } catch (err) {
      bildir(err.response?.data?.hata || "Teslim alınamadı", "hata");
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
      <h2>Satınalma Siparişleri</h2>

      <form onSubmit={handleSubmit} className="form-dikey">
        <div className="form-satir">
          <label>Tedarikçi</label>
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
          <div key={index} className="kalem-satiri">
            <select
              value={kalem.varyant_id}
              onChange={(e) =>
                kalemDegistir(index, "varyant_id", e.target.value)
              }
              required
            >
              <option value="">Varyant seç</option>
              {varyantlar.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.urun_adi} · {v.boy} · {v.ambalaj_kg}kg {v.ambalaj_tipi}
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

        <div className="form-aksiyon">
          <button type="button" onClick={kalemEkle}>
            + Kalem Ekle
          </button>
          <button type="submit">Siparişi Oluştur</button>
        </div>
      </form>

      {siparisler.length === 0 ? (
        <div className="bos-durum">Henüz satınalma siparişi yok.</div>
      ) : (
        <table>
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
                <td>
                  <Etiket deger={s.durum} />
                </td>
                <td>{s.toplam_tutar}</td>
                <td>
                  {s.durum !== "teslim_alindi" && s.durum !== "iptal" && (
                    <button onClick={() => setTeslimAlinacak(s)}>
                      Teslim Al
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <OnayModal
        acik={teslimAlinacak !== null}
        baslik="Siparişi teslim al"
        mesaj={`#${teslimAlinacak?.id} numaralı siparişin kalemleri stoğa eklenecek ve stok hareketleri kaydedilecek.`}
        onayMetni="Teslim Al"
        onayla={teslimAlOnayla}
        iptal={() => setTeslimAlinacak(null)}
      />
    </div>
  );
}

export default SatinalmaSiparisleri;
