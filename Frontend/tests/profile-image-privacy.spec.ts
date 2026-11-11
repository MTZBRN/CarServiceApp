import { test, expect } from '@playwright/test';

test('production profile images use authenticated reads and never reappear after logout', async ({ page, request }) => {
  const origin = 'http://localhost:15232'; // Fresh local Production fixture, never a deployed service.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==', 'base64');
  const reads: { url: string; authorization: string | undefined }[] = [];
  page.on('request', req => {
    if (new URL(req.url()).pathname.startsWith('/api/ProfileImages/'))
      reads.push({ url: req.url(), authorization: req.headers()['authorization'] });
  });
  await page.goto(origin + '/settings');
  await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('Admin-test-only-123');
  await page.getByRole('button', { name: /belépés/i }).click();
  await page.getByLabel('Új profilkép', { exact: true }).setInputFiles({ name: 'fictional.png', mimeType: 'image/png', buffer: png });
  const uploaded = page.waitForResponse(r => r.url().endsWith('/Auth/upload-profile-picture'));
  await page.getByRole('button', { name: 'Kép mentése' }).click();
  const legacyPath = (await (await uploaded).json()).filePath as string;
  const photo = page.getByRole('img', { name: 'Saját profilkép' });
  await expect(photo).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.shell-avatar img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  const token = await page.evaluate(() => localStorage.getItem('authToken'));
  expect(reads.length).toBeGreaterThan(0);
  for (const read of reads) {
    expect(read.authorization).toBe('Bearer ' + token);
    expect(new URL(read.url).search).toBe('');
    expect(read.url).not.toContain(token!);
  }
  const anonymous = await request.get(origin + legacyPath);
  expect(anonymous.status()).toBe(401);
  expect(anonymous.headers()['cache-control']).toBe('no-store');
  await page.reload();
  await expect(photo).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // A response already in flight must not restore an image after the identity is cleared.
  let intercepted = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/ProfileImages/**', async route => {
    intercepted++;
    await pending;
    await route.fulfill({ status: 200, contentType: 'image/png', body: png }).catch(() => {});
  });
  await page.reload();
  await expect.poll(() => intercepted).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Kilépés', exact: true }).click();
  const revoked = page.waitForResponse(r => new URL(r.url()).pathname === '/api/Auth/logout');
  await page.getByRole('dialog', { name: 'Kijelentkezés', exact: true }).getByRole('button', { name: 'Kijelentkezés', exact: true }).click();
  expect((await revoked).ok()).toBeTruthy();
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
  await expect(page.locator('img[src^="data:image/"]')).toHaveCount(0);
  expect((await request.get(origin + legacyPath, { headers: { Authorization: 'Bearer ' + token } })).status()).toBe(401);
});
