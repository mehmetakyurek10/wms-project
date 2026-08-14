const pino = require("pino");
const config = require("./env");

const varsayilanSeviye = () => {
  if (config.ortam === "test") return "silent";
  return config.uretim ? "info" : "debug";
};

const okunabilir = !config.uretim && config.ortam !== "test";

const logger = pino({
  level: process.env.LOG_LEVEL || varsayilanSeviye(),

  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
    ],
    censor: "[gizli]",
  },

  transport: okunabilir
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: true,
        },
      }
    : undefined,
});

module.exports = logger;
