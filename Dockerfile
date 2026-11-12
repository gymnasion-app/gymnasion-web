# Estágio 1: Build (Vite)
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# "/" = mesma origem: o nginx encaminha /api para o back-end
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL
# Chave PÚBLICA do Google reCAPTCHA v2 (embutida no bundle pelo Vite; não é segredo)
ARG VITE_RECAPTCHA_SITE_KEY
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY
RUN npm run build

# Estágio 2: Runtime (nginx servindo os arquivos estáticos)
FROM nginx:1.27-alpine

# O entrypoint do nginx aplica envsubst nos *.template e gera /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Endereço do back-end na rede Docker (sobrescreva no compose se precisar)
ENV API_UPSTREAM=http://gymnasion_app:8080
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
