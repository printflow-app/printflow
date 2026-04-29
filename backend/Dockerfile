FROM node:18-slim

# Prisma uchun kerakli kutubxonalar
RUN apt-get update -y && \
    apt-get install -y openssl libc6 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Railway qanaqa rejimda bo'lishidan qat'i nazar, asboblarni kuch bilan o'rnatamiz
RUN npm install --include=dev

COPY . .

# Build qilamiz
RUN npm run build

# 🚨 DIAGNOSTIKA BOSHLANADI 🚨
RUN echo "=== DOCKER ICHIDAGI FAYLLAR ===" && ls -la
RUN echo "=== DIST PAPKA ICHIDAGI FAYLLAR ===" && ls -la dist || echo "DIST U-MU-MAN YOQ!!!"
RUN echo "=== DIST/SRC ICHIDAGI FAYLLAR ===" && ls -la dist/src || echo "DIST/SRC HAM YOQ!!!"
# 🚨 DIAGNOSTIKA TUGAydi 🚨

ENV NODE_ENV=production
EXPOSE 3000

# Universal Start buyrug'i
CMD ["sh", "-c", "node dist/main.js || node dist/src/main.js"]