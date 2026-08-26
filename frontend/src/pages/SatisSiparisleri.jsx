import { Fragment, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import {
  satislariGetir,
  satisOlustur,
  satisIptal,
  satisDetay,
} from "../api/satisApi";
import { musterileriGetir } from "../api/musteriApi";
import { varyantlariGetir } from "../api/varyantApi";
import Etiket from "../components/Etiket";
import Fis from "../components/Fis";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";
import OnayModal from "../components/OnayModal";
import AllocationModal from "../components/AllocationModal";
import DeliveryModal from "../components/DeliveryModal";
import ErrorState from "../components/ErrorState";
import Pagination from "../components/Pagination";
import { SAYFA_BOYUTU } from "../sabitler";

function SatisSiparisleri() {
  const bildir = useToast();

  const [sayfa, setSayfa] = useState(1);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [tahsisAcik, setTahsisAcik] = useState(false);
  const [teslimEdilecek, setTeslimEdilecek] = useState(null);
  const [iptalEdilecek, setIptalEdilecek] = useState(null);

  const [acikDetay, setAcikDetay] = useState(null);

  const {
    data: detayKalemler,
    loading: detayYukleniyor,
    error: detayHatasi,
  } = useFetch(
    () => (acikDetay ? satisDetay(acikDetay) : Promise.resolve({ data: [] })),
    [acikDetay],
    { initial: [], errorMessage: "Sipariş detayı yüklenemedi" },
  );

  const fisIstekRef = useRef(0);

  const [fisSiparis, setFisSiparis] = useState(null);
  const [fisKalemler, setFisKalemler] = useState([]);

  const [musteriId, setMusteriId] = useState("");
  const [kalemler, setKalemler] = useState([
    { varyant_id: "", miktar: "", birim: "adet", birim_fiyat: "" },
  ]);

  const {
    data: siparisler,
    total: toplam,
    loading: yukleniyor,
    error: siparisHatasi,
    refresh: siparisleriYukle,
  } = useFetch(() => satislariGetir({ sayfa, limit: SAYFA_BOYUTU }), [sayfa], {
    initial: [],
    errorMessage: "Siparişler yüklenemedi",
  });

  const { data: musteriler, error: musteriHatasi } = useFetch(
    () => musterileriGetir(),
    [],
    { initial: [], errorMessage: "Müşteriler yüklenemedi" },
  );

  const { data: varyantlar, refresh: varyantlariYenile } = useFetch(
    () => varyantlariGetir(),
    [],
    { initial: [], errorMessage: "Varyantlar yüklenemedi" },
  );

  const hata = siparisHatasi || musteriHatasi;
  const secilenMusteriId = musteriId || musteriler[0]?.id || "";

  const kalemHesapla = (kalem) => {
    const varyant = varyantlar.find(
      (v) => v.id === parseInt(kalem.varyant_id, 10),
    );
    const ambalajKg = Number(varyant?.ambalaj_kg) || 1;
    const girilenMiktar = Number(kalem.miktar || 0);
    const fiyatKg = Number(kalem.birim_fiyat || 0);
    const kgModu = kalem.birim === "kg";

    const miktarAdet = kgModu ? girilenMiktar / ambalajKg : girilenMiktar;
    const miktarKg = miktarAdet * ambalajKg;

    return {
      varyant,
      ambalajKg,
      miktarAdet,
      miktarKg,
      fiyatKg,
      fiyatAdet: fiyatKg * ambalajKg,
      tutar: miktarKg * fiyatKg,
      mevcutStok: Number(varyant?.miktar || 0),
    };
  };

  const genelToplam = kalemler.reduce(
    (toplam, kalem) => toplam + kalemHesapla(kalem).tutar,
    0,
  );

  const tahsisKalemleri = kalemler
    .filter((kalem) => kalem.varyant_id && Number(kalem.miktar) > 0)
    .map((kalem) => {
      const hesap = kalemHesapla(kalem);
      return {
        varyant_id: Number(kalem.varyant_id),
        miktar: hesap.miktarAdet,
        urun_adi: hesap.varyant?.urun_adi,
        boy: hesap.varyant?.boy,
        ambalaj_kg: hesap.varyant?.ambalaj_kg,
        ambalaj_tipi: hesap.varyant?.ambalaj_tipi,
      };
    });

  const detayAc = (id) => {
    setAcikDetay((onceki) => (onceki === id ? null : id));
  };

  const fisAc = async (siparis) => {
    const istekId = ++fisIstekRef.current;

    try {
      const response = await satisDetay(siparis.id);
      if (istekId !== fisIstekRef.current) return;
      setFisKalemler(response.data);
      setFisSiparis(siparis);
    } catch (err) {
      if (istekId !== fisIstekRef.current) return;
      bildir(err.response?.data?.hata || "Fiş oluşturulamadı", "hata");
    }
  };

  const kalemDegistir = (index, alan, deger) => {
    const yeniKalemler = [...kalemler];
    yeniKalemler[index] = { ...yeniKalemler[index], [alan]: deger };
    setKalemler(yeniKalemler);
  };

  const kalemEkle = () => {
    setKalemler([
      ...kalemler,
      { varyant_id: "", miktar: "", birim: "adet", birim_fiyat: "" },
    ]);
  };

  const kalemSil = (index) => {
    setKalemler(kalemler.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!tahsisKalemleri.length) {
      bildir("En az bir kalem eklemelisiniz", "hata");
      return;
    }

    setTahsisAcik(true);
  };

  const siparisiOlustur = async (tahsisler) => {
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await satisOlustur({
        musteri_id: secilenMusteriId,
        kalemler: kalemler.map((kalem) => {
          const hesap = kalemHesapla(kalem);
          return {
            varyant_id: kalem.varyant_id,
            miktar: hesap.miktarAdet,
            birim_fiyat: hesap.fiyatAdet,
          };
        }),
        tahsisler,
      });
      setKalemler([
        { varyant_id: "", miktar: "", birim: "adet", birim_fiyat: "" },
      ]);
      setTahsisAcik(false);
      bildir("Satış siparişi oluşturuldu, stok ayrıldı");
      if (sayfa === 1) {
        siparisleriYukle();
      } else {
        setSayfa(1);
      }
    } catch (err) {
      bildir(err.response?.data?.hata || "Sipariş oluşturulamadı", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  const teslimTamamlandi = () => {
    setTeslimEdilecek(null);
    siparisleriYukle();
    varyantlariYenile();
  };

  const iptalOnayla = async () => {
    const id = iptalEdilecek.id;
    setIptalEdilecek(null);
    try {
      const response = await satisIptal(id);
      bildir(response.data.mesaj);
      siparisleriYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "İptal edilemedi", "hata");
    }
  };

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <ErrorState mesaj={hata} tekrarDene={siparisleriYukle} />;

  return (
    <div>
      <h2>Satış Siparişleri</h2>

      <form onSubmit={handleSubmit} className="form-dikey">
        <div className="form-satir">
          <label>Müşteri</label>
          <select
            value={secilenMusteriId}
            onChange={(e) => setMusteriId(e.target.value)}
            required
          >
            <option value="">Seçiniz</option>
            {musteriler.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ad}
              </option>
            ))}
          </select>
        </div>

        {kalemler.map((kalem, index) => {
          const hesap = kalemHesapla(kalem);
          const yetersiz =
            kalem.varyant_id && hesap.miktarAdet > hesap.mevcutStok;

          return (
            <div key={index} className="kalem-blogu">
              <div className="kalem-satiri">
                <select
                  value={kalem.varyant_id}
                  onChange={(e) =>
                    kalemDegistir(index, "varyant_id", e.target.value)
                  }
                  required
                >
                  <option value="">Varyant seç</option>
                  {varyantlar.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.urun_adi} · {v.boy} · {Number(v.ambalaj_kg)}kg{" "}
                      {v.ambalaj_tipi} (stok: {Number(v.miktar).toFixed(0)})
                    </option>
                  ))}
                </select>

                <div className="miktar-girisi">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Miktar"
                    value={kalem.miktar}
                    onChange={(e) =>
                      kalemDegistir(index, "miktar", e.target.value)
                    }
                    required
                  />
                  <select
                    value={kalem.birim}
                    onChange={(e) =>
                      kalemDegistir(index, "birim", e.target.value)
                    }
                  >
                    <option value="adet">adet</option>
                    <option value="kg">kg</option>
                  </select>
                </div>

                <input
                  type="number"
                  step="0.01"
                  placeholder="TL / kg"
                  value={kalem.birim_fiyat}
                  onChange={(e) =>
                    kalemDegistir(index, "birim_fiyat", e.target.value)
                  }
                  required
                />

                {kalemler.length > 1 && (
                  <button
                    type="button"
                    className="tehlike"
                    onClick={() => kalemSil(index)}
                  >
                    Kaldır
                  </button>
                )}
              </div>

              {kalem.varyant_id && Number(kalem.miktar) > 0 && (
                <span className={yetersiz ? "hata-metni" : "onemli-not"}>
                  {hesap.miktarAdet.toFixed(2)} adet ·{" "}
                  {hesap.miktarKg.toFixed(0)} kg
                  {hesap.fiyatKg > 0 &&
                    ` · ${hesap.fiyatAdet.toFixed(2)} TL/adet · Tutar: ${hesap.tutar.toLocaleString("tr-TR")} ₺`}
                  {yetersiz &&
                    ` — toplam stoktan fazla (mevcut ${hesap.mevcutStok.toFixed(0)} adet)`}
                </span>
              )}
            </div>
          );
        })}

        <div className="form-aksiyon">
          <button type="button" onClick={kalemEkle}>
            + Kalem Ekle
          </button>
          <button type="submit">Devam · Stok Ayır</button>
        </div>

        {genelToplam > 0 && (
          <div className="form-toplam">
            <span>Genel Toplam</span>
            <strong>{genelToplam.toLocaleString("tr-TR")} ₺</strong>
          </div>
        )}
      </form>

      {siparisler.length === 0 ? (
        <div className="bos-durum">Henüz satış siparişi yok.</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>#</th>
                <th>Müşteri</th>
                <th>Durum</th>
                <th>Toplam Tutar</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {siparisler.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td>
                      <button
                        className="ikincil ikon-btn"
                        onClick={() => detayAc(s.id)}
                        title="Kalemleri göster"
                        aria-label="Sipariş kalemlerini göster"
                      >
                        {acikDetay === s.id ? (
                          <ChevronDown size={15} />
                        ) : (
                          <ChevronRight size={15} />
                        )}
                      </button>
                    </td>
                    <td>{s.id}</td>
                    <td>{s.musteri_adi}</td>
                    <td>
                      <Etiket deger={s.durum} />
                    </td>
                    <td>{Number(s.toplam_tutar).toLocaleString("tr-TR")} ₺</td>
                    <td>
                      {s.durum !== "teslim_edildi" && s.durum !== "iptal" && (
                        <>
                          <button onClick={() => setTeslimEdilecek(s)}>
                            Teslim Et
                          </button>
                          <button
                            className="ikincil"
                            onClick={() => setIptalEdilecek(s)}
                          >
                            İptal
                          </button>
                        </>
                      )}
                      <button
                        className="ikincil ikon-btn"
                        onClick={() => fisAc(s)}
                        title="Fiş"
                        aria-label="Satış fişini aç"
                      >
                        <Receipt size={15} />
                      </button>
                    </td>
                  </tr>

                  {acikDetay === s.id && (
                    <tr className="detay-satiri">
                      <td colSpan={6}>
                        {detayYukleniyor ? (
                          <div className="yukleniyor-kutu">
                            <div className="spinner" />
                          </div>
                        ) : detayHatasi ? (
                          <div className="bos-durum">{detayHatasi}</div>
                        ) : detayKalemler.length === 0 ? (
                          <div className="bos-durum">
                            Bu siparişte kalem yok.
                          </div>
                        ) : (
                          <table className="ic-tablo">
                            <thead>
                              <tr>
                                <th>Ürün</th>
                                <th>Varyant</th>
                                <th>Miktar</th>
                                <th>Toplam kg</th>
                                <th>Birim Fiyat</th>
                                <th>Tutar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detayKalemler.map((k) => (
                                <tr key={k.id}>
                                  <td>{k.urun_adi}</td>
                                  <td>
                                    {k.boy} · {Number(k.ambalaj_kg)}kg{" "}
                                    {k.ambalaj_tipi}
                                  </td>
                                  <td>{Number(k.miktar).toFixed(0)} adet</td>
                                  <td>
                                    {(
                                      Number(k.miktar) * Number(k.ambalaj_kg)
                                    ).toFixed(0)}{" "}
                                    kg
                                  </td>
                                  <td>
                                    {Number(k.birim_fiyat).toLocaleString(
                                      "tr-TR",
                                    )}{" "}
                                    ₺
                                  </td>
                                  <td>
                                    {(
                                      Number(k.miktar) * Number(k.birim_fiyat)
                                    ).toLocaleString("tr-TR")}{" "}
                                    ₺
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <Pagination
            sayfa={sayfa}
            toplam={toplam}
            sayfaBoyutu={SAYFA_BOYUTU}
            degisti={setSayfa}
          />
        </>
      )}

      {tahsisAcik && (
        <AllocationModal
          acik
          kalemler={tahsisKalemleri}
          gonderiliyor={gonderiliyor}
          kapat={() => setTahsisAcik(false)}
          tamamlandi={siparisiOlustur}
        />
      )}

      {teslimEdilecek && (
        <DeliveryModal
          acik
          siparis={teslimEdilecek}
          kapat={() => setTeslimEdilecek(null)}
          tamamlandi={teslimTamamlandi}
        />
      )}

      <OnayModal
        acik={iptalEdilecek !== null}
        baslik="Siparişi iptal et"
        mesaj={`#${iptalEdilecek?.id} numaralı sipariş iptal edilecek ve ayrılan stok serbest bırakılacak.`}
        onayMetni="İptal Et"
        onayla={iptalOnayla}
        iptal={() => setIptalEdilecek(null)}
      />

      <Fis
        acik={fisSiparis !== null}
        tip="satis"
        siparis={fisSiparis}
        kalemler={fisKalemler}
        kapat={() => setFisSiparis(null)}
      />
    </div>
  );
}

export default SatisSiparisleri;
