import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { transferYap } from "../api/transferApi";
import LokasyonSecici from "./LokasyonSecici";
import { useToast } from "../context/ToastContext";

function TransferModal({
  acik,
  kaynak,
  stokSatiri,
  lokasyonlar,
  kapat,
  tamamlandi,
}) {
  const bildir = useToast();
  const [hedefId, setHedefId] = useState("");
  const [miktar, setMiktar] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  if (!acik || !stokSatiri) return null;

  const mevcut = Number(stokSatiri.miktar);
  const hedefler = lokasyonlar.filter((l) => l.id !== kaynak.id && l.aktif);
  const secilenHedef = hedefler.find((l) => l.id === Number(hedefId));

  const kaydet = async (e) => {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      await transferYap({
        varyant_id: stokSatiri.varyant_id,
        kaynak_lokasyon_id: kaynak.id,
        hedef_lokasyon_id: hedefId,
        miktar: Number(miktar),
        aciklama,
      });
      bildir("Transfer tamamlandı");
      setHedefId("");
      setMiktar("");
      setAciklama("");
      tamamlandi();
    } catch (err) {
      bildir(err.response?.data?.hata || "Transfer yapılamadı", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="modal-perde" onClick={kapat}>
      <div
        className="modal transfer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Stok Transferi</h3>

        <div className="transfer-ozet">
          <div>
            <span className="kucuk-not">Ürün</span>
            <strong>
              {stokSatiri.urun_adi} · {stokSatiri.boy} ·{" "}
              {Number(stokSatiri.ambalaj_kg)}kg {stokSatiri.ambalaj_tipi}
            </strong>
          </div>
          <div className="transfer-yon">
            <span>{kaynak.kod}</span>
            <ArrowRight size={16} />
            <span>{secilenHedef ? secilenHedef.kod : "?"}</span>
          </div>
        </div>

        <form onSubmit={kaydet} className="transfer-form">
          <div className="form-alan">
            <label>Hedef lokasyon</label>
            <LokasyonSecici
              deger={hedefId}
              degisti={(e) => setHedefId(e.target.value)}
              lokasyonlar={hedefler}
              zorunlu
            />
          </div>

          <div className="form-alan">
            <label>Miktar (adet) · mevcut {mevcut.toFixed(0)}</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={mevcut}
              value={miktar}
              onChange={(e) => setMiktar(e.target.value)}
              required
            />
          </div>

          <div className="form-alan">
            <label>Açıklama</label>
            <input
              placeholder="İsteğe bağlı"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
            />
          </div>

          <div className="modal-aksiyon">
            <button type="button" className="ikincil" onClick={kapat}>
              Vazgeç
            </button>
            <button type="submit" disabled={gonderiliyor}>
              {gonderiliyor ? "Taşınıyor..." : "Taşı"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TransferModal;
