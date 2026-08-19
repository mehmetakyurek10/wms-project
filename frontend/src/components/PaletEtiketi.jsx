import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Printer, X } from "lucide-react";
import Modal from "./Modal";

function PaletEtiketi({ acik, palet, kapat }) {
  const barkodRef = useRef(null);

  useEffect(() => {
    if (!acik || !palet?.kod || !barkodRef.current) return;

    JsBarcode(barkodRef.current, palet.kod, {
      format: "CODE128",
      width: 2,
      height: 70,
      fontSize: 18,
      margin: 0,
      displayValue: true,
    });
  }, [acik, palet]);

  if (!palet) return null;

  return (
    <Modal
      acik={acik}
      kapat={kapat}
      baslik={`Palet etiketi ${palet.kod}`}
      temelSinif="etiket"
    >
      <div className="etiket-baslik">
        <h3>Palet Etiketi</h3>
        <button className="ikincil ikon-btn etiket-kapat" onClick={kapat}>
          <X size={16} />
        </button>
      </div>

      <svg ref={barkodRef} className="etiket-barkod" />

      <div className="etiket-bilgi">
        <div>
          <span>Ürün</span>
          <strong>{palet.urun_adi}</strong>
        </div>
        <div>
          <span>Varyant</span>
          <strong>
            {palet.boy} · {Number(palet.ambalaj_kg)}kg {palet.ambalaj_tipi}
          </strong>
        </div>
        <div>
          <span>Miktar</span>
          <strong>{Number(palet.miktar).toFixed(0)} adet</strong>
        </div>
        <div>
          <span>Lokasyon</span>
          <strong>{palet.lokasyon_kod}</strong>
        </div>
      </div>

      <div className="etiket-aksiyon">
        <button className="ikincil" onClick={() => window.print()}>
          <Printer size={15} /> Yazdır
        </button>
      </div>
    </Modal>
  );
}

export default PaletEtiketi;
