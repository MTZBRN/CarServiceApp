import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { chooseLookup } from './lookup-helpers';

const api = 'http://localhost:5232/api';
const ui = 'http://localhost:5173';
const customer = { id: 95000, name: 'Lookup Customer', phoneNumber: '0612345678', email: 'lookup@example.invalid', address: null };
const vehicles = Array.from({ length: 65 }, (_, index) => ({ id: 95001 + index, licensePlate: `LOOK-${String(index).padStart(3, '0')}`, make: 'Toyota', model: 'Corolla', year: 2020, customerId: customer.id, customer }));
const responseHeaders = { 'Access-Control-Allow-Origin': ui, 'Access-Control-Expose-Headers': 'X-Total-Count,X-Page,X-Page-Size' };

async function login(page: Page, path = '/worksheets/new') {
  await page.goto(ui + path);
  await page.getByLabel('Felhasználónév (Email)', { exact: true }).fill('admin@test.com');
  await page.getByLabel('Jelszó', { exact: true }).fill('Admin-test-only-123');
  await page.getByRole('button', { name: /belépés/i }).click();
  await expect(page.getByRole('button', { name: 'Kilépés', exact: true })).toBeVisible();
}
async function admin(request: APIRequestContext) {
  const response = await request.post(api + '/Auth/login', { data: { email: 'admin@test.com', password: 'Admin-test-only-123' } });
  expect(response.ok()).toBeTruthy();
  return { Authorization: 'Bearer ' + (await response.json()).token };
}
async function mockVehicles(page: Page, hold?: (query: string) => Promise<void>) {
  const calls: URL[] = [];
  await page.route(url => url.pathname === '/api/Vehicle', async route => {
    const url = new URL(route.request().url());
    calls.push(url);
    const q = url.searchParams.get('q') ?? '';
    await hold?.(q);
    const rows = vehicles.filter(v => `${v.licensePlate} ${v.make} ${v.model} ${v.customer.name}`.toLowerCase().includes(q.toLowerCase()));
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('pageSize') ?? 50);
    await route.fulfill({ json: rows.slice((pageNumber - 1) * size, pageNumber * size), headers: { ...responseHeaders, 'X-Total-Count': String(rows.length), 'X-Page': String(pageNumber), 'X-Page-Size': String(size) } });
  });
  await page.route(/\/api\/Vehicle\/\d+$/, async route => {
    const row = vehicles.find(v => v.id === Number(route.request().url().split('/').pop()));
    await route.fulfill({ status: row ? 200 : 404, json: row ?? {}, headers: responseHeaders });
  });
  return calls;
}

test('vehicle and inventory searches preserve draft values, manual entry and stock', async ({ page, request }) => {
  const headers = await admin(request), tag = 'LOOKUP-' + Date.now();
  const owner = await (await request.post(api + '/Customers', { headers, data: { name: tag, phoneNumber: '123' } })).json();
  const vehicle = await (await request.post(api + '/Vehicle', { headers, data: { customerId: owner.id, licensePlate: tag, make: 'Toyota', model: 'Corolla', year: 2020 } })).json();
  const part = await (await request.post(api + '/parts', { headers, data: { name: 'Filter ' + tag, partNumber: tag, netPrice: 100, grossPrice: 127, stockQuantity: 7 } })).json();
  await login(page);
  const editor = page.getByRole('region', { name: 'Munkalap szerkesztő' });
  await chooseLookup(editor, 'Jármű *', vehicle.licensePlate);
  await expect(editor).toContainText(owner.name);
  await chooseLookup(editor, 'Cikktörzsből másolás', part.partNumber);
  await expect(editor.getByLabel('Megnevezés *', { exact: true })).toHaveValue(part.name);
  await expect(editor.getByLabel('Egységár (Ft) *', { exact: true })).toHaveValue('127');
  await editor.getByRole('button', { name: 'Tétel hozzáadása', exact: true }).click();
  await expect(editor.getByLabel('Megnevezés 1 *')).toHaveValue(part.name);
  const inventory = editor.getByRole('combobox', { name: 'Cikktörzsből másolás', exact: true });
  await expect(inventory).toHaveValue('Manuális tétel');
  await inventory.click();
  await editor.getByRole('option', { name: 'Manuális tétel', exact: true }).click();
  await expect(editor.getByLabel('Új cikkszám mentése a cikktörzsbe is')).toBeVisible();
  await editor.getByLabel('Megnevezés *', { exact: true }).fill('Manual gasket');
  await editor.getByRole('button', { name: 'Tétel hozzáadása', exact: true }).click();
  await expect(editor.getByLabel('Megnevezés 2 *')).toHaveValue('Manual gasket');
  const persisted = await (await request.get(api + '/parts', { headers, params: { partNumber: part.partNumber, pageSize: 1 } })).json();
  expect(persisted).toHaveLength(1);
  expect(persisted[0].id).toBe(part.id);
  expect(persisted[0].stockQuantity).toBe(7);
});

test('more results requests one bounded page, search resets to page one and selection survives closing', async ({ page }) => {
  const calls = await mockVehicles(page);
  await login(page);
  const input = page.getByRole('combobox', { name: 'Jármű *', exact: true });
  await input.click();
  const list = page.getByRole('listbox', { name: 'Jármű *', exact: true });
  await expect(list.getByRole('option')).toHaveCount(50);
  expect(await list.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.screenshot({ path: 'review-artifacts/searchable-lookup/results-desktop.png' });
  expect(calls).toHaveLength(1);
  await expect(page.getByRole('navigation', { name: 'Járművek' })).toHaveCount(0);
  await page.getByRole('button', { name: 'További találatok', exact: true }).click();
  await expect(list.getByRole('option')).toHaveCount(15);
  expect(calls.map(url => Number(url.searchParams.get('page') ?? 1))).toEqual([1, 2]);
  await list.getByRole('option').filter({ hasText: 'LOOK-064' }).click();
  await expect(input).toHaveValue('LOOK-064 · Toyota Corolla · Lookup Customer');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.fill('LOOK-063');
  await expect(list.getByRole('option')).toHaveCount(1);
  expect(calls.at(-1)?.searchParams.get('page') ?? '1').toBe('1');
  expect(calls.at(-1)?.searchParams.get('q')).toBe('LOOK-063');
  await input.press('Escape');
  await expect(input).toHaveValue('LOOK-064 · Toyota Corolla · Lookup Customer');
});

test('combobox supports keyboard selection, Escape, empty results and mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockVehicles(page);
  await login(page);
  const input = page.getByRole('combobox', { name: 'Jármű *', exact: true });
  await input.fill('LOOK-00');
  await expect(page.getByRole('listbox', { name: 'Jármű *', exact: true }).getByRole('option')).toHaveCount(10);
  await page.screenshot({ path: 'review-artifacts/searchable-lookup/results-mobile.png', fullPage: true });
  await input.press('ArrowDown');
  await input.press('ArrowDown');
  await input.press('ArrowUp');
  const activeId = await input.getAttribute('aria-activedescendant');
  expect(activeId).toBeTruthy();
  await expect(page.locator(`[id="${activeId}"]`)).toHaveText('LOOK-000 · Toyota Corolla · Lookup Customer');
  await input.press('Enter');
  await expect(input).toHaveValue('LOOK-000 · Toyota Corolla · Lookup Customer');
  await input.press('ArrowUp');
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await input.press('Escape');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.press('Tab');
  await expect(page.getByRole('link', { name: 'LOOK-000', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Munkalap dátuma *', { exact: true })).toBeFocused();
  await input.fill('no-such-vehicle');
  await expect(page.getByText('Nincs találat.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'review-artifacts/searchable-lookup/empty-mobile.png', fullPage: true });
});

test('loading and obsolete search responses cannot replace the current results', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const calls = await mockVehicles(page, q => q === 'LOOK-000' ? held : Promise.resolve());
  await login(page);
  const input = page.getByRole('combobox', { name: 'Jármű *', exact: true });
  await input.fill('LOOK-000');
  await expect.poll(() => calls.some(url => url.searchParams.get('q') === 'LOOK-000')).toBe(true);
  await expect(page.getByText('Találatok betöltése…', { exact: true })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(0);
  await input.fill('LOOK-064');
  await expect(page.getByRole('option')).toHaveText('LOOK-064 · Toyota Corolla · Lookup Customer');
  release();
  await page.getByRole('option').click();
  await expect(input).toHaveValue('LOOK-064 · Toyota Corolla · Lookup Customer');
});

test('customer lookup searches phone/email, retains selection and filters appointment vehicles', async ({ page }) => {
  await page.route(url => url.pathname === '/api/Customers', async route => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    const found = `${customer.name} ${customer.phoneNumber} ${customer.email}`.includes(q);
    await route.fulfill({ json: found ? [customer] : [], headers: { ...responseHeaders, 'X-Total-Count': found ? '1' : '0' } });
  });
  const calls = await mockVehicles(page);
  await login(page, '/vehicles');
  await page.getByRole('button', { name: 'Új jármű', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Új jármű', exact: true });
  await chooseLookup(modal, 'Ügyfél kiválasztása *', customer.phoneNumber, customer.name);
  const input = modal.getByRole('combobox', { name: 'Ügyfél kiválasztása *', exact: true });
  await expect(input).toHaveValue(customer.name);
  await input.fill(customer.email);
  await modal.getByRole('option', { name: customer.name, exact: true }).click();
  await expect(input).toHaveValue(customer.name);
  await modal.getByRole('button', { name: 'Mégse', exact: true }).click();
  await page.goto(ui + '/calendar');
  await page.getByRole('button', { name: 'Új időpont', exact: true }).click();
  const appointment = page.getByRole('dialog', { name: 'Új időpont', exact: true });
  await chooseLookup(appointment, 'Ügyfél szűrése', customer.email, customer.name);
  await expect.poll(() => calls.some(url => url.searchParams.get('customerId') === String(customer.id))).toBe(true);
  await chooseLookup(appointment, 'Jármű *', 'LOOK-064');
  await expect(appointment).toContainText(customer.phoneNumber);
  await expect(appointment.getByRole('navigation')).toHaveCount(0);
  const vehicleInput = appointment.getByRole('combobox', { name: 'Jármű *', exact: true });
  await vehicleInput.click();
  await expect(appointment.getByRole('listbox', { name: 'Jármű *', exact: true }).getByRole('option')).toHaveCount(50);
  const menu = await appointment.locator('.searchable-lookup-menu').boundingBox();
  const save = await appointment.getByRole('button', { name: 'Mentés', exact: true }).boundingBox();
  expect(menu).not.toBeNull(); expect(save).not.toBeNull();
  expect(menu!.y + menu!.height).toBeLessThanOrEqual(save!.y);
  await page.screenshot({ path: 'review-artifacts/searchable-lookup/appointment-desktop.png' });
  await vehicleInput.press('Escape');
});
