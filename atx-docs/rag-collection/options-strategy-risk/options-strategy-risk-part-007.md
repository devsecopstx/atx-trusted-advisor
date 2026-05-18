---
id: xfinance-pdf-ingest-options-strategy-risk-part-007
name: xfinance-pdf-ingest-options-strategy-risk-part-007
description: Options Risk (part 7/38)
strategy_type: pdf_ingest
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [pdf_ingest, options, strategy, risk]
---

<!-- INGEST: pdf → markdown via pymupdf4llm; slug=options-strategy-risk; outlook=Neutral -->

*Source PDF: 96 page(s).*
## **Features of Stock Options** 

The following discussion relates primarily to stock options other than binary options. A separate description of the features of binary stock options may be found at the end of this chapter.

As a general rule a single-stock option covers 100 shares of the underlying security, although in the case of options covering fund shares, options covering 100 or 1000 shares may be available. Other stock options departing from the general rule may be introduced in the future. The number of underlying shares covered by any stock option may be adjusted after the option is issued if certain events occur, as described below.

The exercise prices of the stock options that are traded at the date of this document are stated in U.S. dollars per share. The exercise price of an option must be multiplied by the number of shares underlying the option in order to determine the aggregate exercise price and aggregate premium of that option.

EXAMPLE: _**An XYZ 40 call gives the buyer the right to purchase 100 shares of XYZ stock at a price of $40 per share, or a total price of $4,000.**_

In the future, stock options may, with regulatory approval, be introduced that have exercise prices in a foreign currency.

Adjustments may be made to certain of the standardized terms of outstanding stock options when certain events occur, such as a stock dividend, stock distribution, stock split, reverse stock split, rights offering, distribution, reorganization, recapitalization, reclassification in respect of an underlying security, or a merger, consolidation, dissolution or liquidation of the issuer of the underlying security. In the following discussion, there is a brief description of a number of general adjustment rules applicable to stock options that are in effect at the date of this document. Such rules may be changed from time to time with regulatory approval. OCC has the authority to make such exceptions as it determines to be appropriate to any of the general adjustment rules.

As a general rule, no adjustment is made for ordinary cash dividends or cash distributions. A cash dividend or distribution will generally be considered “ordinary,” regardless of size, if OCC believes

18

CHAPTER III : OPTIONS ON EQUITY SECURITIES

that it was declared pursuant to a policy or practice of paying such dividends or distributions on a quarterly or other regular basis. No adjustment will normally be made for any cash dividend or distribution that amounts to less than $0.125 per underlying share. For contracts originally listed with a unit of trading larger than 100 shares, no adjustment normally would be made for any cash dividends or distributions that amount to less than $12.50 per contract. As an exception to the general rule, options on fund shares will generally be adjusted for capital gains distributions even if made on a regular basis, and adjustments may be made for certain other distributions in respect of fund shares in special circumstances described in OCC’s rules, provided in each case that the amount of the adjustment would be $0.125 or more per fund share. Determinations whether to adjust for cash dividends or distributions not covered by the preceding rules, or when other special circumstances apply, are made on a case-by-case basis.

Because stock options are not generally adjusted for ordinary cash dividends and distributions, covered writers of calls are entitled to retain dividends and distributions earned on the underlying securities during the time prior to exercise. However, a call holder becomes entitled to the dividend if he exercises the option prior to the ex-dividend date even though the assigned writer may not be notified that he was assigned an exercise until after the ex-date. Because call holders may seek to “capture” an impending dividend by exercising, a call writer’s chances of being assigned an exercise may increase as the ex-date for a dividend on the underlying security approaches.

Stock dividends, stock distributions and stock splits may result in an adjustment of the number of options held or written or the number of underlying shares, and in some cases may also result in an adjustment of the exercise price.

When a stock distribution, stock split or stock dividend results in the issuance of one or more whole shares of stock for each outstanding share—such as a 2-for-1 or a 3-for-1 stock split—as a general rule the number of underlying shares will not be adjusted. Instead, the number of outstanding options will be proportionately increased and the exercise price will be proportionately decreased.

EXAMPLE: _**Before a 2-for-1 stock split, an investor holds an option on 100 shares of XYZ stock with an exercise price of $60. After adjustment for the split, he will hold two XYZ options, each on 100 shares and each with an exercise price of $30.**_

Other stock dividends, stock distributions and stock splits may result in an adjustment in the number of underlying shares and the exercise price.

EXAMPLE: _**An investor bought an XYZ 50 option — either a call or a put — and XYZ Corporation subsequently effected a 3-for-2 stock distribution. Instead of covering 100 shares of stock at an exercise price of $50 a share, each outstanding option could be adjusted to cover 150 shares at an exercise price of $33.33 per share. The aggregate exercise price remains substantially the same before and after the adjustment ($50 x 100 = $5,000 and $33.33 x 150 = $4,999.50).**_

As a general rule, adjustments in exercise prices are rounded to the nearest exercise price increment, and adjustments in the number of underlying shares are rounded down to eliminate fractional shares. In the latter case, the property deliverable upon exercise may be adjusted to include the value of the eliminated fractional share, as determined by OCC.

Note that in the preceding example where the exercise price of the adjusted XYZ option was rounded down, the exercising put holder or assigned call writer would lose $0.50 as a result of the rounding. Rounding up could result in losses to exercising call holders and assigned put writers.

19

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS

A reverse stock split, combination of shares, or similar event will generally result in an adjustment in the number of shares deliverable upon exercise, while the aggregate exercise price remains unchanged.

EXAMPLE: _**An investor holds a call option covering 100 shares of XYZ stock with an exercise price of 50 resulting in an aggregate exercise price for the contract of $5,000 ($50 x 100). After a 1-for-10 reverse split, the deliverable could be reduced to 10 shares while the nominal exercise price remained $50. In that case, upon exercise of the adjusted option, the investor would still pay $5,000 ($50 x 100, not $50 x 10), but would receive 10 shares of XYZ stock instead of 100.**_

An adjustment that substitutes cash for all, such as in the case of a cash merger or other event whereby the underlying security is converted solely to cash, or part of the deliverable security will eliminate or reduce the time value of the option, and therefore the option may lose significant value, both immediately and at exercise, as a result of the adjustment.

EXAMPLE: _**Because of an all cash merger involving XYZ Corporation, the stock held by XYZ’s owners is extinguished in return for a payment of $50 in cash per XYZ share. In response to the corporate action on the underlying security, XYZ options generally will be adjusted to require the delivery of $50 per share upon exercise. As a result, an XYZ call option with an exercise price of $40 will lose all of its time value and the option’s value will only reflect the intrinsic value of $10 ($50 – $40 = $10). Additionally, an XYZ call option with an exercise price of $60 will become worthless because the exercise price exceeds the $50 cash settlement delivery amount.**_

EXAMPLE: _**An investor bought a $50 put option representing the obligation to deliver 100 shares of Company A stock upon exercise. Company A subsequently effected a 1-for-3 reverse stock split and the terms of the reverse split provided for payment of cash in lieu of fractional shares, using a value of $60 per share for this purpose. As a general rule, any adjustment in the number of underlying shares is rounded to eliminate fractional shares, so the number of shares to be delivered could be adjusted to 33 shares (100 x ¹/³ = 33¹/³, with the ¹/³ fractional share rounded down as part of the adjustment to eliminate fractional shares) plus $20 cash in lieu of the ¹/³ fractional share ($60 x ¹/³) if cash is paid in lieu of such fractional share. Because this cash delivery obligation is generally fixed at the time of adjustment, the investor would lose the time value of the fractional share. This option may continue to trade until expiration, with the deliverable at exercise or expiration being 33 shares plus $20 cash.**_

The obligation to make a fixed cash payment in lieu of a fractional share could result, depending on the relative size of the fixed cash obligation, in an immediate reduction in the value of the option and at exercise could result in the option being less valuable or worthless in comparison to the value it would have had in the absence of the adjustment. If a stock underlying the option undergoes multiple reverse splits prior to expiration, it will become increasingly likely that one of those reverse stock splits eventually will create a fractional share.

As a general rule, no adjustment is made for ordinary stock dividends or distributions. A stock dividend or distribution will generally be considered “ordinary” if (i) the number of shares distributed does not exceed 10% of the number of shares outstanding on the declaration date and (ii) it is declared pursuant to a policy or practice of paying such dividends or distributions on a quarterly basis.

Distributions of property other than the underlying security may result in the adjustment of outstanding options to include the distributed property.

20

CHAPTER III : OPTIONS ON EQUITY SECURITIES

EXAMPLE: _**If XYZ “spins off” its subsidiary ABC by distributing to its stockholders 2.5 shares of ABC stock for each share of XYZ stock, outstanding XYZ options might be adjusted to require delivery of 100 shares of XYZ stock plus 250 shares of ABC stock.**_

Alternatively, the exercise prices of outstanding options might be reduced by the value, on a per-share basis, of the distributed property, as determined by OCC.

Events other than distributions may also result in adjustments. If all of the outstanding shares of an underlying security are acquired in a merger or consolidation, outstanding options will as a general rule be adjusted to require delivery of the cash, securities, or other property payable to holders of the underlying security as a result of the acquisition.

EXAMPLE: _**If XYZ is acquired by PQR in a merger where each holder of XYZ stock receives $50 plus 1/2 share of PQR stock for each share of XYZ stock held, XYZ options might be adjusted to call for the delivery of $5,000 in cash and 50 shares of PQR stock instead of 100 shares of XYZ stock.**_

When an underlying security is wholly or partially converted into a debt security or a preferred stock, options that have been adjusted to call for delivery of the debt security or preferred stock may, as a general rule, be further adjusted to call for any securities distributed as interest or dividends on such debt security or preferred stock.
