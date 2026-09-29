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
 * Personal Gmail SMTP (parity with Next.js `desk-smtp`).
 * SMTP_USER = Gmail address, SMTP_PASS = app password. SMTP_HOST is ignored.
 */
object DeskSmtpSender {
    private const val GMAIL_HOST = "smtp.gmail.com"
    private const val GMAIL_PORT = "587"

    fun sendPlain(to: String, subject: String, body: String): Boolean {
        val user = System.getenv("SMTP_USER")?.trim().orEmpty()
        val pass = System.getenv("SMTP_PASS")?.trim().orEmpty()
        val fromEnv = System.getenv("DESK_EMAIL_FROM")?.trim().orEmpty()
        val from = fromEnv.ifEmpty { user }
        if (user.isEmpty() || pass.isEmpty() || from.isEmpty()) return false

        val props = Properties()
        props["mail.smtp.host"] = GMAIL_HOST
        props["mail.smtp.port"] = GMAIL_PORT
        props["mail.smtp.auth"] = "true"
        props["mail.smtp.starttls.enable"] = "true"

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
