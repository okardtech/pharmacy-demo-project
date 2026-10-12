import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 360, height: 760 }, colorScheme: 'dark' });

async function start(page: Page, user: string) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('laopharm-demo-v1', JSON.stringify({ lang: 'en', theme: 'dark' })));
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(user) }).click();
}

test('pharmacy screens at 360px, dark, English — no horizontal scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, 'pharmacist');
  for (const r of ['/app', '/app/pos', '/app/stock']) {
    await page.goto(r);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${r}`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `e2e/shots/mobile${r.replace(/\//g, '_')}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('inspector runs a checklist on a phone', async ({ page }) => {
  await start(page, 'inspector1');
  await page.locator('input[inputmode="numeric"]').fill('123456');
  await page.locator('form button[type="submit"]').click();
  await page.goto('/gov/inspections');
  await page.getByRole('button', { name: /Start inspection/ }).first().click();
  await page.getByRole('button', { name: /GPS check-in/ }).click();
  await page.getByRole('button', { name: 'Yes' }).first().click();
  await page.getByRole('button', { name: 'No' }).nth(1).click();
  await expect(page.getByText(/Checked in/)).toBeVisible();
  await page.screenshot({ path: 'e2e/shots/mobile_inspection.png' });
});
