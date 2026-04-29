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

# Build the NestJS app
RUN npm run build

# Remove development dependencies to keep the image small and secure
RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

# Start the compiled app
CMD ["node", "dist/main.js"]