async function reservedQuantity(connection, birimId) {
  const [rows] = await connection.query(
    `SELECT COALESCE(SUM(miktar), 0) AS rezerve
     FROM stok_rezervasyonlari
     WHERE birim_id = ?`,
    [birimId],
  );

  return Number(rows[0].rezerve);
}

module.exports = { reservedQuantity };
