package com.atxfinance.backend.portfolio

import org.bson.Document
import org.bson.types.ObjectId
import java.util.Date

object BsonJson {
    fun value(v: Any?): Any? =
        when (v) {
            null -> null
            is ObjectId -> v.toHexString()
            is Date -> v.toInstant().toString()
            is Document -> documentToMap(v)
            is List<*> -> v.map { value(it) }
            else -> v
        }

    fun documentToMap(doc: Document): Map<String, Any?> =
        doc.keys.associateWith { key -> value(doc[key]) }
}
