# =============================================================================
# Multi-stage Dockerfile for KEIZOKU Spring Boot Application
# Compatible with Render, Railway, Fly.io, and Docker environments
# =============================================================================

# Stage 1: Build the application JAR with Maven using Eclipse Temurin JDK 17
FROM maven:3.9-eclipse-temurin-17-alpine AS builder
WORKDIR /build

# Copy project definition and source files
COPY pom.xml .
COPY src ./src

# Build production JAR without tests (finalName 'app' in pom.xml produces target/app.jar)
RUN mvn clean package -DskipTests -B

# Stage 2: Production runtime image using Eclipse Temurin JRE 17
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Install su-exec for safe privilege step-down from root to non-root appuser
RUN apk add --no-cache su-exec

# Non-root application user for container security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create persistent storage mount directory and local app data directory with permissions
RUN mkdir -p /var/data /app/data /app/seed-data && \
    chown -R appuser:appgroup /var/data /app && \
    chmod -R 775 /var/data /app

# Copy built JAR from builder stage
COPY --from=builder --chown=appuser:appgroup /build/target/app.jar app.jar

# Copy template database for initial disk seeding (preserves data if persistent disk is fresh)
COPY --chown=appuser:appgroup data ./seed-data

# Copy and prepare entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN sed -i -e 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Render passes PORT dynamically (defaults to 10000)
ENV PORT=10000
EXPOSE 10000

# Execute entrypoint to ensure disk permissions before stepping down to appuser
ENTRYPOINT ["/entrypoint.sh"]
