# Root-level Dockerfile to build and run the Spring Boot backend
# Build stage
FROM gradle:8.10.2-jdk21 AS build
WORKDIR /workspace/services/atxfinance-backend

# Copy Gradle build descriptors first to leverage layer caching
COPY services/atxfinance-backend/build.gradle.kts services/atxfinance-backend/settings.gradle.kts ./
# If you later add the Gradle wrapper, uncomment these lines for better reproducibility:
COPY services/atxfinance-backend/gradle gradle
# COPY services/atxfinance-backend/gradlew ./

# Prime Gradle deps cache (ignore failure before sources are present)
RUN --mount=type=cache,target=/home/gradle/.gradle gradle --no-daemon build -x test || true

# Copy sources and build the Spring Boot fat jar
COPY services/atxfinance-backend/src ./src
RUN --mount=type=cache,target=/home/gradle/.gradle gradle --no-daemon bootJar -x test

# Runtime stage (distroless)
FROM gcr.io/distroless/java21-debian12:nonroot
WORKDIR /app
# Copy the boot jar without hardcoding version
COPY --from=build /workspace/services/atxfinance-backend/build/libs/*.jar /app/app.jar
USER nonroot
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["/usr/bin/java", "-jar", "/app/app.jar"]
