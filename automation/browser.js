
const { chromium } = require('playwright');

const QUREO_URL = 'https://me-portal.qureo.education/login';

async function inspectPage(page, errors) {
  return await page.evaluate((pageErrors) => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };

    const fields = [...document.querySelectorAll('input')]
      .filter(visible)
      .map(el => ({
        type: el.type,
        placeholder: el.placeholder,
        name: el.name,
        id: el.id
      }));

    const buttons = [
      ...document.querySelectorAll(
        'button, [role="button"], input[type="submit"]'
      )
    ]
      .filter(visible)
      .map(el => ({
        text: (el.innerText || el.value || '').trim(),
        ariaLabel: el.getAttribute('aria-label')
      }));

    const iframes = [...document.querySelectorAll('iframe')]
      .map(el => ({
        src: el.src,
        title: el.title
      }));

    return {
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      bodyText: document.body?.innerText?.slice(0, 5000) || '',
      headings: [...document.querySelectorAll('h1,h2,h3')]
        .filter(visible)
        .map(el => el.innerText.trim()),
      fields,
      buttons,
      iframes,
      scriptsCount: document.scripts.length,
      pageErrors
    };
  }, errors);
}

async function openQureo() {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const page = await browser.newPage();
    const errors = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.goto(QUREO_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(7000);

    const result = await inspectPage(page, errors);

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
