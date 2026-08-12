import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { satisRezervasyonlari, satisTeslimEt } from "../api/satisApi";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";

function DeliveryModal({ acik, siparis, kapat, tamamlandi }) {
  const bildir = useToast();
  const [rezervasyonlar, setRezervasyonlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!acik || !siparis) return;

    const yukle = async () => {
      setYukleniyor(true);
      try {
        const response = await satisRezervasyonlari(siparis.id);
        setRezervasyonlar(response.data);
      } catch (err) {
        bildir(err.response?.data?.hata || "Ayrılan stok yüklenemedi", "hata");
      } finally {
        setYukleniyor(false);
      }
    };

    yukle();
    // "siparis" nesnesi bilerek bagimliliklarda yok. Modal acikken ust
    // bilesen yeniden cizilip yeni bir nesne uretse de ayni siparisin
    // rezervasyonlarini bastan cekmenin anlami yok; gercekten baska bir
    // siparise gecildiginde "siparis?.id" zaten tetikliyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, siparis?.id, bildir]);

  if (!siparis) return null;

  const eksikVar = rezervasyonlar.some(
    (r) => Number(r.birim_miktari) < Number(r.miktar),
  );

  const onayla = async () => {
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await satisTeslimEt(siparis.id);
      bildir("Sipariş teslim edildi, stoklar düşüldü");
      tamamlandi();
    } catch (err) {
      bildir(err.response?.data?.hata || "Teslim edilemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <Modal
      acik={acik}
      kapat={kapat}
      baslik={`${siparis.id} numaralı siparişi teslim et`}
      sinif="transfer-modal"
    >
      <div className="modal-ikon modal-ikon-notr">
        <PackageCheck size={22} />
      </div>
      <h3>#{siparis.id} · Teslim Et</h3>
      <p>Sipariş oluşturulurken ayrılan stok aşağıdaki birimlerden çıkacak.</p>

      {yukleniyor ? (
        <div className="yukleniyor-kutu">
          <div className="spinner" />
        </div>
      ) : rezervasyonlar.length === 0 ? (
        <div className="bos-durum">
          Bu siparişte ayrılmış stok yok, teslim edilemez.
        </div>
      ) : (
        <>
          <table className="ic-tablo">
            <thead>
              <tr>
                <th>Birim</th>
                <th>Lokasyon</th>
                <th>Ürün</th>
                <th>Çıkacak</th>
                <th>Birimde</th>
              </tr>
            </thead>
            <tbody>
              {rezervasyonlar.map((r) => {
                const yetersiz = Number(r.birim_miktari) < Number(r.miktar);
                return (
                  <tr key={r.id} className={yetersiz ? "kritik" : ""}>
                    <td>
                      <span
                        className={`etiket etiket-${
                          r.tip === "palet" ? "mavi" : "gri"
                        }`}
                      >
                        {r.tip === "palet" ? r.kod : "Dökme"}
                      </span>
                    </td>
                    <td>{r.lokasyon_kod}</td>
                    <td>
                      {r.urun_adi} · {r.boy}
                    </td>
                    <td>{Number(r.miktar).toFixed(0)}</td>
                    <td>{Number(r.birim_miktari).toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {eksikVar && (
            <p className="hata-metni">
              Bazı birimlerde ayrılan miktar kadar mal yok. Sayım sonrası stok
              düşmüş olabilir. Teslimat reddedilecektir.
            </p>
          )}
        </>
      )}

      <div className="modal-aksiyon">
        <button type="button" className="ikincil" onClick={kapat}>
          Vazgeç
        </button>
        <button
          type="button"
          onClick={onayla}
          disabled={gonderiliyor || yukleniyor || rezervasyonlar.length === 0}
        >
          {gonderiliyor ? "İşleniyor..." : "Teslim Et"}
        </button>
      </div>
    </Modal>
  );
}

export default DeliveryModal;
