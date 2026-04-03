package com.atxfinance.backend.desk

import jakarta.mail.Authenticator
import jakarta.mail.Message
import jakarta.mail.PasswordAuthentication
import jakarta.mail.Session
import jakarta.mail.Transport
import jakarta.mail.internet.InternetAddress
import jakarta.mail.internet.MimeMessage
import java.util.Properties

/**
 * Optional SMTP for admin delivery-channel tests and parity with Next.js `desk-smtp`.
 * Reads the same env vars as the Next app: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, DESK_EMAIL_FROM, SMTP_SECURE.
 */
object DeskSmtpSender {
    fun sendPlain(to: String, subject: String, body: String): Boolean {
        val host = System.getenv("SMTP_HOST")?.trim().orEmpty()
        if (host.isEmpty()) return false
        val user = System.getenv("SMTP_USER")?.trim().orEmpty()
        val pass = System.getenv("SMTP_PASS")?.trim().orEmpty()
        val fromEnv = System.getenv("DESK_EMAIL_FROM")?.trim().orEmpty()
        val from = fromEnv.ifEmpty { user }
        if (user.isEmpty() || pass.isEmpty() || from.isEmpty()) return false

        val port = System.getenv("SMTP_PORT")?.trim()?.toIntOrNull()?.takeIf { it in 1..65535 } ?: 587
        val secureRaw = System.getenv("SMTP_SECURE")?.trim()?.lowercase().orEmpty()
        val secure = secureRaw == "1" || secureRaw == "true" || secureRaw == "yes"

        val props = Properties()
        props["mail.smtp.host"] = host
        props["mail.smtp.port"] = port.toString()
        props["mail.smtp.auth"] = "true"
        if (secure) {
            props["mail.smtp.ssl.enable"] = "true"
        } else {
            props["mail.smtp.starttls.enable"] = "true"
        }

        return try {
            val session =
                Session.getInstance(
                    props,
                    object : Authenticator() {
                        override fun getPasswordAuthentication(): PasswordAuthentication =
                            PasswordAuthentication(user, pass)
                    },
                )
            val msg = MimeMessage(session)
            msg.setFrom(InternetAddress(from))
            msg.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to.trim()))
            msg.subject = subject
            msg.setText(body)
            Transport.send(msg)
            true
        } catch (_: Exception) {
            false
        }
    }
}
