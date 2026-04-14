package com.atxfinance.backend.config

import io.micrometer.common.KeyValue
import io.micrometer.common.KeyValues
import io.micrometer.observation.Observation
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.observation.ClientHttpObservationDocumentation.LowCardinalityKeyNames
import org.springframework.http.client.observation.ClientRequestObservationConvention
import org.springframework.http.client.observation.ClientRequestObservationContext
import org.springframework.http.client.observation.DefaultClientRequestObservationConvention

/**
 * RestTemplate is Micrometer-instrumented with meter **`http.client.requests`**. Each distinct request URI becomes
 * a **`uri`** tag; xAI paths embed collection/file ids → cardinality explodes and triggers
 * **`OnlyOnceLoggingDenyMeterFilter`** ("maximum number of URI tags").
 *
 * This convention keeps **`method`**, **`status`**, **`outcome`**, etc. from the default implementation but replaces
 * **`uri`** with a **template** (ids collapsed). **`java.net.http.HttpClient`** (e.g. Yahoo chain fetch) is not affected.
 */
@Configuration
class ClientHttpMetricsConventionConfig {
    @Bean
    fun clientRequestObservationConvention(): ClientRequestObservationConvention =
        TemplatedClientRequestObservationConvention()
}

internal class TemplatedClientRequestObservationConvention(
    private val delegate: DefaultClientRequestObservationConvention = DefaultClientRequestObservationConvention(),
) : ClientRequestObservationConvention {

    override fun getName(): String = delegate.name

    override fun getContextualName(context: ClientRequestObservationContext): String? =
        delegate.getContextualName(context)

    override fun getLowCardinalityKeyValues(context: ClientRequestObservationContext): KeyValues {
        val uriKey = LowCardinalityKeyNames.URI.asString()
        val acc = ArrayList<KeyValue>()
        delegate.getLowCardinalityKeyValues(context).forEach { kv ->
            if (kv.key != uriKey) {
                acc.add(kv)
            }
        }
        acc.add(KeyValue.of(uriKey, templateUri(context)))
        return KeyValues.of(acc)
    }

    override fun getHighCardinalityKeyValues(context: ClientRequestObservationContext): KeyValues =
        delegate.getHighCardinalityKeyValues(context)

    override fun supportsContext(context: Observation.Context): Boolean =
        context is ClientRequestObservationContext
}

internal fun templateUri(context: ClientRequestObservationContext): String {
    context.uriTemplate?.trim()?.takeIf { it.isNotEmpty() }?.let {
        return it
    }
    val uri =
        try {
            context.carrier?.uri
        } catch (_: Exception) {
            null
        } ?: return "UNKNOWN"
    val path = uri.rawPath?.takeIf { it.isNotEmpty() } ?: uri.path?.takeIf { it.isNotEmpty() } ?: "/"
    val host = uri.host?.lowercase() ?: ""
    val templated = templateOutboundPath(host, path)
    return if (host.isEmpty()) {
        templated
    } else {
        "$host$templated"
    }
}

internal fun templateOutboundPath(host: String, path: String): String {
    val p = if (path.startsWith("/")) path else "/$path"

    if (host.endsWith("x.ai") || host.contains("management-api")) {
        var t = p
        t = t.replace(Regex("/collections/[^/]+/documents/[^/]+"), "/collections/{collectionId}/documents/{fileId}")
        t = t.replace(Regex("/files/[^/]+"), "/files/{fileId}")
        return t
    }

    if (host.contains("x.com") || host.contains("twitter.com") || host.contains("googleapis.com")) {
        return p
    }

    var g = p.replace(Regex("/[a-f0-9]{24}(?=/|$)"), "/{id}")
    g = g.replace(Regex("/[A-Za-z0-9._-]{22,}(?=/|$)"), "/{id}")
    return g
}
