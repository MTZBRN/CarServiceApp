import { expect, type APIRequestContext } from '@playwright/test';

export async function ensureWorkshopCompany(request: APIRequestContext, api: string, headers: Record<string,string>) {
  const response = await request.get(api + '/Settings', { headers });
  expect(response.ok()).toBeTruthy();
  const current = await response.json();
  if (!current.companyName?.trim()) {
    const saved = await request.post(api + '/Settings', { headers, data: { ...current, companyName: 'Fixture Workshop' } });
    expect(saved.ok()).toBeTruthy();
    return 'Fixture Workshop';
  }
  return current.companyName as string;
}
