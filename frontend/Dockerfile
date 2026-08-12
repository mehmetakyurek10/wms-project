FROM node:24-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Ayni adres uzerinden sunuldugu icin API adresi goreli. Boylece paket
# hangi makinede calisacagini bilmek zorunda kalmiyor; makine degisince
# yeniden derleme gerekmiyor.
ENV VITE_API_URL=/api
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80