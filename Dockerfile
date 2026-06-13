FROM node:20-alpine

# Set working directory inside container
WORKDIR /usr/src/app

# Copy package management files first to utilize Docker layer caching
COPY package*.json ./

# Install dev and production dependencies
RUN npm install

# Copy backend files
COPY . .

# Expose backend service port
EXPOSE 5000

# Command to run development server (uses ts-node-dev)
CMD ["npm", "run", "dev"]
