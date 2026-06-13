# Stage 1: Development
FROM node:20-alpine AS development

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package management files first to utilize Docker layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for ts-node-dev)
RUN npm install

# Copy backend files
COPY . .

# Expose backend service port
EXPOSE 5000

# Command to run local server (uses ts-node-dev)
CMD ["npm", "run", "dev"]


# Stage 2: Production Build & Execution
FROM node:20-alpine AS production

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package management files first
COPY package*.json ./

# Install all dependencies to perform typescript compilation
RUN npm install

# Copy backend files
COPY . .

# Compile TypeScript to JavaScript (creates ./dist)
RUN npm run build

# Expose backend service port
EXPOSE 5000

# Command to run production server (executes node dist/index.js)
CMD ["npm", "run", "start"]
