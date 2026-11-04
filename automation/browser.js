
const { chromium } = require('playwright');

async function inspectPage(page) {
  const data = await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };

    const buttons = [...document.querySelectorAll(
      'button, input[type="button"], input[type="submit"], [role="button"]'
    )]
      .filter(visible)
      .map(el => ({
        text: (el.innerText || el.value || '').trim(),
        type: el.getAttribute('type'),
        ariaLabel: el.getAttribute('aria-label')
      }));

    const fields = [...document.querySelectorAll('input')]
      .filter(visible)
      .map(el => ({
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id,
        label: el.getAttribute('aria-label')
      }));

    const headings = [...document.querySelectorAll(
      'h1, h2, h3'
    )]
      .filter(visible)
      .map(el => el.innerText.trim());

    return {
      title: document.title,
      url: location.href,
      headings,
      fields,
      buttons
    };
  });

  return data;
}

module.exports = { inspectPage };
