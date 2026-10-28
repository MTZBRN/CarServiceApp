import { test, expect, type Page } from '@playwright/test';
const ui = 'http://127.0.0.1:5173';
const api = 'http://localhost:5232/api';
let mechanic: string;
let vehicleId: number;
let jobId: number;
async function login(page: Page, email = 'admin@test.com', password = 'admin123') {
  await page.goto(ui + '/login');
  await page.getByPlaceholder('Felhasználónév (Email)').fill(email);
  await page.getByPlaceholder('Jelszó').fill(password);
  await page.getByRole('button', { name: /belépés/i }).click();
  await expect(page.getByRole('button', { name: 'Kilépés', exact: true })).toBeVisible();
}
test.beforeAll(async ({ request }) => {
  const response = await request.post(api + '/Auth/login', { data: { email: 'admin@test.com', password: 'admin123' } });
  const headers = { Authorization: 'Bearer ' + (await response.json()).token };
  mechanic = `shell-${Date.now()}@test.com`;
  expect((await request.post(api + '/Users', { headers, data: { name: 'Shell Mechanic', email: mechanic, password: 'shell123', role: 'mechanic' } })).ok()).toBeTruthy();
  const customer = await (await request.post(api + '/Customers', { headers, data: { name: 'Shell Print Customer', phoneNumber: '123' } })).json();
  const vehicle = await (await request.post(api + '/Vehicle', { headers, data: { licensePlate: `SHELL-${Date.now()}`, make: 'Ford', model: 'Focus', year: 2020, customerId: customer.id } })).json();
  vehicleId = vehicle.id;
  const job = await (await request.post(api + '/ServiceJobs', { headers, data: { vehicleId, date: new Date().toISOString(), description: 'Shell print isolation', jobParts: [], laborCost: 1000 } })).json();
  jobId = job.id;
});

test('desktop shell has semantic routes, admin controls, persistent collapse and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await expect(page.locator('body')).toHaveCSS('font-family', /Segoe UI/);
  const nav = page.getByRole('navigation', { name: 'Fő navigáció' });
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav.getByRole('link', { name: 'Áttekintés' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('button', { name: /Munkalapok/ })).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Adminisztráció' }).getByRole('link')).toHaveCount(2);
  await page.keyboard.press('Tab');
  await nav.getByRole('link', { name: 'Ügyfelek' }).focus();
  await expect(nav.getByRole('link', { name: 'Ügyfelek' })).toBeFocused();
  const focus = await nav.getByRole('link', { name: 'Ügyfelek' }).evaluate(el => getComputedStyle(el).outlineWidth);
  expect(parseFloat(focus)).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(ui + '/customers');
  await expect(nav.getByRole('link', { name: 'Ügyfelek' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('main')).toBeFocused();
  await page.screenshot({ path: 'C:/CarServiceApp/stage23-artifacts/desktop-customers.png' });
  await page.getByRole('button', { name: 'Oldalsáv összecsukása', exact: true }).click();
  await expect(page.locator('.workshop-sidebar')).toHaveCSS('width', '72px');
  await expect(nav.getByRole('link', { name: 'Járművek' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.workshop-sidebar')).toHaveCSS('width', '72px');
  await page.getByRole('button', { name: 'Oldalsáv kibontása', exact: true }).click();
  await expect(page.locator('.workshop-sidebar')).toHaveCSS('width', '248px');
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
});

for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 900, height: 700 }]) {
  test(`responsive drawer, keyboard containment and route focus at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await login(page);
    const trigger = page.getByRole('button', { name: 'Menü megnyitása' });
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Navigáció' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Menü bezárása' })).toBeFocused();
    expect(await page.locator('#root').evaluate(el => el.inert)).toBe(true);
    await page.keyboard.press('Shift+Tab');
    await expect(drawer.getByRole('button', { name: 'Kijelentkezés', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(drawer.getByRole('button', { name: 'Menü bezárása' })).toBeFocused();
    if (viewport.width === 390) await page.screenshot({ path: 'C:/CarServiceApp/stage23-artifacts/mobile-navigation.png' });
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click(); await drawer.getByRole('link', { name: 'Ügyfelek', exact: true }).click();
    await expect(page).toHaveURL(ui + '/customers'); await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('main')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  });
}

test('mechanic sees permitted navigation and cannot expose admin pages via stored role', async ({ page }) => {
  await login(page, mechanic, 'shell123');
  await expect(page.getByRole('navigation', { name: 'Adminisztráció' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Alkatrészek' })).toBeVisible();
  await expect(page.locator('.shell-profile')).toContainText('Szerelő');
  await page.evaluate(() => localStorage.setItem('userRole', 'admin'));
  await page.goto(ui + '/settings');
  await expect(page.getByRole('alert')).toHaveText('Nincs jogosultságod az oldal megtekintéséhez.');
  await expect(page.getByRole('navigation', { name: 'Adminisztráció' })).toHaveCount(0);
});

test('logout confirmation cancels safely, traps focus and clears identity on confirmation', async ({ page }) => {
  await login(page);
  const trigger = page.getByRole('button', { name: 'Kilépés', exact: true }); await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Kijelentkezés', exact: true });
  await expect(dialog.getByRole('button', { name: 'Mégse' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await dialog.getByRole('button', { name: 'Mégse' }).click();
  await expect(trigger).toBeVisible();
  await trigger.click(); await dialog.getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(false);
});

test('legacy forms use labelled keyboard controls and dialogs restore focus without discarding drafts on backdrop', async ({ page }) => {
  await login(page); await page.getByRole('link', { name: 'Járművek', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Új jármű', exact: true }); await trigger.click();
  const modal = page.getByRole('dialog', { name: 'Új jármű', exact: true });
  const combo = modal.getByRole('combobox').first();
  await combo.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await expect(modal).toBeVisible();
  const input = modal.getByPlaceholder('ABC-123'); await input.fill('DRAFT-123');
  expect(await input.evaluate(el => el.labels?.length)).toBeGreaterThan(0);
  await modal.click({ position: { x: 2, y: 2 } });
  await expect(input).toHaveValue('DRAFT-123');
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(false);
});

test('vehicle breadcrumbs and print frame remain independent of the dark shell', async ({ page }) => {
  await login(page); await page.goto(ui + '/vehicles/' + vehicleId);
  await expect(page.getByRole('navigation', { name: 'Morzsamenü' }).getByRole('link', { name: 'Járművek' })).toHaveAttribute('href', '/vehicles');
  await page.locator('button[title*="Nyomtat"]').first().click();
  const preview = page.getByRole('dialog', { name: 'Munkalap nyomtatási előnézet' }); await expect(preview).toBeVisible();
  await expect(preview.locator('.print-wrapper')).toContainText('Shell print isolation');
  expect(await preview.locator('.print-wrapper').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.screenshot({ path: 'C:/CarServiceApp/stage23-artifacts/print-preview.png' });
  page.on('frameattached', async frame => { await frame.evaluate(() => { window.print = () => {}; }).catch(() => {}); });
  const printFramePromise = page.waitForEvent('frameattached');
  await preview.getByRole('button', { name: 'Nyomtatás', exact: true }).click();
  const frame = await printFramePromise;
  await expect.poll(async () => frame.locator('.print-wrapper').count().catch(() => 0)).toBe(1);
  const styles = await frame.evaluate(() => [...document.querySelectorAll('style, link[rel="stylesheet"]')].map(el => el.textContent || el.getAttribute('href')).join('\n'));
  expect(styles).not.toContain('.app-shell'); expect(styles).not.toContain('--color-bg'); expect(styles).toContain('@page');
  expect(await frame.locator('.print-wrapper').evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)');
  expect(jobId).toBeGreaterThan(0);
});

test('reduced motion preference suppresses application animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page);
  expect(await page.getByRole('link', { name: 'Ügyfelek', exact: true }).evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});



test('nested print dialog restores its worksheet and releases background inertness', async ({ page }) => {
  await login(page); await page.goto(ui + '/vehicles/' + vehicleId);
  const edit = page.locator('button[title*="szerkeszt"]').first();
  await edit.click();
  const worksheet = page.getByRole('dialog', { name: 'Munkalap', exact: true });
  const print = worksheet.locator('button[title="Nyomtatás"]');
  await print.click();
  const preview = page.getByRole('dialog', { name: 'Munkalap nyomtatási előnézet' });
  await expect(preview).toBeVisible();
  expect(await worksheet.evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press('Escape'); await expect(preview).toHaveCount(0);
  await expect(worksheet).toBeVisible(); await expect(print).toBeFocused();
  expect(await worksheet.evaluate(el => el.inert)).toBe(false);
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(true);
  await page.keyboard.press('Escape'); await expect(worksheet).toHaveCount(0);
  await expect(edit).toBeFocused();
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(false);
});
