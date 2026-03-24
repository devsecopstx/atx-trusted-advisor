package com.atxfinance.backend.persona

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.session.isGlobalAdmin
import com.mongodb.MongoWriteException
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.dao.DuplicateKeyException
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date

@Service
class PersonaService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {

    fun listPersonas(session: ResolvedSession, statusQuery: String?): List<Document> {
        val admin = session.isGlobalAdmin()
        val q = Query()
        when {
            !admin -> q.addCriteria(Criteria.where("status").`is`("published"))
            !statusQuery.isNullOrBlank() && statusQuery in PERSONA_STATUSES -> {
                q.addCriteria(Criteria.where("status").`is`(statusQuery))
            }
            else -> { /* all */ }
        }
        q.with(Sort.by(Sort.Order.desc("updatedAt")))
        return mongoTemplate.find(q, Document::class.java, props.personasCollection)
    }

    fun loadLatestAuditByPersonaIds(personaHexIds: List<String>): Map<String, Document> {
        if (personaHexIds.isEmpty()) return emptyMap()
        val events = mongoTemplate.find(
            Query.query(
                Criteria.where("entityType").`is`("xpersona").and("entityId").`in`(personaHexIds),
            ).with(Sort.by(Sort.Order.desc("createdAt"))),
            Document::class.java,
            props.auditEventsCollection,
        )
        val out = LinkedHashMap<String, Document>()
        for (e in events) {
            val eid = e.getString("entityId") ?: continue
            if (!out.containsKey(eid)) {
                out[eid] = e
            }
        }
        return out
    }

    fun listAuditTrailForPersona(personaId: String): List<Document> {
        return mongoTemplate.find(
            Query.query(Criteria.where("entityType").`is`("xpersona").and("entityId").`is`(personaId))
                .with(Sort.by(Sort.Order.desc("createdAt")))
                .limit(20),
            Document::class.java,
            props.auditEventsCollection,
        )
    }

    fun getPersonaById(personaId: String): Document? {
        if (!ObjectId.isValid(personaId)) return null
        return mongoTemplate.findById(ObjectId(personaId), Document::class.java, props.personasCollection)
    }

    fun createPersona(body: Map<String, Any?>): Document {
        val err = validateCreatePayload(body)
        if (err != null) throw PersonaPayloadException(400, err)
        val now = Date()
        val name = body["name"]!!.toString().trim()
        val doc = Document()
        doc["name"] = name
        doc["nameNormalized"] = normalizeNameKey(name)
        doc["systemPrompt"] = body["systemPrompt"]!!.toString().trim()
        doc["overridePrompt"] = (body["overridePrompt"] as? String)?.trim().orEmpty()
        doc["xaiCollection"] = subDoc(body["xaiCollection"])
        doc["teamCollection"] = subDoc(body["teamCollection"])
        doc["model"] = (body["model"] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: DEFAULT_MODEL
        doc["temperature"] = (body["temperature"] as? Number)?.toDouble() ?: 0.2
        doc["enableRag"] = body["enableRag"] as? Boolean ?: true
        doc["defaultScope"] = (body["defaultScope"] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: "global"
        doc["xapi"] = normalizeXapiDoc(body["xapi"])
        doc["status"] = "draft"
        doc["version"] = 0
        doc["createdAt"] = now
        doc["updatedAt"] = now
        if (!personaSatisfiesFileSearch(doc)) {
            throw PersonaPayloadException(
                400,
                "Collection search (file_search / collections_search) requires xaiCollection.collectionId, teamCollection.collectionId, or collection ids on tools",
            )
        }
        try {
            mongoTemplate.insert(doc, props.personasCollection)
        } catch (ex: DuplicateKeyException) {
            throw PersonaPayloadException(409, "PERSONA_NAME_CONFLICT")
        } catch (ex: MongoWriteException) {
            if (ex.code == 11000) {
                throw PersonaPayloadException(409, "PERSONA_NAME_CONFLICT")
            }
            throw ex
        }
        return doc
    }

    fun updatePersona(personaId: String, body: Map<String, Any?>): Document {
        if (!ObjectId.isValid(personaId)) {
            throw PersonaPayloadException(404, "not_found")
        }
        val existing = getPersonaById(personaId) ?: throw PersonaPayloadException(404, "not_found")
        val err = validateUpdatePayload(body)
        if (err != null) throw PersonaPayloadException(400, err)
        val merged = mergeForValidation(existing, body)
        if (!personaSatisfiesFileSearch(merged)) {
            throw PersonaPayloadException(
                400,
                "Invalid persona payload: collection search requires xaiCollection, teamCollection, or collection ids on tools",
            )
        }
        val set = Document()
        for ((k, v) in body) {
            if (v == null || k == "_id") continue
            when (k) {
                "name" -> {
                    val n = v.toString().trim()
                    set["name"] = n
                    set["nameNormalized"] = normalizeNameKey(n)
                }
                "systemPrompt" -> set["systemPrompt"] = v.toString().trim()
                "overridePrompt" -> set["overridePrompt"] = v.toString().trim()
                "xaiCollection" -> set["xaiCollection"] = subDoc(v)
                "teamCollection" -> set["teamCollection"] = subDoc(v)
                "model" -> set["model"] = v.toString().trim()
                "temperature" -> set["temperature"] = (v as Number).toDouble()
                "enableRag" -> set["enableRag"] = v
                "defaultScope" -> set["defaultScope"] = v.toString().trim()
                "xapi" -> set["xapi"] = normalizeXapiDoc(v)
            }
        }
        set["updatedAt"] = Date()
        val oid = ObjectId(personaId)
        val u = Update()
        for (k in set.keys) {
            u.set(k, set[k])
        }
        try {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(oid)),
                u,
                props.personasCollection,
            )
        } catch (ex: DuplicateKeyException) {
            throw PersonaPayloadException(409, "PERSONA_NAME_CONFLICT")
        } catch (ex: MongoWriteException) {
            if (ex.code == 11000) {
                throw PersonaPayloadException(409, "PERSONA_NAME_CONFLICT")
            }
            throw ex
        }
        return getPersonaById(personaId) ?: throw PersonaPayloadException(404, "not_found")
    }

    fun deletePersona(personaId: String): Boolean {
        if (!ObjectId.isValid(personaId)) return false
        val res = mongoTemplate.remove(
            Query.query(Criteria.where("_id").`is`(ObjectId(personaId))),
            props.personasCollection,
        )
        return res.deletedCount == 1L
    }

    private fun mergeForValidation(existing: Document, patch: Map<String, Any?>): Document {
        val copy = Document(existing)
        for ((k, v) in patch) {
            if (v == null) continue
            when (k) {
                "name" -> copy["name"] = v.toString().trim()
                "systemPrompt" -> copy["systemPrompt"] = v.toString().trim()
                "overridePrompt" -> copy["overridePrompt"] = v.toString().trim()
                "xaiCollection" -> copy["xaiCollection"] = subDoc(v)
                "teamCollection" -> copy["teamCollection"] = subDoc(v)
                "xapi" -> copy["xapi"] = normalizeXapiDoc(v)
                "model" -> copy["model"] = v.toString().trim()
                "temperature" -> copy["temperature"] = (v as Number).toDouble()
                "enableRag" -> copy["enableRag"] = v
                "defaultScope" -> copy["defaultScope"] = v.toString().trim()
            }
        }
        copy["xapi"] = normalizeXapiDoc(copy["xapi"])
        return copy
    }

    private fun subDoc(v: Any?): Document {
        if (v is Document) return v
        if (v is Map<*, *>) {
            val d = Document()
            v.forEach { (k, x) -> if (k is String) d[k] = x }
            return d
        }
        return Document()
    }

    private fun normalizeXapiDoc(raw: Any?): Document {
        val src = when (raw) {
            is Document -> raw
            is Map<*, *> -> subDoc(raw)
            else -> Document()
        }
        val out = Document()
        out["mode"] = (src["mode"] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: "responses"
        out["toolChoice"] = (src["toolChoice"] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: "auto"
        val maxTurns = (src["maxTurns"] as? Number)?.toInt() ?: 5
        out["maxTurns"] = maxTurns.coerceIn(1, 10)
        val toolsRaw = src["tools"]
        val toolsList = mutableListOf<Document>()
        if (toolsRaw is List<*>) {
            for (t in toolsRaw) {
                if (t is Map<*, *>) {
                    val td = subDoc(t)
                    if (td.getString("type")?.isNotBlank() == true) {
                        toolsList.add(td)
                    }
                }
            }
        }
        out["tools"] = toolsList.take(32)
        return out
    }

    private fun hasFileSearchTool(xapi: Document): Boolean {
        val tools = xapi["tools"] as? List<*> ?: return false
        for (t in tools) {
            val td = t as? Document ?: continue
            val type = td.getString("type") ?: continue
            if (type == "file_search" || type == "collections_search") return true
        }
        return false
    }

    private fun linkedCollectionIds(persona: Document, xapi: Document): List<String> {
        val ids = mutableListOf<String>()
        (persona["xaiCollection"] as? Document)?.getString("collectionId")?.trim()?.takeIf { it.isNotEmpty() }?.let(ids::add)
        (persona["teamCollection"] as? Document)?.getString("collectionId")?.trim()?.takeIf { it.isNotEmpty() }?.let(ids::add)
        val tools = xapi["tools"] as? List<*> ?: emptyList<Any>()
        for (t in tools) {
            val td = t as? Document ?: continue
            when (td.getString("type")) {
                "collections_search" -> {
                    val arr = td["collection_ids"] as? List<*>
                    arr?.forEach { id ->
                        if (id is String && id.trim().isNotEmpty()) ids.add(id.trim())
                    }
                }
                "file_search" -> {
                    val source = td["source"] as? Document
                    val arr = source?.get("collection_ids") as? List<*>
                    arr?.forEach { id ->
                        if (id is String && id.trim().isNotEmpty()) ids.add(id.trim())
                    }
                }
            }
        }
        return ids.distinct()
    }

    private fun personaSatisfiesFileSearch(persona: Document): Boolean {
        val xapi = normalizeXapiDoc(persona["xapi"])
        if (!hasFileSearchTool(xapi)) return true
        return linkedCollectionIds(persona, xapi).isNotEmpty()
    }

    private fun validateCreatePayload(body: Map<String, Any?>): String? {
        val name = (body["name"] as? String)?.trim() ?: return "invalid_name"
        if (name.length < 2 || name.length > 80) return "invalid_name"
        val sp = (body["systemPrompt"] as? String)?.trim() ?: return "invalid_system_prompt"
        if (sp.length < 10 || sp.length > 16_000) return "invalid_system_prompt"
        val op = body["overridePrompt"] as? String
        if (op != null && op.length > 16_000) return "invalid_override"
        return null
    }

    private fun validateUpdatePayload(body: Map<String, Any?>): String? {
        if (body.containsKey("name")) {
            val name = (body["name"] as? String)?.trim()
            if (name == null || name.length < 2 || name.length > 80) return "invalid_name"
        }
        if (body.containsKey("systemPrompt")) {
            val sp = (body["systemPrompt"] as? String)?.trim()
            if (sp == null || sp.length < 10 || sp.length > 16_000) return "invalid_system_prompt"
        }
        if (body.containsKey("overridePrompt")) {
            val op = body["overridePrompt"] as? String ?: ""
            if (op.length > 16_000) return "invalid_override"
        }
        return null
    }

    companion object {
        private val PERSONA_STATUSES = setOf("draft", "published", "archived")
        private const val DEFAULT_MODEL = "grok-4-1-fast-reasoning"

        fun normalizeNameKey(name: String): String = name.trim().lowercase()

        fun serializePersona(doc: Document): Map<String, Any?> {
            val id = doc.getObjectId("_id")
            val map = LinkedHashMap<String, Any?>()
            map["_id"] = id?.toHexString()
            map["name"] = doc.getString("name")
            map["systemPrompt"] = doc.getString("systemPrompt")
            map["overridePrompt"] = doc.getString("overridePrompt") ?: ""
            map["xaiCollection"] = doc["xaiCollection"] ?: Document()
            map["teamCollection"] = doc["teamCollection"] ?: Document()
            map["model"] = doc.getString("model")
            map["temperature"] = (doc["temperature"] as? Number)?.toDouble() ?: 0.2
            map["enableRag"] = doc.getBoolean("enableRag", true)
            map["defaultScope"] = doc.getString("defaultScope") ?: "global"
            map["xapi"] = doc["xapi"] ?: Document()
            map["status"] = doc.getString("status") ?: "draft"
            map["version"] = (doc["version"] as? Number)?.toInt() ?: 0
            map["publishedAt"] = dateToIso(doc["publishedAt"])
            map["xaiCollectionVerification"] = doc["xaiCollectionVerification"]?.let { ver ->
                if (ver is Document) {
                    val c = Document(ver)
                    c["checkedAt"] = dateToIso(ver["checkedAt"])
                    c
                } else {
                    ver
                }
            }
            map["createdAt"] = dateToIso(doc["createdAt"]) ?: Instant.now().toString()
            map["updatedAt"] = dateToIso(doc["updatedAt"]) ?: Instant.now().toString()
            return map
        }

        fun serializeAuditBrief(doc: Document): Map<String, Any?> {
            val actor = doc["actor"] as? Document
            return mapOf(
                "action" to doc.getString("action"),
                "createdAt" to (dateToIso(doc["createdAt"]) ?: ""),
                "actor" to mapOf(
                    "userId" to (actor?.getString("userId") ?: ""),
                    "email" to actor?.getString("email"),
                    "username" to actor?.getString("username"),
                ),
                "details" to doc["details"],
            )
        }

        private fun dateToIso(v: Any?): String? = when (v) {
            is Date -> v.toInstant().toString()
            null -> null
            else -> null
        }
    }
}

class PersonaPayloadException(val status: Int, val code: String) : RuntimeException(code)
