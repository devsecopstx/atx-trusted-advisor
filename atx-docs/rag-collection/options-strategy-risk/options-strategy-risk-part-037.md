---
id: xfinance-pdf-ingest-options-strategy-risk-part-037
name: xfinance-pdf-ingest-options-strategy-risk-part-037
description: Options Risk (part 37/38)
strategy_type: pdf_ingest
risk_level: balanced
market_condition: neutral
complexity: advanced
underlying_type: stock
tags: [pdf_ingest, options, strategy, risk]
---

<!-- INGEST: pdf → markdown via pymupdf4llm; slug=options-strategy-risk; outlook=Neutral -->

*Source PDF: 96 page(s).*
## **Scope and Limitations of This Document** 

Readers should be aware of the scope and limitations of this document set forth below:

1. This document has been prepared by the U.S. options markets for distribution pursuant to the requirements of SEC Rule 9b-1 under the Securities Exchange Act of 1934 and the rules of the U.S. options markets. This document is not intended to meet other requirements which may be in effect in any jurisdiction and should not be relied upon for that purpose.

The options discussed in this document are exempt from the registration requirements of the Securities Act of 1933, as amended, and this document is not a prospectus. Nothing in this document should be construed as furnishing investment advice or as being a recommendation, solicitation or offer to buy or sell any option or any other security.

2. Only the U.S. options markets on which an option is authorized to be traded are responsible for the statements in this document concerning that option.

3. The options markets do not intend this document to be incorporated by reference into any publication that may be prepared or distributed by OCC, an options market or any other person (other than a document that has been specifically designated to be a supplement to this document and that has been filed with the SEC pursuant to Rule 9b-l). The fact that another document states that this document is available, or states from whom this document may be obtained, or recommends that this document be read and understood, does not mean that this document has been incorporated by reference into that other document.

4. No other publication is incorporated by reference into this document. The fact that this document refers to information that may be available in other publications does not mean that any of those other publications has been incorporated into this document.

5. This document does not attempt to present a complete description of all of the provisions

governing options. These are set forth in applicable laws, in the rules and regulations of the SEC and other regulatory agencies, and in the rules, interpretations, policies and procedures (collectively called “rules”) of OCC, the options markets and the foreign clearing houses that act as “associate clearing houses” of OCC that may be in force from time to time.

This document also does not attempt to describe either the rules that govern the structure or conduct of options trading or the forms and procedures for trading in the various options markets. These matters differ from one options market to another, and they may change from time to time. As examples, the various options markets may utilize different market-making systems (with some markets using a specialist system, others a competing market-maker system, and others a combination of the two), order routing systems, and automatic order execution systems. Moreover, as advances are made in computer technology, the trading and market-making systems and the other trading procedures of the options markets are likely to evolve and change — or even be radically different from what they now are.

At particular times — such as when unusual conditions or circumstances exist, which for example may occur on and after days on which there have been substantial or volatile price movements in the securities markets generally or in the markets for underlying or related interests — the options markets may have authority under their rules to modify the application of some or all of their trading rules and procedures or to take such actions as they may deem appropriate in the circumstances. Such actions could include, among other things, changing the manner in which trading in particular

87

CHARACTERISTICS AND RISKS OF STANDARDIZED OPTIONS

options is conducted, extending trading hours for particular options, halting trading in particular options, restricting the types of orders that may be employed, and modifying or eliminating the bid/asked differential at which market-makers or specialists may quote. The taking of such actions by an options market often is promptly disclosed to the trading crowd in that options market, to representatives of brokerage firms that are members of the options market, and/or to price vendors, but the actions may be taken without public notice, and there can be no assurance that disclosure will be made in a manner that will permit investors to learn of the actions in a timely way.

OCC and the options markets have broad discretion under their rules to take a variety of actions in particular circumstances, and readers should not assume that any organization will exercise its discretion in a particular way in any particular circumstance. A statement in this document to the effect that OCC or an options market has authority or discretion to take a particular action does not mean that it will necessarily take that action. To the contrary, it should be understood from such a statement that the organization also has authority not to take that action. Moreover, it should be understood that OCC and the options markets have broad discretion in the manner in which they interpret their own rules.

OCC and the options markets have no duty to enforce, or to oversee the enforcement of, each other’s rules. OCC and each U.S. options market has a general statutory obligation to enforce compliance with its own rules by its own members. However, there can be no assurance that all such rules will always be complied with by members, since frequently the only means of enforcing compliance with rules is to impose disciplinary sanctions after the fact on those who have violated them.

Readers desiring information concerning the rules of OCC or any of the options markets as to the terms of options, the manner in which options are traded or in which a market functions, the trading hours of a particular options market, or other related matters, or information concerning any of the other matters referred to herein, may obtain the information from the relevant organization.

6. The U.S. options markets have rules applicable to the handling of customer accounts and the execution of buy and sell orders that impose special requirements with respect to approval of customer accounts for options trading and recommendations of particular option transactions. This document does not attempt to describe those requirements, the laws and rules governing brokerage firms and other securities professionals, or the agreements, procedures and internal rules of brokerage firms that are applicable to the approval and opening of customer accounts, the handling and execution of orders, the transmission to brokerage firms of instructions to exercise or not to exercise options, the manner or time in which writers of options are notified by their brokerage firms that options have been assigned an exercise, the handling of customers’ funds, securities and accounts, the safeguarding of customers’ positions in options, or other matters relating to the handling of options transactions by brokerage firms. Readers should consult with their own brokerage firms for information concerning such matters.

7. This document does not attempt to describe the risks to investors that may be associated with the way trading is conducted in any particular options market or in any market for an underlying or related interest. The reader should not assume that either the options markets or the markets for underlying or related interests will be efficient, liquid, continuous and orderly in all circumstances or that they will be or remain open at all times. Even on relatively normal days, there will be variances in the market-making performance of specialists and market makers in the various markets which derive primarily from differences in individual skills, capital, willingness to accept risk, ability to hedge risk, trading strategies, and market-making obligations, and these variances are likely to be exacerbated during times of greatly increased volume or volatility. Although specialists and market makers in some markets have certain obligations to assist in the maintenance, so far as is practicable, of a fair and orderly market, traditional indicators of orderliness are difficult to apply to the trading of derivative products such as options and there is a risk that the market-making system of a particular market will not operate effectively, efficiently or in an orderly manner at particular times. The nature and scope of that risk are not among the types of risk discussed further in this document.

88

CHAPTER XI: SCOPE AND LIMITATIONS OF THIS DOCUMENT

It is also possible that the systems of an options market, or of a market for an underlying or related interest, may fail or may not work effectively or efficiently at times. Historically, for example, the operations of various U.S. markets have been disrupted by earthquake, flood, fire, electricity outages, and computer failure. Moreover, no system can be expected to work perfectly at all times. The options markets may rely on manual methods to record trade information, and errors or omissions can occur in their reports of price, volume and other information, and these can be expected to be exacerbated on days of significant volume or volatility.

It is also beyond the scope of this document to discuss the risks that may result to investors from the use by market participants of options pricing theories. There are a number of publications that are commercially available which discuss such theories.

8. This document does not attempt to describe risks that may be inherent in an investment in the underlying interest. It is obvious that the investment potential of an option can be dependent on the performance of the underlying interest and that investors in options are therefore subject to the risks that may affect the value of that interest. For example, one of the risks undertaken by a purchaser of a call option (or a writer of a put option) on XYZ stock is that XYZ may decline in price during the life of the option. The risk of this decline is dependent on the risks that may affect the economy or the stock market generally or XYZ specifically. Similarly, the holder of a dollar-denominated option on a foreign currency is subject to the risk factors affecting the relative values of the U.S. dollar and the foreign currency. A discussion of these types of risks is beyond the scope of this document.

9. This document does not attempt to describe systemic risks that could affect the options markets and the investors in those markets. The options markets, like all securities markets, are interrelated with, and frequently interdependent upon, other aspects of national and international financial and capital systems and upon the national and world economy. Any disturbance or crisis of one part of these interrelated systems could severely disrupt or even threaten the performance of the options markets or of OCC. Bank failures, payments breakdowns, large and sudden economic shocks, the failure of a large securities firm, market or clearing organization, or other such events could cause other failures on a widespread basis and could affect the liquidity and solvency of the participants in the options markets. The specific causes of systemic failure or disruption are not easy to predict, and a discussion of them is beyond the scope of this document.

10. All examples in this document are based on hypothetical values that are not necessarily indicative of the prices in an actual transaction. Readers should not assume that options will necessarily be priced in accordance with any example in this document or in accordance with any pricing formula or model. As noted in the discussion of “Premium” in Chapter II, option premiums are not fixed by OCC or any of the options markets.
