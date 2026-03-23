package com.atxfinance.backend.portfolio

import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.springframework.stereotype.Service

/**
 * Merrill/Fidelity holdings CSV import. Mirrors Next broker-holdings-import.ts.
 */
@Service
class BrokerHoldingsImportService(
    private val positionsService: PositionsService,
    private val portfolioCrud: PortfolioCrudService,
) {

    data class ParsedAccount(
        val accountRef: String,
        val label: String,
        val positions: List<BrokerPosition>,
    )

    data class BrokerPosition(
        val type: String, // stock, option, cash
        val ticker: String,
        val shares: Double? = null,
        val purchasePrice: Double? = null,
    )

    data class ApplyResult(
        val accountRef: String,
        val label: String,
        val imported: Int,
        val skippedNonStock: Int,
        val deletedPrior: Int,
        val error: String? = null,
    )

    fun parseAndPreview(
        broker: String,
        csv: String,
        fidelityHoldingsDefaultAccountRef: String,
    ): Pair<List<ParsedAccount>, String?> {
        return when (broker.lowercase()) {
            "merrill" -> parseMerrill(csv)
            "fidelity" -> parseFidelity(csv, fidelityHoldingsDefaultAccountRef)
            else -> emptyList<ParsedAccount>() to "Unsupported broker: $broker"
        }
    }

    private fun parseMerrill(csv: String): Pair<List<ParsedAccount>, String?> {
        val lines = csv.replace("\uFEFF", "").trim().split("\r\n", "\r", "\n").map { it.trim() }.filter { it.isNotEmpty() }
        if (lines.size < 2) {
            return emptyList<ParsedAccount>() to "File has no data rows (need header + at least one row)."
        }
        val header = parseCsvLine(lines[0]).map { it.replace("\uFEFF", "").trim() }
        val iSymbol = header.indexOfFirst { it.contains("ymbol", ignoreCase = true) && !it.contains("cusip", ignoreCase = true) }
        val iAccountReg = header.indexOfFirst { it.contains("account", ignoreCase = true) && it.contains("registration", ignoreCase = true) }
        val iAccountNum = header.indexOfFirst { it.contains("account", ignoreCase = true) && it.contains("#", ignoreCase = true) }
        val iQty = header.indexOfFirst { it.contains("quantity", ignoreCase = true) }
        val iPrice = header.indexOfFirst { it.contains("price", ignoreCase = true) }

        if (iSymbol < 0 || iQty < 0) {
            return emptyList<ParsedAccount>() to "Required column(s) not found: Symbol, Quantity"
        }

        val byAccount = mutableMapOf<String, MutableList<BrokerPosition>>()
        for (i in 1 until lines.size) {
            val row = parseCsvLine(lines[i])
            val symbolRaw = (row.getOrNull(iSymbol) ?: "").trim()
            val accountRef = (row.getOrNull(iAccountNum) ?: "").trim().ifEmpty { (row.getOrNull(iAccountReg) ?: "").trim() }
            val label = (row.getOrNull(iAccountReg) ?: "").trim().ifEmpty { accountRef }
            val key = accountRef.ifEmpty { label }.ifEmpty { "default" }
            if (key.all { it.isDigit() || it == '.' || it == ',' }) continue

            val qty = parseQuantity(row.getOrNull(iQty) ?: "")
            val price = parseNum(row.getOrNull(iPrice) ?: "")
            if (symbolRaw.isEmpty() || symbolRaw == "--" || qty == null || qty == 0.0) continue

            val underlying = if (symbolRaw.contains("#")) symbolRaw.substringBefore("#").uppercase() else symbolRaw.uppercase()
            if (underlying.endsWith("XX") && underlying.length >= 4) {
                byAccount.getOrPut(key) { mutableListOf() }.add(
                    BrokerPosition("cash", underlying, qty, price ?: 1.0)
                )
                continue
            }

            val isOption = symbolRaw.contains("#") && (
                symbolRaw.matches(Regex(".*[CP]\\d{8}$", RegexOption.IGNORE_CASE)) ||
                symbolRaw.contains("CALL", ignoreCase = true) ||
                symbolRaw.contains("PUT", ignoreCase = true)
            )
            if (isOption) continue

            byAccount.getOrPut(key) { mutableListOf() }.add(
                BrokerPosition("stock", underlying, kotlin.math.abs(qty), price?.let { kotlin.math.abs(it) })
            )
        }

        val accounts = byAccount.map { (ref, positions) ->
            ParsedAccount(ref, ref, positions)
        }
        return accounts to if (accounts.isEmpty()) "No accounts parsed from Merrill Holdings CSV." else null
    }

    private fun parseFidelity(csv: String, defaultAccountRef: String): Pair<List<ParsedAccount>, String?> {
        val ref = defaultAccountRef.trim()
        if (ref.isEmpty()) {
            return emptyList<ParsedAccount>() to "Fidelity holdings export has no Account column; set fidelityHoldingsDefaultAccountRef to match an account external ref (extAccountId)."
        }
        val lines = csv.replace("\uFEFF", "").trim().split("\r\n", "\r", "\n").map { it.trim() }.filter { it.isNotEmpty() }
        val positions = mutableListOf<BrokerPosition>()
        var dataStartIndex = -1
        var headerRow: List<String>? = null

        for (i in lines.indices) {
            val row = parseCsvLine(lines[i])
            val first = (row.getOrNull(0) ?: "").trim()
            if (first.equals("symbol", ignoreCase = true) && row.size >= 2) {
                headerRow = row.map { it.replace("\uFEFF", "").trim() }
                dataStartIndex = i + 1
                break
            }
            if (first.lowercase().startsWith("disclosure") || first.isEmpty()) break
        }

        if (headerRow == null || dataStartIndex < 0) {
            return emptyList<ParsedAccount>() to "Could not find header row starting with Symbol"
        }

        val h = headerRow
        val iSymbol = h.indexOfFirst { it.equals("symbol", ignoreCase = true) }
        val iQty = h.indexOfFirst { it.equals("quantity", ignoreCase = true) }
        val iLast = h.indexOfFirst { it.equals("last", ignoreCase = true) }
        val iAvgCost = h.indexOfFirst { it.contains("avg", ignoreCase = true) && it.contains("cost", ignoreCase = true) }

        if (iSymbol < 0 || iQty < 0) {
            return emptyList<ParsedAccount>() to "Required columns Symbol and Quantity not found"
        }

        for (r in dataStartIndex until lines.size) {
            val row = parseCsvLine(lines[r])
            val firstCell = (row.getOrNull(0) ?: "").trim()
            if (firstCell.lowercase().startsWith("disclosure") || firstCell.isEmpty()) break

            val symbolRaw = (row.getOrNull(iSymbol) ?: "").trim()
            if (symbolRaw.isEmpty() || symbolRaw == "--") continue

            val qty = parseNum(row.getOrNull(iQty) ?: "")
            if (qty == null) continue
            val quantity = kotlin.math.abs(qty)

            val lastPrice = if (iLast >= 0) parseNum(row.getOrNull(iLast) ?: "") else null
            val avgCost = if (iAvgCost >= 0) parseNum(row.getOrNull(iAvgCost) ?: "") else null
            val price = lastPrice ?: avgCost ?: 0.0

            if (symbolRaw.matches(Regex("^cash\\s*\\(", RegexOption.IGNORE_CASE))) continue
            if (symbolRaw.matches(Regex("^[A-Z]+\\d{6}[CP]\\d+$", RegexOption.IGNORE_CASE))) continue

            positions.add(
                BrokerPosition("stock", symbolRaw.uppercase(), quantity, if (price > 0) price else null)
            )
        }

        return listOf(ParsedAccount(ref, "Fidelity (All Accounts)", positions)) to
            if (positions.isEmpty()) "No positions parsed from Fidelity CSV." else null
    }

    private fun parseCsvLine(line: String): List<String> {
        val out = mutableListOf<String>()
        var i = 0
        while (i < line.length) {
            if (line[i] == '"') {
                val sb = StringBuilder()
                i++
                while (i < line.length) {
                    when {
                        line[i] == '"' && i + 1 < line.length && line[i + 1] == '"' -> {
                            sb.append('"')
                            i += 2
                        }
                        line[i] == '"' -> {
                            i++
                            break
                        }
                        else -> sb.append(line[i++])
                    }
                }
                out.add(sb.toString())
                if (i < line.length && line[i] == ',') i++
            } else {
                val comma = line.indexOf(',', i)
                if (comma < 0) {
                    out.add(line.substring(i).trim())
                    break
                }
                out.add(line.substring(i, comma).trim())
                i = comma + 1
            }
        }
        return out
    }

    private fun parseNum(v: String): Double? {
        val cleaned = v.replace(",", "").replace(Regex("[$()]"), "").trim()
        if (cleaned.isEmpty() || cleaned == "--") return null
        return cleaned.toDoubleOrNull()?.takeIf { it.isFinite() }
    }

    private fun parseQuantity(raw: String): Double? {
        val n = parseNum(raw) ?: return null
        return if (raw.trim().startsWith("(")) -kotlin.math.abs(n) else n
    }

    private fun aggregateStockLots(positions: List<BrokerPosition>): List<Triple<String, Double, Double>> {
        val map = mutableMapOf<String, Pair<Double, Double>>()
        for (p in positions) {
            if (p.type != "stock") continue
            val ticker = p.ticker.trim().uppercase()
            if (ticker.isEmpty()) continue
            val qty = p.shares ?: 0.0
            if (!qty.isFinite() || qty <= 0) continue
            val price = (p.purchasePrice ?: 0.0).coerceAtLeast(0.0)
            val (prevQty, prevCost) = map.getOrDefault(ticker, 0.0 to 0.0)
            map[ticker] = (prevQty + qty) to (prevCost + qty * price)
        }
        return map.map { entry ->
            val ticker = entry.key
            val (qty, costBasis) = entry.value
            Triple(ticker, qty, if (qty > 0) costBasis / qty else 0.0)
        }
    }

    fun apply(
        session: ResolvedSession,
        portfolioId: String,
        parsedAccounts: List<ParsedAccount>,
        mappings: Map<String, String>,
    ): List<ApplyResult> {
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioId, session)
            ?: throw IllegalArgumentException("Portfolio not found")
        val accounts = portfolioCrud.listAccountsForPortfolio(portfolio.getObjectId("_id")!!, session)
        val allowedAccountIds = accounts.mapNotNull { it.getObjectId("_id")?.toHexString() }.toSet()

        val results = mutableListOf<ApplyResult>()
        for (acc in parsedAccounts) {
            val key = acc.accountRef.ifEmpty { acc.label }.ifEmpty { "default" }
            val accountId = mappings[key]?.trim()
            val label = acc.label.ifEmpty { acc.accountRef }.ifEmpty { key }

            if (accountId.isNullOrEmpty()) {
                results.add(ApplyResult(acc.accountRef, label, 0, 0, 0, "No app account selected for this broker account key"))
                continue
            }

            if (accountId !in allowedAccountIds) {
                results.add(ApplyResult(acc.accountRef, label, 0, 0, 0, "Mapped account not in portfolio"))
                continue
            }

            val skipped = acc.positions.count { it.type != "stock" }
            val deletedCount = positionsService.deleteAllForAccount(session, portfolioId, accountId)

            var imported = 0
            var applyError: String? = null
            val lots = aggregateStockLots(acc.positions)
            for ((ticker, qty, avgCost) in lots) {
                try {
                    positionsService.upsert(session, PositionPayloadNormalizer.LegacyUpsert(portfolioId, accountId, ticker, qty, avgCost))
                    imported++
                } catch (e: Exception) {
                    applyError = e.message ?: "Upsert failed"
                    break
                }
            }
            results.add(ApplyResult(acc.accountRef, label, imported, skipped, deletedCount.toInt(), applyError))
        }
        return results
    }
}
