package com.atxfinance.backend.portfolio

class PositionValidationException(
    val code: Code,
    message: String,
) : RuntimeException(message) {
    enum class Code {
        INVALID_IDS,
        ACCOUNT_NOT_FOUND,
        ACCOUNT_PORTFOLIO_MISMATCH,
        ACCOUNT_MISSING_EXT_ACCOUNT_ID,
        POSITION_FIELDS_INCOMPLETE,
        INVALID_OPTION_EXPIRATION,
    }
}
