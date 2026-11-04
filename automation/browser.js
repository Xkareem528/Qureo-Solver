
const { chromium } = require('playwright');

const QUREO_URL = 'https://me-portal.qureo.education/login';

async function inspectPage(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };

    const buttons = [
      ...document.querySelectorAll(
        'button, input[type="button"], input[type="submit"], [role="button"]'
      )
    ]
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

    const headings = [
      ...document.querySelectorAll('h1, h2, h3')
    ]
      .filter(visible)
      .map(el => el.innerText.trim());

    const questionElements = [
      ...document.querySelectorAll(
        '[class*="question"], [class*="Question"]'
      )
    ]
      .filter(visible)
      .slice(0, 20)
      .map(el => el.innerText.trim())
      .filter(Boolean);

    return {
      title: document.title,
      url: location.href,
      headings,
      fields,
      buttons,
      questionElements
    };
  });
}

async function openQureo() {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();

    await page.goto(QUREO_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const result = await inspectPage(page);

    const hasLoginFields = result.fields.some(
      field => field.type === 'password'
    );

    return {
      success: true,
      pageType: hasLoginFields ? 'login' : 'other',
      page: result
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  inspectPage,
  openQureo
};
