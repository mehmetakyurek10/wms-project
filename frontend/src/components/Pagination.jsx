function Pagination({ sayfa, toplam, sayfaBoyutu, degisti }) {
  const toplamSayfa = Math.ceil(toplam / sayfaBoyutu);

  if (toplam <= sayfaBoyutu) return null;

  return (
    <div className="sayfalama">
      <button onClick={() => degisti(sayfa - 1)} disabled={sayfa === 1}>
        Önceki
      </button>
      <span>
        Sayfa {sayfa} / {toplamSayfa} · Toplam {toplam} kayıt
      </span>
      <button
        onClick={() => degisti(sayfa + 1)}
        disabled={sayfa >= toplamSayfa}
      >
        Sonraki
      </button>
    </div>
  );
}

export default Pagination;
