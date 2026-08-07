const jwt = require("jsonwebtoken");
const config = require("../config/env");

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const REFRESH_COOKIE = "wms_refresh";
const REFRESH_PATH = "/auth";

function createAccessToken(kullanici) {
  return jwt.sign(
    {
      id: kullanici.id,
      rol: kullanici.rol,
      tv: kullanici.token_surumu,
      tip: "access",
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

function createRefreshToken(kullanici) {
  return jwt.sign(
    { id: kullanici.id, tv: kullanici.token_surumu, tip: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TTL },
  );
}

// sameSite "lax" dev ortaminda calisir cunku site tanimi sema + kayitli alan
// adidir, port dahil degildir: localhost:5173 ile localhost:3000 ayni sitedir.
// Frontend ile backend farkli alan adlarina tasinirsa burasi "none" + secure
// olmali ve o zaman CSRF icin ek onlem gerekir.
const COOKIE_SECENEKLERI = {
  httpOnly: true,
  secure: config.uretim,
  sameSite: "lax",
  path: REFRESH_PATH,
};

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    ...COOKIE_SECENEKLERI,
    maxAge: REFRESH_TTL_MS,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, COOKIE_SECENEKLERI);
}

function readRefreshCookie(req) {
  return req.cookies ? req.cookies[REFRESH_COOKIE] : undefined;
}

module.exports = {
  REFRESH_COOKIE,
  createAccessToken,
  createRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  readRefreshCookie,
};
