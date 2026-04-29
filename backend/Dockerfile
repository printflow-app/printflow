# 1. Muhitni tayyorlash (Yengil va barqaror Linux versiyasi)
FROM node:18-slim

# 2. Prisma va tizim uchun kerakli kutubxonalarni o'rnatish
RUN apt-get update -y && \
    apt-get install -y openssl libc6 && \
    rm -rf /var/lib/apt/lists/*

# 3. Ishchi papkani belgilash
WORKDIR /app

# 4. Paketlar ro'yxatini va Prisma sxemasini ko'chirish
# (Bu qadam keshdan foydalanish uchun alohida qilinadi)
COPY package*.json ./
COPY prisma ./prisma/

# 5. Barcha kutubxonalarni o'rnatish
# (Development kutubxonalari ham o'rnatiladi, chunki 'nest build' uchun ular shart)
RUN npm install

# 6. Loyihaning barcha kodlarini konteynerga ko'chirish
COPY . .

# 7. Prisma Client'ni Linux uchun generatsiya qilish va Loyihani Build qilish
# Sening package.json'dagi "build" buyrug'ingni ishlatamiz.
# Bu buyruq 'dist' papkasini yaratishga kafolat beradi.
RUN npm run build

# 8. Muhit o'zgaruvchisi (Port Railway tomonidan avtomat beriladi)
ENV NODE_ENV=production

# 9. Konteyner ichidagi portni ochish
EXPOSE 3000

# 10. Dasturni ishga tushirish
# 'npm run start:prod' buyrug'i 'dist/main.js' ni xatosiz topadi
CMD ["npm", "run", "start:prod"]