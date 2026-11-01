import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
const api='http://localhost:5232/api',ui='http://localhost:5173';
async function admin(request:APIRequestContext){const response=await request.post(api+'/Auth/login',{data:{email:'admin@test.com',password:'Admin-test-only-123'}});expect(response.ok()).toBeTruthy();return {Authorization:'Bearer '+(await response.json()).token};}
async function login(page:Page,email='admin@test.com',password='Admin-test-only-123'){await page.goto(ui+'/audit');await page.getByLabel('Felhasználónév (Email)',{exact:true}).fill(email);await page.getByLabel('Jelszó',{exact:true}).fill(password);await page.getByRole('button',{name:/belépés/i}).click();await expect(page.getByRole('button',{name:'Kilépés',exact:true})).toBeVisible();}

test('admin reads recent business audit with filters and paging',async({page,request})=>{
 const headers=await admin(request);let last=0;
 for(let i=0;i<55;i++){const response=await request.post(api+'/Customers',{headers,data:{name:'Audit-private-'+Date.now()+'-'+i,phoneNumber:'123'}});expect(response.ok()).toBeTruthy();last=(await response.json()).id;}
 await login(page);await expect(page.getByRole('heading',{name:'Eseménynapló',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Eseménynapló',exact:true})).toHaveAttribute('href','/audit');
 await page.getByLabel('Esemény (pl. Worksheet.Completed)',{exact:true}).fill('Customer.Created');
 const pager=page.getByRole('navigation',{name:'Lapozás',exact:true});await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);await expect(page.getByRole('table')).toContainText('Customer.Created');
 await pager.getByRole('button',{name:'Következő oldal',exact:true}).click();await expect(pager).toContainText('2. oldal');await expect(page.getByRole('table').locator('tbody tr').first()).not.toContainText('Customer #'+last);
 await page.getByLabel('Rekord azonosítója',{exact:true}).fill(String(last));await expect(pager).toContainText('1. oldal / 1 · 1 találat');await expect(page.getByRole('table')).toContainText('Customer #'+last);await expect(page.getByRole('table')).not.toContainText('Audit-private');
});

test('mechanic cannot open audit page or fetch audit records',async({page,request})=>{
 const headers=await admin(request),email='audit-worker-'+Date.now();expect((await request.post(api+'/Users',{headers,data:{name:'Audit mechanic',email,password:'Mechanic-test-only-123',role:'mechanic'}})).ok()).toBeTruthy();
 const signed=await request.post(api+'/Auth/login',{data:{email,password:'Mechanic-test-only-123'}});const token=(await signed.json()).token;expect((await request.get(api+'/Audit',{headers:{Authorization:'Bearer '+token}})).status()).toBe(403);
 await login(page,email,'Mechanic-test-only-123');await expect(page.getByRole('link',{name:'Eseménynapló',exact:true})).toHaveCount(0);await expect(page.getByRole('table',{name:'Eseménynapló'})).toHaveCount(0);await expect(page.getByText('Nincs jogosultságod',{exact:false})).toBeVisible();
});

test('audit metadata stays text and mobile has no document overflow',async({page})=>{
 const malicious='<img src=x onerror="window.auditExecuted=true">';
 await page.route(url=>url.pathname==='/api/Audit',route=>route.fulfill({json:[{id:9,timestampUtc:'2026-11-01T12:00:00Z',actorUserId:1,actorName:malicious,actorRole:'admin',action:'Customer.Created',resourceType:'Customer',resourceId:10,outcome:'Success',details:malicious,traceId:'fixture'}],headers:{'X-Total-Count':'1'}}));
 await page.setViewportSize({width:390,height:844});await login(page);const table=page.getByRole('table',{name:'Eseménynapló'});await expect(table).toBeVisible();await expect(table.locator('code')).toHaveText(malicious);await expect(table.locator('img')).toHaveCount(0);expect(await page.evaluate(()=>Object.hasOwn(window,'auditExecuted'))).toBe(false);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
