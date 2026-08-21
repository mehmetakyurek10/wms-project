const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  timezone: process.env.DB_TIMEZONE || "local",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 20,
  queueLimit: 50,
  enableKeepAlive: true,
});

module.exports = pool;
