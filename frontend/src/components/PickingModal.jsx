import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { getStockUnits } from "../api/stockUnitApi";
import { satisTeslimEt } from "../api/satisApi";
import { useToast } from "../context/ToastContext";

const yuvarla = (sayi) => Math.round(sayi * 100) / 100;

function PickingModal({ acik, siparis, kalemler, kapat, tamamlandi }) {
  const bildir = useToast();
  const [birimler, setBirimler] = useState({});
  const [secimler, setSecimler] = useState({});
  const [yukleniyor, setYukleniyor] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!acik || !siparis || !kalemler?.length) return;

    const yukle = async () => {
      setYukleniyor(true);
      setSecimler({});
      try {
        const varyantIdleri = [...new Set(kalemler.map((k) => k.varyant_id))];
        const sonuclar = await Promise.all(
          varyantIdleri.map((vid) => getStockUnits({ varyant_id: vid })),
        );
        const harita = {};
        varyantIdleri.forEach((vid, i) => {
          harita[vid] = sonuclar[i].data.filter((b) => Number(b.miktar) > 0);
        });
        setBirimler(harita);
      } catch (err) {
        bildir(err.response?.data?.hata || "Stok birimleri yüklenemedi", "hata");
      } finally {
        setYukleniyor(false);
      }
    };

    yukle();
  }, [acik, siparis?.id]);

  if (!acik || !siparis) return null;

  const gruplar = [];
  const gorulenler = new Set();

  for (const kalem of kalemler) {
    if (gorulenler.has(kalem.varyant_id)) {
      const grup = gruplar.find((g) => g.varyant_id === kalem.varyant_id);
      grup.gereken = yuvarla(grup.gereken + Number(kalem.miktar));
      continue;
    }
    gorulenler.add(kalem.varyant_id);
    gruplar.push({
      varyant_id: kalem.varyant_id,
      urun_adi: kalem.urun_adi,
      boy: kalem.boy,
      ambalaj_kg: kalem.ambalaj_kg,
      ambalaj_tipi: kalem.ambalaj_tipi,
      gereken: yuvarla(Number(kalem.miktar)),
    });
  }

  const secilenToplam = (varyantId) =>
    yuvarla(
      (birimler[varyantId] || []).reduce(
        (toplam, birim) => toplam + (Number(secimler[birim.id]) || 0),
        0,
      ),
    );

  const hepsiTamam = gruplar.every(
    (grup) => secilenToplam(grup.varyant_id) === grup.gereken,
  );

  const secimDegistir = (birimId, deger) => {
    setSecimler((onceki) => ({ ...onceki, [birimId]: deger }));
  };

  const kaydet = async (e) => {
    e.preventDefault();

    const tahsisler = Object.entries(secimler)
      .map(([birimId, deger]) => ({
        birim_id: Number(birimId),
        miktar: Number(deger),
      }))
      .filter((t) => Number.isFinite(t.miktar) && t.miktar > 0);

    if (!tahsisler.length) {
      bildir("Hiç birim seçilmedi", "hata");
      return;
    }

    setGonderiliyor(true);
    try {
      await satisTeslimEt(siparis.id, { tahsisler });
      bildir("Sipariş teslim edildi, stoklar düşüldü");
      tamamlandi();
    } catch (err) {
      bildir(err.response?.data?.hata || "Teslim edilemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div className="modal-perde" onClick={kapat}>
      <div
        className="modal transfer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-ikon modal-ikon-notr">
          <PackageCheck size={22} />
        </div>
        <h3>#{siparis.id} · Toplama</h3>
        <p>Her kalem için malın hangi birimden çıkacağını seç.</p>

        {yukleniyor ? (
          <div className="yukleniyor-kutu">
            <div className="spinner" />
          </div>
        ) : (
          <form onSubmit={kaydet} className="transfer-form">
            {gruplar.map((grup) => {
              const grupBirimleri = birimler[grup.varyant_id] || [];
              const secilen = secilenToplam(grup.varyant_id);
              const kalan = yuvarla(grup.gereken - secilen);
              const tamam = kalan === 0;

              return (
                <div key={grup.varyant_id} className="kalem-blogu">
                  <h4 className="bolum-basligi">
                    {grup.urun_adi} · {grup.boy} · {Number(grup.ambalaj_kg)}kg{" "}
                    {grup.ambalaj_tipi}
                  </h4>

                  <span className={tamam ? "kucuk-not" : "hata-metni"}>
                    Gereken {grup.gereken.toFixed(0)} · Seçilen{" "}
                    {secilen.toFixed(0)}
                    {!tamam &&
                      (kalan > 0
                        ? ` · ${kalan.toFixed(0)} adet eksik`
                        : ` · ${Math.abs(kalan).toFixed(0)} adet fazla`)}
                  </span>

                  {grupBirimleri.length === 0 ? (
                    <div className="bos-durum">
                      Bu üründen depoda stok birimi yok.
                    </div>
                  ) : (
                    <table className="ic-tablo">
                      <thead>
                        <tr>
                          <th>Birim</th>
                          <th>Lokasyon</th>
                          <th>Mevcut</th>
                          <th>Alınacak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupBirimleri.map((birim) => (
                          <tr key={birim.id}>
                            <td>
                              <span
                                className={`etiket etiket-${
                                  birim.tip === "palet" ? "mavi" : "gri"
                                }`}
                              >
                                {birim.tip === "palet" ? birim.kod : "Dökme"}
                              </span>
                            </td>
                            <td>{birim.lokasyon_kod}</td>
                            <td>{Number(birim.miktar).toFixed(0)}</td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={Number(birim.miktar)}
                                placeholder="0"
                                value={secimler[birim.id] ?? ""}
                                onChange={(e) =>
                                  secimDegistir(birim.id, e.target.value)
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}

            <div className="modal-aksiyon">
              <button type="button" className="ikincil" onClick={kapat}>
                Vazgeç
              </button>
              <button type="submit" disabled={gonderiliyor || !hepsiTamam}>
                {gonderiliyor ? "İşleniyor..." : "Teslim Et"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default PickingModal;
