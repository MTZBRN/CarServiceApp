import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

import { chooseLookup } from './lookup-helpers';

const api = 'http://localhost:5232/api';
const cases = [
  { name: 'one-part', parts: 1, lines: 1, twoPages: true },
  { name: 'legacy-labor-only', parts: 0, lines: 1, twoPages: true },
  { name: 'three-parts', parts: 3, lines: 1, twoPages: true },
  { name: 'long-description', parts: 3, lines: 80, twoPages: false },
  { name: 'long-company', parts: 1, lines: 1, twoPages: false },
  { name: 'many-parts', parts: 75, lines: 1, twoPages: false },
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
    const customer = await create('/Customers', { name: 'PDF Test Customer', phoneNumber: '5550179' });
    const vehicle = await create('/Vehicle', {
      customerId: customer.id, licensePlate: 'PDF-' + fixture.name, make: 'Ford', model: 'Focus', year: 2020,
    });
    const jobParts = Array.from({ length: fixture.parts }, (_, index) => ({
      partName: `PDF-Part-${String(index + 1).padStart(3, '0')}`, quantity: 2, unitPrice: 137,
    }));
    const previousSettings = await (await request.get(api + '/Settings', { headers })).json();
    const settingsA = await create('/Settings', { companyName: 'Fixture Garage A', version: previousSettings.version });
    const captured = fixture.name === 'one-part';
    const legacy = fixture.name === 'legacy-labor-only';
    const km = legacy ? '' : fixture.name === 'three-parts' ? '0' : '84621';
    const company = fixture.name === 'long-company' ? {
      companyName: 'W'.repeat(200), address: 'R'.repeat(500), phone: '7'.repeat(50),
      taxNumber: '8'.repeat(50), email: 'w'.repeat(64)+'@'+'w'.repeat(63)+'.'+'w'.repeat(63)+'.'+'w'.repeat(61),
    } : { companyName:'Fixture Garage B' };
    if (captured) await create('/parts', { partNumber:'FIX-137', name:'PDF-Part-001', netPrice:93, grossPrice:137, stockQuantity:8 });
    const job = await create('/ServiceJobs', {
      vehicleId: vehicle.id, isCompleted: captured, description: 'Original description', laborCost: 499, jobParts: captured ? [] : jobParts,
    });
    await create('/Settings', { ...company, version: settingsA.version });
    if (captured || legacy) await page.route('**/api/Settings*', route => route.abort());
    if (legacy) await page.route('**/api/ServiceJobs/' + job.id, route =>
      route.fulfill({ json: { ...job, isCompleted: true, companyHistory: 'HistoricalUnavailable', companySnapshot: null } }));
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
    await page.goto('/worksheets/' + job.id + (legacy ? '?print=1' : ''));
    await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
    await page.getByPlaceholder('Jelszó').fill('Admin-test-only-123');
    await page.getByRole('button', { name: /belépés/i }).click();
    if (!legacy) {
      await expect(page.getByLabel('Km óra (km)')).toHaveValue('');
      await expect(page.getByLabel('Üzemanyag', { exact:true })).toHaveValue('');
      if (captured) {
        await chooseLookup(page, 'Cikktörzsből másolás', 'FIX-137');
        await page.getByLabel('Mennyiség *',{ exact:true }).fill('2');
        await page.getByRole('button',{ name:'Tétel hozzáadása' }).click();
      }
      await page.getByLabel('Km óra (km)').fill(km);
      await page.getByLabel('Üzemanyag', { exact:true }).selectOption('diesel');
      await page.getByTestId('save-worksheet').click();
      await expect(page.getByText('Nincs nem mentett módosítás')).toBeVisible();
      await page.reload();
      await expect(page.getByLabel('Km óra (km)')).toHaveValue(km);
      await expect(page.getByLabel('Üzemanyag', { exact:true })).toHaveValue('diesel');
      if (captured) {
        // Exercise the customer print boundary even if a future detail response gains supplier metadata.
        await page.route('**/api/ServiceJobs/'+job.id, async route => {
          const response = await route.fetch();
          const detail = await response.json();
          const parts = detail.jobParts.map((part:object)=>({...part,purchaseCost:93,supplierDiscount:'17.35%',margin:'31.79%'}));
          await route.fulfill({response,json:{...detail,jobParts:parts}});
        });
      }
      await page.getByRole('button', {name:'Nyomtatás',exact:true}).click();
    }
    const preview = page.getByRole('dialog', { name: 'Munkalap nyomtatási előnézet' });
    await preview.locator('input[value="PDF Test Customer"]').fill('Edited PDF Customer');
    await preview.locator('textarea').fill(lines.join('\n'));
    await preview.getByRole('button', { name: 'Nyomtatás', exact: true }).click();
    const snapshot = () => page.evaluate(() => (window as Window & { worksheetPdf?: string }).worksheetPdf);
    await expect.poll(snapshot).toContain('print-wrapper');

    const printable = await context.newPage();
    const path = info.outputPath(fixture.name + '.pdf');
    try {
      await printable.setContent((await snapshot())!);
      await printable.emulateMedia({media:'print'});
      // 210 mm A4 minus the two 10 mm page margins, at 96 CSS pixels/inch.
      await printable.setViewportSize({ width: Math.round(190 * 96 / 25.4), height: 1047 });
      const bounds = await printable.locator('.print-company-table').evaluate(table => {
        const box = table.getBoundingClientRect();
        const cell = (table as HTMLTableElement).rows[1].cells[1];
        const cellBox = cell.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(cell);
        return { right:box.right, available:document.documentElement.clientWidth, fraction:cellBox.width/box.width,
          overflow:Array.from(range.getClientRects()).some(r=>r.left<cellBox.left-1 || r.right>cellBox.right+1) };
      });
      expect(bounds.right).toBeLessThanOrEqual(bounds.available+1);
      expect(bounds.fraction).toBeCloseTo(0.5,1);
      expect(bounds.overflow).toBe(false);
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
    if (fixture.twoPages) expect.soft(pages).toHaveLength(2);
    else expect.soft(pages.length).toBeGreaterThan(1);
    for (const pdfPage of pages) {
      expect.soft(Math.abs(pdfPage.width - 595.28)).toBeLessThan(2);
      expect.soft(Math.abs(pdfPage.height - 841.89)).toBeLessThan(2);
      expect.soft(pdfPage.text.trim()).not.toBe('');
    }
    const content = pages.map(p => p.text).join('\n').replace(/\s+/g, ' ');
    for (const value of [
      'GTA-', 'MUNKALAP', 'Kelt:', 'MEGRENDELŐ', 'VÁLLALKOZÁS', 'JÁRMŰ ADATOK',
      'Km óra:', ...(legacy ? ['A korábbi cégadatok nem állnak rendelkezésre.'] : ['Dízel']), 'Szint:', 'Tartozékok / Egyéb:', 'Sérülés:', 'Hibaleírás / Megrendelt munka:',
      'Átadott anyagok:', 'Vállalási határidő:', 'Várható javítási költség', 'Megrendelő nyilatkozata:',
      'A jármű fenti munkáit megrendelem és átadom:', '(megrendelő)', '(vállalkozó képviselője)',
      'Edited PDF Customer', 'Munkadíj', '499 Ft', 'Végösszeg',
      new Intl.NumberFormat('hu-HU').format(fixture.parts * 274 + 499).replace(/\s+/g, ' ') + ' Ft',
      ...lines, ...jobParts.map(part => part.partName),
    ]) expect.soft(content).toContain(value);
    expect.soft(content).not.toMatch(/localhost|127\.0\.0\.1|Original description|PDF Test Customer/);
    const kmField = pages[0].text.match(/Km óra:\s*(\d*)\s*km\s+Üzemanyag:\s*(.*?)\s*Szint:/s);
    expect(kmField?.slice(1)).toEqual([km, legacy ? '' : 'Dízel']);
    if (!legacy) expect(content.replace(/\s/g,'')).toContain((captured ? 'Fixture Garage A' : company.companyName).replace(/\s/g,''));
    if (fixture.name === 'long-company') {
      for (const value of Object.values(company)) expect(content.replace(/\s/g,'')).toContain(value);
    }
    const costText = pages.slice(1).map(p=>p.text).join(' ').replace(/\s+/g,' ');
    for (const part of jobParts) {
      expect(costText).toContain(part.partName+' · '+(captured ? 'FIX-137' : '—')+' 2 137 Ft 274 Ft');
    }
    expect(costText).toContain('Munkadíj 499 Ft');
    const total = new Intl.NumberFormat('hu-HU').format(fixture.parts * 274 + 499).replace(/\s/g,' ');
    expect(costText).toContain('Végösszeg '+total+' Ft');
    expect(content).not.toMatch(/\b93 Ft|beszerzési|kedvezmény|árrés|purchase cost|discount|margin|17[.,]35|31[.,]79/i);
    expect(content).not.toContain(captured ? 'Fixture Garage B' : 'Fixture Garage A');
    if (legacy) expect(content).not.toContain('Fixture Garage B');
    const costStart = pages.findIndex(p => p.text.includes('Egységár'));
    expect(costStart).toBeGreaterThan(pages.findIndex(p => p.text.includes('Átvevő:')));
    if (fixture.twoPages) expect(costStart).toBe(1);
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
