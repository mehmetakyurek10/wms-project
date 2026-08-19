async function paletGozuDolu(baglanti, lokasyonId) {
  const [rows] = await baglanti.query(
    `SELECT sb.id
     FROM stok_birimleri sb
     JOIN lokasyonlar l ON sb.lokasyon_id = l.id
     WHERE sb.lokasyon_id = ?
       AND l.tip = 'palet'
       AND sb.tip = 'palet'
       AND sb.miktar > 0
     LIMIT 1
     FOR UPDATE`,
    [lokasyonId],
  );

  return rows.length > 0;
}

module.exports = { paletGozuDolu };
