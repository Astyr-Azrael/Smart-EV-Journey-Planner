# Scraping Sources and Ethics

The scraping lab is isolated from the core journey planner so a third-party page redesign cannot break route planning.

## Supported demonstrations

- **Static page inspection:** `POST /api/crawler/inspect` uses BeautifulSoup, CSS selectors and lxml XPath. It extracts metadata, headings, public links, JSON-LD, EV terms and candidate station/charger blocks.
- **Multi-page extraction:** `POST /api/crawler/multipage` processes up to five explicit URLs sequentially with a delay between pages. This demonstrates pagination/location-page handling without an unrestricted spider.
- **Dynamic extraction:** `POST /api/crawler/dynamic` uses headless Chrome, Selenium and explicit waits. The evaluator supplies a permitted page plus wait/item CSS selectors.

## Safety gate

Before static or Selenium extraction, the Smart EV Journey Planner backend:

1. accepts only complete HTTP(S) URLs;
2. resolves the hostname and rejects private, loopback, link-local, reserved and multicast addresses;
3. fetches and checks `robots.txt`;
4. follows ordinary redirects but does not bypass authentication, CAPTCHAs or anti-bot controls;
5. limits static HTML to 3 MB;
6. extracts factual metadata rather than reproducing full pages;
7. retains the source URL and crawl timestamp.

Candidate Indian sources from the project guide—Statiq, Tata Power EZ Charge, ChargeZone and Bolt.Earth—must be rechecked immediately before a classroom crawl because their layouts, terms and robots policies can change. If automated access is not allowed, use a permitted reference page instead.
