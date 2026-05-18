---
id: xfinance-pdf-ingest-options-strategy-risk-part-011
name: xfinance-pdf-ingest-options-strategy-risk-part-011
description: Options Risk (part 11/38)
strategy_type: pdf_ingest
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [pdf_ingest, options, strategy, risk]
---

<!-- INGEST: pdf → markdown via pymupdf4llm; slug=options-strategy-risk; outlook=Neutral -->

*Source PDF: 96 page(s).*
## **Strategy-Based Indexes** 

Strategy-based indexes are complex, and their calculations may involve the use of multiple variables, including the values of equity securities and options on those securities. Strategies based on options on these indexes, referred to as “strategy-based index options,” are also complex. Investors should be certain that they understand the method of calculation and 

28 

CHAPTER IV : INDEX OPTIONS

## significance of any strategy-based index and the uses for which strategy-based index options are suited before buying or selling the options. 

Strategy-based indexes measure the returns from investment strategies involving the purchase and sale of various securities. All of the securities purchased and sold pursuant to the strategy are deemed to be the component securities of the strategy-based index. As of December 2009, the only strategy-based index on which options are approved to be traded is a buy-write index measuring the return on a hypothetical “buy-write” strategy involving the simultaneous writing of call options on a stock index and purchase of the component securities of that index. Under the hypothetical strategy, a succession of at the money index call options with one month to expiration are assumed to be written, and the proceeds ( _i.e._ , the premiums received) from writing the options are assumed to be invested in a weighted basket of the component securities that mirrors the index. Dividends received from ownership of the component securities of the index are similarly assumed to be reinvested in the basket of securities. The options are deemed held until expiration, and new call options are assumed to be written on the business day immediately after the settlement value is determined. All options written under the buy-write strategy are deemed to have been assigned an exercise notice on the expiration date if in the money on that date, and to have expired without value if out of the money on the expiration date. The buy-write index measures the cumulative gross rate of return of the strategy since the inception of the index. The index will therefore rise during periods when the strategy is profitable and decline when it is unprofitable. The following example illustrates the calculation of the buy-write index. 

EXAMPLE: _**Assume that the buy-write index has a value of 800 on January 1. The return from the buy-write strategy, taking into account the returns of the component securities of the stock index and of the options assumed to be written on the index, is 0.5% and 1% on January 2 and 3, respectively. The index value at the end of a given trading day is equal to the previous closing value of the index multiplied by one plus the rate of return for that trading day. In this example, the value of the buywrite index at the close of trading on January 3 would be 812.04 (800 x 1.005 x 1.01). Assume that the return of the buy-write strategy on January 4, again taking into account the returns of the component securities of the stock index and of the options assumed written on that index, is a negative 0.7%. The value of the buy-write index at the close of trading on January 4 would be 806.36 (812.04 x .993).**_ 

The calculation of the buy-write index, as in the case of any strategy-based index, requires the making of assumptions about, for example, the timing of transactions involved with a particular strategy and the prices received or paid for the securities traded (which are determined using market data for specified time periods). The index is calculated throughout the trading day using reported values for the reference index and reported premium values for the options as well as the value of any ordinary dividends payable on the component securities. The calculation of the index assumes that transactions can be continuously executed, _i.e._ , that there will be no market disruptions, and may use assumed prices equal to volume-weighted average prices, which may not be the same as the prices an investor employing the strategy would pay or receive. Detailed information regarding calculation of the buy-write index is available from the exchange on which the options are traded. A special opening value for the reference index is used in calculating the index on the date that a new option is written to replace an expiring option, which is known as a roll date, and special procedures are used on roll dates to reflect the hypothetical transactions that are assumed to take place on those dates.

## **Relative Performance Indexes** 

A relative performance index measures the relative performance — generally the relative total return — of two index components. As of January 2012, the only relative performance options approved for trading are options on indexes of which both index components are equity securities 

29 

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS 

(one or both of which could be non-leveraged fund shares). One of the components in each pair is referred to as the target component and the second is referred to as the benchmark component. The index is calculated by measuring the total return of the target component relative to the total return of the benchmark component. The index will rise as and to the extent that the target component outperforms the benchmark component, and will fall as and to the extent that the opposite occurs. The value of the relative performance index will be set to a base value, such as 100, initially. The following example illustrates the calculation of a relative performance index. 

EXAMPLE: _**Assume that a relative performance index has an initial base value of 100. If the total return of the target component in one day is 10% and the total return of the benchmark component in the one day period is 9%, the index value of the relative performance index at the end of the one day period would equal 100 x (1 + 10%) / (1 + 9%) = 100.92. If the total return of the target component in the one day period is 9% and the total return of the benchmark component in the one day period is 10%, the index value of the relative performance index at the end of the one day period would equal 100 x (1 + 9%) / (1 + 10%) = 99.09.**_ 

_**The example above illustrates only a scenario where the total return assumed is for a one day period. Other periods would yield different results. Market participants should contact the exchange on which these options are traded for a more complete description of the index calculation methodology.**_ 

Investors should be certain that they understand the method of calculation of any relative performance index and the uses for which relative performance options are suited before buying or selling such options. Different relative performance indexes may measure relative performance in different ways. Investors should contact the listing options market for information on the method of calculation of a particular relative performance index. 

In the event that one of the index components in an underlying relative performance index is eliminated as the result of a cash-out merger or other event, the reporting authority may cease to publish the value of the index. In that case, the exercise settlement value of the options would become fixed based upon the last published value for the index, and the market on which the options are traded may determine to accelerate the expiration date for the options (and, in the case of European-style options, their exercisability). The expiration date will ordinarily be accelerated to fall on the next standard expiration date for options as specified in OCC’s rules or on such other date as OCC establishes in consultation with the market on which the options are traded. All options that are not in the money will become worthless and all that are in the money will have no time value. Holders of an in-the-money option whose expiration date is accelerated must be prepared to exercise that option prior to the accelerated exercise cut-off time in order to prevent the option from expiring unexercised. Writers of European-style options whose expiration date is subject to being accelerated bear the risk that, in the event of such an acceleration, they may be assigned an exercise notice and be required to perform their obligations as writers prior to the original expiration date. As with any other option for which the expiration date is accelerated, no adjustment would be made to compensate for the accelerated expiration date of a relative performance option.
