package com.atxfinance.backend.xchat

import com.atxfinance.backend.config.AtxfinanceProperties
import org.bson.Document
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.stereotype.Service

@Service
class XchatPlatformSettingsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    fun loadSettings(): Document? =
        mongoTemplate.findAll(Document::class.java, props.xchatPlatformSettingsCollection).firstOrNull()
}
