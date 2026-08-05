const app = require("./app");
const config = require("./config/env");

app.listen(config.port, () => {
  console.log(
    `[server] WMS API http://localhost:${config.port} üzerinde çalışıyor (${config.ortam})`,
  );
});
