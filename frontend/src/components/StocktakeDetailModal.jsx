import { sayimDetay } from "../api/sayimApi";
import Etiket from "./Etiket";
import Modal from "./Modal";
import useFetch from "../hooks/useFetch";

function StocktakeDetailModal({ sayimId, kapat }) {
  const { data: detay, loading: yukleniyor } = useFetch(
    () => sayimDetay(sayimId),
    [sayimId],
    { initial: null, errorMessage: "Sayım detayı alınamadı" },
  );

  return (
    <Modal acik kapat={kapat} baslik="Sayım detayı">
      <h3>Sayım detayı</h3>

      {yukleniyor || !detay ? (
        <div className="yukleniyor-kutu">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="etiket-bilgi">
            <div>
              <span>Lokasyon</span>
              <strong>
                {detay.lokasyon_kod}
                {detay.lokasyon_adi ? ` · ${detay.lokasyon_adi}` : ""}
              </strong>
            </div>
            <div>
              <span>Tarih</span>
              <strong>{new Date(detay.tarih).toLocaleString("tr-TR")}</strong>
            </div>
            <div>
              <span>Sayan</span>
              <strong>{detay.kullanici_adi || "—"}</strong>
            </div>
            <div>
              <span>Sayılan kalem</span>
              <strong>{detay.sayilan_kalem}</strong>
            </div>
            <div>
              <span>Farklı kalem</span>
              <strong>{detay.farkli_kalem}</strong>
            </div>
            <div>
              <span>Net fark</span>
              <strong>{Number(detay.net_fark).toFixed(0)} adet</strong>
            </div>
          </div>

          {detay.aciklama && <p className="kucuk-not">{detay.aciklama}</p>}

          {detay.hareketler.length === 0 ? (
            <div className="bos-durum">
              Bu sayımda fark çıkmadı, stok değişmedi.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Varyant</th>
                  <th>Yön</th>
                  <th>Miktar</th>
                </tr>
              </thead>
              <tbody>
                {detay.hareketler.map((h) => (
                  <tr key={h.id}>
                    <td>{h.urun_adi}</td>
                    <td>
                      {h.boy} · {Number(h.ambalaj_kg)}kg {h.ambalaj_tipi}
                    </td>
                    <td>
                      <Etiket deger={h.tip} />
                    </td>
                    <td>{Number(h.miktar).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <div className="modal-aksiyon">
        <button className="ikincil" onClick={kapat}>
          Kapat
        </button>
      </div>
    </Modal>
  );
}

export default StocktakeDetailModal;
