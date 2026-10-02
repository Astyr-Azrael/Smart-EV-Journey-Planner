import ipaddress
import json
import socket
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from ..config import settings
from ..scrapers.static_scraper import extract_with_css_and_xpath


class CrawlSafetyError(ValueError):
    pass


def validate_public_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise CrawlSafetyError("Enter a complete public http(s) URL")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise CrawlSafetyError("The host could not be resolved") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise CrawlSafetyError("Private and local network addresses are blocked")
    return parsed.geturl()


def parse_page(html: str, url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else url
    description_tag = soup.find("meta", attrs={"name": lambda value: value and value.lower() == "description"})
    description = description_tag.get("content", "").strip() if description_tag else ""
    headings = [tag.get_text(" ", strip=True) for tag in soup.select("h1, h2, h3")[:20]]
    links = []
    for anchor in soup.select("a[href]"):
        href = urljoin(url, anchor.get("href", ""))
        if href.startswith(("http://", "https://")) and href not in links:
            links.append(href)
        if len(links) >= 30:
            break
    structured_data = []
    for script in soup.select('script[type="application/ld+json"]')[:10]:
        try:
            structured_data.append(json.loads(script.string or "{}"))
        except json.JSONDecodeError:
            continue
    text = " ".join(soup.stripped_strings)
    ev_terms = [term for term in ["charging", "charger", "electric vehicle", "CCS", "CHAdeMO", "kilowatt", "station"] if term.lower() in text.lower()]
    return {
        "url": url,
        "title": title,
        "description": description,
        "headings": headings,
        "links": links,
        "structured_data": structured_data,
        "ev_terms_found": ev_terms,
        "text_preview": text[:900],
        "word_count": len(text.split()),
        "selector_demo": extract_with_css_and_xpath(html),
    }


async def inspect_public_page(url: str) -> dict:
    safe_url = validate_public_url(url)
    parsed = urlparse(safe_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    headers = {"User-Agent": settings.user_agent, "Accept": "text/html,application/xhtml+xml"}
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds, follow_redirects=True, headers=headers) as client:
        robots = RobotFileParser()
        robots.set_url(robots_url)
        try:
            robots_response = await client.get(robots_url)
            robots.parse(robots_response.text.splitlines() if robots_response.is_success else [])
        except httpx.HTTPError:
            robots.parse([])
        if not robots.can_fetch(settings.user_agent, safe_url):
            raise CrawlSafetyError("This website's robots.txt does not allow this crawler to inspect that page")
        response = await client.get(safe_url)
        response.raise_for_status()
        if "text/html" not in response.headers.get("content-type", ""):
            raise CrawlSafetyError("The URL did not return an HTML webpage")
        if len(response.content) > 3_000_000:
            raise CrawlSafetyError("The page is larger than the 3 MB inspection limit")
        return parse_page(response.text, str(response.url))
