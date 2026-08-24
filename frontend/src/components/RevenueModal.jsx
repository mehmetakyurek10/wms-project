import { useState } from "react";
import { Banknote } from "lucide-react";
import { seferHasilatGuncelle } from "../api/marketTripApi";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";

function RevenueModal({ sefer, kapat, tamamlandi }) {
  const bildir = useToast();
  const [hasilat, setHasilat] = useState(
    sefer.hasilat == null ? "" : String(sefer.hasilat),
  );
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const kaydet = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);

    try {
      await seferHasilatGuncelle(sefer.id, { hasilat });
      bildir(`${sefer.fis_no} hasılatı kaydedildi`);
      kapat();
      tamamlandi();
    } catch (err) {
      bildir(err.response?.data?.hata || "Hasılat kaydedilemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <Modal acik kapat={kapat} baslik="Hasılat" sinif="transfer-modal">
      <div className="modal-ikon modal-ikon-notr">
        <Banknote size={22} />
      </div>
      <h3>{sefer.fis_no} · Hasılat</h3>
      <p>
        {sefer.pazar_adi || sefer.pazar_kod} seferinde{" "}
        {Number(sefer.toplam_satilan).toFixed(0)} adet satıldı. Kasadan sayılan
        tutarı girin.
      </p>

      <form onSubmit={kaydet}>
        <div className="form-alan">
          <label>Hasılat (₺)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={hasilat}
            onChange={(e) => setHasilat(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="modal-aksiyon">
          <button type="button" className="ikincil" onClick={kapat}>
            Vazgeç
          </button>
          <button type="submit" disabled={gonderiliyor}>
            {gonderiliyor ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default RevenueModal;
