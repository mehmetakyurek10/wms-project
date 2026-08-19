import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";
import { ToastContext } from "./ToastContext";

const SURE = { basari: 3000, hata: 8000 };

export function ToastSaglayici({ children }) {
  const [toastlar, setToastlar] = useState([]);
  const zamanlayicilar = useRef(new Map());

  const kapat = useCallback((id) => {
    const zamanlayici = zamanlayicilar.current.get(id);

    if (zamanlayici) {
      clearTimeout(zamanlayici);
      zamanlayicilar.current.delete(id);
    }

    setToastlar((oncekiler) => oncekiler.filter((t) => t.id !== id));
  }, []);

  const bildir = useCallback(
    (mesaj, tip = "basari") => {
      const id = `${tip}|${mesaj}`;
      const mevcutZamanlayici = zamanlayicilar.current.get(id);

      if (mevcutZamanlayici) clearTimeout(mevcutZamanlayici);

      setToastlar((oncekiler) => {
        const mevcut = oncekiler.find((t) => t.id === id);
        const digerleri = oncekiler.filter((t) => t.id !== id);
        const sayac = mevcut ? mevcut.sayac + 1 : 1;

        return [...digerleri, { id, mesaj, tip, sayac }];
      });

      zamanlayicilar.current.set(
        id,
        setTimeout(() => kapat(id), SURE[tip] ?? SURE.basari),
      );
    },
    [kapat],
  );

  useEffect(() => {
    const harita = zamanlayicilar.current;

    return () => {
      harita.forEach(clearTimeout);
      harita.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={bildir}>
      {children}
      <div className="toast-alan" aria-live="polite" aria-atomic="false">
        {toastlar.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.tip}`}
            role={t.tip === "hata" ? "alert" : "status"}
          >
            {t.tip === "hata" ? (
              <AlertCircle size={16} />
            ) : (
              <CheckCircle size={16} />
            )}
            <span>
              {t.mesaj}
              {t.sayac > 1 && <span className="toast-sayac"> ×{t.sayac}</span>}
            </span>
            <button
              type="button"
              className="toast-kapat"
              onClick={() => kapat(t.id)}
              aria-label="Bildirimi kapat"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
