import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, username: string, twoFactor = false) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(username) }).first().click();
  if (twoFactor) {
    await page.locator('input[inputmode="numeric"]').fill('123456');
    await page.locator('form button[type="submit"]').click();
  }
}

const PHARMACY = ['/app', '/app/pos', '/app/stock', '/app/receive', '/app/prescriptions', '/app/controlled', '/app/destruction', '/app/adr', '/app/customers', '/app/suppliers', '/app/reports', '/app/license', '/app/staff', '/app/sync', '/app/settings', '/gallery'];
const REGULATOR = ['/gov', '/gov/registry', '/gov/registry/ph-001', '/gov/register', '/gov/renewals', '/gov/catalog', '/gov/inspections', '/gov/corrective', '/gov/controlled', '/gov/reports', '/gov/users', '/gov/audit', '/gov/system', '/gov/sync'];

for (const [user, routes, tfa] of [['owner', PHARMACY, false], ['admin', REGULATOR, true]] as const) {
  test(`every ${user} screen renders without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !m.text().includes('tile.openstreetmap') && errors.push(m.text()));
    await login(page, user, tfa);
    for (const r of routes) {
      await page.goto(r);
      await expect(page.locator('main h1').first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(450);
      await page.screenshot({ path: `e2e/shots/${user}${r.replace(/\//g, '_')}.png`, fullPage: false });
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('offline: sell + receive stock, then sync on reconnect', async ({ page, context }) => {
  await login(page, 'pharmacist');
  // warm lazy chunks while online (production uses the service-worker app shell)
  await page.goto('/app/receive');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('link', { name: /^(POS|ຂາຍ)$/ }).first().click();
  await expect(page.locator('input[role=combobox]')).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));

  // sell
  await page.locator('input[role=combobox]').fill('Paracetamol');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Pay|ຊຳລະ/ }).click();
  await page.getByRole('button', { name: /Complete sale|ສຳເລັດການຂາຍ/ }).click();
  await expect(page.getByRole('dialog')).toContainText('D01-');
  await page.keyboard.press('Escape');

  // receive stock (client-side navigation, still offline)
  await page.getByRole('link', { name: /Receive stock|ຮັບສິນຄ້າ/ }).first().click();
  await page.getByLabel(/Invoice no|ເລກໃບບິນ/).fill('INV-OFF-1');
  await page.getByRole('searchbox').fill('Vitamin');
  await page.locator('ul li button').filter({ hasText: 'Vitamin' }).first().click();
  await page.getByLabel(/Lot no|ເລກລັອດ/).fill('VC-OFF1');
  await page.getByLabel(/Expiry|ວັນໝົດອາຍຸ/).fill('2028-12-31');
  await page.getByLabel(/^Qty|^ຈຳນວນ/).fill('50');
  await page.getByRole('button', { name: /Post goods receipt|ບັນທຶກການຮັບສິນຄ້າ/ }).click();

  const indicator = page.locator('header button[aria-live="polite"]');
  await expect(indicator).toContainText(/Offline|ອອບລາຍ/);
  await expect(indicator).not.toContainText(/ 0 /);

  // reconnect → outbox drains
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(indicator).toContainText(/synced|ຊິງຄ໌ແລ້ວ/, { timeout: 15_000 });
  await page.getByRole('link', { name: /Sync center|ສູນຊິງຄ໌/ }).first().click();
  await expect(page.getByText(/Everything is synced|ທຸກຢ່າງຊິງຄ໌ແລ້ວ/)).toBeVisible();
});
