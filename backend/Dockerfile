FROM node:20-alpine

WORKDIR /app

# Copy and install
COPY package.json package-lock.json node_modules ./
# RUN npm i

# Copy rest of the backend and frontend build
COPY . .

# Build TS
RUN npx tsc -b

CMD ["node", "dist/index.js"]
