import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

function OnayModal({ acik, baslik, mesaj, onayMetni = "Sil", onayla, iptal }) {
  return (
    <Modal acik={acik} kapat={iptal} baslik={baslik}>
      <div className="modal-ikon">
        <AlertTriangle size={22} />
      </div>
      <h3>{baslik}</h3>
      <p>{mesaj}</p>
      <div className="modal-aksiyon">
        <button className="ikincil" onClick={iptal}>
          Vazgeç
        </button>
        <button className="tehlike" onClick={onayla}>
          {onayMetni}
        </button>
      </div>
    </Modal>
  );
}

export default OnayModal;
