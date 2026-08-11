import { useState } from "react";
import { Plus, Trash2, Store, Receipt } from "lucide-react";
import {
  seferleriGetir,
  seferOzetiGetir,
  seferKalemleriGetir,
  seferAc,
} from "../api/marketTripApi";
import { lokasyonlariGetir } from "../api/lokasyonApi";
import { varyantlariGetir } from "../api/varyantApi";
import AllocationModal from "../components/AllocationModal";
import MarketReturnModal from "../components/MarketReturnModal";
import MarketTripReceipt from "../components/MarketTripReceipt";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";

const SAYFA_BOYUTU = 20;
const BOS_KALEM = { varyant_id: "", miktar: "", birim: "adet" };

function paraFormat(sayi) {
  return Number(sayi).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MarketTrips() {
  const bildir = useToast();

  const [sayfa, setSayfa] = useState(1);
  const [ozetYil, setOzetYil] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [tahsisAcik, setTahsisAcik] = useState(false);
  const [donusAcik, setDonusAcik] = useState(false);
  const [pazarId, setPazarId] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [kalemler, setKalemler] = useState([BOS_KALEM]);

  const [fisSefer, setFisSefer] = useState(null);
  const [fisKalemler, setFisKalemler] = useState([]);

  const {
    data: seferler,
    total: toplam,
    loading: yukleniyor,
    error: hata,
    refresh: seferleriYukle,
  } = useFetch(() => seferleriGetir({ sayfa, limit: SAYFA_BOYUTU }), [sayfa], {
    initial: [],
    errorMessage: "Seferler yüklenemedi",
  });

  const { data: acikSeferler, refresh: acikSeferiYenile } = useFetch(
    () => seferleriGetir({ durum: "yolda" }),
    [],
    { initial: [], errorMessage: "Açık sefer bilgisi alınamadı" },
  );

  const { data: ozet, refresh: ozetiYenile } = useFetch(
    () => seferOzetiGetir({ yil: ozetYil || undefined }),
    [ozetYil],
    {
      initial: { yil: null, yillar: [], satirlar: [] },
      errorMessage: "Özet yüklenemedi",
    },
  );

  const { data: lokasyonlar } = useFetch(() => lokasyonlariGetir(), [], {
    initial: [],
    errorMessage: "Lokasyonlar yüklenemedi",
  });

  const { data: varyantlar, refresh: varyantlariYenile } = useFetch(
    () => varyantlariGetir(),
    [],
    { initial: [], errorMessage: "Ürünler yüklenemedi" },
  );

  const pazarlar = lokasyonlar.filter((l) => l.tip === "pazar" && l.aktif);
  const acikSefer = acikSeferler[0] || null;
  const toplamSayfa = Math.ceil(toplam / SAYFA_BOYUTU);
  const secilenPazarId = pazarId || pazarlar[0]?.id || "";

  const ozetToplami = ozet.satirlar.reduce(
    (t, s) => ({
      giden: t.giden + Number(s.toplam_giden),
      donen: t.donen + Number(s.toplam_donen),
      satilan: t.satilan + Number(s.toplam_satilan),
      hasilat: t.hasilat + Number(s.tahmini_hasilat),
    }),
    { giden: 0, donen: 0, satilan: 0, hasilat: 0 },
  );

  const kalemHesapla = (kalem) => {
    const varyant = varyantlar.find(
      (v) => v.id === parseInt(kalem.varyant_id, 10),
    );
    const ambalajKg = Number(varyant?.ambalaj_kg) || 1;
    const girilen = Number(kalem.miktar || 0);
    const miktarAdet = kalem.birim === "kg" ? girilen / ambalajKg : girilen;

    return { varyant, ambalajKg, miktarAdet, miktarKg: miktarAdet * ambalajKg };
  };

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

  const kalemDegistir = (index, alan, deger) => {
    const yeniKalemler = [...kalemler];
    yeniKalemler[index] = { ...yeniKalemler[index], [alan]: deger };
    setKalemler(yeniKalemler);
  };

  const fisAc = async (sefer) => {
    try {
      const response = await seferKalemleriGetir(sefer.id);
      setFisKalemler(response.data);
      setFisSefer(sefer);
    } catch (err) {
      bildir(err.response?.data?.hata || "Fiş oluşturulamadı", "hata");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!secilenPazarId) {
      bildir("Önce Lokasyon Yönetimi'nden bir pazar tanımlayın", "hata");
      return;
    }
    if (!tahsisKalemleri.length) {
      bildir("En az bir ürün eklemelisiniz", "hata");
      return;
    }

    setTahsisAcik(true);
  };

  const seferiOlustur = async (tahsisler) => {
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      const response = await seferAc({
        lokasyon_id: Number(secilenPazarId),
        kalemler: tahsisKalemleri.map((k) => ({
          varyant_id: k.varyant_id,
          miktar: k.miktar,
        })),
        tahsisler,
        aciklama,
      });
      bildir(response.data.mesaj);
      setTahsisAcik(false);
      setKalemler([BOS_KALEM]);
      setAciklama("");
      seferleriYukle();
      acikSeferiYenile();
      varyantlariYenile();
    } catch (err) {
      bildir(err.response?.data?.hata || "Sefer açılamadı", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  const donusTamamlandi = () => {
    setDonusAcik(false);
    seferleriYukle();
    acikSeferiYenile();
    varyantlariYenile();
    ozetiYenile();
  };

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <p className="hata-metni">{hata}</p>;

  return (
    <div>
      <h2>Pazar Seferleri</h2>

      {acikSefer ? (
        <div className="tutarlilik-kutu sapma-var">
          <Store size={20} />
          <div>
            <strong>
              {acikSefer.fis_no} · {acikSefer.pazar_adi || acikSefer.pazar_kod}{" "}
              yolda
            </strong>
            <span className="kucuk-not">
              {Number(acikSefer.toplam_giden).toFixed(0)} adet mal pazarda. Yeni
              sefer açmadan önce bu seferi kapatmalısınız.
            </span>
          </div>
          <div className="yan-aksiyon">
            <button className="ikincil" onClick={() => fisAc(acikSefer)}>
              <Receipt size={15} /> Fiş
            </button>
            <button onClick={() => setDonusAcik(true)}>Dönüşü Kaydet</button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="bolum-basligi">Yeni sefer</h2>

          {pazarlar.length === 0 ? (
            <div className="bos-durum">
              Tanımlı pazar yok. Lokasyon Yönetimi ekranından tip olarak
              &quot;Pazar&quot; seçip bir lokasyon ekleyin.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-alan">
                <label>Pazar</label>
                <select
                  value={secilenPazarId}
                  onChange={(e) => setPazarId(e.target.value)}
                >
                  {pazarlar.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ad || p.kod}
                    </option>
                  ))}
                </select>
              </div>

              <div className="kalem-blogu">
                {kalemler.map((kalem, index) => {
                  const hesap = kalemHesapla(kalem);
                  return (
                    <div className="kalem-satiri" key={index}>
                      <div className="form-alan">
                        <label>Ürün</label>
                        <select
                          value={kalem.varyant_id}
                          onChange={(e) =>
                            kalemDegistir(index, "varyant_id", e.target.value)
                          }
                        >
                          <option value="">Seçiniz</option>
                          {varyantlar.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.urun_adi} · {v.boy} · {Number(v.ambalaj_kg)}kg{" "}
                              {v.ambalaj_tipi}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-alan">
                        <label>Götürülecek</label>
                        <div className="miktar-girisi">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={kalem.miktar}
                            onChange={(e) =>
                              kalemDegistir(index, "miktar", e.target.value)
                            }
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
                        {kalem.birim === "kg" && Number(kalem.miktar) > 0 && (
                          <span className="kucuk-not">
                            = {hesap.miktarAdet.toFixed(2)} adet
                          </span>
                        )}
                      </div>

                      {kalemler.length > 1 && (
                        <button
                          type="button"
                          className="tehlike ikon-btn"
                          onClick={() =>
                            setKalemler(kalemler.filter((_, i) => i !== index))
                          }
                          title="Kalemi sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="form-alan">
                <label>Açıklama</label>
                <input
                  placeholder="İsteğe bağlı"
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                />
              </div>

              <div className="form-aksiyon">
                <button
                  type="button"
                  className="ikincil"
                  onClick={() => setKalemler([...kalemler, BOS_KALEM])}
                >
                  <Plus size={15} /> Ürün ekle
                </button>
                <button type="submit" disabled={gonderiliyor}>
                  Sefere Çıkar
                </button>
              </div>
            </form>
          )}
        </>
      )}

      <h2 className="bolum-basligi">Yıl özeti</h2>

      <div className="filtre-cubugu">
        <div className="form-alan">
          <label>Yıl</label>
          <select
            value={ozetYil || ozet.yil || ""}
            onChange={(e) => setOzetYil(e.target.value)}
          >
            {(ozet.yillar.length ? ozet.yillar : [ozet.yil])
              .filter(Boolean)
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
        </div>
      </div>

      {ozet.satirlar.length === 0 ? (
        <div className="bos-durum">
          Bu yıl için tamamlanmış sefer yok. Özet yalnızca kapatılmış seferleri
          sayar.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Pazar</th>
              <th>Sefer</th>
              <th>Giden</th>
              <th>Dönen</th>
              <th>Satılan</th>
              <th>Tahmini hasılat</th>
            </tr>
          </thead>
          <tbody>
            {ozet.satirlar.map((s) => (
              <tr key={s.lokasyon_id}>
                <td>{s.pazar_adi || s.pazar_kod}</td>
                <td>{s.sefer_sayisi}</td>
                <td>{Number(s.toplam_giden).toFixed(0)}</td>
                <td>{Number(s.toplam_donen).toFixed(0)}</td>
                <td>
                  <strong>{Number(s.toplam_satilan).toFixed(0)}</strong>
                </td>
                <td>{paraFormat(s.tahmini_hasilat)} ₺</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>Toplam</strong>
              </td>
              <td></td>
              <td>
                <strong>{ozetToplami.giden.toFixed(0)}</strong>
              </td>
              <td>
                <strong>{ozetToplami.donen.toFixed(0)}</strong>
              </td>
              <td>
                <strong>{ozetToplami.satilan.toFixed(0)}</strong>
              </td>
              <td>
                <strong>{paraFormat(ozetToplami.hasilat)} ₺</strong>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <h2 className="bolum-basligi">Geçmiş seferler</h2>

      {seferler.length === 0 ? (
        <div className="bos-durum">Henüz sefer kaydı yok.</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Fiş No</th>
                <th>Pazar</th>
                <th>Çıkış</th>
                <th>Dönüş</th>
                <th>Giden</th>
                <th>Dönen</th>
                <th>Satılan</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {seferler.map((s) => (
                <tr key={s.id}>
                  <td>{s.fis_no}</td>
                  <td>{s.pazar_adi || s.pazar_kod}</td>
                  <td>{s.cikis_tarihi?.slice(0, 10)}</td>
                  <td>{s.donus_tarihi?.slice(0, 10) || "-"}</td>
                  <td>{Number(s.toplam_giden).toFixed(0)}</td>
                  <td>{Number(s.toplam_donen).toFixed(0)}</td>
                  <td>
                    <strong>{Number(s.toplam_satilan).toFixed(0)}</strong>
                  </td>
                  <td>
                    <span
                      className={`etiket etiket-${
                        s.durum === "yolda" ? "sari" : "yesil"
                      }`}
                    >
                      {s.durum === "yolda" ? "Yolda" : "Tamamlandı"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="ikincil ikon-btn"
                      onClick={() => fisAc(s)}
                      title="Fiş"
                    >
                      <Receipt size={14} />
                    </button>
                  </td>
                </tr>
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

      <AllocationModal
        acik={tahsisAcik}
        kalemler={tahsisKalemleri}
        gonderiliyor={gonderiliyor}
        kapat={() => setTahsisAcik(false)}
        tamamlandi={seferiOlustur}
      />

      <MarketReturnModal
        acik={donusAcik}
        sefer={acikSefer}
        kapat={() => setDonusAcik(false)}
        tamamlandi={donusTamamlandi}
      />

      <MarketTripReceipt
        acik={fisSefer !== null}
        sefer={fisSefer}
        kalemler={fisKalemler}
        kapat={() => setFisSefer(null)}
      />
    </div>
  );
}

export default MarketTrips;
