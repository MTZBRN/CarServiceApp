import {test,expect} from '@playwright/test';

test('logout clears local identity even when server revocation is unavailable',async({page})=>{
  await page.goto('/login');
  await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');
  await page.getByPlaceholder('Jelszó').fill('Admin-test-only-123');
  await page.getByRole('button',{name:/belépés/i}).click();
  await expect(page.getByRole('link',{name:'Ügyfelek',exact:true})).toBeVisible();
  let requested=false;
  await page.route('**/api/Auth/logout',async route=>{requested=true;await route.fulfill({status:503,body:'Unavailable'});});
  await page.getByRole('button',{name:'Kilépés',exact:true}).click();
  await page.getByRole('dialog',{name:'Kijelentkezés',exact:true}).getByRole('button',{name:'Kijelentkezés',exact:true}).click();
  await expect(page.getByPlaceholder('Jelszó')).toBeVisible();
  await expect.poll(()=>requested).toBe(true);
  expect(await page.evaluate(()=>['authToken','userRole','user_data','currentUser'].every(k=>localStorage.getItem(k)===null))).toBe(true);
});
