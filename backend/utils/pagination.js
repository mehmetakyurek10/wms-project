const MAKS_LIMIT = 500;

function buildPagination(query, varsayilanLimit = MAKS_LIMIT) {
  const sayfaNo = Math.max(parseInt(query.sayfa, 10) || 1, 1);
  const istenen = parseInt(query.limit, 10);
  const limit = Math.min(
    Number.isFinite(istenen) && istenen > 0 ? istenen : varsayilanLimit,
    MAKS_LIMIT,
  );

  return { sayfa: sayfaNo, limit, offset: (sayfaNo - 1) * limit };
}

module.exports = { buildPagination, MAKS_LIMIT };
