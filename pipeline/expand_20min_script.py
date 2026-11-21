#!/usr/bin/env python3
"""Expand ep01_20min_masterclass.json to a full 20+ minute (~3,300 word) script."""

import json
from pathlib import Path

BP_PATH = Path("/home/antigravity/sherwie/AS/pipeline/blueprints/ep01_20min_masterclass.json")

DEEP_DIVES = {
    "ch01_holiday_trigger": (
        " Think about what happens in the final ten days of December. You start with a clean mental number, "
        "four hundred euros, because four hundred feels sensible and manageable against your monthly paycheck. "
        "But retailers know that once you enter a seasonal buying cycle, your brain switches from analytical accounting "
        "to emotional completion mode. In completion mode, your primary goal is no longer staying under a mathematical cap; "
        "your goal is crossing names off a list to relieve cognitive stress. When a store combines time pressure, emotional "
        "obligation, and fragmented mobile checkouts, the four-hundred-euro boundary dissolves without a single moment where "
        "you consciously decided to break it. You do not buy one nine-hundred-euro luxury item. You suffer thirty separate "
        "fifteen-to-thirty-euro micro-overruns across three weeks, and you only see the true nine-hundred-and-twenty-euro total "
        "when your January bank statement closes."
    ),
    "ch02_four_multipliers": (
        " Let's trace a real household receipt trail through those four multipliers so you can see how invisible they feel in "
        "real time. On December fourth, you go online to buy gifts for six core family members with a planned cap of roughly "
        "forty-six euros each. The first item is fifty-eight euros. You tell yourself it is only twelve euros over, and you will "
        "make it up on the next person. You never make it up on the next person; instead, fairness bias forces you to spend at "
        "least fifty-eight to sixty-five euros on everyone else so no one feels shortchanged. Next comes the office secret Santa, "
        "the school teacher collection, and the cousin who unexpectedly brings a gift to dinner. Then come four separate online "
        "orders that each charge seven euros for expedited winter shipping, three rolls of heavy wrapping paper, ribbon, gift tags, "
        "and two twenty-four-euro bottles of wine for holiday hosts. Finally, while checking out, a banner offers you a winter jacket "
        "at forty percent off if you add it to your cart right now. Every single step felt tiny. Together, they total five hundred "
        "and twenty euros of pure unplanned cash drain."
    ),
    "ch03_retail_pricing_psychology": (
        " These three behavioral formulas are not accidents; they are A/B tested across billions of checkout sessions every year. "
        "Consider how the Decoy Effect rewires your perception of value in under three seconds. In controlled retail experiments, "
        "when shoppers are shown two coffee makers—one at forty-five euros and one at seventy-nine euros—roughly seventy percent "
        "choose the forty-five-euro model. The moment the retailer adds a third model at one hundred and fifty-nine euros right "
        "next to them, almost nobody buys the one-fifty-nine model, yet over sixty-four percent of shoppers suddenly switch from "
        "the forty-five-euro model to the seventy-nine-euro model. Why? Because the human brain hates extremes and gravitates toward "
        "the middle option, assuming the middle option is the safe compromise. Pair that with free-shipping thresholds calibrated "
        "just twenty-two percent above the store's average order value, and four-installment Buy Now Pay Later buttons that hide "
        "the true total price behind a thirty-euro today badge, and you are fighting a billion-dollar casino algorithm every time "
        "you open a shopping app."
    ),
    "ch04_fake_discount_anatomy": (
        " Once you see the ninety-day price curve behind seasonal sales, you can never unsee it. Under consumer protection rules in "
        "many jurisdictions, a retailer only has to establish a higher reference price for a short window—often fourteen to thirty "
        "days—before advertising a massive percentage markdown against that inflated anchor. That is why October is quietly the "
        "highest price-inflation month of the retail calendar. Prices are stepped up in October specifically so they can be "
        "dramatically slashed in late November and December. When you install a ninety-day price-history graph extension or simply "
        "log the street price of items on your list sixty days before a major holiday, you discover that more than seventy percent "
        "of advertised flash deals are within two euros of their ordinary Tuesday price from September. When you judge an item strictly "
        "by your pre-written euro cap rather than the red discount badge, fake urgency completely loses its power over your wallet."
    ),
    "ch05_three_column_protocol": (
        " Notice what happens psychologically the moment you write down the Three-Column Calm Budgeting table on a single sheet of "
        "paper or in an isolated sub-account. First, by carving out the fifteen percent Friction Vault—sixty euros out of four "
        "hundred—on day one, you eliminate the number-one cause of budget collapse. When a six-euro shipping fee or a fifteen-euro "
        "box of wrapping paper appears, it no longer breaks your plan, because it was already paid for before you started. Second, "
        "by locking four core recipients at fifty-five euros and six extended recipients at twenty euros before you type a single word "
        "into a search bar, you turn product shopping into a filter game. If a product costs seventy-nine euros, you do not waste "
        "twenty minutes debating whether you can stretch for it. It violates the fifty-five-euro column rule, so it is disqualified "
        "in half a second. Constraints do not create financial stress; constraints eliminate decision fatigue."
    ),
    "ch06_asymmetric_value_arbitrage": (
        " You can apply Asymmetric Category Arbitrage far beyond holiday gifts—it works for dinner hosting, birthdays, weddings, and "
        "even your own household upgrades year-round. Think about the difference between bringing a twenty-euro bottle of supermarket "
        "champagne to a dinner party versus bringing a twenty-euro tin of ceremonial-grade matcha or an estate-bottled Cretan olive "
        "oil. A twenty-euro champagne sits at the very bottom of the champagne shelf; everyone at the table knows it is the cheapest "
        "bottle in the case. A twenty-euro olive oil or artisan sea salt collection sits at the absolute summit of the culinary shelf. "
        "It signals care, curation, and taste, while keeping your unit cost strictly locked at twenty euros. Whenever your budget cap "
        "is between fifteen and thirty euros, refuse to buy the cheapest version of an expensive product category. Step down one tier "
        "in category size, and buy the undisputed world-class champion of a twenty-euro consumable category."
    ),
    "ch07_forty_eight_hour_rule": (
        " To make the Forty-Eight Hour Dopamine Cooling Rule effortless, remove stored one-click credit cards from your mobile browser "
        "and social media apps, and replace them with a single bookmark folder labeled 48-Hour Holding Tank. Whenever you see a "
        "jacket, gadget, kitchen tool, or home upgrade that is not on your pre-planned monthly ledger, you are completely allowed to "
        "buy it—on one condition: you drop the link into the 48-Hour Holding Tank and write down the exact euro price and the date. "
        "Forty-eight hours later, when the artificial countdown timer and the midnight dopamine spike have evaporated, you open the "
        "folder. Seven times out of ten, looking at that item in cold daylight feels like looking at someone else's shopping cart. "
        "Across a typical household, that single friction barrier prevents four to six thirty-five-euro impulse checkouts every month, "
        "saving over two thousand euros a year with zero feeling of deprivation."
    ),
    "ch08_dec26_january_pivot": (
        " Let's examine why the Hybrid Velocity Waterfall works so much better in the real world than a spreadsheet-only debt plan. "
        "When people carry three or four balances into January, the mental weight comes from the number of open monthly minimum "
        "payments chipping away at their paycheck on different days of the month. By focusing every single spare euro—three hundred "
        "and forty euros a month above minimums—onto the twelve-hundred-euro store card at twenty-four point nine percent APR, you "
        "do not wait three years to feel progress. In ninety-six days, an entire bill disappears permanently from your life. That frees "
        "up its forty-five-euro minimum payment, turning your three-hundred-and-forty-euro attack shovel into a three-hundred-and-eighty-five "
        "euro shovel against the nineteen-point-five percent credit card. By month eleven, both high-interest cards are dead, and you "
        "are throwing five hundred and fifty euros a month at the remaining car loan. You compress thirty-seven months of debt stress "
        "into eighteen clean months and keep fourteen hundred and twenty euros in your own pocket."
    ),
    "ch09_subscription_and_no_spend_audit": (
        " When you run your ninety-day recurring statement audit on December twenty-seventh or January second, group every automated "
        "charge into three buckets: Essential Infrastructure, High-Joy Active Use, and Silent Drift. Silent Drift is where companies "
        "make billions: the cloud storage tier you upgraded two years ago, the streaming channel you subscribed to for one show last "
        "spring, the fitness app billing fourteen-ninety-nine every month, and the home or auto insurance policy that quietly ratcheted "
        "up eighteen percent at renewal because the insurer knows most customers never call to re-quote. Spend forty-five minutes "
        "canceling every subscription that fails the Two-Euro Cost-Per-Use test, and spend another thirty minutes running competing "
        "quotes on your broadband, mobile, and insurance policies. Unlike a miserable No-Spend January challenge that forces you to "
        "say no to coffee with a friend every day, a one-time structural audit requires forty-five minutes of effort once and pays "
        "you one hundred and ninety-five euros every month for the next twelve months automatically."
    ),
    "ch10_grocery_supermarket_traps": (
        " Let's run the exact math on a weekly family supermarket trip to see how one hundred and forty-five euros a month hides in "
        "plain sight. Most shoppers walk down the center aisles looking at the front of packages and the large yellow price tags on "
        "the eye-level shelf. A box of brand-name cereal or pasta sauce at eye level might say two euros and ninety-nine cents for "
        "three hundred and五十 grams, which equals eight euros and fifty-four cents per kilogram. Directly below your knees on the "
        "bottom shelf sits the store's own single-ingredient equivalent at one euro and六十 cents for five hundred grams—three euros "
        "and twenty cents per kilogram. That is a sixty-two percent unit-price reduction on the exact same nutritional staple. When "
        "you combine bottom-shelf unit-price shopping with a strict perimeter-first route—produce, whole proteins, bulk grains, and "
        "dairy—while bypassing end-cap three-for-ten displays, your weekly grocery bill drops from one hundred and sixty-five euros "
        "to under one hundred and thirty euros immediately."
    ),
    "ch11_thirty_five_k_car_autopsy": (
        " Look closely at why the thirty-five-thousand-euro new car trap is so dangerous to a household's long-term freedom. Dealerships "
        "are trained never to negotiate on the totalfive-year cost of ownership; they negotiate exclusively on the monthly payment box. "
        "If you say five hundred euros a month is too high, they simply stretch the loan term from forty-eight months to seventy-two or "
        "eighty-four months, making the monthly payment look smaller while increasing total interest paid and locking you underwater on "
        "the depreciation curve for six years. Now compare that seventy-four-thousand-two-hundred-euro five-year net-worth drain against "
        "the Calm Budgeting alternative: buying a three-year-old, single-owner vehicle with a proven reliability record for sixteen "
        "thousand five hundred euros. The first owner already paid thenineteen-thousand-euro depreciation cliff. Your insurance premium "
        "is thirty-five percent lower, your financing drag is zero, and the three hundred and eighty euros a month you save compounds "
        "in your investment account to over twenty-eight thousand euros in just five years."
    ),
    "ch12_two_account_quiet_budgeting": (
        " Let's close by looking at what your financial life actually feels like once Two-Account Quiet Budgeting is running. On the "
        "first morning of every month, your paycheck arrives in Account One—your Vault Hub. Within two hours, automated rules pay your "
        "housing, utilities, insurance, and debt or index fund transfers, and move thirty-five euros into your year-round Gift and "
        "Seasonal Sinking Fund so next November four hundred and twenty euros is sitting in cash waiting for you. Then, every Monday "
        "at eight in the morning, an automated transfer pushes your fixed weekly variable allowance—say two hundred and二十 euros for "
        "groceries, coffee, and weekend fun—into Account Two, your everyday spending card. You never open a budgeting spreadsheet on "
        "Wednesday night. You never argue about a four-euro coffee. You simply spend from Account Two until Monday's balance hits zero, "
        "knowing with one hundred percent mathematical certainty that your bills, your future holiday vault, and your eight-percent "
        "index investments are already paid and compounding."
    ),
}

bp = json.loads(BP_PATH.read_text(encoding="utf-8"))
total_words = 0
for ch in bp["chapters"]:
    extra = (
        DEEP_DIVES.get(ch["id"], "")
        .replace("五十", "fifty")
        .replace("六十", "sixty")
        .replace("二十", "twenty")
        .replace("totalfive", "total five")
        .replace("thenineteen", "the nineteen")
    )
    if extra and extra.strip() not in ch["narration"]:
        ch["narration"] = ch["narration"].strip() + extra
    total_words += len(ch["narration"].split())

BP_PATH.write_text(json.dumps(bp, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Updated ep01_20min_masterclass.json: {len(bp['chapters'])} chapters, {total_words} total words (~{total_words/152:.1f} minutes)")
