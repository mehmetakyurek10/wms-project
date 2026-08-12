import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { seferKalemleriGetir, seferKapat } from "../api/marketTripApi";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";

const yuvarla = (sayi) => Math.round(sayi * 100) / 100;

function MarketReturnModal({ acik, sefer, kapat, tamamlandi }) {
  const bildir = useToast();
  const [kalemler, setKalemler] = useState([]);
  const [donenler, setDonenler] = useState({});
  const [yukleniyor, setYukleniyor] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!acik || !sefer) return;

    const yukle = async () => {
      setYukleniyor(true);
      try {
        const response = await seferKalemleriGetir(sefer.id);
        setKalemler(response.data);
        setDonenler({});
      } catch (err) {
        bildir(
          err.response?.data?.hata || "Sefer kalemleri yüklenemedi",
          "hata",
        );
      } finally {
        setYukleniyor(false);
      }
    };

    yukle();
    // "sefer" nesnesi bilerek bagimliliklarda yok; kimlik degisirse
    // "sefer?.id" zaten tetikliyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, sefer?.id, bildir]);

  if (!sefer) return null;

  const satir = (kalem) => {
    const giden = yuvarla(Number(kalem.giden_miktar));
    const donenGirdi = donenler[kalem.varyant_id];
    const donen =
      donenGirdi === "" || donenGirdi === undefined ? 0 : Number(donenGirdi);
    const gecerli = Number.isFinite(donen) && donen >= 0 && donen <= giden;
    const satilan = gecerli ? yuvarla(giden - donen) : 0;

    return {
      giden,
      donen,
      gecerli,
      satilan,
      hasilat: satilan * Number(kalem.perakende_fiyat || 0),
    };
  };

  const hesaplar = kalemler.map(satir);
  const hepsiGecerli = hesaplar.every((h) => h.gecerli);
  const toplamSatilan = yuvarla(
    hesaplar.reduce((toplam, h) => toplam + h.satilan, 0),
  );
  const toplamDonen = yuvarla(
    hesaplar.reduce((toplam, h) => toplam + h.donen, 0),
  );
  const toplamHasilat = hesaplar.reduce((toplam, h) => toplam + h.hasilat, 0);

  const onayla = async () => {
    if (gonderiliyor || !hepsiGecerli) return;
    setGonderiliyor(true);
    try {
      await seferKapat(sefer.id, {
        kalemler: kalemler.map((kalem, i) => ({
          varyant_id: kalem.varyant_id,
          donen_miktar: hesaplar[i].donen,
        })),
      });
      bildir(`${sefer.fis_no} numaralı sefer kapatıldı`);
      tamamlandi();
    } catch (err) {
      bildir(err.response?.data?.hata || "Sefer kapatılamadı", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <Modal
      acik={acik}
      kapat={kapat}
      baslik={`${sefer.fis_no} dönüş kaydı`}
      sinif="transfer-modal"
      kirli={Object.values(donenler).some((d) => d !== "" && d !== undefined)}
    >
      <div className="modal-ikon modal-ikon-notr">
        <Undo2 size={22} />
      </div>
      <h3>{sefer.fis_no} · Dönüş</h3>
      <p>Depoya dönen miktarları girin. Girilmeyen fark satılmış sayılacak.</p>

      {yukleniyor ? (
        <div className="yukleniyor-kutu">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <table className="ic-tablo">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Giden</th>
                <th>Dönen</th>
                <th>Satılan</th>
              </tr>
            </thead>
            <tbody>
              {kalemler.map((kalem, i) => (
                <tr
                  key={kalem.varyant_id}
                  className={hesaplar[i].gecerli ? "" : "kritik"}
                >
                  <td>
                    {kalem.urun_adi} · {kalem.boy}
                  </td>
                  <td>{hesaplar[i].giden.toFixed(0)}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={hesaplar[i].giden}
                      placeholder="0"
                      value={donenler[kalem.varyant_id] ?? ""}
                      onChange={(e) =>
                        setDonenler((onceki) => ({
                          ...onceki,
                          [kalem.varyant_id]: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>{hesaplar[i].satilan.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!hepsiGecerli && (
            <p className="hata-metni">
              Dönen miktar sıfırdan küçük ya da gidenden fazla olamaz.
            </p>
          )}

          <div className="transfer-ozet">
            <div>
              Satılan <strong>{toplamSatilan.toFixed(0)} adet</strong>
            </div>
            <div>
              Depoya dönen <strong>{toplamDonen.toFixed(0)} adet</strong>
            </div>
            <div>
              Tahmini hasılat{" "}
              <strong>
                {toplamHasilat.toLocaleString("tr-TR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ₺
              </strong>
            </div>
          </div>
        </>
      )}

      <div className="modal-aksiyon">
        <button type="button" className="ikincil" onClick={kapat}>
          Vazgeç
        </button>
        <button
          type="button"
          onClick={onayla}
          disabled={
            gonderiliyor || yukleniyor || !hepsiGecerli || !kalemler.length
          }
        >
          {gonderiliyor ? "Kapatılıyor..." : "Seferi Kapat"}
        </button>
      </div>
    </Modal>
  );
}

export default MarketReturnModal;
