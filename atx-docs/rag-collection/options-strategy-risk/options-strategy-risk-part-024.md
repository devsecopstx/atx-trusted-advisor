---
id: xfinance-pdf-ingest-options-strategy-risk-part-024
name: xfinance-pdf-ingest-options-strategy-risk-part-024
description: Options Risk (part 24/38)
strategy_type: pdf_ingest
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [pdf_ingest, options, strategy, risk]
---

<!-- INGEST: pdf → markdown via pymupdf4llm; slug=options-strategy-risk; outlook=Neutral -->

*Source PDF: 96 page(s).*
## **Risks of Option Writers** 

The risks discussed in numbered sections 3, 4, 5 and 10 below apply to writers of non-binary and binary options, but the risks discussed in numbered sections 1, 2, 6, 7, 8, 9 and 11 are inapplicable to writers of binary options. Special risks of binary options are discussed below under the caption “Special Risks of Binary Options (Other Than Credit Default Options).”

The risks discussed in numbered sections 5, 9 and 10 below apply to writers of range options, but the risks discussed in numbered sections 1, 2, 6, 7, 8 and 11 do not. Although some of the risks discussed in numbered sections 3 and 4 apply to writers of range options, these risks are separately discussed below under the caption “Special Risks of Range Options” because range options are of a single type (rather than consisting of a put class and a call class) and have a unique payout structure.

1. An option writer may be assigned an exercise at any time during the period the option is exercisable. Starting with the day it is purchased (provided, in the case of a delayed start option, that its exercise price has been set), an American-style option is subject to being exercised by the option holder at any time until the option expires. This means that the option writer is subject to being assigned an exercise at any time after she has written the option until the option expires or until she has closed out her position in a closing transaction. By contrast, the writer of a European-style option (including a European-style delayed start option), a capped option, or an American-style delayed start option before its exercise price is set is subject to assignment only when the option becomes exercisable or, in the case of a capped option, when the automatic exercise value of the underlying interest hits the cap price.

An assigned writer may not receive notice of the assignment until one or more days after the assignment has been made by OCC. Once an exercise has been assigned to a writer, the writer may no longer close out the assigned position in a closing purchase transaction, whether or not she has received notice of the assignment. In that circumstance, an attempted closing purchase would be treated as an opening purchase transaction.

If an option that is exercisable is in the money, the option writer can anticipate that the option will be exercised, especially as expiration approaches. Once she is assigned an exercise, the assigned writer must deliver (in the case of a call) or purchase (in the case of a put) the underlying interest (or pay the cash settlement amount in the case of an in the money cash-settled option). The consequences of being assigned an exercise depend upon whether the writer of a call is covered or uncovered, as discussed below.

63

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS

2. The writer of a covered call forgoes the opportunity to benefit from an increase in the value of the underlying interest above the option price, but continues to bear the risk of a decline in the value of the underlying interest. Unlike a holder of the underlying interest who has not written a call against it, the covered call writer has (in exchange for the premium) given up the opportunity to profit from an increase in the value of the underlying interest above the exercise price. If he is assigned an exercise, the net proceeds that he realizes from the sale of the underlying interest pursuant to the exercise could be substantially below its prevailing market price.

EXAMPLE: _**When XYZ stock was $50, the investor collected a $4 a share premium by writing an XYZ 50 delivery call. As expiration approaches, the stock has risen to $58 and he is assigned an exercise. His total return, in addition to any dividends received, will be the $50 exercise price he is paid for the stock plus the $4 premium collected when the option was written — $4 a share less than the $58 he could have sold the stock for if he had** not_ _**written the option.**_

_**On the other hand, if the value of the underlying interest declines substantially below the exercise price, the call is not likely to be exercised and, depending upon the price paid for the underlying interest, the covered call writer could have an unrealized loss on the underlying interest. However, that loss will be wholly or partially offset by the premium he received when he wrote the option.**_

3. The writer of an uncovered call (other than a binary call) is in an extremely risky position and may incur large losses if the value of the underlying interest increases above the exercise price. For the writer of an uncovered call (other than a binary call), the potential loss is unlimited. When a physical delivery call is assigned an exercise, the writer will have to purchase the underlying interest in order to satisfy his obligation on the call, and his loss will be the excess of the purchase price over the exercise price of the call reduced by the premium received for writing the call. In the case of a cash-settled call other than a binary call, the loss will be the cash settlement amount reduced by the premium. Anything that may cause the price of the underlying interest to rise dramatically, such as a strong market rally or the announcement of a tender offer for an underlying stock at a price that is substantially above the prevailing market price, can cause large losses for an uncovered call writer. For the writer of a binary call, the potential loss will be limited to the fixed cash settlement amount of the option minus the premium received for writing the call. The writer of a binary call will be obligated to pay the entire fixed cash settlement amount if the exercise settlement value is only slightly in the money or, for certain binary calls, even if the exercise settlement value is at the money.

EXAMPLE: _**An investor receives a premium of $4 a share for writing an uncovered XYZ 50 call option and the stock price jumps to $69 as the option approaches expiration. If the investor liquidates his option position at, say, $19, in an offsetting closing purchase transaction, he will incur a loss of $1,500 (the $1,900 paid in the offsetting purchase transaction less the $400 option premium received when the option was written).**_

EXAMPLE: _**An investor receives a premium of $4 for writing a binary call option on XYZ security that has an exercise price of $80 and a fixed cash settlement amount of $100. If the exercise settlement value of XYZ is $81 at expiration, the investor will incur a loss of $96 (the $100 paid to the holder of the call option less the $4 premium received when the option was written).**_

The writer of an uncovered call (other than a binary call) is in an extremely risky position and may incur large losses. Moreover, as discussed in Chapter IX, a writer of uncovered calls must meet applicable margin requirements (which, except in the case of binary calls, can rise substantially if the market moves adversely to the writer’s position). Uncovered call writing is thus suitable only for the

64

CHAPTER X: PRINCIPAL RISKS OF OPTIONS POSITIONS

knowledgeable investor who understands the risks, has sufficient liquid assets to meet applicable margin requirements, and, except in the case of binary options, where the potential loss is limited as described above, has the financial capacity and willingness to incur potentially substantial losses. A binary call writer may be required under exchange rules to deposit the full cash settlement amount at the time the option is written.

4. As with writing uncovered calls, the risk of writing put options is substantial. The writer of a put option bears a risk of loss if the value of the underlying interest declines below the exercise price, and such loss could be substantial if the decline is significant. The writer of a put bears the risk of a decline in the price of the underlying interest — potentially to zero in the case of a put other than a binary put. A writer of a physical delivery put who is assigned an exercise must purchase the underlying interest at the exercise price — which could be substantially greater than the current market price of the underlying interest — and a writer of a cash-settled put other than a binary put must pay a cash settlement amount which reflects the decline in the value of the underlying interest below the exercise price. For the writer of a binary put, the potential loss will be the fixed cash settlement amount of the option minus the premium received for writing the put. The writer of a binary put will be obligated to pay the entire fixed cash settlement amount even if the exercise settlement value of the option is only slightly in the money. Unless a put is a cash-secured put (discussed below), its writer is required to maintain margin with his brokerage firm. Moreover, the writer’s purchase of the underlying interest upon being assigned an exercise of a physical delivery put may result in an additional margin call.

Put writers must have an understanding of the risks, the financial capacity and willingness to incur potentially substantial losses, and the liquidity to meet margin requirements and to buy the underlying interest, or to pay the cash settlement amount, in the event the option is exercised. A writer of an American-style put other than a delayed-start option can be assigned an exercise at any time during the life of the option until such time as she enters into a closing transaction with respect to the option. A writer of an American-style delayed-start option can be assigned an exercise at any time after the option’s exercise price is set until such time as she enters into a closing transaction with respect to the option. Since exercise will ordinarily occur only if the market price of the underlying interest is below the exercise price of the option, the writer of a physical delivery put option can expect to pay more for the underlying interest upon exercise than its then market value.

EXAMPLE: _**At a time when XYZ stock is $50, an investor receives a $300 premium ($3 a share) by writing an XYZ 50 put. Subsequently the stock price declines to $40 and she is assigned an exercise. The investor must purchase the stock at $50. Even though the $3 a share premium reduces her effective cost to $47, that is still substantially higher than the $40 market price of the stock.**_

EXAMPLE: _**An investor receives a premium of $4 for writing a binary put option on XYZ security that has an exercise price of $80 and a fixed cash settlement amount of $100. If the exercise settlement value of XYZ is $79 at expiration, the investor will incur a loss of $96 (the $100 paid to the holder of the put option less the $4 premium received when the option was written).**_

In the case of a put other than a binary put, the put writer’s exposure to margin requirements can be eliminated if the put writer deposits cash equal to the option’s exercise price with his brokerage firm. Under this strategy, known as cash-secured put writing, the put writer is not subject to any additional margin requirements regardless of what happens to the market value of the underlying interest. In the meantime, the put writer might earn interest by having the cash invested in a short-term debt instrument — for example, in a Treasury bill. However, a cash-secured put writer is still subject to a risk of loss if the value of the underlying interest declines. The risk of writers of binary puts is limited to the cash settlement amount of the option, and a binary put writer may be

65

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS

required under exchange rules to deposit the full cash settlement amount at the time the option is written.
