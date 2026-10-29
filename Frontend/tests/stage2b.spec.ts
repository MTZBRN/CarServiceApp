import {test,expect,type Page,type APIRequestContext} from '@playwright/test';
const api='http://localhost:5232/api';
async function login(page:Page,email='admin@test.com') {
 await page.goto('/login');await page.getByLabel('Felhasználónév (Email)',{exact:true}).fill(email);
 await page.getByLabel('Jelszó',{exact:true}).fill('Admin-test-only-123');await page.getByRole('button',{name:/belépés/i}).click();
 await expect(page.getByRole('link',{name:'Ügyfelek',exact:true})).toBeVisible();
}
async function fixture(request:APIRequestContext) {
 const login=await request.post(api+'/Auth/login',{data:{email:'admin@test.com',password:'Admin-test-only-123'}});expect(login.ok()).toBeTruthy();
 const headers={Authorization:'Bearer '+(await login.json()).token};const suffix=Date.now();
 const c=await(await request.post(api+'/Customers',{headers,data:{name:'Concurrency '+suffix,phoneNumber:'123'}})).json();
 const v=await(await request.post(api+'/Vehicle',{headers,data:{customerId:c.id,licensePlate:'CC-'+suffix,make:'Ford',model:'Focus',year:2020}})).json();
 const j=await request.post(api+'/ServiceJobs',{headers,data:{vehicleId:v.id,description:'Concurrency '+suffix}});expect(j.ok()).toBeTruthy();
 return {headers,job:await j.json(),suffix};
}
test('two worksheet forms cannot silently overwrite a newer save',async({page,context,request})=>{
 const f=await fixture(request);await login(page);await page.goto('/worksheets/'+f.job.id);
 const second=await context.newPage();await second.goto('/worksheets/'+f.job.id);
 await expect(second.getByLabel('Munka leírása *')).toHaveValue(f.job.description);
 await page.getByLabel('Munka leírása *').fill('Successful first save');await page.getByTestId('save-worksheet').click();
 await expect(page.getByRole('region',{name:'Munkalap szerkesztő'}).getByRole('status')).toContainText('Nincs nem mentett módosítás');
 // Printing fetches a fresh snapshot, but must not advance the stale editor's expected version.
 await second.getByRole('button',{name:'Nyomtatás',exact:true}).click();
 const preview=second.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'});await expect(preview).toBeVisible();
 await preview.getByRole('button',{name:'Bezárás',exact:true}).click();
 await second.getByLabel('Munka leírása *').fill('Keep my stale draft');await second.getByTestId('save-worksheet').click();
 await expect(second.getByRole('alert')).toContainText('Töltsd újra');
 await expect(second.getByLabel('Munka leírása *')).toHaveValue('Keep my stale draft');
 expect((await(await request.get(api+'/ServiceJobs/'+f.job.id,{headers:f.headers})).json()).description).toBe('Successful first save');
});
test('mechanic sees completed work read-only and no destructive controls',async({page,request})=>{
 const f=await fixture(request);const email='mechanic-'+f.suffix;
 expect((await request.post(api+'/Users',{headers:f.headers,data:{name:'Mechanic',email,password:'Admin-test-only-123',role:'mechanic'}})).ok()).toBeTruthy();
 expect((await request.put(api+'/ServiceJobs/'+f.job.id,{headers:f.headers,data:{id:f.job.id,version:f.job.version,description:f.job.description,isCompleted:true}})).ok()).toBeTruthy();
 await login(page,email);await page.goto('/worksheets/'+f.job.id);
 await expect(page.getByLabel('Munka leírása *')).toBeDisabled();await expect(page.getByLabel('Munkadíj (Ft) *')).toBeDisabled();
 await expect(page.getByTestId('save-worksheet')).toHaveCount(0);await expect(page.getByRole('button',{name:'Munkalap újranyitása'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Nyomtatás',exact:true})).toBeEnabled();
 await page.goto('/inventory');await expect(page.getByRole('table')).toBeVisible();await expect(page.getByRole('button',{name:'Törlés',exact:true})).toHaveCount(0);
 await page.goto('/customers');await expect(page.getByRole('table')).toBeVisible();await expect(page.getByRole('button',{name:'Törlés',exact:true})).toHaveCount(0);
});
