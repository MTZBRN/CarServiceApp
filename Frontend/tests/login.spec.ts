import { test, expect } from '@playwright/test';

test('sikeres bejelentkezés folyamata', async ({ page }) => {
  // 1. Megnyitjuk a frontendet (Ellenőrizd, hogy a port tényleg 5173-e)
  await page.goto('http://localhost:5173');

  // 2. Kitöltjük a beviteli mezőket
  await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('admin123');

  // 3. Rákattintunk a belépés gombra
  await page.getByRole('button', { name: /belépés/i }).click();

  // 4. Ellenőrizzük az eredményt (például, hogy eltűnt-e a belépés gomb, vagy megjelent-e a kijelentkezés)
  // Ezt a sort majd igazítsd a sikeres belépés utáni felületedhez!
  // await expect(page).toHaveURL(/.*dashboard/);
});

test('sikeres bejelentkezés után kijelentkezik és visszatér a login képernyőre', async ({
  page,
}) => {
  await page.goto('http://localhost:5173');
  await page
    .getByPlaceholder('Felhasználónév (Email)')
    .fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('admin123');

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('Auth/login') &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: /belépés/i }).click(),
  ]);
  await expect(page.getByRole('button', { name: 'Kilépés' })).toBeVisible();

  await page.getByRole('button', { name: 'Kilépés' }).click(); await page.getByRole('dialog', { name: 'Kijelentkezés', exact: true }).getByRole('button', { name: 'Kijelentkezés', exact: true }).click();

  await expect(
    page.getByPlaceholder('Felhasználónév (Email)'),
  ).toBeVisible();
  await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
  await expect(page.getByRole('button', { name: /belépés/i })).toBeVisible();
});

test('hibás jelszó megadásakor hibaüzenetet jelenít meg', async ({ page }) => {
  await page.goto('http://localhost:5173');

  await page
    .getByPlaceholder('Felhasználónév (Email)')
    .fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('wrong-password');
  await page.getByRole('button', { name: /belépés/i }).click();

  await expect(
    page.getByText(/Hibás (jelszó|felhasználónév vagy jelszó)!/),
  ).toBeVisible();
});

test('üres mezőkkel nem küldi el a bejelentkezési űrlapot', async ({ page }) => {
  await page.goto('http://localhost:5173');

  const usernameInput = page.getByPlaceholder('Felhasználónév (Email)');
  const passwordInput = page.getByPlaceholder('Jelszó');

  await page.getByRole('button', { name: /belépés/i }).click();

  await expect(
    usernameInput.evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).resolves.toBe(true);
  await expect(
    passwordInput.evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).resolves.toBe(true);
  await expect(page.getByText('Hibás jelszó!')).not.toBeVisible();
});

test('admin teljes napi folyamata: új munka rögzítése a naptárban', async ({
  page,
}) => {
  const testDescription = `E2E napi munka ${Date.now()}`;

  await page.goto('http://localhost:5173');
  await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('admin123');

  const initialData = Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/Vehicle') && r.request().method() === 'GET'),
    page.waitForResponse(r => r.url().endsWith('/api/Appointments') && r.request().method() === 'GET'),
  ]);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('Auth/login') &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: /belépés/i }).click(),
  ]);
  await expect(page.getByRole('link', { name: 'Naptár' })).toBeVisible();

  await initialData;
  await page.getByRole('link', { name: 'Naptár' }).click();
  await expect(page.getByRole('heading', { name: /Szerviz Naptár/i })).toBeVisible();

  await page.getByRole('button', { name: 'Új időpont', exact: true }).click();

  const modal = page.locator('.modal-content').last();
  await expect(modal.getByRole('heading', { name: 'Új időpont' })).toBeVisible();

  const vehicleSelector = modal.getByRole('combobox', { name: 'Jármű *' });
  const vehicleLabel = await vehicleSelector.locator('option').nth(1).innerText();
  await vehicleSelector.selectOption({ index: 1 });

  await modal
    .getByPlaceholder('Pl. Kopogó hang a futómű felől...')
    .fill(testDescription);

  const appointmentResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/Appointments') &&
      response.request().method() === 'POST',
  );
  await modal.getByRole('button', { name: 'Mentés' }).click();
  await appointmentResponse;

  await expect(modal).not.toBeVisible();
  const vehiclePlate = vehicleLabel.split(" – ")[0];
  await expect(page.getByText(vehiclePlate, { exact: false }).last()).toBeVisible();
});
