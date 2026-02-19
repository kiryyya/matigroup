FROM node:18-alpine

# Install PostgreSQL client
RUN apk add --no-cache postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Skip environment validation during build
# Variables will be provided at runtime
ENV SKIP_ENV_VALIDATION=true
ENV NODE_ENV=production

# Build the application
# Use --no-lint to skip linting during build
RUN npm run build -- --no-lint

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
