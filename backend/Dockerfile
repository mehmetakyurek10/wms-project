FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

# exec kritik: onsuz sinyal kabuga gider ve node'a ulasmaz, boylece
# index.js'teki SIGTERM isleyicisi hic calismaz ve konteyner zorla
# oldurulur. exec ile node kabugun yerini alir, sinyali dogrudan alir.
CMD ["sh", "-c", "node db/migrate.js && exec node index.js"]