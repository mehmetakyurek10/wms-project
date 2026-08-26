import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import {
  stokHareketleriniGetir,
  stokHareketiEkle,
} from "../api/stokHareketleri";
import { varyantlariGetir } from "../api/varyantApi";
import { lokasyonlariGetir } from "../api/lokasyonApi";
import { getStockUnits } from "../api/stockUnitApi";
import Etiket from "../components/Etiket";
import LokasyonSecici from "../components/LokasyonSecici";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";
import ErrorState from "../components/ErrorState";
import Pagination from "../components/Pagination";

import { SAYFA_BOYUTU } from "../sabitler";
const FILTRE_ALANLARI = ["varyant_id", "tip", "sebep", "baslangic", "bitis"];

function StokHareketleri() {
  const bildir = useToast();
  const [parametreler, setParametreler] = useSearchParams();

  // Filtreler ve sayfa numarasi adres cubugunda tutuluyor: sayfa
  // yenilendiginde kayboluyorlardi ve filtreli bir goruntu paylasilamiyordu.
  const sayfa = Number(parametreler.get("sayfa")) || 1;
  const filtre = Object.fromEntries(
    FILTRE_ALANLARI.map((alan) => [alan, parametreler.get(alan) || ""]),
  );

  const parametreGuncelle = (yeniler) => {
    const sonraki = new URLSearchParams(parametreler);

    for (const [anahtar, deger] of Object.entries(yeniler)) {
      if (deger === "" || deger === undefined || deger === null) {
        sonraki.delete(anahtar);
      } else {
        sonraki.set(anahtar, String(deger));
      }
    }

    // replace kullaniliyor: her filtre degisikligi gecmise ayri bir kayit
    // birakirsa geri tusu kullanilamaz hale gelir.
    setParametreler(sonraki, { replace: true });
  };

  // URLSearchParams her cizimde yeni nesne uretir; bagimliliga metin halini
  // vermek gereksiz yeniden cekmeyi onluyor.
  const sorguAnahtari = parametreler.toString();

  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [form, setForm] = useState({
    varyant_id: "",
    lokasyon_id: "",
    birim_id: "",
    tip: "giris",
    sebep: "manuel",
    miktar: "",
    birim: "adet",
    aciklama: "",
  });

  const {
    data: hareketler,
    total: toplam,
    loading: yukleniyor,
    error: hata,
    refresh: hareketleriYukle,
  } = useFetch(
    () => stokHareketleriniGetir({ ...filtre, sayfa, limit: SAYFA_BOYUTU }),
    [sorguAnahtari],
    { initial: [], errorMessage: "Hareketler yüklenemedi" },
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

  const secilenVaryantId = form.varyant_id || varyantlar[0]?.id || "";

  const { data: birimler, refresh: birimleriYenile } = useFetch(
    () =>
      form.tip === "cikis" && secilenVaryantId
        ? getStockUnits({ varyant_id: secilenVaryantId })
        : Promise.resolve({ data: [] }),
    [form.tip, secilenVaryantId],
    { initial: [], errorMessage: "Stok birimleri yüklenemedi" },
  );

  const lokasyonlar = tumLokasyonlar.filter((l) => l.aktif);
  const secilebilirBirimler = birimler.filter(
    (b) => Number(b.kullanilabilir) > 0,
  );

  const filtreVar = FILTRE_ALANLARI.some((alan) => filtre[alan] !== "");

  const filtreDegisti = (e) => {
    parametreGuncelle({ [e.target.name]: e.target.value, sayfa: "" });
  };

  const secilenVaryant = varyantlar.find(
    (v) => v.id === parseInt(secilenVaryantId, 10),
  );
  const ambalajKg = Number(secilenVaryant?.ambalaj_kg) || 1;
  const miktarAdet =
    form.birim === "kg"
      ? Number(form.miktar || 0) / ambalajKg
      : Number(form.miktar || 0);

  const handleChange = (e) => {
    const yeniForm = { ...form, [e.target.name]: e.target.value };
    if (e.target.name === "varyant_id" || e.target.name === "tip") {
      yeniForm.lokasyon_id = "";
      yeniForm.birim_id = "";
    }
    setForm(yeniForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await stokHareketiEkle({
        varyant_id: secilenVaryantId,
        lokasyon_id: form.lokasyon_id,
        birim_id: form.birim_id,
        tip: form.tip,
        sebep: form.sebep,
        miktar: miktarAdet,
        aciklama: form.aciklama,
      });
      setForm({ ...form, miktar: "", aciklama: "", birim_id: "" });
      bildir("Stok hareketi kaydedildi");
      hareketleriYukle();
      varyantlariYenile();
      birimleriYenile();
    } catch (err) {
      bildir(err.response?.data?.hata || "Hareket eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  if (yukleniyor)
    return (
      <div className="yukleniyor-kutu">
        <div className="spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  if (hata) return <ErrorState mesaj={hata} tekrarDene={hareketleriYukle} />;

  const cikisModu = form.tip === "cikis";

  return (
    <div>
      <h2>Stok Hareketleri</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Varyant</label>
          <select
            name="varyant_id"
            value={secilenVaryantId}
            onChange={handleChange}
            required
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
          <label>Hareket tipi</label>
          <select name="tip" value={form.tip} onChange={handleChange}>
            <option value="giris">Giriş</option>
            <option value="cikis">Çıkış</option>
          </select>
        </div>

        {cikisModu ? (
          <div className="form-alan">
            <label>Hangi birimden</label>
            <select
              name="birim_id"
              value={form.birim_id}
              onChange={handleChange}
              required
            >
              <option value="">
                {secilebilirBirimler.length === 0
                  ? "Bu varyantın kullanılabilir stoğu yok"
                  : "Seçiniz"}
              </option>
              {secilebilirBirimler.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tip === "palet" ? b.kod : "Dökme"} · {b.lokasyon_kod} ·{" "}
                  {Number(b.kullanilabilir).toFixed(0)} adet
                  {Number(b.rezerve) > 0 &&
                    ` (${Number(b.miktar).toFixed(0)} mevcut)`}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-alan">
            <label>Nereye</label>
            <LokasyonSecici
              ad="lokasyon_id"
              deger={form.lokasyon_id}
              degisti={handleChange}
              lokasyonlar={lokasyonlar}
              zorunlu
            />
          </div>
        )}

        <div className="form-alan">
          <label>Sebep</label>
          <select name="sebep" value={form.sebep} onChange={handleChange}>
            <option value="manuel">Manuel</option>
            <option value="satinalma">Satınalma</option>
            <option value="satis">Satış</option>
            <option value="sayim">Sayım</option>
            <option value="fire">Fire</option>
            <option value="iade">İade</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Miktar</label>
          <div className="miktar-girisi">
            <input
              name="miktar"
              type="number"
              step="0.01"
              value={form.miktar}
              onChange={handleChange}
              required
            />
            <select name="birim" value={form.birim} onChange={handleChange}>
              <option value="adet">adet</option>
              <option value="kg">kg</option>
            </select>
          </div>
          {form.birim === "kg" && Number(form.miktar) > 0 && (
            <span className="kucuk-not">
              = {miktarAdet.toFixed(2)} adet ({ambalajKg}kg ambalaj)
            </span>
          )}
        </div>

        <div className="form-alan">
          <label>Açıklama</label>
          <input
            name="aciklama"
            placeholder="İsteğe bağlı"
            value={form.aciklama}
            onChange={handleChange}
          />
        </div>

        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>

      <div className="filtre-cubugu">
        <div className="form-alan">
          <label>Varyant</label>
          <select
            name="varyant_id"
            value={filtre.varyant_id}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            {varyantlar.map((v) => (
              <option key={v.id} value={v.id}>
                {v.urun_adi} · {v.boy}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Tip</label>
          <select name="tip" value={filtre.tip} onChange={filtreDegisti}>
            <option value="">Tümü</option>
            <option value="giris">Giriş</option>
            <option value="cikis">Çıkış</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Sebep</label>
          <select name="sebep" value={filtre.sebep} onChange={filtreDegisti}>
            <option value="">Tümü</option>
            <option value="manuel">Manuel</option>
            <option value="satinalma">Satınalma</option>
            <option value="satis">Satış</option>
            <option value="sayim">Sayım</option>
            <option value="fire">Fire</option>
            <option value="iade">İade</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Başlangıç</label>
          <input
            type="date"
            name="baslangic"
            value={filtre.baslangic}
            onChange={filtreDegisti}
          />
        </div>

        <div className="form-alan">
          <label>Bitiş</label>
          <input
            type="date"
            name="bitis"
            value={filtre.bitis}
            onChange={filtreDegisti}
          />
        </div>

        {filtreVar && (
          <button
            className="ikincil ikon-btn"
            onClick={() =>
              setParametreler(new URLSearchParams(), { replace: true })
            }
            title="Filtreleri temizle"
            aria-label="Filtreleri temizle"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {hareketler.length === 0 ? (
        <div className="bos-durum">
          {filtreVar
            ? "Bu filtrelere uyan hareket yok."
            : "Henüz stok hareketi yok."}
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Ürün</th>
                <th>Varyant</th>
                <th>Lokasyon</th>
                <th>Tip</th>
                <th>Sebep</th>
                <th>Miktar</th>
                <th>Açıklama</th>
                <th>İşlemi Yapan</th>
              </tr>
            </thead>
            <tbody>
              {hareketler.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.tarih).toLocaleString("tr-TR")}</td>
                  <td>
                    <Link
                      className="tablo-link"
                      to={`/varyantlar?urun_id=${h.urun_id}`}
                    >
                      {h.urun_adi}
                    </Link>
                  </td>
                  <td>
                    <Link
                      className="tablo-link"
                      to={`/stok-hareketleri?varyant_id=${h.varyant_id}`}
                    >
                      {h.boy} · {Number(h.ambalaj_kg)}kg {h.ambalaj_tipi}
                    </Link>
                  </td>
                  <td>{h.lokasyon_kod || "-"}</td>
                  <td>
                    <Etiket deger={h.tip} />
                  </td>
                  <td>
                    <Etiket deger={h.sebep} />
                  </td>
                  <td>{Number(h.miktar).toFixed(0)}</td>
                  <td>{h.aciklama}</td>
                  <td>{h.kullanici_adi || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            sayfa={sayfa}
            toplam={toplam}
            sayfaBoyutu={SAYFA_BOYUTU}
            degisti={(yeni) => parametreGuncelle({ sayfa: yeni })}
          />
        </>
      )}
    </div>
  );
}

export default StokHareketleri;
