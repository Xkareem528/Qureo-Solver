


const QUREO_URL = 'https://me-portal.qureo.education/login';

async function inspectPage(page, errors, failedScripts) {
  return await page.evaluate(({ pageErrors, scripts }) => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };

    return {
      title: document.title,
      url: location.href,
      readyState: document.readyState,
      bodyText: document.body?.innerText?.slice(0, 5000) || '',
      headings: [...document.querySelectorAll('h1,h2,h3')]
        .filter(visible)
        .map(el => el.innerText.trim()),

      fields: [...document.querySelectorAll('input')]
        .filter(visible)
        .map(el => ({
          type: el.type,
          placeholder: el.placeholder,
          name: el.name,
          id: el.id
        })),

      buttons: [...document.querySelectorAll(
        'button, [role="button"], input[type="submit"]'
      )]
        .filter(visible)
        .map(el => ({
          text: (el.innerText || el.value || '').trim(),
          ariaLabel: el.getAttribute('aria-label')
        })),

      iframes: [...document.querySelectorAll('iframe')]
        .map(el => ({
          src: el.src,
          title: el.title
        })),

      scriptsCount: document.scripts.length,
      pageErrors,
      failedScripts: scripts
    };
  }, {
    pageErrors: errors,
    scripts: failedScripts
  });
}

async function openQureo() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',

      extraHTTPHeaders: {
        Referer: 'https://me-portal.qureo.education/'
      }
    });

    const page = await context.newPage();
    const errors = [];
    const failedScripts = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    page.on('response', response => {
      if (response.request().resourceType() === 'script') {
        const contentType =
          response.headers()['content-type'] || '';

        if (!contentType.includes('javascript')) {
          failedScripts.push({
            url: response.url(),
            status: response.status(),
            contentType
          });
        }
      }
    });

    await page.goto(QUREO_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(7000);

    const result = await inspectPage(
      page,
      errors,
      failedScripts
    );

    const hasLoginFields = result.fields.some(
      field => field.type === 'password'
    );

    return {
      success: true,
      message: 'تم فحص صفحة QUREO',
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
