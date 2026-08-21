import { AlertTriangle, RotateCw } from "lucide-react";

function ErrorState({ mesaj, tekrarDene }) {
  const yeniden = tekrarDene || (() => window.location.reload());

  return (
    <div className="bos-durum">
      <AlertTriangle size={36} />
      <p className="hata-metni">{mesaj}</p>
      <button className="ikincil" onClick={yeniden}>
        <RotateCw size={15} /> Tekrar dene
      </button>
    </div>
  );
}

export default ErrorState;
