import { test, expect, type Page } from '@playwright/test';
const ui = 'http://localhost:5173';
const api = 'http://localhost:5232/api';
async function login(page: Page) {
  await page.goto(ui + '/login');
  await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('Admin-test-only-123');
  await page.getByRole('button', { name: /belépés/i }).click();
  await expect(page.getByRole('button', { name: 'Kilépés' })).toBeVisible();
}
async function settleCore(page: Page) {
  await page.evaluate(async () => {
    const { customersApi } = await import('/src/api/customers.ts');
    // This explicit transport request is only a barrier; count assertions are started afterward.
    await customersApi.list();
  });
}
test('shared consumers reuse lists and mutations refresh only affected resources', async ({ page }) => {
  const counts: Record<string, number> = {};
  page.on('request', req => {
    if (req.method() === 'GET' && req.url().startsWith(api)) {
      const resource = new URL(req.url()).pathname.slice(5);
      counts[resource] = (counts[resource] || 0) + 1;
    }
  });
  await login(page);
  await expect.poll(() => counts.Vehicle).toBe(1);
  await expect.poll(()=>counts.Dashboard).toBe(1);
  expect(counts.Customers||0).toBe(0);expect(counts.Appointments||0).toBe(0);
  await page.getByRole('link', { name: 'Járművek', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Járművek', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Ügyfelek', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Új ügyfél' })).toBeVisible();
  await expect.poll(()=>counts.Customers).toBe(1);expect(counts.Vehicle).toBe(1);expect(counts.Appointments||0).toBe(0);
  // Bounded dashboard summary replaces full-table inventory/worksheet/appointment preload.
  expect(counts.parts||0).toBe(0);expect(counts.Users||0).toBe(0);expect(counts.ServiceJobs||0).toBe(0);expect(counts.Dashboard).toBe(1);
  const before = { ...counts };
  const name = 'Shared ' + Date.now();
  const id = await page.evaluate(async name => {
    const { customersApi } = await import('/src/api/customers.ts');
    return (await customersApi.create({ name, phoneNumber: '123' })).data.id;
  }, name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  expect(counts.Customers).toBe(before.Customers + 1); expect(counts.Vehicle).toBe(before.Vehicle); expect(counts.Appointments||0).toBe(before.Appointments||0);
  await page.evaluate(async ({ id, name }) => {
    const { customersApi } = await import('/src/api/customers.ts');
    await customersApi.update(id, { name: name + ' edited', phoneNumber: '456' });
  }, { id, name });
  await expect(page.getByText(name + ' edited', { exact: true })).toBeVisible();
  expect(counts.Customers).toBe(before.Customers + 2); expect(counts.Vehicle).toBe(before.Vehicle + 1); expect(counts.Appointments||0).toBe(before.Appointments||0);
  await page.getByRole('link', { name: 'Alkatrészek', exact: true }).click();
  await expect.poll(() => counts.parts).toBe(1);
  const inventoryBefore = { ...counts };
  await page.evaluate(async suffix => {
    const { inventoryApi } = await import('/src/api/inventory.ts');
    await inventoryApi.create({ name: 'Shared part ' + suffix, partNumber: suffix, netPrice: 100, grossPrice: 127, stockQuantity: 1 });
  }, String(Date.now()));
  expect(counts.parts).toBe(inventoryBefore.parts + 1);
  expect(counts.Customers).toBe(inventoryBefore.Customers); expect(counts.Vehicle).toBe(inventoryBefore.Vehicle); expect(counts.Appointments||0).toBe(inventoryBefore.Appointments||0);
});

test('failed mutation leaves shared records and request counts unchanged', async ({ page }) => {
  await login(page); await settleCore(page);
  const calls: string[] = [];
  page.on('request', req => { if (req.method() === 'GET' && req.url().startsWith(api)) calls.push(req.url()); });
  await page.route('**/api/Customers', route => route.request().method() === 'POST' ? route.fulfill({ status: 500, body: 'Failed' }) : route.continue());
  const result = await page.evaluate(async () => {
    const { customersApi } = await import('/src/api/customers.ts');
    try { await customersApi.create({ name: 'Must not appear', phoneNumber: '1' }); return 'saved'; } catch { return 'failed'; }
  });
  expect(result).toBe('failed'); expect(calls).toEqual([]);
  await page.getByRole('link', { name: 'Ügyfelek', exact: true }).click();
  await expect(page.getByText('Must not appear', { exact: true })).toHaveCount(0);
});

for (const status of [200, 401]) {
test(`logout cancels a delayed ${status} response before a second session`, async ({ page }) => {
  let release!: () => void;
  let captured!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { captured = resolve; });
  let first = true;
  const vehicle = (licensePlate: string) => ({ id: 990001, customerId: 1, licensePlate, make: 'Ford', model: 'Focus', year: 2020 });
  await page.route('**/api/Vehicle', async route => {
    if (first) {
      first = false; captured(); await held;
      await route.fulfill(status === 200 ? { json: [vehicle('PREVIOUS-USER')] } : { status: 401, body: '' }).catch(() => {});
    } else await route.fulfill({ json: [vehicle('CURRENT-USER')] });
  });
  await login(page); await started;
  await page.getByRole('button', { name: 'Kilépés' }).click(); await page.getByRole('dialog', { name: 'Kijelentkezés', exact: true }).getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
  await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('Admin-test-only-123'); await page.getByRole('button', { name: /belépés/i }).click();
  await page.getByRole('link', { name: 'Járművek', exact: true }).click();
  await expect(page.getByText('CURRENT-USER', { exact: true })).toBeVisible();
  release();
  // A completed current-session request gives the released old response time to be processed.
  await settleCore(page);
  await expect(page.getByText('PREVIOUS-USER', { exact: true })).toHaveCount(0);
  await expect(page.getByText('CURRENT-USER', { exact: true })).toBeVisible();
});

}

test('shared resource failure supports retry and preserves data during a failed refresh', async ({ page }) => {
  await page.goto(ui + '/login');
  await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
  await page.evaluate(async () => {
    localStorage.setItem('authToken', 'test-session');
    const {resetApiSession} = await import('/src/api/client.ts');
    resetApiSession();
  });
  let calls = 0;
  await page.route('**/api/Auth/me', route => route.fulfill({ json: { userName: 'Test', role: 'admin' } }));
  await page.route('**/api/Customers', route => {
    calls++;
    return calls === 2 ? route.fulfill({ json: [{ id: 1, name: 'Recovered', phoneNumber: '1', email: null, address: null }] }) : route.fulfill({ status: 503, body: 'Unavailable' });
  });
  const states = await page.evaluate(async () => {
    const { createWorkshopStore } = await import('/src/data/workshopStore.ts');
    const resource = createWorkshopStore().resources.customers;
    const result = [];
    const state = () => { const s = resource.snapshot(); return { loading: s.loading, error: !!s.error, names: s.data.map((c: { name: string }) => c.name) }; };
    const first = resource.load();
    result.push(state());
    await first; result.push(state());
    await resource.refresh(); result.push(state());
    await resource.refresh(); result.push(state());
    return result;
  });
  expect(states).toEqual([
    { loading: true, error: false, names: [] },
    { loading: false, error: true, names: [] },
    { loading: false, error: false, names: ['Recovered'] },
    { loading: false, error: true, names: ['Recovered'] },
  ]);
  expect(calls).toBe(3);
});


test('a mutation refresh wins over an older in-flight list response', async ({ page }) => {
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const captured = new Promise<void>(resolve => { started = resolve; });
  const vehicle = { id: 990002, customerId: 1, licensePlate: 'LATEST-LIST', make: 'Ford', model: 'Focus', year: 2020 };
  let reads = 0;
  await page.route('**/api/Vehicle', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, json: vehicle });
    if (++reads === 1) { started(); await held; return route.fulfill({ json: [] }).catch(() => {}); }
    return route.fulfill({ json: [vehicle] });
  });
  await login(page); await captured;
  await page.evaluate(async vehicle => {
    const { vehiclesApi } = await import('/src/api/vehicles.ts');
    await vehiclesApi.create(vehicle);
  }, vehicle);
  await page.getByRole('link', { name: 'Járművek', exact: true }).click();
  await expect(page.getByText('LATEST-LIST', { exact: true })).toBeVisible();
  const oldResponse = page.waitForResponse(response => response.url().endsWith('/api/Vehicle') && response.request().method() === 'GET');
  release(); await oldResponse; await settleCore(page);
  await expect(page.getByText('LATEST-LIST', { exact: true })).toBeVisible();
  expect(reads).toBe(2);
});
