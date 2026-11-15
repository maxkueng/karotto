import {
  expect,
  test,
} from '@playwright/test';

const username = process.env.E2E_USERNAME ?? 'max';
const password = process.env.E2E_PASSWORD ?? 'correct horse battery staple';

test.use({
  viewport: {
    width: 960,
    height: 600,
  },
  timezoneId: 'Pacific/Kiritimati',
});

test(
  'shows the board without chrome and leaves the timezone alone',
  async ({ page }) => {
    const login = await page.request.post(
      '/api/v1/auth/login',
      {
        data: {
          username,
          password,
        },
      },
    );
    expect(login.ok()).toBe(true);
    const preferenceWrites: string[] = [];
    page.on(
      'request',
      (request) => {
        if (request.url().includes('/user/preferences')) {
          preferenceWrites.push(request.method());
        }
      },
    );

    await page.goto('/display');
    const columns = page.locator('section[aria-label]');
    await expect(columns).toHaveCount(3);
    await expect(columns.first()).toBeVisible();

    await expect(page.locator('nav')).toHaveCount(0);
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.locator('input[type=search]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Task options"]')).toHaveCount(0);

    const tops = await columns.evaluateAll((sections) => sections.map((section) => section.getBoundingClientRect().top));
    expect(new Set(tops).size).toBe(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(overflow).toBe(0);
    expect(preferenceWrites).toEqual([]);
  },
);
