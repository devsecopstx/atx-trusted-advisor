package com.atxfinance.backend.identity

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.desk.DeskSmtpSender
import org.bson.Document
import org.bson.types.ObjectId
import org.slf4j.LoggerFactory
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.Base64
import java.util.Date

/**
 * When an access request is approved on the JVM (BFF proxy), issues the same Mongo credential-invite fields
 * as Next.js `issueCredentialInviteForUser` and sends the set-password link via desk SMTP (parity with
 * `sendAccessApprovedPasswordInviteEmail`). xAI per-user collection bootstrap remains a Next concern.
 */
@Service
class CredentialInviteService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun maybeIssueInviteAndSendEmail(userId: ObjectId, email: String) {
        val trimmedEmail = email.trim()
        if (trimmedEmail.isEmpty()) {
            return
        }
        val user = mongoTemplate.findById(userId, Document::class.java, props.coreUsersCollection) ?: return
        val passwordHash = user.getString("passwordHash")
        if (!passwordHash.isNullOrEmpty()) {
            return
        }

        val rawBytes = ByteArray(32)
        SecureRandom().nextBytes(rawBytes)
        val rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(rawBytes)
        val tokenHash = AuthTokenHash.sha256HexOfUtf8(rawToken)
        val now = Date()
        val expires = Date(now.time + INVITE_TTL_MS)

        val res =
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(userId)),
                Update()
                    .set("credentialInviteTokenHash", tokenHash)
                    .set("credentialInviteExpiresAt", expires)
                    .set("updatedAt", now)
                    .unset("passwordResetTokenHash")
                    .unset("passwordResetExpiresAt"),
                props.coreUsersCollection,
            )
        if (res.matchedCount != 1L) {
            log.warn("[credential-invite] user not found for invite issue userId={}", userId.toHexString())
            return
        }

        val publicBase =
            System.getenv("PUBLIC_APP_BASE_URL")?.trim()?.removeSuffix("/").orEmpty()
        if (publicBase.isEmpty()) {
            log.warn(
                "[credential-invite] PUBLIC_APP_BASE_URL unset — invite token stored but email skipped userId={}",
                userId.toHexString(),
            )
            return
        }

        val encoded = URLEncoder.encode(rawToken, StandardCharsets.UTF_8)
        val link = "$publicBase/login/set-password?token=$encoded"
        val subject = "Your xFinance access is approved — set your password"
        val text =
            listOf(
                "Your access request was approved.",
                "",
                "Set your password to sign in with email:",
                link,
                "",
                "This link expires in 7 days. If you did not request access, ignore this email.",
            ).joinToString("\n")

        val sent = DeskSmtpSender.sendPlain(trimmedEmail, subject, text)
        if (!sent) {
            log.warn(
                "[credential-invite] desk SMTP send failed or not configured userId={}",
                userId.toHexString(),
            )
        }
    }

    companion object {
        private const val INVITE_TTL_MS = 7L * 24 * 60 * 60 * 1000
    }
}
