import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import {
  varyantlariGetir,
  varyantEkle,
  varyantGuncelle,
  varyantSil,
} from "../api/varyantApi";
import { urunleriGetir } from "../api/urunApi";
import { kategorileriGetir } from "../api/kategoriApi";
import { lokasyonlariGetir } from "../api/lokasyonApi";
import LokasyonSecici from "../components/LokasyonSecici";
import { useToast } from "../context/ToastContext";
import useFetch from "../hooks/useFetch";
import OnayModal from "../components/OnayModal";
import { SAYFA_BOYUTU } from "../sabitler";

const FILTRE_ALANLARI = ["kategori_id", "urun_id", "aktif", "sadece_dusuk"];

function Varyantlar() {
  const bildir = useToast();
  const [parametreler, setParametreler] = useSearchParams();
  const gezin = useNavigate();

  // Filtreler ve sayfa numarasi adres cubugunda tutuluyor: sayfa
  // yenilendiginde kayboluyorlardi ve panelden filtreli baglanti
  // verilemiyordu.
  const aranan = parametreler.get("ara") || "";
  const sayfa = Number(parametreler.get("sayfa")) || 1;
  const filtre = Object.fromEntries(
    FILTRE_ALANLARI.map((alan) => [alan, parametreler.get(alan) || ""]),
  );

  const [arama, setArama] = useState(aranan);
  const [silinecek, setSilinecek] = useState(null);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [duzenlemeForm, setDuzenlemeForm] = useState({});
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [form, setForm] = useState({
    urun_id: "",
    boy: "",
    ambalaj_tipi: "kova",
    ambalaj_kg: 10,
    barkod: "",
    miktar: 0,
    birim: "adet",
    lokasyon_id: "",
    kritik_seviye: 0,
    toptan_fiyat: 0,
    perakende_fiyat: 0,
  });

  const parametreGuncelle = (yeniler) => {
    const sonraki = new URLSearchParams(parametreler);

    for (const [anahtar, deger] of Object.entries(yeniler)) {
      if (deger === "" || deger === undefined || deger === null) {
        sonraki.delete(anahtar);
      } else {
        sonraki.set(anahtar, String(deger));
      }
    }

    // replace kullaniliyor: her filtre degisikligi tarayici gecmisine
    // ayri bir kayit birakirsa geri tusu kullanilamaz hale gelir.
    setParametreler(sonraki, { replace: true });
  };

  // URLSearchParams her cizimde yeni nesne uretir; bagimliliga metin
  // halini vermek gereksiz yeniden cekmeyi onluyor.
  const sorguAnahtari = parametreler.toString();

  const {
    data: varyantlar,
    total: toplam,
    loading: yukleniyor,
    error: hata,
    refresh: varyantlariYukle,
  } = useFetch(
    () =>
      varyantlariGetir({
        kategori_id: filtre.kategori_id || undefined,
        urun_id: filtre.urun_id || undefined,
        aktif: filtre.aktif || undefined,
        sadece_dusuk: filtre.sadece_dusuk || undefined,
        ara: aranan || undefined,
        sayfa,
        limit: SAYFA_BOYUTU,
      }),
    [sorguAnahtari],
    { initial: [], errorMessage: "Varyantlar yüklenemedi" },
  );

  const { data: urunler } = useFetch(() => urunleriGetir(), [], {
    initial: [],
    errorMessage: "Ürünler yüklenemedi",
  });

  const { data: kategoriler } = useFetch(() => kategorileriGetir(), [], {
    initial: [],
    errorMessage: "Kategoriler yüklenemedi",
  });

  const { data: tumLokasyonlar } = useFetch(() => lokasyonlariGetir(), [], {
    initial: [],
    errorMessage: "Lokasyonlar yüklenemedi",
  });

  const lokasyonlar = tumLokasyonlar.filter((l) => l.aktif);

  const toplamSayfa = Math.ceil(toplam / SAYFA_BOYUTU);
  const filtreVar =
    aranan !== "" || FILTRE_ALANLARI.some((alan) => filtre[alan] !== "");

  useEffect(() => {
    const zamanlayici = setTimeout(() => {
      if (arama !== aranan) {
        parametreGuncelle({ ara: arama, sayfa: "" });
      }
    }, 400);
    return () => clearTimeout(zamanlayici);
    // Yalnizca kullanicinin yazdigi metni izliyoruz; digerleri her cizimde
    // yeniden uretildigi icin bagimliliga eklenirse dongu olusur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arama]);

  const filtreDegisti = (e) => {
    parametreGuncelle({ [e.target.name]: e.target.value, sayfa: "" });
  };

  const filtreleriTemizle = () => {
    setArama("");
    setParametreler(new URLSearchParams(), { replace: true });
  };

  const ambalajKg = Number(form.ambalaj_kg) || 1;
  const miktarAdet =
    form.birim === "kg"
      ? Number(form.miktar || 0) / ambalajKg
      : Number(form.miktar || 0);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (gonderiliyor) return;
    setGonderiliyor(true);
    try {
      await varyantEkle({
        urun_id: form.urun_id,
        boy: form.boy,
        ambalaj_tipi: form.ambalaj_tipi,
        ambalaj_kg: form.ambalaj_kg,
        barkod: form.barkod,
        miktar: miktarAdet,
        lokasyon_id: miktarAdet > 0 ? form.lokasyon_id : "",
        kritik_seviye: form.kritik_seviye,
        toptan_fiyat: form.toptan_fiyat,
        perakende_fiyat: form.perakende_fiyat,
      });
      setForm({ ...form, boy: "", barkod: "", miktar: 0, lokasyon_id: "" });
      bildir("Varyant eklendi");
      varyantlariYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Varyant eklenemedi", "hata");
    } finally {
      setGonderiliyor(false);
    }
  };

  const duzenlemeyeBasla = (v) => {
    setDuzenlenenId(v.id);
    setDuzenlemeForm({
      boy: v.boy,
      ambalaj_tipi: v.ambalaj_tipi,
      ambalaj_kg: v.ambalaj_kg,
      barkod: v.barkod || "",
      kritik_seviye: v.kritik_seviye,
      toptan_fiyat: v.toptan_fiyat,
      perakende_fiyat: v.perakende_fiyat,
      aktif: v.aktif,
    });
  };

  const duzenlemeKaydet = async (id) => {
    try {
      await varyantGuncelle(id, duzenlemeForm);
      setDuzenlenenId(null);
      bildir("Varyant güncellendi");
      varyantlariYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Güncellenemedi", "hata");
    }
  };

  const silOnayla = async () => {
    const id = silinecek.id;
    setSilinecek(null);
    try {
      await varyantSil(id);
      bildir("Varyant silindi");
      varyantlariYukle();
    } catch (err) {
      bildir(err.response?.data?.hata || "Silinemedi", "hata");
    }
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
      <h2>Stok Kalemleri</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-alan">
          <label>Ürün</label>
          <select
            name="urun_id"
            value={form.urun_id}
            onChange={handleChange}
            required
          >
            <option value="">Seçiniz</option>
            {urunler.map((u) => (
              <option key={u.id} value={u.id}>
                {u.kategori_adi ? `${u.kategori_adi} · ` : ""}
                {u.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Boy (kalibre)</label>
          <input
            name="boy"
            placeholder="201/230"
            value={form.boy}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-alan">
          <label>Ambalaj</label>
          <select
            name="ambalaj_tipi"
            value={form.ambalaj_tipi}
            onChange={handleChange}
          >
            <option value="kova">Kova</option>
            <option value="teneke">Teneke</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Ambalaj kg</label>
          <input
            name="ambalaj_kg"
            type="number"
            step="0.1"
            value={form.ambalaj_kg}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Barkod</label>
          <input
            name="barkod"
            placeholder="İsteğe bağlı"
            value={form.barkod}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Başlangıç stoğu</label>
          <div className="miktar-girisi">
            <input
              name="miktar"
              type="number"
              step="0.01"
              value={form.miktar}
              onChange={handleChange}
            />
            <select name="birim" value={form.birim} onChange={handleChange}>
              <option value="adet">adet</option>
              <option value="kg">kg</option>
            </select>
          </div>
          {form.birim === "kg" && Number(form.miktar) > 0 && (
            <span className="kucuk-not">= {miktarAdet.toFixed(2)} adet</span>
          )}
        </div>

        {miktarAdet > 0 && (
          <div className="form-alan">
            <label>Başlangıç stoğu nereye girsin</label>
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
          <label>Kritik seviye (adet)</label>
          <input
            name="kritik_seviye"
            type="number"
            step="0.01"
            value={form.kritik_seviye}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Toptan fiyat (adet)</label>
          <input
            name="toptan_fiyat"
            type="number"
            step="0.01"
            value={form.toptan_fiyat}
            onChange={handleChange}
          />
        </div>

        <div className="form-alan">
          <label>Perakende fiyat (adet)</label>
          <input
            name="perakende_fiyat"
            type="number"
            step="0.01"
            value={form.perakende_fiyat}
            onChange={handleChange}
          />
        </div>

        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Ekleniyor..." : "Ekle"}
        </button>
      </form>

      <div className="arama-kutusu">
        <Search size={16} />
        <input
          placeholder="Ürün, boy veya barkod ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
        />
      </div>

      <div className="filtre-cubugu">
        <div className="form-alan">
          <label>Kategori</label>
          <select
            name="kategori_id"
            value={filtre.kategori_id}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            {kategoriler.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Ürün</label>
          <select
            name="urun_id"
            value={filtre.urun_id}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            {urunler.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ad}
              </option>
            ))}
          </select>
        </div>

        <div className="form-alan">
          <label>Durum</label>
          <select name="aktif" value={filtre.aktif} onChange={filtreDegisti}>
            <option value="">Tümü</option>
            <option value="1">Aktif</option>
            <option value="0">Pasif</option>
          </select>
        </div>

        <div className="form-alan">
          <label>Stok</label>
          <select
            name="sadece_dusuk"
            value={filtre.sadece_dusuk}
            onChange={filtreDegisti}
          >
            <option value="">Tümü</option>
            <option value="1">Sadece kritik</option>
          </select>
        </div>

        {filtreVar && (
          <button
            className="ikincil ikon-btn"
            onClick={filtreleriTemizle}
            title="Filtreleri temizle"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {varyantlar.length === 0 ? (
        <div className="bos-durum">
          {filtreVar
            ? "Bu filtrelere uyan stok kalemi yok."
            : "Henüz stok kalemi eklenmemiş."}
        </div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Boy</th>
                <th>Ambalaj</th>
                <th>Stok (adet)</th>
                <th>Toplam kg</th>
                <th>Kritik (adet)</th>
                <th>Barkod</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {varyantlar.map((v) =>
                duzenlenenId === v.id ? (
                  <tr key={v.id}>
                    <td>{v.urun_adi}</td>
                    <td>
                      <input
                        value={duzenlemeForm.boy}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            boy: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={duzenlemeForm.ambalaj_tipi}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            ambalaj_tipi: e.target.value,
                          })
                        }
                      >
                        <option value="kova">Kova</option>
                        <option value="teneke">Teneke</option>
                      </select>
                    </td>
                    <td>{Number(v.miktar).toFixed(0)}</td>
                    <td>
                      {(Number(v.miktar) * Number(v.ambalaj_kg)).toFixed(0)} kg
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={duzenlemeForm.kritik_seviye}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            kritik_seviye: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={duzenlemeForm.barkod}
                        onChange={(e) =>
                          setDuzenlemeForm({
                            ...duzenlemeForm,
                            barkod: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <button onClick={() => duzenlemeKaydet(v.id)}>
                        Kaydet
                      </button>
                      <button
                        className="ikincil"
                        onClick={() => setDuzenlenenId(null)}
                      >
                        İptal
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={v.id}
                    className={
                      parseFloat(v.miktar) <= parseFloat(v.kritik_seviye)
                        ? "kritik"
                        : ""
                    }
                  >
                    <td>
                      <Link
                        className="tablo-link"
                        to={`/varyantlar?urun_id=${v.urun_id}`}
                      >
                        {v.urun_adi}
                      </Link>
                    </td>
                    <td>{v.boy}</td>
                    <td>
                      {Number(v.ambalaj_kg)} kg {v.ambalaj_tipi}
                    </td>
                    <td>{Number(v.miktar).toFixed(0)}</td>
                    <td>
                      {(Number(v.miktar) * Number(v.ambalaj_kg)).toFixed(0)} kg
                    </td>
                    <td>{Number(v.kritik_seviye).toFixed(0)}</td>
                    <td>{v.barkod || "-"}</td>
                    <td>
                      <button onClick={() => duzenlemeyeBasla(v)}>
                        Düzenle
                      </button>
                      <button
                        className="ikincil"
                        onClick={() =>
                          gezin(`/stok-hareketleri?varyant_id=${v.id}`)
                        }
                      >
                        Hareketler
                      </button>
                      <button
                        onClick={() => setSilinecek(v)}
                        className="tehlike"
                      >
                        Sil
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          {toplam > SAYFA_BOYUTU && (
            <div className="sayfalama">
              <button
                onClick={() => parametreGuncelle({ sayfa: sayfa - 1 })}
                disabled={sayfa === 1}
              >
                Önceki
              </button>
              <span>
                Sayfa {sayfa} / {toplamSayfa} · Toplam {toplam} kayıt
              </span>
              <button
                onClick={() => parametreGuncelle({ sayfa: sayfa + 1 })}
                disabled={sayfa >= toplamSayfa}
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      )}

      <OnayModal
        acik={silinecek !== null}
        baslik="Stok kalemini sil"
        mesaj={`${silinecek?.urun_adi} · ${silinecek?.boy} kalemi silinecek.`}
        onayMetni="Sil"
        onayla={silOnayla}
        iptal={() => setSilinecek(null)}
      />
    </div>
  );
}

export default Varyantlar;
