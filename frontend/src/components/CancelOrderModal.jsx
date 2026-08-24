import { useState } from "react";
import { Ban } from "lucide-react";
import { siparisIptal } from "../api/satinalmaApi";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";

function CancelOrderModal({ siparis, kapat, tamamlandi }) {
  const bildir = useToast();
  const [aciklama, setAciklama] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const iptalEt = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);

    try {
      await siparisIptal(siparis.id, { aciklama: aciklama.trim() });
      bildir(`#${siparis.id} numaralı sipariş iptal edildi`);
      kapat();
      tamamlandi();
    } catch (err) {
      bildir(err.response?.data?.hata || "Sipariş iptal edilemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <Modal acik kapat={kapat} baslik="Siparişi İptal Et" sinif="transfer-modal">
      <div className="modal-ikon modal-ikon-notr">
        <Ban size={22} />
      </div>
      <h3>
        #{siparis.id} · {siparis.tedarikci_adi}
      </h3>
      <p>
        {Number(siparis.toplam_tutar).toLocaleString("tr-TR")} ₺ tutarındaki bu
        sipariş iptal edilecek. Stokta hiçbir değişiklik olmaz; sipariş kayıtta
        iptal edilmiş olarak kalır.
      </p>

      <form onSubmit={iptalEt}>
        <div className="form-alan">
          <label htmlFor="iptal-sebebi">İptal sebebi</label>
          <input
            id="iptal-sebebi"
            type="text"
            maxLength={255}
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="Tedarikçi malın olmadığını bildirdi"
            required
            autoFocus
          />
        </div>

        <div className="modal-aksiyon">
          <button type="button" className="ikincil" onClick={kapat}>
            Vazgeç
          </button>
          <button
            type="submit"
            className="tehlike"
            disabled={gonderiliyor || aciklama.trim().length < 3}
          >
            {gonderiliyor ? "İptal ediliyor..." : "Siparişi İptal Et"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default CancelOrderModal;
