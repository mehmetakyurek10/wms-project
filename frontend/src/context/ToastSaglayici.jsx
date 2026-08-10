import { useCallback, useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { ToastContext } from "./ToastContext";

export function ToastSaglayici({ children }) {
  const [toastlar, setToastlar] = useState([]);

  const bildir = useCallback((mesaj, tip = "basari") => {
    const id = Date.now() + Math.random();
    setToastlar((oncekiler) => [...oncekiler, { id, mesaj, tip }]);
    setTimeout(() => {
      setToastlar((oncekiler) => oncekiler.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={bildir}>
      {children}
      <div className="toast-alan">
        {toastlar.map((t) => (
          <div key={t.id} className={`toast toast-${t.tip}`}>
            {t.tip === "hata" ? (
              <AlertCircle size={16} />
            ) : (
              <CheckCircle size={16} />
            )}
            <span>{t.mesaj}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
