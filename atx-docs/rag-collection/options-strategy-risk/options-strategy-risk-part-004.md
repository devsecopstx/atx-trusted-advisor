---
id: xfinance-pdf-ingest-options-strategy-risk-part-004
name: xfinance-pdf-ingest-options-strategy-risk-part-004
description: Options Risk (part 4/38)
strategy_type: pdf_ingest
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [pdf_ingest, options, strategy, risk]
---

<!-- INGEST: pdf → markdown via pymupdf4llm; slug=options-strategy-risk; outlook=Neutral -->

*Source PDF: 96 page(s).*
The contract size of a cash-settled option other than a binary option or a range option is determined by the multiplier that is fixed by the options market on which the options series is traded. The multiplier determines the aggregate value of each point of the difference between the exercise price of the option and the exercise settlement value of the underlying interest. For example, a multiplier of 100 means that for each point by which a cash-settled option is in the money upon exercise, there is a $100 increase in the cash settlement amount. Similarly, if an option with a multiplier of 100 is trading at a premium of, say, $4, then the aggregate premium for a single option contract would be $400. As another example, a multiplier of 1 means that for each point by which a cash-settled option is in the money upon exercise, there is a $1 increase in the cash settlement amount. Similarly, if an option with a multiplier of 1 is trading at a premium of, say, $4, then the aggregate premium for a single option contract would be $4. The contract size of a range option is determined by the option’s multiplier and its maximum range exercise value. The contract size of a binary option is its cash settlement amount, which is fixed by the options market for any series of binary options at or before the opening of trading in that series. Some options markets define the cash settlement amount for binary options as being the multiplier times a fixed settlement value. Other options markets define the cash settlement amount for binary options without reference to a multiplier. 

8

CHAPTER II : OPTIONS NOMENCLATURE

EXERCISE — If the holder of a physical delivery option wishes to buy (in the case of a call) or sell (in the case of a put) the underlying interest at the exercise price — or, in the case of a cash-settled option, to receive the cash settlement amount — his option must be exercised. In order to exercise most options, option holders must give exercise instructions to their brokerage firm in accordance with the firm’s procedures prior to the firm’s exercise cut-off time. The exercise process is discussed in Chapter VIII. Every option holder should understand this process and should learn his brokerage firm’s procedures concerning exercise, and its exercise cut-off time, for each option she may buy.

Although an option holder must assure that action is taken to exercise most options, capped options and certain cash-settled options provide for automatic exercise in specified circumstances. Other options having automatic exercise provisions may be introduced for trading in the future.

The rules of the options markets generally limit the total number of puts or calls on the same underlying interest that a single investor or group of investors acting in concert may exercise during a specified time period. Information concerning the exercise limits for particular options is available from the options market on which those options are traded or from brokerage firms.

The right to exercise an option may be restricted in certain circumstances. This is discussed under “Risks of Option Holders” in Chapter X.

When an option has been exercised, OCC will assign the exercise in accordance with its rules to a Clearing Member whose account with OCC reflects the writing of an option of the same series. The Clearing Member may, in turn, assign this exercise to one of its customers who is a writer in accordance with the Clearing Member’s procedures, and the assigned writer will then be obligated to perform the obligations of the option — that is, to sell (in the case of a physical delivery call) or buy (in the case of a physical delivery put) the underlying interest at the exercise price, or, in the case of a cash-settled option, to pay the cash settlement amount. The assignment process is discussed further in Chapter VIII.

CASH SETTLEMENT AMOUNT, SETTLEMENT CURRENCY and EXERCISE SETTLEMENT VALUE — The cash settlement amount is the amount of cash that the holder of a cash-settled option is entitled to receive upon exercise. In the case of a cash-settled option other than a binary option or a range option, it is the amount by which the exercise settlement value of the underlying interest of a cashsettled call exceeds the exercise price, or the amount by which the exercise price of a cash-settled put exceeds the exercise settlement value of the underlying interest, multiplied by the multiplier for the option.

EXAMPLE: _**Assume that a holder of a cash-settled call on the XYZ index that has an exercise price of 80 exercises it when the exercise settlement value of the index is 85. If the multiplier for XYZ index options is 100, the assigned writer would be obligated to pay, and the exercising holder would be entitled to receive,** a cash settlement amount_ _**of $500 ($85 minus $80 multiplied by 100 = $500).**_

EXAMPLE: _**Assume that a holder of a cash-settled call on the XYZ index that has an exercise price of 80 exercises it when the exercise settlement value of the index is 85. If the multiplier for XYZ index options is 1, the assigned writer would be obligated to pay, and the exercising holder would be entitled to receive, a cash settlement amount of $5 ($85 minus $80 multiplied by 1 = $5).**_

9

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS

In the case of a binary option, the cash settlement amount is determined by the relevant listing options market and, whether or not established through use of a multiplier, is fixed and does not vary (except in the case of certain adjustments described below) regardless of the amount by which the exercise settlement value exceeds (in the case of a binary call option) or is less than (in the case of a binary put option) the exercise price.

EXAMPLE: _**An investor holds a binary call option on XYZ security that has an exercise price of $80 and a fixed cash settlement amount of $100. If the exercise settlement value of XYZ is $81 at expiration, the investor will receive $100. If the exercise settlement value is $90, the investor will still receive $100. If, on the other hand, the exercise settlement value of XYZ at expiration is below $80, the investor will receive nothing, and the option will expire worthless.**_

It is very important to note that the conditions under which a binary option returns a cash settlement amount may vary depending upon the rules of the listing options market. Specifically, the listing options market may list binary options that return a cash settlement amount if: (1) the exercise settlement value of the underlying is _above_ the exercise price (a binary call); or (2) the exercise settlement value of the underlying is _below_ the exercise price (a binary put). In addition, certain binary call options return a cash settlement amount if the exercise settlement value of the underlying is exactly equal to the exercise price.

EXAMPLE: _**Assume XYZ stock is the underlying security for a binary stock option with an exercise price of $80, and the exercise settlement value of XYZ at expiration is exactly $80. If the listing options market specified that the option would return a cash settlement amount if the exercise settlement value was** above_ _**the exercise price, the option will expire unexercised. If, however, the listing options market specified that the option would return a cash settlement amount if the exercise settlement value was** at or above_ _**the exercise price, the option would be automatically exercised at expiration.**_

In the case of a range option, the cash settlement amount varies depending on where the exercise settlement value of the underlying index falls within the range length at expiration. At the time a series of range options is opened for trading, the listing options market will specify the range length as well as the range interval, which is a value equal to a certain number of index points that is used to divide the range length into three segments: the low range, the middle range and the high range. The low range begins at the low end of the range length and ends one range interval higher. The high range begins one range interval below the high end of the range length and ends at the high end of the range length. The high range and the low range are of equal length. The middle range is the segment of values between the end of the low range and the beginning of the high range. The listing options market will also set a maximum range exercise value and a multiplier, the product of which is the maximum cash settlement amount. This maximum cash settlement amount will be payable if the level of the underlying index falls anywhere in the middle range at expiration. Within the low range, the cash settlement amount increases from zero to the maximum cash settlement amount as the level of the underlying index increases. Within the high range, the cash settlement amount decreases from the maximum cash settlement amount to zero as the level of the underlying index continues to increase.

10

CHAPTER II : OPTIONS NOMENCLATURE

EXAMPLE: _**Assume for a series of range index options that the listing options market has specified a range length from 1000 to 1100, a range interval of 10, a maximum range exercise value of 10 and a multiplier of $100. The series therefore has a maximum cash settlement amount of $1,000 (multiplier times the maximum range exercise value), a low range from 1000 to 1010, a middle range from 1010 to 1090 and a high range from 1090 to 1100. The table below summarizes the variations in cash settlement amount based on the foregoing assumptions:**_

**==> picture [470 x 99] intentionally omitted <==**

**----- Start of picture text -----**<br>
Middle<br>Low Range High Range<br>Range<br>Value of the<br>Below  1010  Above<br>Underlying  1000 1000 1001 1002 … 1009 -1090 1091 … 1098 1099 1100 1100<br>Index<br>Cash<br>Settlement  0 0 100 200 … 900 1,000 900 … 200 100 0 0<br>Amount ($)<br>**----- End of picture text -----**<br>


The currency in which the cash settlement amount is payable is called the settlement currency. The settlement currency for all cash-settled options with standardized terms that are trading at the date of this document is U.S. dollars. It is possible that another currency will be the settlement currency for some options introduced in the future.

The manner of determining the exercise settlement value for a particular option series is fixed by the options market on which the series is traded. The exercise settlement values for options on a particular underlying interest traded in one options market will not necessarily be determined in the same manner as the exercise settlement values for options or futures on the same underlying interest that may be traded in other markets.

Options markets may change the method of determining exercise settlement values for particular options series on specified days or on all days. These changes may be made applicable to series outstanding at the time the changes become effective. Alternatively, an options market might phase in a change in the method of determining exercise settlement values by opening new series of options identical to outstanding series in all respects other than the method for calculating exercise settlement values. Such new series would trade alongside the old series until both series expire, but the two series would not be interchangeable. In the future, options markets may, subject to regulatory approval, introduce options whose exercise settlement values may not exceed a specified maximum amount.

ADJUSTMENT — Adjustments may be made to some of the standardized terms of outstanding options upon the occurrence of certain events related to the underlying security. Adjustments that may be made to a particular type of options are discussed in the chapter relating to that type.
