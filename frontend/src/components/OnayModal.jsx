import { AlertTriangle } from "lucide-react";

function OnayModal({ acik, baslik, mesaj, onayMetni = "Sil", onayla, iptal }) {
  if (!acik) return null;

  return (
    <div className="modal-perde" onClick={iptal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}

export default OnayModal;
