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

# Build arguments for environment variables
ARG DATABASE_URL
ARG TELEGRAM_BOT_TOKEN
ARG SKIP_ENV_VALIDATION

# Set environment variables for build
ENV DATABASE_URL=${DATABASE_URL}
ENV TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION}

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
