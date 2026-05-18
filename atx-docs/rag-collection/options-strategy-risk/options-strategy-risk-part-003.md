---
id: xfinance-pdf-ingest-options-strategy-risk-part-003
name: xfinance-pdf-ingest-options-strategy-risk-part-003
description: Options Risk (part 3/38)
strategy_type: pdf_ingest
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [pdf_ingest, options, strategy, risk]
---

<!-- INGEST: pdf → markdown via pymupdf4llm; slug=options-strategy-risk; outlook=Neutral -->

*Source PDF: 96 page(s).*
## **Options Nomenclature** 

This chapter contains a description of the standardized terms, and of some of the special vocabulary, applicable to options. Most of the nomenclature is the same for options on the various types of underlying interests. Differences that are applicable to options on a particular underlying interest will be described in the chapter devoted to that underlying interest.

Certain terms — options, options markets, call options, put options, physical delivery options, cash-settled options, options series, and multiply-traded options — have been defined in Chapter I. Readers interested in those definitions should consult that chapter.

OPTION HOLDER; OPTION WRITER — The option holder is the person who buys the right conveyed by the option.

EXAMPLE: _**The holder of a physical delivery XYZ** call_ _**option has the right to** purchase_ _**shares of XYZ Corporation stock at the specified exercise price upon exercise prior to the expiration of the option. The holder of a physical delivery XYZ** put_ _**option has the right to** sell_ _**shares of XYZ Corporation at the specified exercise price upon exercise prior to the expiration of the option. The holder of a cashsettled option has the right to receive an amount of cash equal to the** cash settlement amount_ _**(described below) upon exercise prior to the expiration of the option.**_

The option writer is obligated — if and when assigned an exercise — to perform according to the terms of the option. The option writer is sometimes referred to as the option seller. An option writer who has been assigned an exercise is known as an assigned writer.

EXAMPLE: _**If a physical delivery XYZ call option is exercised by the holder of the option, the assigned writer must** deliver_ _**the required number of shares of XYZ common stock. He will be paid for the shares at the specified exercise price regardless of their current market price.**_

If a physical delivery put option is exercised, the assigned writer must purchase the required number of shares at the specified exercise price regardless of their current market price. If a cash-settled option is exercised, the assigned writer must pay the cash settlement amount.

No certificates are issued to evidence options. Investors look to the confirmations and statements that they receive from their brokerage firms to confirm their positions as option holders or writers. An option holder looks to the system created by OCC’s rules, rather than to any particular option writer, for performance of the option he owns. Similarly, option writers must perform their obligations under the OCC system and are not obligated to any particular option holder. Since every options transaction involves both a holder and a writer, it follows that the aggregate rights of option holders under the system are matched by the aggregate obligations of option writers.

The OCC system is designed so that the performance of all options is between OCC and a group of firms called Clearing Members that carry the positions of all option holders and option writers in their accounts at OCC. To qualify as a Clearing Member, a firm must meet OCC’s financial requirements. In addition, Clearing Members must provide OCC with collateral for the positions of option writers that they carry and must contribute to Clearing Funds that protect OCC against a Clearing Member’s failure. The Clearing Members’ guarantees of the performance of options writers’ obligations, the financial strength of the Clearing Members, the collateral that they deposit, the obligations of correspondent clearing corporations, and the Clearing Funds together make up the OCC system backing the performance of options.

6

CHAPTER II : OPTIONS NOMENCLATURE

EXERCISE PRICE  — In the case of a physical delivery option, the exercise price (which is sometimes called the “strike price”) is the price at which the option holder has the right either to purchase or to sell the underlying interest.

EXAMPLE: _**A physical delivery XYZ 40 call option gives the option holder the right to purchase 100 shares of XYZ stock at an** exercise price_ _**of $40 a share. A physical delivery XYZ 40 put option gives the option holder the right to sell 100 shares of XYZ common stock at an exercise price of $40 a share.**_

The exercise price of a cash-settled option (other than a binary option or a range option) is the base for the determination of the amount of cash, if any, that the option holder is entitled to receive upon exercise (see the discussion of “Cash Settlement Amount and Exercise Settlement Value” below). The exercise price of a binary option is the value or level of the underlying interest above, below, or, in some cases, at which the option will be in the money at expiration, thereby causing the fixed cash settlement amount to become payable (see the “Binary Option” definition below). In the case of a range option, the exercise price is the option’s range length (see the “Range Option” definition below).

Exercise prices for each options series (except for series of delayed start options) are established by the options market on which that series is traded at the time trading in the series is introduced, and are generally set at levels above and below the then market value of the underlying interest. However, the options markets may use other methods to set exercise prices. Specific information regarding the setting of exercise prices may be obtained from the listing options market. The options markets generally have the authority to introduce additional series of options with different exercise prices based on changes in the value of the underlying interest, or in response to investor interest, or in unusual market conditions, or in other circumstances. For series of delayed start options, exercise price setting formulas — rather than exercise prices — are established by the options market on which each series is traded before the time trading commences in each such series. Those exercise price setting formulas provide that on the exercise price setting date the exercise price for the series will be fixed at the money, in the money by a certain amount, or out of the money by a certain amount.

EXPIRATION DATE  — This is the date on which the option expires. If an option has not been exercised prior to its expiration, it ceases to exist — that is, the option holder no longer has any rights, and the option no longer has any value. The expiration dates for the various options series are fixed by the options market on which the series trades. Readers should learn the expiration date of each option they wish to buy or write.

STYLE OF OPTION  — The style of an option refers to when that option is exercisable. At the date of this document there are three different styles of options — American-style, European-style and capped. Subject to certain limitations prescribed in the rules of OCC or the options markets and subject to applicable law, these three styles are exercisable at the following times:

Each American-style option other than a delayed start option may be exercised at any time prior to its expiration. An American-style delayed start option may be exercised at any time after its exercise price is set and before its expiration date.

A European-style option may be exercised only during a specified period before the option expires. Every European-style option being traded at the date of this document is exercisable only on its expiration date.

A capped option will be automatically exercised prior to expiration if the options market on which the option is trading determines that the value of the underlying interest at a specified time on a trading day “hits the cap price” for the option. Capped options may also be exercised, like European-style options, during a specified period before expiration. This period

7

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS

is the expiration date for all capped options traded at the date of this document. The special terminology applicable to capped options is discussed at the end of this chapter.

European-style or capped options having an expiration period that is longer or shorter than their expiration date may be introduced for trading in the future.

BINARY OPTION — A binary option is a cash-settled option having only two possible payoff outcomes: either a fixed amount or nothing at all. Some binary options are referred to as “fixed return options.” As of the date this product was approved for trading, the only binary options approved for trading (other than credit default options, as defined below) are binary stock options, which are binary options on individual equity securities, including fund shares; and binary index options, which are binary options on broad-based securities indexes (including volatility indexes). The binary options approved for trading are all subject to automatic exercise. The holder of a binary option other than a credit default option has the right to receive (and the writer of a binary option has the obligation to pay) the exercise settlement amount for the option if the value of the underlying interest as of the time specified by the applicable listing options market ( _i.e._ , the exercise settlement value) meets the criteria for automatic exercise of the option, as specified in the rules of the listing options market. If those criteria are not met, the option will expire worthless. Credit default options are a specific kind of binary option discussed at the end of Chapter V. Except for credit default options, binary options are European-style options.

RANGE OPTION — A range option is a European-style, cash-settled option that has a payout if the value of the underlying interest falls within a specific range of values (the range length) at expiration. As the underlying interest value increases throughout the range length, the amount of the payout ( _i.e._ , the cash settlement amount) of the range option increases linearly to a maximum value, remains constant at that value through the middle of the range length and then decreases linearly to zero as the value of the underlying continues to increase to the top of the range length. A more detailed description of this feature of range options is set forth below under the caption “Cash Settlement Amount and Exercise Settlement Value.” Range options are of a single type rather than consisting of puts and calls.

UNIT OF TRADING; CONTRACT SIZE — The unit of trading (which is sometimes referred to as the contract size) of a physical delivery option is the amount of the underlying interest that is subject to being purchased or sold upon the exercise of a single option contract. For example, the unit of trading for most options on equity securities is 100 shares. Thus, a physical delivery XYZ 50 call will give its holder the right upon exercise to purchase 100 shares of XYZ at $50 per share. If the option is trading at a premium of, say, $4 per share, then the aggregate premium for a single option contract would be $400.
