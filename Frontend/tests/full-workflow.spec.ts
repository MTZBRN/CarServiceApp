import { test, expect } from '@playwright/test';

test('teljes admin workflow ügyféltől a munkalapig', async ({ page }) => {
  const suffix = Date.now();
  const customerName = `E2E Ügyfél ${suffix}`;
  const phoneNumber = '+36 30 555 0101';
  const email = `e2e.${suffix}@example.com`;
  const licensePlate = `E2E-${String(suffix).slice(-3)}`;
  const vehicleMake = 'Toyota';
  const vehicleModel = 'Corolla';
  const jobDescription = `E2E szervizmunka ${suffix}`;
  const partNumber = `E2E-${suffix}`;
  const partName = 'E2E motorolaj';
  const partPrice = '12500';

  await page.goto('http://localhost:5173');
  await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('admin123');
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('Auth/login') &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: /belépés/i }).click(),
  ]);

  await page.getByRole('link', { name: 'Ügyfelek' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ügyfelek', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Új ügyfél' }).click();

  const customerModal = page.locator('.modal-content').last();
  await customerModal.getByPlaceholder('Teljes név').fill(customerName);
  await customerModal.getByPlaceholder('+36 30 123 4567').fill(phoneNumber);
  await customerModal.getByPlaceholder('pelda@email.hu').fill(email);
  await customerModal
    .getByPlaceholder('Település, Utca, Házszám')
    .fill('Budapest, E2E utca 1.');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/Customers') &&
        response.request().method() === 'POST',
    ),
    customerModal.getByRole('button', { name: /ügyfél létrehozása/i }).click(),
  ]);
  await expect(customerModal).not.toBeVisible();
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Járművek' }).click();
  await expect(
    page.getByRole('heading', { name: 'Járművek', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Új jármű' }).click();

  const vehicleModal = page.locator('.modal-content').last();
  await vehicleModal.getByRole('combobox').selectOption({ label: customerName });

  await vehicleModal.getByPlaceholder('ABC-123').fill(licensePlate);
  await vehicleModal.getByPlaceholder('Toyota').fill(vehicleMake);
  await vehicleModal.getByPlaceholder('Corolla').fill(vehicleModel);
  await vehicleModal.getByRole('spinbutton').first().fill('2022');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/Vehicle') &&
        response.request().method() === 'POST',
    ),
    vehicleModal.getByRole('button', { name: 'Mentés', exact: true }).click(),
  ]);
  await expect(vehicleModal).not.toBeVisible();
  await expect(page.getByText(licensePlate, { exact: true })).toBeVisible();
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();

  const vehicleCard = page
    .getByRole('row')
    .filter({ hasText: licensePlate })
    .first();
  await vehicleCard.getByRole('button', { name: 'Új munkalap' }).click();

  await expect(page).toHaveURL(/\/worksheets\/new\?vehicleId=/);
  const worksheetModal = page.getByRole('region', { name: 'Munkalap szerkesztő' });
  await expect(worksheetModal.getByText(licensePlate, { exact: true })).toBeVisible();
  await worksheetModal.getByLabel('Munka leírása *').fill(jobDescription);

  await worksheetModal.getByPlaceholder('Cikkszám').fill(partNumber);
  await worksheetModal.getByPlaceholder('Megnevezés').fill(partName);
  await worksheetModal.getByLabel('Egységár (Ft) *', { exact: true }).fill(partPrice);
  await worksheetModal.getByLabel('Új cikkszám mentése a cikktörzsbe is').check();
  await worksheetModal.getByLabel('Új cikktörzs-tétel nettó ára (Ft) *').fill('10000');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/parts') &&
        response.request().method() === 'POST',
    ),
    worksheetModal
      .getByRole('button', { name: 'Tétel hozzáadása' })
      .click(),
  ]);
  await expect(worksheetModal.getByLabel('Cikkszám 1')).toHaveValue(partNumber);
  await expect(worksheetModal.getByLabel('Megnevezés 1 *')).toHaveValue(partName);

  const serviceJobRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname.endsWith('/api/ServiceJobs') &&
      request.method() === 'POST',
  );
  const serviceJobResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/api/ServiceJobs') &&
      response.request().method() === 'POST',
  );
  await worksheetModal.getByTestId('save-worksheet').click();
  await serviceJobRequest;
  const savedServiceJobResponse = await serviceJobResponse;
  expect(savedServiceJobResponse.ok()).toBeTruthy();
  const savedJob = await savedServiceJobResponse.json();
  await expect(page).toHaveURL(new RegExp('/worksheets/' + savedJob.id + '$'));
  await worksheetModal.getByRole('link', { name: licensePlate }).click();
  await expect(page.getByText(jobDescription, { exact: true })).toBeVisible();
  await expect(page.getByText(partNumber, { exact: false })).toBeVisible();
  await expect(page.getByText(partName, { exact: false })).toBeVisible();
});
