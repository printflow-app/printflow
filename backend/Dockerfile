FROM node:18-slim

# OpenSSL 1.1 o'rnatish
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDeps needed for nest CLI)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS app — creates dist/
RUN npm run build

# Expose port
EXPOSE 3000

# Start the compiled app
CMD ["node", "dist/main.js"]
