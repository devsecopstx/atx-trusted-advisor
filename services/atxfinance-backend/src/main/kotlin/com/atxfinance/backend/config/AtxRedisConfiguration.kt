package com.atxfinance.backend.config

import io.lettuce.core.ClientOptions
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Conditional
import org.springframework.context.annotation.Configuration
import org.springframework.core.env.Environment
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.connection.RedisStandaloneConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory
import org.springframework.data.redis.core.StringRedisTemplate

@Configuration
@Conditional(RedisEnabledCondition::class)
class AtxRedisConfiguration(
    private val props: AtxfinanceProperties,
    private val env: Environment,
) {
    @Bean
    fun redisConnectionFactory(): RedisConnectionFactory {
        val raw =
            env.getProperty("REDIS_URL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: env.getProperty("SPRING_DATA_REDIS_URL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: props.redis.url.trim()
        val url =
            AtxRedisUriResolver.resolveConnectionUrl(
                raw = raw,
                tlsPlainWithRediss = props.redis.tlsPlainWithRediss,
                envTls = env.getProperty("REDIS_TLS"),
            )
        val t = AtxRedisUriResolver.parseStandalone(url)
        val standalone =
            RedisStandaloneConfiguration().apply {
                hostName = t.host
                port = t.port
                t.username?.let { setUsername(it) }
                t.password?.let { setPassword(it) }
            }
        val clientBuilder = LettuceClientConfiguration.builder()
        if (t.useSsl) {
            clientBuilder.useSsl()
        }
        clientBuilder.clientOptions(ClientOptions.builder().disconnectedBehavior(ClientOptions.DisconnectedBehavior.REJECT_COMMANDS).build())
        return LettuceConnectionFactory(standalone, clientBuilder.build())
    }

    @Bean
    fun stringRedisTemplate(factory: RedisConnectionFactory): StringRedisTemplate = StringRedisTemplate(factory)
}
