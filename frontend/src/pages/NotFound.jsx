import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";

function NotFound() {
  const gezin = useNavigate();

  return (
    <div className="bos-durum">
      <Compass size={36} />
      <h3>Sayfa bulunamadı</h3>
      <p>Aradığınız adres değişmiş ya da hiç var olmamış olabilir.</p>
      <button onClick={() => gezin("/panel", { replace: true })}>
        Panele dön
      </button>
    </div>
  );
}

export default NotFound;
