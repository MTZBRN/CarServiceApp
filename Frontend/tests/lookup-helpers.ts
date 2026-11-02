import { expect, type Locator, type Page } from '@playwright/test';

export async function chooseLookup(scope: Page | Locator, label: string, query: string, resultText = query) {
  const input = scope.getByRole('combobox', { name: label, exact: true });
  await input.fill(query);
  const option = scope.getByRole('option').filter({ hasText: resultText });
  await expect(option).toHaveCount(1);
  await option.click();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
}
