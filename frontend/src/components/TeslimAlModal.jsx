import { useState } from "react";
import { PackageCheck } from "lucide-react";
import LokasyonSecici from "./LokasyonSecici";

function TeslimAlModal({ acik, siparis, lokasyonlar, kapat, onayla }) {
  const [lokasyonId, setLokasyonId] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  if (!acik || !siparis) return null;

  const kaydet = async (e) => {
    e.preventDefault();
    setGonderiliyor(true);
    await onayla(lokasyonId);
    setGonderiliyor(false);
    setLokasyonId("");
  };

  return (
    <div className="modal-perde" onClick={kapat}>
      <div
        className="modal transfer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-ikon modal-ikon-notr">
          <PackageCheck size={22} />
        </div>
        <h3>Siparişi teslim al</h3>
        <p>
          #{siparis.id} numaralı siparişin kalemleri seçtiğin lokasyona
          eklenecek ve stok hareketleri kaydedilecek.
        </p>

        <form onSubmit={kaydet} className="transfer-form">
          <div className="form-alan">
            <label>Malın indirileceği lokasyon</label>
            <LokasyonSecici
              deger={lokasyonId}
              degisti={(e) => setLokasyonId(e.target.value)}
              lokasyonlar={lokasyonlar}
              zorunlu
            />
          </div>

          <div className="modal-aksiyon">
            <button type="button" className="ikincil" onClick={kapat}>
              Vazgeç
            </button>
            <button type="submit" disabled={gonderiliyor}>
              {gonderiliyor ? "İşleniyor..." : "Teslim Al"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeslimAlModal;
