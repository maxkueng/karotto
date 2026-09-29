import {
  expect,
  test,
} from '@playwright/test';
import type { Page } from '@playwright/test';

const username = process.env.E2E_USERNAME ?? 'max';
const password = process.env.E2E_PASSWORD ?? 'correct horse battery staple';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill(
    '#login-username',
    username,
  );
  await page.fill(
    '#login-password',
    password,
  );
  await page.click('button[type=submit]');
  await page.waitForSelector('section[aria-label="Habits"]');
  const welcome = page.locator('text=Welcome back!');
  if (await welcome.count()) {
    await page.click('text=Start My New Day!');
    await welcome.waitFor({ state: 'detached' });
  }
  await page.click('section[aria-label="Habits"] button:has-text("All")');
  await page.click('section[aria-label="Dailies"] button:has-text("Due")');
  await page.click('section[aria-label="To Do\'s"] button:has-text("Active")');
  await expect(page.locator('textarea[placeholder="Add a To Do"]')).toBeVisible();
}

async function quickAdd(
  page: Page,
  placeholder: string,
  text: string,
): Promise<void> {
  const field = page.locator(`textarea[placeholder="${placeholder}"]`);
  await field.click();
  await field.fill(text);
  await page.keyboard.press('Enter');
  await expect(page.locator(
    '.task-title',
    { hasText: text },
  ).first()).toBeVisible();
}

async function deleteTask(
  page: Page,
  text: string,
): Promise<void> {
  const card = page.locator(
    '.task-card',
    { hasText: text },
  ).first();
  await card.hover();
  await card.locator('[aria-label="Task options"]').click();
  await page.click('[role=menu] >> text=Delete');
  await page.click('[role=dialog] button:has-text("Delete")');
  await expect(card).toHaveCount(0);
}

test(
  'rejects wrong credentials',
  async ({ page }) => {
    await page.goto('/login');
    await page.fill(
      '#login-username',
      username,
    );
    await page.fill(
      '#login-password',
      'nope-nope-nope',
    );
    await page.click('button[type=submit]');
    await expect(page.locator('text=Invalid username or password')).toBeVisible();
  },
);

test(
  'creates, scores, edits and deletes tasks',
  async ({ page }) => {
    await login(page);
    const stamp = Date.now().toString(36);
    const habit = `e2e habit ${stamp}`;
    const daily = `e2e daily ${stamp}`;
    const todo = `e2e todo ${stamp}`;

    await quickAdd(
      page,
      'Add a Habit',
      habit,
    );
    await quickAdd(
      page,
      'Add a Daily',
      daily,
    );
    await quickAdd(
      page,
      'Add a To Do',
      todo,
    );

    const habitCard = page.locator(
      '.task-card',
      { hasText: habit },
    );
    await habitCard.locator('[aria-label="Score up"]').click();
    await expect(habitCard).toContainText('+1 | 0');

    const dailyCard = page.locator(
      '.task-card',
      { hasText: daily },
    );
    await page.click('section[aria-label="Dailies"] button:has-text("Due")');
    await dailyCard.locator('[role=checkbox]').click();
    await expect(dailyCard).toHaveCount(0);
    await page.click('section[aria-label="Dailies"] button:has-text("All")');
    await expect(dailyCard.locator('[role=checkbox]')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(dailyCard).toContainText('1');

    const todoCard = page.locator(
      '.task-card',
      { hasText: todo },
    );
    await todoCard.locator('.task-title').click();
    await page.fill(
      '#task-notes',
      'Some **notes**',
    );
    await page.fill(
      'input[placeholder="New checklist item"]',
      'first step',
    );
    await page.keyboard.press('Enter');
    const firstItem = page.locator('[aria-label="Checklist item"]').first();
    await firstItem.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' done');
    await expect(firstItem).toHaveValue('first step done');
    await page.keyboard.press('Enter');
    await expect(page.locator('input[placeholder="New checklist item"]')).toBeFocused();
    await page.keyboard.type('second step');
    await page.click('[role=dialog] button:has-text("Save")');
    await expect(todoCard).toContainText('notes');
    await expect(todoCard).toContainText('0/2');
    await todoCard.locator(
      'label',
      { hasText: 'first step done' },
    ).click();
    await expect(todoCard).toContainText('1/2');

    await todoCard.locator('[role=checkbox]').first().click();
    await expect(todoCard).toHaveCount(0);
    await page.click('section[aria-label="To Do\'s"] button:has-text("Complete")');
    await expect(page.locator(
      '.task-card',
      { hasText: todo },
    )).toBeVisible();
    await page.click('section[aria-label="To Do\'s"] button:has-text("Active")');

    await deleteTask(
      page,
      habit,
    );
    await deleteTask(
      page,
      daily,
    );
    await page.click('section[aria-label="Dailies"] button:has-text("Due")');
    await page.click('section[aria-label="To Do\'s"] button:has-text("Complete")');
    await deleteTask(
      page,
      todo,
    );
    await page.click('section[aria-label="To Do\'s"] button:has-text("Active")');
  },
);
