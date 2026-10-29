import { test, expect, type Page } from '@playwright/test';
const ui = 'http://localhost:5173';
const api = 'http://localhost:5232/api';
let vehicleId: number;
let mechanic: string;
async function signIn(page: Page, email = 'admin@test.com', password = 'admin123') {
  await page.getByPlaceholder('Felhasználónév (Email)').fill(email);
  await page.getByPlaceholder('Jelszó').fill(password);
  await page.getByRole('button', { name: /belépés/i }).click();
}
test.beforeAll(async ({ request }) => {
  const login = await request.post(`${api}/Auth/login`, { data: { email: 'admin@test.com', password: 'admin123' } });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).token}` };
  mechanic = `routing-${Date.now()}@test.com`;
  expect((await request.post(`${api}/Users`, { headers, data: { name: 'Routing mechanic', email: mechanic, password: 'route123', role: 'mechanic' } })).ok()).toBeTruthy();
  const customer = await (await request.post(`${api}/Customers`, { headers, data: { name: 'Routing customer', phoneNumber: '123' } })).json();
  const vehicle = await request.post(`${api}/Vehicle`, { headers, data: { customerId: customer.id, licensePlate: `ROUTE-${Date.now()}`, make: 'Ford', model: 'Focus', year: 2020 } });
  expect(vehicle.ok()).toBeTruthy(); vehicleId = (await vehicle.json()).id;
});

test('protected deep link returns to the full requested URL after login and refresh', async ({ page }) => {
  const target = `/vehicles/${vehicleId}?from=calendar#history`;
  await page.goto(ui + target);
  await expect(page).toHaveURL(ui + '/login?returnTo=' + encodeURIComponent(target));
  await page.reload(); await signIn(page);
  await expect(page).toHaveURL(ui + target);
  await expect(page.getByRole('button', { name: 'Vissza a listához' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(ui + target);
  await expect(page.getByRole('button', { name: 'Vissza a listához' })).toBeVisible();
});

test('sidebar navigation uses history and direct page refresh restores the screen', async ({ page }) => {
  await page.goto(ui + '/login'); await signIn(page); await expect(page).toHaveURL(ui + '/dashboard');
  await page.getByRole('link', { name: 'Ügyfelek', exact: true }).click(); await expect(page).toHaveURL(ui + '/customers');
  await page.getByRole('link', { name: 'Járművek', exact: true }).click(); await expect(page).toHaveURL(ui + '/vehicles');
  await page.goBack(); await expect(page).toHaveURL(ui + '/customers'); await expect(page.getByRole('button', { name: 'Új ügyfél' })).toBeVisible();
  await page.goForward(); await expect(page).toHaveURL(ui + '/vehicles'); await expect(page.getByRole('heading', { name: 'Járművek', exact: true })).toBeVisible();
  for (const path of ['/dashboard', '/calendar', '/customers', '/vehicles', '/inventory', '/users', '/settings']) {
    await page.goto(ui + path); await expect(page.getByRole('button', { name: 'Kilépés' })).toBeVisible();
    await page.reload(); await expect(page).toHaveURL(path === '/calendar' ? /\/calendar\?date=.*&view=.*/ : ui + path); await expect(page.getByRole('button', { name: 'Kilépés' })).toBeVisible();
  }
});

test('mechanic cannot mount admin screens or grant access by editing stored role', async ({ page }) => {
  await page.goto(ui + '/users'); await signIn(page, mechanic, 'route123');
  await expect(page.getByRole('alert')).toHaveText('Nincs jogosultságod az oldal megtekintéséhez.');
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeTruthy();
  await page.evaluate(() => localStorage.setItem('userRole', 'admin'));
  await page.goto(ui + '/settings'); await expect(page.getByRole('alert')).toHaveText('Nincs jogosultságod az oldal megtekintéséhez.');
  await page.goto(ui + '/vehicles'); await expect(page.getByRole('heading', { name: 'Járművek', exact: true })).toBeVisible();
});

test('invalid session keeps destination and clears stale identity', async ({ page }) => {
  await page.goto(ui + '/login'); await signIn(page); await expect(page).toHaveURL(ui + '/dashboard');
  await page.evaluate(() => localStorage.setItem('authToken', 'invalid'));
  await page.goto(ui + '/calendar');
  await expect(page).toHaveURL(ui + '/login?returnTo=%2Fcalendar');
  expect(await page.evaluate(() => localStorage.getItem('user_data'))).toBeNull();
  await signIn(page); await expect(page).toHaveURL(/\/calendar\?date=\d{4}-\d{2}-\d{2}&view=(week|month|agenda)$/);
});

test('401 during a session redirects to login while preserving the current route', async ({ page }) => {
  // Start on customers so inventory has not already been loaded by the operational dashboard.
  await page.goto(ui + '/customers'); await signIn(page); await expect(page).toHaveURL(ui + '/customers');
  await page.route('**/api/parts', route => route.fulfill({ status: 401, body: '' }));
  await page.getByRole('link', { name: 'Alkatrészek', exact: true }).click();
  await expect(page).toHaveURL(ui + '/login?returnTo=%2Finventory');
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
});

test('logout clears identity and browser back cannot restore a protected screen', async ({ page }) => {
  await page.goto(ui + '/customers'); await signIn(page); await expect(page).toHaveURL(ui + '/customers');
  await page.getByRole('link', { name: 'Járművek', exact: true }).click();
  await page.getByRole('button', { name: 'Kilépés' }).click(); await page.getByRole('dialog', { name: 'Kijelentkezés', exact: true }).getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(page).toHaveURL(ui + '/login');
  expect(await page.evaluate(() => ['authToken','currentUser','userRole','user_data'].map(k => localStorage.getItem(k)))).toEqual([null,null,null,null]);
  await page.goBack(); await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Új ügyfél' })).toHaveCount(0);
});

test('login rejects external return destinations and unknown routes are explicit', async ({ page }) => {
  await page.goto(ui + '/login?returnTo=%2F%2Fevil.example'); await signIn(page); await expect(page).toHaveURL(ui + '/dashboard');
  await page.goto(ui + '/does-not-exist'); await expect(page.getByRole('alert')).toHaveText('Az oldal nem található.');
  await page.goto(ui + '/vehicles/99999999'); await expect(page.getByRole('alert')).toContainText('A jármű nem található.');
});

test('production SPA direct URL serves HTML anonymously while API stays protected', async ({ page, request }) => {
  const origin = 'http://localhost:5232';
  const html = await request.get(origin + '/customers'); expect(html.status()).toBe(200); expect(html.headers()['content-type']).toContain('text/html');
  expect((await request.get(api + '/Customers')).status()).toBe(401);
  await page.goto(origin + '/customers'); await expect(page).toHaveURL(origin + '/login?returnTo=%2Fcustomers');
  await signIn(page); await expect(page).toHaveURL(origin + '/customers');
  await page.reload(); await expect(page.getByRole('button', { name: 'Új ügyfél' })).toBeVisible();
});

test('temporary session-check failure offers retry without discarding login or destination', async ({ page }) => {
  await page.goto(ui + '/login'); await signIn(page); await expect(page).toHaveURL(ui + '/dashboard');
  await page.route('**/api/Auth/me', route => route.fulfill({ status: 503, body: '' }));
  await page.goto(ui + '/customers');
  await expect(page.getByRole('alert')).toContainText('A munkamenet ellenőrzése nem sikerült.');
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeTruthy();
  await page.unroute('**/api/Auth/me'); await page.getByRole('button', { name: 'Újrapróbálás' }).click();
  await expect(page).toHaveURL(ui + '/customers'); await expect(page.getByRole('button', { name: 'Új ügyfél' })).toBeVisible();
});
