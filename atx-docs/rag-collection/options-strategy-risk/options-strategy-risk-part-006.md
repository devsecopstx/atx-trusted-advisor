---
id: xfinance-pdf-ingest-options-strategy-risk-part-006
name: xfinance-pdf-ingest-options-strategy-risk-part-006
description: Options Risk (part 6/38)
strategy_type: pdf_ingest
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [pdf_ingest, options, strategy, risk]
---

<!-- INGEST: pdf → markdown via pymupdf4llm; slug=options-strategy-risk; outlook=Neutral -->

*Source PDF: 96 page(s).*
Time value is whatever the premium of the option is in addition to its intrinsic value. Time value is that part of the premium that reflects the time remaining before expiration. An American-style option may ordinarily be expected to trade for no less than its intrinsic value prior to its expiration, although occasionally an American-style option will trade at less than its intrinsic value. Because European-style options (including binary options and range options) and capped options are not exercisable at all times, they are more likely than American-style options to trade at less than their intrinsic value when they are not exercisable. 

EXAMPLE OF A CALL WITH INTRINSIC VALUE: _**At a time when the current market price of XYZ stock is $46 a share, an XYZ 40 call would have an** intrinsic value_ _**of $6 a share. If the market price of the stock were to decline to $44, the intrinsic value of the call would be only $4. Should the price of the stock drop to $40 or below, the call would no longer have any intrinsic value.**_

14

CHAPTER II : OPTIONS NOMENCLATURE

EXAMPLE OF A PUT WITH INTRINSIC VALUE: _**At a time when the current market price of XYZ stock is $46 a share, an XYZ 50 put would have an** intrinsic value_ _**of $4 a share. Were the market price of XYZ stock to increase to $50 or above, the put would no longer have any intrinsic value.**_

EXAMPLE OF TIME VALUE: _**At a time when the market price of XYZ stock is $40 a share, an XYZ 40 call may have a current market price of, say, $2 a share. This is entirely** time value_ _**.**_

An option with intrinsic value may often have some time value as well — that is, the market price of the option may be greater than its intrinsic value. This could occur with an option of any style.

EXAMPLE: _**With the market price of XYZ stock at $45 a share, an XYZ 40 call may have a current market price of $6 a share, reflecting an intrinsic value of $5 a share and a time value of $1 a share.**_

An option’s time value is influenced by several factors (as discussed above under “Premium”), including the length of time remaining until expiration. An option is a “wasting” asset; if it is not sold or exercised prior to its expiration, it will become worthless. As a consequence, all else remaining the same, the time value of an option usually decreases as the option approaches expiration, and this decrease accelerates as the time to expiration shortens. However, there may be occasions when the market price of an option may be lower than the market price of another option that has less time remaining to expiration but that is similar in all other respects.

An American-style option’s time value is also influenced by the amount the option is in the money or out of the money. An option normally has very little time value if it is substantially in the money. Although an option that is substantially out of the money has only time value, the amount of that time value is normally less than the time value of an option having the same underlying interest and expiration that is at the money.

Another factor influencing the time value of an option is the volatility of the underlying interest. All else being the same, options on more volatile interests command higher premiums than options on less volatile interests.

Time value is also influenced by the current cost of money. Increases in prevailing interest rates tend to cause higher premiums for calls and lower premiums for puts, and decreases in prevailing interest rates tend to cause lower premiums for calls and higher premiums for puts.

The following is a description of the terminology applicable to capped options:

CAP INTERVAL — The cap interval is a constant established by the options market on which a series of capped options is traded. The exercise price for a capped-style option plus the cap interval (in the case of a call), or minus the cap interval (in the case of a put), equals the cap price for the option. For example, if a capped call option with an exercise price of 360 has a cap interval of 30, then the cap price at which the option will be automatically exercised would be 390.

CAP PRICE — The cap price is the level that the automatic exercise value of a capped option must reach in order for the option to be automatically exercised. The cap price of a call option is above, and of a put option below, the exercise price of the option.

15

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS

EXAMPLE: _**A 360 ABC capped call index option has an exercise price of 360 and a cap interval of 30. The call option has a** cap price_ _**of 390.**_

EXAMPLE: _**A 310 XYZ capped put index option has an exercise price of 310 and a cap interval of 20. The put option has a** cap price_ _**of 290.**_

AUTOMATIC EXERCISE VALUE — The automatic exercise value of a capped option is the price or level of the underlying interest determined in a manner fixed by the options market on which the option is traded for each trading day as of a specified time of that day.

EXAMPLE: _**A 310 XYZ capped put index option has a cap interval of 20, and therefore has a cap price of 290. Assume that the options market on which the option is traded has specified the close of trading on each trading day as the time for determining the automatic exercise value on the XYZ index, and that the index level reaches a low of 289 during a particular trading day, but is at 291 at the close. The** automatic exercise value_ _**has not reached the cap price, and the automatic exercise feature of the option is not triggered, because the index level was not at or below the cap price at the time of day specified by the options market for determining the automatic exercise value.**_

CASH SETTLEMENT AMOUNT — This is the cash amount that the holder of a cash-settled capped option is entitled to receive upon the exercise of the option. In the case of a capped option that has been automatically exercised, the cash settlement amount is equal to the cap interval times the multiplier for the option, even if the automatic exercise value on the day that the automatic exercise feature is triggered exceeds (in the case of a call) or is less than (in the case of a put) the cap price. If the capped option is voluntarily exercised at expiration, the cash settlement amount is determined in the same manner as for other styles of cash-settled options.

EXAMPLE: _**A 360 ABC capped call index option has a cap interval of 30 and a multiplier of 100. The automatic exercise value of the ABC index is 396 on a particular trading day. The call option is automatically exercised, and the** cash settlement amount_ _**is $3000 (equal to the cap interval of 30 times the multiplier of 100).**_

EXAMPLE: _**A 360 ABC capped call index option has a cap interval of 30 and a multiplier of 100. The automatic exercise value of the ABC index never equals or exceeds the cap price of 390 during the life of the option, and the exercise settlement value of the option is 367 on the final trading day. Upon exercise of the option, the holder is entitled to receive a cash settlement amount of $700 (equal to the multiplier of 100 times the difference between the exercise settlement value of 367 and the exercise price of 360).**_

16

CHAPTER II : OPTIONS NOMENCLATURE

A delayed start option is an option that does not have an exercise price when first introduced for trading but instead has an exercise price setting formula pursuant to which the exercise price will be fixed on a specified future date. The following is a description of the terminology applicable to delayed start options:

EXERCISE PRICE SETTING DATE—The exercise price setting date for a series of delayed start options is the date on which the options market on which the series is traded will set the exercise price for the series. The exercise price setting date is specified before the commencement of trading of each series of delayed start options. Specific information regarding exercise price setting dates may be obtained from the listing options market.

EXERCISE PRICE SETTING FORMULA—The exercise price setting formula for a series of delayed start options is the formula used by the options market on which the series is traded to set the exercise price for the series on the exercise price setting date. The exercise price setting formula is specified before the commencement of trading of each series of delayed start option. The formula for a particular series may provide that the exercise price will be at the money, in the money by a specified amount, or out of the money by a specified amount. Exercise prices may be rounded as specified by the listing options market.

EXAMPLE: _**In January, an American-style delayed start option on the ABC index is opened for trading with an exercise price setting date of the third Friday in September and an exercise price setting formula specifying that the exercise price will be set at the closing value of the ABC index on the exercise price setting date, rounded to the nearest whole number. The option may not be exercised at all until after the third Friday in September because it will not have an exercise price until that time. At the close of trading on the third Friday in September, the options market on which the delayed start option is trading will determine the closing value of the ABC index and set the exercise price based on that value. For example, if the options market determines that the ABC index closed at 908.10 on the exercise price setting date, the options market would round that value to 908, and from that time until its expiration date the delayed start option would trade as a regular Americanstyle option with an exercise price of 908.**_

17

CHAPTER III

## **Options on Equity Securities** 

The term “stock options” is used broadly in this document to include not only options on common stocks but also options on all other types of equity securities, such as limited partnership interests, “American Depository Receipts” and “American Depository Shares” representing interests in foreign entities, preferred stocks, and fund shares. The term “fund shares” includes interests in exchangetraded funds and other entities holding or trading in one or more types of investments, and as used in this document the term “equity securities” includes fund shares. 

Issuers of underlying equity securities do not participate in the selection of their securities for options trading (although some options markets may determine not to select an underlying security without the consent of the issuer of that security). Issuers of underlying equity securities have no responsibility regarding the issuance, the terms, or the performance of options, and option holders have no rights as security holders of such issuers. 

The principal risks of holders and writers of stock options are discussed in Chapter X. Readers interested in buying or writing stock options should carefully read that chapter.
