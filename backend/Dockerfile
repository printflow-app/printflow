FROM node:18-slim

# Prisma uchun kerakli kutubxonalar
RUN apt-get update -y && \
    apt-get install -y openssl libc6 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# 🚨 MANA ASOSIY ZARBA! 
# Railway qanaqa rejimda bo'lishidan qat'i nazar, barcha asboblarni kuch bilan o'rnatamiz:
RUN npm install --include=dev

COPY . .

# Endi Nest CLI aniq bor, build 100% ishlaydi va dist papka yaratiladi
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Start qotirib yoziladi
CMD sh -c "node dist/main.js || node dist/src/main.js"