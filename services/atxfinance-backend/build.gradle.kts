import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.depman)
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.spring)
}

group = "com.atxfinance"
version = "0.1.0-SNAPSHOT"

// Align Kotlin compiler JDK + bytecode with Java (avoids JVM 17 vs 1.8 inline mismatch in IDE/Gradle).
kotlin {
    jvmToolchain(21)
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

repositories {
    mavenCentral()
}

dependencies {
    // Align Google Cloud library versions with the official BOM (managed set from Maven Central)
    implementation(platform(libs.gcp.bom))

    // Spring Boot starters
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // OpenAPI UI
    implementation(libs.springdoc.webmvc.ui)

    // MongoDB + ShedLock provider
    implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation(libs.shedlock.spring)
    implementation(libs.shedlock.mongo)

    // Google Pub/Sub client (version managed by BOM)
    implementation("com.google.cloud:google-cloud-pubsub")

    // Observability: Micrometer Prometheus + OTEL tracing
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation("io.micrometer:micrometer-tracing-bridge-otel")
    implementation(libs.otel.otlp)

    // Kotlin stdlib + reflect (versions from Kotlin plugin)
    implementation(kotlin("stdlib-jdk8"))
    implementation(kotlin("reflect"))

    // Desk / admin delivery email (SMTP) — same env contract as Next.js nodemailer path
    implementation("org.eclipse.angus:angus-mail:2.0.3")

    // Tests
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("de.flapdoodle.embed:de.flapdoodle.embed.mongo:3.5.4")
}

tasks.withType<KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = "21"
        freeCompilerArgs = freeCompilerArgs + listOf("-Xjsr305=strict")
    }
}

tasks.test {
    useJUnitPlatform()
}
