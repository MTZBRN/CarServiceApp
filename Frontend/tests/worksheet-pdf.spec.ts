import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const api = 'http://localhost:5232/api';
const cases = [
  { name: 'one-part', parts: 1, lines: 1, singlePage: true },
  { name: 'three-parts', parts: 3, lines: 1, singlePage: true },
  { name: 'long-description', parts: 3, lines: 80, singlePage: false },
  { name: 'many-parts', parts: 75, lines: 1, singlePage: false },
];

for (const fixture of cases) {
  test(`A4 worksheet PDF: ${fixture.name}`, async ({ page, request, context }, info) => {
    const login = await request.post(api + '/Auth/login', {
      data: { email: 'admin@test.com', password: 'Admin-test-only-123' },
    });
    expect(login.ok()).toBeTruthy();
    const headers = { Authorization: 'Bearer ' + (await login.json()).token };
    async function create(path: string, data: object) {
      const response = await request.post(api + path, { headers, data });
      expect(response.ok()).toBeTruthy();
      return response.json();
    }
    const customer = await create('/Customers', { name: 'PDF Test Customer', phoneNumber: '123456789' });
    const vehicle = await create('/Vehicle', {
      customerId: customer.id, licensePlate: 'PDF-' + fixture.name, make: 'Ford', model: 'Focus', year: 2020,
    });
    const jobParts = Array.from({ length: fixture.parts }, (_, index) => ({
      partName: `PDF-Part-${String(index + 1).padStart(3, '0')}`, quantity: 2, unitPrice: 137,
    }));
    const job = await create('/ServiceJobs', {
      vehicleId: vehicle.id, description: 'Original description', laborCost: 499, jobParts,
    });
    const lines = Array.from({ length: fixture.lines }, (_, index) =>
      `Edited work line ${String(index + 1).padStart(3, '0')}: inspect and verify.`);

    // Capture the real react-to-print document at window.print. Chromium PDF
    // generation targets a top-level page, so replay that document unchanged
    // except for serializing the live values of its native form controls.
    await page.addInitScript(() => {
      window.addEventListener('message', event => {
        if (event.origin === location.origin && event.data?.kind === 'worksheet-pdf') {
          (window as Window & { worksheetPdf?: string }).worksheetPdf = event.data.html;
        }
      });
      window.print = () => {
        const copy = document.documentElement.cloneNode(true) as HTMLElement;
        document.querySelectorAll('input, select, textarea').forEach((control, index) => {
          const target = copy.querySelectorAll('input, select, textarea')[index];
          if (control instanceof HTMLInputElement) target.setAttribute('value', control.value);
          if (control instanceof HTMLTextAreaElement) target.textContent = control.value;
          if (control instanceof HTMLSelectElement) {
            target.querySelectorAll('option').forEach((option, i) =>
              option.toggleAttribute('selected', i === control.selectedIndex));
          }
        });
        window.parent.postMessage({ kind: 'worksheet-pdf', html: '<!doctype html>' + copy.outerHTML }, window.parent.location.origin);
      };
    });
    await page.goto('/worksheets/' + job.id + '?print=1');
    await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
    await page.getByPlaceholder('Jelszó').fill('Admin-test-only-123');
    await page.getByRole('button', { name: /belépés/i }).click();
    const preview = page.getByRole('dialog', { name: 'Munkalap nyomtatási előnézet' });
    await preview.locator('input[value="PDF Test Customer"]').fill('Edited PDF Customer');
    await preview.locator('textarea').fill(lines.join('\n'));
    await preview.locator('select').first().selectOption('Hibrid');
    await preview.getByRole('button', { name: 'Nyomtatás', exact: true }).click();
    const snapshot = () => page.evaluate(() => (window as Window & { worksheetPdf?: string }).worksheetPdf);
    await expect.poll(snapshot).toContain('print-wrapper');

    const printable = await context.newPage();
    const path = info.outputPath(fixture.name + '.pdf');
    try {
      await printable.setContent((await snapshot())!);
      await printable.pdf({ path, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, scale: 1 });
    } finally {
      await printable.close();
    }
    const inspection = execFileSync(process.env.WORKSHEET_PDF_PYTHON || 'python', [
      '-c',
      'import json,sys; from pypdf import PdfReader; print(json.dumps([{"width":float(p.mediabox.width),"height":float(p.mediabox.height),"text":p.extract_text()} for p in PdfReader(sys.argv[1]).pages]))',
      path,
    ], { encoding: 'utf8' });
    const pages: { width: number; height: number; text: string }[] = JSON.parse(inspection);
    console.log(`${fixture.name}: ${pages.length} A4 PDF page(s)`);
    if (fixture.singlePage) expect.soft(pages).toHaveLength(1);
    else expect.soft(pages.length).toBeGreaterThan(1);
    for (const pdfPage of pages) {
      expect.soft(Math.abs(pdfPage.width - 595.28)).toBeLessThan(2);
      expect.soft(Math.abs(pdfPage.height - 841.89)).toBeLessThan(2);
      expect.soft(pdfPage.text.trim()).not.toBe('');
    }
    const content = pages.map(p => p.text).join('\n').replace(/\s+/g, ' ');
    for (const value of [
      'GTA-', 'MUNKALAP', 'Kelt:', 'MEGRENDELŐ', 'VÁLLALKOZÁS', 'JÁRMŰ ADATOK',
      'Km óra:', 'Hibrid', 'Szint:', 'Tartozékok / Egyéb:', 'Sérülés:', 'Hibaleírás / Megrendelt munka:',
      'Átadott anyagok:', 'Vállalási határidő:', 'Várható javítási költség', 'Megrendelő nyilatkozata:',
      'A jármű fenti munkáit megrendelem és átadom:', '(megrendelő)', '(vállalkozó képviselője)',
      'Edited PDF Customer', 'Munkadíj', '499 Ft', 'Végösszeg',
      new Intl.NumberFormat('hu-HU').format(fixture.parts * 274 + 499).replace(/\s+/g, ' ') + ' Ft',
      ...lines, ...jobParts.map(part => part.partName),
    ]) expect.soft(content).toContain(value);
    expect.soft(content).not.toMatch(/localhost|127\.0\.0\.1|Original description|PDF Test Customer/);
    const ordering = pages.find(p => p.text.includes('A járművet átvettem:'));
    expect.soft(ordering?.text).toContain('(vállalkozó képviselője)');
    const handover = pages.find(p => p.text.includes('Az elvégzett munka megfelelő'));
    expect.soft(handover?.text).toContain('Átadó:');
    expect.soft(handover?.text).toContain('Átvevő:');
    const totals = pages.find(p => p.text.includes('Alkatrészek összesen'));
    expect.soft(totals?.text).toContain('Végösszeg');
    if (fixture.name === 'many-parts') {
      for (const p of pages.filter(p => /PDF-Part-\d{3}/.test(p.text))) {
        expect.soft(p.text).toContain('Mennyiség');
      }
    }
  });
}
