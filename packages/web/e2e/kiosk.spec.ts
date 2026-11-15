import {
  expect,
  test,
} from '@playwright/test';

const username = process.env.E2E_USERNAME ?? 'max';
const password = process.env.E2E_PASSWORD ?? 'correct horse battery staple';

test(
  'logs in from a token in the URL hash',
  async ({
    page,
    request,
  }) => {
    const created = await request.post(
      '/api/v1/auth/token',
      {
        data: {
          username,
          password,
          name: 'e2e kiosk',
        },
      },
    );
    expect(created.status()).toBe(201);
    const {
      id,
      token,
    } = await created.json() as {
      id: string;
      token: string;
    };

    try {
      await page.goto(`/#token=${token}`);
      await expect(page.locator('section[aria-label="Habits"]')).toBeVisible();
      expect(page.url()).not.toContain('token=');

      await page.reload();
      await expect(page.locator('section[aria-label="Habits"]')).toBeVisible();
    } finally {
      await request.delete(
        `/api/v1/user/tokens/${id}`,
        { headers: { authorization: `Bearer ${token}` } },
      );
    }
  },
);

test(
  'falls back to the login page for a rejected token',
  async ({ page }) => {
    await page.goto('/#token=krt_nope');
    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.locator('text=Invalid or expired API token')).toBeVisible();
    expect(page.url()).not.toContain('token=');
  },
);
