FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Expose port 3000
EXPOSE 3000

# Start Vite dev server
CMD ["npm", "run", "dev"]
