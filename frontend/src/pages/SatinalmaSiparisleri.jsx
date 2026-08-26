import { Fragment, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Receipt } from "lucide-react";
import {
  siparisleriGetir,
  siparisOlustur,
  siparisTeslimAl,
  siparisDetay,
} from "../api/satinalmaApi";
import { tedarikcileriGetir } from "../api/tedarikciApi";
import { varyantlariGetir } from "../api/varyantApi";
import { lokasyonlariGetir } from "../api/lokasyonApi";
import Etiket from "../components/Etiket";
import Fis from "../components/Fis";
import TeslimAlModal from "../components/TeslimAlModal";
import CancelOrderModal from "../components/CancelOrderModal";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";
import useAuth from "../hooks/useAuth";
import ErrorState from "../components/ErrorState";
import { SAYFA_BOYUTU } from "../sabitler";

function SatinalmaSiparisleri() {
  const bildir = useToast();

  const { kullanici } = useAuth();
  const yonetici = kullanici?.rol === "admin";

  const [sayfa, setSayfa] = useState(1);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [teslimAlinacak, setTeslimAlinacak] = useState(null);
  const [iptalEdilecek, setIptalEdilecek] = useState(null);

  const [acikDetay, setAcikDetay] = useState(null);

  const {
    data: detayKalemler,
    loading: detayYukleniyor,
    error: detayHatasi,
  } = useFetch(
    () => (acikDetay ? siparisDetay(acikDetay) : Promise.resolve({ data: [] })),
    [acikDetay],
    { initial: [], errorMessage: "Sipariş detayı yüklenemedi" },
  );

  const fisIstekRef = useRef(0);

  const [fisSiparis, setFisSiparis] = useState(null);
  const [fisKalemler, setFisKalemler] = useState([]);

  const [tedarikciId, setTedarikciId] = useState("");
  const [kalemler, setKalemler] = useState([
    { varyant_id: "", miktar: "", birim: "adet", birim_fiyat: "" },
  ]);

  const {
    data: siparisler,
    total: toplam,
    loading: yukleniyor,
    error: siparisHatasi,
    refresh: siparisleriYukle,
  } = useFetch(
    () => siparisleriGetir({ sayfa, limit: SAYFA_BOYUTU }),
    [sayfa],
    { initial: [], errorMessage: "Siparişler yüklenemedi" },
  );

  const { data: tedarikciler, error: tedarikciHatasi } = useFetch(
    () => tedarikcileriGetir(),
    [],
    { initial: [], errorMessage: "Tedarikçiler yüklenemedi" },
  );

  const { data: varyantlar, refresh: varyantlariYenile } = useFetch(
    () => varyantlariGetir(),
    [],
    { initial: [], errorMessage: "Varyantlar yüklenemedi" },
  );

  const { data: tumLokasyonlar } = useFetch(() => lokasyonlariGetir(), [], {
    initial: [],
    errorMessage: "Lokasyonlar yüklenemedi",
  });

  const lokasyonlar = tumLokasyonlar.filter((l) => l.aktif);
  const hata = siparisHatasi || tedarikciHatasi;
  const toplamSayfa = Math.ceil(toplam / SAYFA_BOYUTU);
  const secilenTedarikciId = tedarikciId || tedarikciler[0]?.id || "";

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
      ambalajKg,
      miktarAdet,
      miktarKg,
      fiyatKg,
      fiyatAdet: fiyatKg * ambalajKg,
      tutar: miktarKg * fiyatKg,
    };
  };

  const genelToplam = kalemler.reduce(
    (toplam, kalem) => toplam + kalemHesapla(kalem).tutar,
    0,
  );

  const detayAc = (id) => {
    setAcikDetay((onceki) => (onceki === id ? null : id));
  };

  const fisAc = async (siparis) => {
    const istekId = ++fisIstekRef.current;

    try {
      const response = await siparisDetay(siparis.id);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await siparisOlustur({
        tedarikci_id: secilenTedarikciId,
        kalemler: kalemler.map((kalem) => {
          const hesap = kalemHesapla(kalem);
          return {
            varyant_id: kalem.varyant_id,
            miktar: hesap.miktarAdet,
            birim_fiyat: hesap.fiyatAdet,
          };
        }),
      });
      setKalemler([
        { varyant_id: "", miktar: "", birim: "adet", birim_fiyat: "" },
      ]);
      bildir("Alım siparişi oluşturuldu");
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

  const teslimAlOnayla = async (lokasyonId) => {
    try {
      await siparisTeslimAl(teslimAlinacak.id, { lokasyon_id: lokasyonId });
      bildir("Sipariş teslim alındı, stoklar güncellendi");
      setTeslimAlinacak(null);
      siparisleriYukle();
      varyantlariYenile();
    } catch (err) {
      bildir(err.response?.data?.hata || "Teslim alınamadı", "hata");
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
      <h2>Alım Siparişleri</h2>

      <form onSubmit={handleSubmit} className="form-dikey">
        <div className="form-satir">
          <label>Tedarikçi</label>
          <select
            value={secilenTedarikciId}
            onChange={(e) => setTedarikciId(e.target.value)}
          >
            {tedarikciler.map((t) => (
              <option key={t.id} value={t.id}>
                {t.ad}
              </option>
            ))}
          </select>
        </div>

        {kalemler.map((kalem, index) => {
          const hesap = kalemHesapla(kalem);

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
                      {v.ambalaj_tipi}
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
                <span className="kucuk-not">
                  {hesap.miktarAdet.toFixed(2)} adet ·{" "}
                  {hesap.miktarKg.toFixed(0)} kg
                  {hesap.fiyatKg > 0 &&
                    ` · ${hesap.fiyatAdet.toFixed(2)} TL/adet · Tutar: ${hesap.tutar.toLocaleString("tr-TR")} ₺`}
                </span>
              )}
            </div>
          );
        })}

        <div className="form-aksiyon">
          <button type="button" onClick={kalemEkle}>
            + Kalem Ekle
          </button>
          <button type="submit" disabled={gonderiliyor}>
            {gonderiliyor ? "Oluşturuluyor..." : "Siparişi Oluştur"}
          </button>
        </div>

        {genelToplam > 0 && (
          <div className="form-toplam">
            <span>Genel Toplam</span>
            <strong>{genelToplam.toLocaleString("tr-TR")} ₺</strong>
          </div>
        )}
      </form>

      {siparisler.length === 0 ? (
        <div className="bos-durum">Henüz alım siparişi yok.</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>#</th>
                <th>Tedarikçi</th>
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
                    <td>{s.tedarikci_adi}</td>
                    <td title={s.iptal_aciklamasi || undefined}>
                      <Etiket deger={s.durum} />
                    </td>
                    <td>{Number(s.toplam_tutar).toLocaleString("tr-TR")} ₺</td>
                    <td>
                      {s.durum !== "teslim_alindi" && s.durum !== "iptal" && (
                        <>
                          <button onClick={() => setTeslimAlinacak(s)}>
                            Teslim Al
                          </button>
                          {yonetici && (
                            <button
                              className="ikincil"
                              onClick={() => setIptalEdilecek(s)}
                            >
                              İptal
                            </button>
                          )}
                        </>
                      )}
                      <button
                        className="ikincil ikon-btn"
                        onClick={() => fisAc(s)}
                        title="Fiş"
                        aria-label="Alım fişini aç"
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

          {toplam > SAYFA_BOYUTU && (
            <div className="sayfalama">
              <button
                onClick={() => setSayfa(sayfa - 1)}
                disabled={sayfa === 1}
              >
                Önceki
              </button>
              <span>
                Sayfa {sayfa} / {toplamSayfa} · Toplam {toplam} kayıt
              </span>
              <button
                onClick={() => setSayfa(sayfa + 1)}
                disabled={sayfa >= toplamSayfa}
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}

      {teslimAlinacak && (
        <TeslimAlModal
          acik
          siparis={teslimAlinacak}
          lokasyonlar={lokasyonlar}
          kapat={() => setTeslimAlinacak(null)}
          onayla={teslimAlOnayla}
        />
      )}

      {iptalEdilecek && (
        <CancelOrderModal
          siparis={iptalEdilecek}
          kapat={() => setIptalEdilecek(null)}
          tamamlandi={siparisleriYukle}
        />
      )}

      <Fis
        acik={fisSiparis !== null}
        tip="alim"
        siparis={fisSiparis}
        kalemler={fisKalemler}
        kapat={() => setFisSiparis(null)}
      />
    </div>
  );
}

export default SatinalmaSiparisleri;
