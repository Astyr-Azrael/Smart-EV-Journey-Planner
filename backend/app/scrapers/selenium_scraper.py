from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def scrape_dynamic_page(url: str, wait_css: str, item_css: str, max_items: int = 20) -> dict:
    """Extract permitted visible card text from a JavaScript-rendered public page."""
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--window-size=1440,1000")
    driver = webdriver.Chrome(options=options)
    try:
        driver.set_page_load_timeout(30)
        driver.get(url)
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.CSS_SELECTOR, wait_css)))
        items = []
        for element in driver.find_elements(By.CSS_SELECTOR, item_css)[:max_items]:
            try:
                text = " ".join(element.text.split())
                if text:
                    items.append(text[:1000])
            except StaleElementReferenceException:
                continue
        return {"url": driver.current_url, "title": driver.title, "items": items, "item_count": len(items), "engine": "Selenium Chrome explicit-wait"}
    except (TimeoutException, NoSuchElementException) as exc:
        raise RuntimeError(f"Dynamic content did not appear for selector '{wait_css}': {exc}") from exc
    finally:
        driver.quit()
