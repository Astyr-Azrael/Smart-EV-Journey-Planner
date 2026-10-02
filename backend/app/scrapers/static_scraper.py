from bs4 import BeautifulSoup


def extract_with_css_and_xpath(html: str) -> dict:
    """Demonstrate the same extraction with CSS selectors and XPath."""
    soup = BeautifulSoup(html, "html.parser")
    css_headings = [node.get_text(" ", strip=True) for node in soup.select("h1, h2, h3")[:20]]
    xpath_headings: list[str] = []
    xpath_available = False
    try:
        from lxml import html as lxml_html

        tree = lxml_html.fromstring(html)
        xpath_headings = [" ".join(str(value).split()) for value in tree.xpath("//h1//text() | //h2//text() | //h3//text()") if str(value).strip()][:20]
        xpath_available = True
    except (ImportError, ValueError):
        xpath_headings = css_headings
    cards = []
    for node in soup.select("article, [class*='station'], [class*='charger']")[:25]:
        text = " ".join(node.stripped_strings)
        if text:
            cards.append(text[:500])
    return {
        "css_selector": "h1, h2, h3",
        "css_headings": css_headings,
        "xpath_expression": "//h1//text() | //h2//text() | //h3//text()",
        "xpath_headings": xpath_headings,
        "xpath_engine_available": xpath_available,
        "candidate_station_cards": cards,
    }
