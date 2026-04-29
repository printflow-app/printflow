FROM node:18-slim

# OpenSSL va kerakli system kutubxonalarni o'rnatish
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and prisma schema first (cache optimization)
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (fresh Linux-native binaries)
RUN npm install

# Generate Prisma client for Linux
RUN npx prisma generate

# Copy source code and config (node_modules excluded via .dockerignore)
COPY . .

# Build the NestJS app — creates dist/main.js
RUN npx nest build

# Debug: verify dist/main.js exists
RUN ls -la dist/ && echo "BUILD SUCCESS: dist/main.js found"

# Expose port (Railway uses PORT env variable)
EXPOSE 3000

# Start the compiled app
CMD ["node", "dist/main.js"]
