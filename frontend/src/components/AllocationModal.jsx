import { useEffect, useState } from "react";
import { PackageSearch } from "lucide-react";
import { getStockUnits } from "../api/stockUnitApi";
import Modal from "./Modal";
import { useToast } from "../context/ToastContext";

const yuvarla = (sayi) => Math.round(sayi * 100) / 100;

function AllocationModal({
  acik,
  kalemler = [],
  kapat,
  tamamlandi,
  gonderiliyor,
}) {
  const bildir = useToast();
  const [birimler, setBirimler] = useState({});
  const [secimler, setSecimler] = useState({});
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    if (!acik || !kalemler?.length) return;

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
          harita[vid] = sonuclar[i].data.filter(
            (b) => Number(b.kullanilabilir) > 0,
          );
        });
        setBirimler(harita);
      } catch (err) {
        bildir(
          err.response?.data?.hata || "Stok birimleri yüklenemedi",
          "hata",
        );
      } finally {
        setYukleniyor(false);
      }
    };

    yukle();
    // "kalemler" bilerek bagimliliklarda yok. Her cizimde yeni bir dizi
    // referansi uretildigi icin eklenirse istek dongusu olusur. Kullanilabilir
    // stok, modal her acildiginda bir kez cekiliyor; modal acikken kalem
    // listesi degismiyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acik, bildir]);

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

  const kaydet = (e) => {
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

    tamamlandi(tahsisler);
  };

  return (
    <Modal
      acik={acik}
      kapat={kapat}
      baslik="Stok ayırma"
      sinif="transfer-modal"
      kirli={Object.values(secimler).some((s) => s !== "" && s !== undefined)}
    >
      <div className="modal-ikon modal-ikon-notr">
        <PackageSearch size={22} />
      </div>
      <h3>Stok Ayır</h3>
      <p>
        Sipariş oluşturulurken bu mal depoda ayrılacak ve başka siparişlere
        satılamayacak.
      </p>

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

            const toplamKullanilabilir = yuvarla(
              grupBirimleri.reduce((t, b) => t + Number(b.kullanilabilir), 0),
            );

            return (
              <div key={grup.varyant_id} className="kalem-blogu">
                <h4 className="bolum-basligi">
                  {grup.urun_adi} · {grup.boy} · {Number(grup.ambalaj_kg)}kg{" "}
                  {grup.ambalaj_tipi}
                </h4>

                <span className={tamam ? "onemli-not" : "hata-metni"}>
                  Gereken {grup.gereken.toFixed(0)} · Ayrılan{" "}
                  {secilen.toFixed(0)}
                  {!tamam &&
                    (kalan > 0
                      ? ` · ${kalan.toFixed(0)} adet eksik`
                      : ` · ${Math.abs(kalan).toFixed(0)} adet fazla`)}
                </span>

                {toplamKullanilabilir < grup.gereken && (
                  <div className="hata-metni">
                    Depoda yalnızca {toplamKullanilabilir.toFixed(0)} adet
                    kullanılabilir stok var. Sipariş miktarını düşürmelisiniz.
                  </div>
                )}

                {grupBirimleri.length === 0 ? (
                  <div className="bos-durum">
                    Bu üründen kullanılabilir stok yok.
                  </div>
                ) : (
                  <table className="ic-tablo">
                    <thead>
                      <tr>
                        <th>Birim</th>
                        <th>Lokasyon</th>
                        <th>Kullanılabilir</th>
                        <th>Ayrılacak</th>
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
                          <td>
                            {Number(birim.kullanilabilir).toFixed(0)}
                            {Number(birim.rezerve) > 0 && (
                              <span className="kucuk-not">
                                {" "}
                                ({Number(birim.miktar).toFixed(0)} mevcut)
                              </span>
                            )}
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={Number(birim.kullanilabilir)}
                              placeholder="0"
                              value={secimler[birim.id] ?? ""}
                              onChange={(e) =>
                                setSecimler((onceki) => ({
                                  ...onceki,
                                  [birim.id]: e.target.value,
                                }))
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
              {gonderiliyor ? "Oluşturuluyor..." : "Siparişi Oluştur"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default AllocationModal;
