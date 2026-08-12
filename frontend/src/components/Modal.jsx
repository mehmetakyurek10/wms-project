import { useEffect, useRef } from "react";

const ODAKLANABILIR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function Modal({
  acik,
  kapat,
  baslik,
  temelSinif = "modal",
  sinif = "",
  kirli = false,
  children,
}) {
  const kutuRef = useRef(null);
  const kapatRef = useRef(kapat);

  useEffect(() => {
    kapatRef.current = kapat;
  });

  useEffect(() => {
    if (!acik) return;

    const oncekiOdak = document.activeElement;
    const kutu = kutuRef.current;

    const odaklanabilirler = () => [...kutu.querySelectorAll(ODAKLANABILIR)];

    const ilk = odaklanabilirler()[0];
    if (ilk) ilk.focus();
    else kutu.focus();

    // Tab tusu modalin icinde donuyor. Bu olmadan odak arkadaki forma
    // kaciyor ve klavyeyle calisan kullanici modaldan cikmadan alanlari
    // degistirebiliyor.
    const tusaBas = (olay) => {
      if (olay.key === "Escape") {
        olay.preventDefault();
        kapatRef.current();
        return;
      }

      if (olay.key !== "Tab") return;

      const liste = odaklanabilirler();
      if (!liste.length) return;

      const ilkEleman = liste[0];
      const sonEleman = liste[liste.length - 1];

      if (olay.shiftKey && document.activeElement === ilkEleman) {
        olay.preventDefault();
        sonEleman.focus();
      } else if (!olay.shiftKey && document.activeElement === sonEleman) {
        olay.preventDefault();
        ilkEleman.focus();
      }
    };

    document.addEventListener("keydown", tusaBas);

    const oncekiTasma = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", tusaBas);
      document.body.style.overflow = oncekiTasma;
      if (oncekiOdak instanceof HTMLElement) oncekiOdak.focus();
    };
  }, [acik]);

  if (!acik) return null;

  // Icinde doldurulmus alan varsa perdeye yanlislikla tiklamak butun
  // girisi silmemeli. On iki palet icin miktar girdikten sonra bunu
  // kaybetmek geri alinamaz bir hata.
  const perdeTiklandi = () => {
    if (
      kirli &&
      !window.confirm(
        "Girdiğiniz bilgiler kaybolacak. Pencereyi kapatmak istiyor musunuz?",
      )
    ) {
      return;
    }
    kapat();
  };

  return (
    <div className="modal-perde" onClick={perdeTiklandi}>
      <div
        ref={kutuRef}
        className={`${temelSinif} ${sinif}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        tabIndex={-1}
        onClick={(olay) => olay.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default Modal;
