import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { transferYap } from "../api/transferApi";
import LokasyonSecici from "./LokasyonSecici";
import Modal from "./Modal";
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

  if (!stokSatiri || !kaynak) return null;

  const palet = stokSatiri.birim_tipi === "palet";
  const mevcut = Number(stokSatiri.miktar);
  const hedefler = lokasyonlar.filter((l) => l.id !== kaynak.id && l.aktif);
  const secilenHedef = hedefler.find((l) => l.id === Number(hedefId));

  const kaydet = async (e) => {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      await transferYap({
        birim_id: stokSatiri.id,
        hedef_lokasyon_id: hedefId,
        miktar: palet ? undefined : Number(miktar),
        aciklama,
      });
      bildir(palet ? "Palet taşındı" : "Transfer tamamlandı");
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
    <Modal
      acik={acik}
      kapat={kapat}
      baslik={palet ? "Palet Taşı" : "Stok Transferi"}
      sinif="transfer-modal"
      kirli={hedefId !== "" || miktar !== "" || aciklama !== ""}
    >
      <h3>{palet ? "Palet Taşı" : "Stok Transferi"}</h3>

      <div className="transfer-ozet">
        <div>
          <span className="kucuk-not">
            {palet ? `Palet ${stokSatiri.birim_kodu}` : "Ürün"}
          </span>
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
          <label htmlFor="transfer-hedef-lokasyon">Hedef lokasyon</label>
          <LokasyonSecici
            kimlik="transfer-hedef-lokasyon"
            deger={hedefId}
            degisti={(e) => setHedefId(e.target.value)}
            lokasyonlar={hedefler}
            zorunlu
          />
        </div>

        {palet ? (
          <p className="kucuk-not">
            Palet bütün olarak taşınacak · {mevcut.toFixed(0)} adet
          </p>
        ) : (
          <div className="form-alan">
            <label htmlFor="transfermodal-miktar-adet-mevcut">
              Miktar (adet) · mevcut {mevcut.toFixed(0)}
            </label>
            <input
              id="transfermodal-miktar-adet-mevcut"
              type="number"
              step="0.01"
              min="0.01"
              max={mevcut}
              value={miktar}
              onChange={(e) => setMiktar(e.target.value)}
              required
            />
          </div>
        )}

        <div className="form-alan">
          <label htmlFor="transfermodal-aciklama">Açıklama</label>
          <input
            id="transfermodal-aciklama"
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
    </Modal>
  );
}

export default TransferModal;
