import { test, expect, type Page } from '@playwright/test';

async function worksheet(page: Page) {
    await page.clock.install();
    await page.goto('/worksheets/new');
    await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
    await page.getByPlaceholder('Jelszó').fill('Admin-test-only-123');
    await page.getByRole('button', {name: /belépés/i}).click();
    await expect(page.getByRole('textbox', {name: /Munka leírása/})).toBeVisible();
}

test('warns with a dirty worksheet, keeps it on continuation and locks both tabs on expiry', async ({page, context}) => {
    await worksheet(page);
    const field = page.getByRole('textbox', {name: /Munka leírása/});
    const activity = page.waitForResponse(r => r.url().endsWith('/Auth/activity') && r.status() === 200);
    await field.fill('Fictional unsaved repair');
    await activity;
    await expect(page.getByText(/15 perc inaktivitás/)).toBeVisible();
    const other = await context.newPage();
    await other.goto('/customers');
    await expect(other.getByRole('button', {name:'Kilépés'})).toBeVisible();
    await page.bringToFront();
    await page.clock.fastForward('14:01');
    const warning = page.getByRole('dialog', {name:'A munkamenet hamarosan lejár'});
    await expect(warning).toBeVisible();
    await warning.getByRole('button', {name:'Munkamenet folytatása'}).click();
    await expect(warning).toBeHidden();
    await expect(field).toHaveValue('Fictional unsaved repair');
    await page.clock.fastForward('15:01');
    await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
    await expect(field).toHaveCount(0);
    await expect(other.getByPlaceholder('Jelszó')).toBeVisible();
});

test('wake after deadline locks immediately and reports an unconfirmed offline revocation', async ({page}) => {
    await worksheet(page);
    await page.route('**/api/Auth/logout*', route => route.abort());
    let activity = 0;
    page.on('request', req => { if (req.url().endsWith('/Auth/activity')) activity++; });
    const later = await page.evaluate(() => Date.now() + 16 * 60_000);
    // Move wall time without executing the warning/expiry timers, as on a suspended laptop.
    await page.clock.setSystemTime(later);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
    await expect(page.getByText(/visszavonást nem sikerült/)).toBeVisible();
    expect(activity).toBe(0);
});

test('429 activity response preserves the confirmed deadline and authenticated identity', async ({page}) => {
    await worksheet(page);
    await page.route('**/api/Auth/activity', route => route.fulfill({status:429}));
    await page.clock.fastForward('10:00');
    const rejected = page.waitForResponse(r => r.url().endsWith('/Auth/activity') && r.status() === 429);
    await page.getByRole('textbox', {name:/Munka leírása/}).fill('Fictional rate-limited edit');
    await rejected;
    await expect(page.getByRole('button', {name:'Kilépés'})).toBeVisible();
    await page.clock.fastForward('04:01');
    await expect(page.getByRole('dialog', {name:'A munkamenet hamarosan lejár'})).toBeVisible();
    await page.clock.fastForward('01:00');
    await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
});

test('replacement identity in another tab discards the old worksheet and reloads permissions', async ({page, context, request}) => {
    await worksheet(page);
    const field = page.getByRole('textbox', {name:/Munka leírása/});
    await field.fill('Fictional previous operator draft');
    const other = await context.newPage();
    await other.goto('/customers');
    const api = 'http://localhost:5232/api';
    const headers = { Authorization: 'Bearer ' + await other.evaluate(() => localStorage.getItem('authToken')) };
    const email = 'session-test-' + Date.now() + '@example.invalid';
    const password = 'Fictional-mechanic-123';
    const created = await request.post(api + '/Users', {headers, data:{name:'Fictional mechanic', email, password, role:'mechanic'}});
    expect(created.ok()).toBeTruthy();
    const signedIn = await request.post(api + '/Auth/login', {data:{email,password}});
    expect(signedIn.ok()).toBeTruthy();
    await other.evaluate(token => localStorage.setItem('authToken', token), (await signedIn.json()).token);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('userRole'))).toBe('mechanic');
    await expect(field).toHaveValue('');
    await page.goto('/users');
    await expect(page.getByText('Nincs jogosultságod az oldal megtekintéséhez.')).toBeVisible();
});
