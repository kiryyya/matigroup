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
# Skip type checking and linting during Docker build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Verify build output exists
RUN test -d .next || (echo "ERROR: .next directory not found after build!" && exit 1)

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
