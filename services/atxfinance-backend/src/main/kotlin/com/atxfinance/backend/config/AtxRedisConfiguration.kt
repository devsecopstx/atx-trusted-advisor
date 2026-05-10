package com.atxfinance.backend.config

import io.lettuce.core.ClientOptions
import io.lettuce.core.SocketOptions
import io.lettuce.core.TimeoutOptions
import io.lettuce.core.resource.ClientResources
import io.lettuce.core.resource.DefaultClientResources
import io.lettuce.core.resource.Delay
import org.apache.commons.pool2.impl.GenericObjectPoolConfig
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Conditional
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.connection.RedisStandaloneConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.connection.lettuce.LettucePoolingClientConfiguration
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.Duration

@Configuration
@Conditional(RedisEnabledCondition::class)
class AtxRedisConfiguration(
    private val props: AtxfinanceProperties,
    private val env: Environment,
) {
    @Bean(destroyMethod = "shutdown")
    fun redisClientResources(): ClientResources {
        return DefaultClientResources.builder()
            .reconnectDelay(Delay.exponential())
            .build()
    }

    @Bean("controlRedisConnectionFactory")
    @Primary
    fun controlRedisConnectionFactory(clientResources: ClientResources): RedisConnectionFactory =
        createConnectionFactory(resolveControlUrl(), clientResources)

    @Bean("cacheRedisConnectionFactory")
    fun cacheRedisConnectionFactory(
        @Qualifier("controlRedisConnectionFactory") controlFactory: RedisConnectionFactory,
        clientResources: ClientResources,
    ): RedisConnectionFactory {
        val controlUrl = resolveControlUrl()
        val cacheUrl = resolveCacheUrl()
        return if (cacheUrl == controlUrl) {
            controlFactory
        } else {
            createConnectionFactory(cacheUrl, clientResources)
        }
    }

    @Bean(name = ["stringRedisTemplate", "controlRedisTemplate"])
    @Primary
    fun controlRedisTemplate(
        @Qualifier("controlRedisConnectionFactory") factory: RedisConnectionFactory,
    ): StringRedisTemplate = StringRedisTemplate(factory)

    @Bean("cacheRedisTemplate")
    fun cacheRedisTemplate(
        @Qualifier("cacheRedisConnectionFactory") factory: RedisConnectionFactory,
    ): StringRedisTemplate = StringRedisTemplate(factory)

    private fun resolveControlUrl(): String {
        val raw =
            env.getProperty("REDIS_URL_CONTROL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: env.getProperty("SPRING_DATA_REDIS_CONTROL_URL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: props.redis.controlUrl.trim().takeIf { it.isNotEmpty() }
                ?: env.getProperty("REDIS_URL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: env.getProperty("SPRING_DATA_REDIS_URL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: props.redis.url.trim().takeIf { it.isNotEmpty() }
                ?: error("REDIS_URL_CONTROL / REDIS_URL missing for control plane")
        return AtxRedisUriResolver.resolveConnectionUrl(
            raw = raw,
            tlsPlainWithRediss = props.redis.tlsPlainWithRediss,
            envTls = env.getProperty("REDIS_TLS"),
        )
    }

    private fun resolveCacheUrl(): String {
        val raw =
            env.getProperty("REDIS_URL_CACHE")?.trim()?.takeIf { it.isNotEmpty() }
                ?: env.getProperty("SPRING_DATA_REDIS_CACHE_URL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: props.redis.cacheUrl.trim().takeIf { it.isNotEmpty() }
                ?: resolveControlUrl()
        return AtxRedisUriResolver.resolveConnectionUrl(
            raw = raw,
            tlsPlainWithRediss = props.redis.tlsPlainWithRediss,
            envTls = env.getProperty("REDIS_TLS"),
        )
    }

    private fun createConnectionFactory(url: String, clientResources: ClientResources): RedisConnectionFactory {
        val t = AtxRedisUriResolver.parseStandalone(url)
        val standalone =
            RedisStandaloneConfiguration().apply {
                hostName = t.host
                port = t.port
                t.username?.let { setUsername(it) }
                t.password?.let { setPassword(it) }
            }
        val socketConnectTimeout = Duration.ofMillis(props.redis.connectTimeoutMs.coerceIn(100, 10_000))
        val commandTimeout = Duration.ofMillis(props.redis.commandTimeoutMs.coerceIn(100, 10_000))
        val poolConfig = GenericObjectPoolConfig<Any>().apply {
            maxTotal = props.redis.poolMaxActive.coerceIn(1, 64)
            maxIdle = props.redis.poolMaxIdle.coerceIn(1, 64)
            minIdle = props.redis.poolMinIdle.coerceIn(0, maxIdle)
            setMaxWait(Duration.ofMillis(props.redis.poolMaxWaitMs.coerceIn(50, 10_000)))
            setMinEvictableIdleDuration(Duration.ofMillis(props.redis.poolMinEvictableIdleMs.coerceIn(1_000, 3_600_000)))
            timeBetweenEvictionRunsMillis = props.redis.poolEvictionRunIntervalMs.coerceIn(1_000, 3_600_000)
            testOnBorrow = true
            testWhileIdle = true
        }
        val clientOptions = ClientOptions.builder()
            .disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS)
            .socketOptions(SocketOptions.builder().connectTimeout(socketConnectTimeout).build())
            .timeoutOptions(TimeoutOptions.enabled(commandTimeout))
            .autoReconnect(true)
            .build()

        val clientBuilder = LettucePoolingClientConfiguration.builder()
            .clientResources(clientResources)
            .poolConfig(poolConfig)
            .commandTimeout(commandTimeout)
            .shutdownTimeout(Duration.ofMillis(100))
            .clientOptions(clientOptions)
        if (t.useSsl) {
            clientBuilder.useSsl()
        }
        return LettuceConnectionFactory(standalone, clientBuilder.build()).apply {
            validateConnection = true
            shareNativeConnection = true
        }
    }
}
