import { test, expect } from '@playwright/test';

test('stage 1 booking worksheet history and permissions', async ({ page, request }) => {
 const base = 'http://localhost:5232/api';
 const login = await request.post(`${base}/Auth/login`, {data:{email:'admin@test.com',password:'admin123'}});
 expect(login.ok()).toBeTruthy();
 const admin = (await login.json()).token;
 const headers = {Authorization:`Bearer ${admin}`};
 for (const route of ['Customers','Vehicle','Appointments','ServiceJobs','Parts','Users','Settings']) expect((await request.get(`${base}/${route}`)).status()).toBe(401);
 const suffix=Date.now();
 expect((await request.post(`${base}/Users`,{headers,data:{name:'Mechanic',email:`mechanic${suffix}`,password:'test123',role:'mechanic'}})).ok()).toBeTruthy();
 const ml=await request.post(`${base}/Auth/login`,{data:{email:`mechanic${suffix}`,password:'test123'}});
 const mh={Authorization:`Bearer ${(await ml.json()).token}`};
 expect((await request.get(`${base}/Users`,{headers:mh})).status()).toBe(403);
 expect((await request.post(`${base}/Settings`,{headers:mh,data:{}})).status()).toBe(403);
 expect((await request.get(`${base}/Settings`,{headers:mh})).ok()).toBeTruthy();
 const customer=await (await request.post(`${base}/Customers`,{headers,data:{name:`Stage ${suffix}`,phoneNumber:'123'}})).json();
 expect((await request.put(`${base}/Customers/${customer.id}`,{headers,data:{name:`Updated ${suffix}`,phoneNumber:'456'}})).ok()).toBeTruthy();
 const vehicle=await (await request.post(`${base}/Vehicle`,{headers,data:{customerId:customer.id,licensePlate:`ST-${suffix}`,make:'Ford',model:'Focus',year:2020}})).json();
 const appointment=await (await request.post(`${base}/Appointments`,{headers:mh,data:{vehicleId:vehicle.id,startTime:new Date().toISOString(),endTime:new Date(Date.now()+3600000).toISOString(),note:'Persisted note'}})).json();
 expect(appointment.note).toBe('Persisted note');
 const job=await (await request.post(`${base}/ServiceJobs`,{headers:mh,data:{appointmentId:appointment.id,vehicleId:vehicle.id,description:'Stage worksheet',jobParts:[{partName:'Brake pads',partNumber:'BP',quantity:2,unitPrice:500}]}})).json();
 expect(job.id).toBeTruthy();
 expect((await (await request.get(`${base}/ServiceJobs/ByAppointment/${appointment.id}`,{headers:mh})).json()).id).toBe(job.id);
 await page.goto('http://127.0.0.1:5173');
 await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');await page.getByPlaceholder('Jelszó').fill('admin123');await page.getByRole('button',{name:/belépés/i}).click();
 await expect(page.getByRole('button',{name:'Kilépés'})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Kilépés'})).toBeVisible();
 await page.getByRole('link',{name:'Járművek',exact:true}).click();
 const card=page.getByRole('row').filter({hasText:vehicle.licensePlate}).first();await card.getByRole('link',{name:'Adatlap'}).click();
 await expect(page.getByText('Stage worksheet',{exact:true})).toBeVisible();
 // Existing history buttons expose descriptive titles.
 const editButton=page.locator('button[title*="szerkeszt"]');await editButton.first().click();
 await expect(page).toHaveURL(new RegExp('/worksheets/'+job.id+'$'));const modal=page.getByRole('region',{name:'Munkalap szerkesztő'});await expect(modal.getByLabel('Munka leírása *')).toHaveValue('Stage worksheet');await expect(modal.getByLabel('Megnevezés 1 *')).toHaveValue('Brake pads');
 await modal.getByLabel('Munka leírása *').fill('Updated worksheet');await modal.getByTestId('save-worksheet').click();await expect(modal.getByRole('status')).toHaveText('Nincs nem mentett módosítás');
 await modal.getByRole('button',{name:'Nyomtatás',exact:true}).click();await expect(page.locator('.modal-overlay').last()).toBeVisible();await expect(page.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'}).locator('input[value="'+vehicle.licensePlate+'"]')).toHaveCount(1);
 expect((await request.delete(`${base}/Customers/${customer.id}`,{headers})).status()).toBe(409);
 expect((await request.delete(`${base}/Appointments/${appointment.id}`,{headers:mh})).ok()).toBeTruthy();
 const retained=await (await request.get(`${base}/ServiceJobs/${job.id}`,{headers:mh})).json();expect(retained.appointmentId).toBeNull();expect(retained.jobParts[0].partName).toBe('Brake pads');
 await page.reload();await page.getByRole('button',{name:'Kijelentkezés',exact:true}).click(); await page.getByRole('dialog', { name: 'Kijelentkezés', exact: true }).getByRole('button', { name: 'Kijelentkezés', exact: true }).click();await expect(page.getByPlaceholder('Jelszó')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('user_data'))).toBeNull();
});

test('calendar creates and reopens a worksheet; inspection reminders have no booking actions', async ({page,request}) => {
 const base='http://localhost:5232/api';const login=await request.post(`${base}/Auth/login`,{data:{email:'admin@test.com',password:'admin123'}});const headers={Authorization:`Bearer ${(await login.json()).token}`};
 const tag=Date.now();const c=await (await request.post(`${base}/Customers`,{headers,data:{name:`Calendar ${tag}`,phoneNumber:'123'}})).json();
 const v=await (await request.post(`${base}/Vehicle`,{headers,data:{customerId:c.id,licensePlate:`CAL-${tag}`,make:'Ford',model:'Focus',year:2020,motExpiry:new Date().toISOString()}})).json();
 const a=await (await request.post(`${base}/Appointments`,{headers,data:{vehicleId:v.id,startTime:new Date().toISOString(),endTime:new Date(Date.now()+3600000).toISOString(),note:'Calendar note'}})).json();
 await page.goto('http://127.0.0.1:5173');await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com');await page.getByPlaceholder('Jelszó').fill('admin123');await page.getByRole('button',{name:/belépés/i}).click();
 await page.getByRole('link',{name:'Naptár',exact:true}).click();
 await page.locator('.rbc-event').filter({hasText:'Műszaki emlékeztető'}).filter({hasText:v.licensePlate}).click();
 let modal=page.locator('.modal-content').last();await expect(modal.getByRole('button',{name:/Munkalap (létrehozása|megnyitása)/})).toHaveCount(0);await expect(modal.locator('button[title="Törlés"]')).toHaveCount(0);await modal.locator('button').first().click();
 const event=page.locator('.rbc-event').filter({hasText:'Calendar note'}).filter({hasText:v.licensePlate});await event.click();await page.getByRole('button',{name:/Munkalap (létrehozása|megnyitása)/}).click();
 await expect(page).toHaveURL(new RegExp('/worksheets/new\\?appointmentId='+a.id));const editor=page.getByRole('region',{name:'Munkalap szerkesztő'});await editor.getByLabel('Munka leírása *').fill('Created from calendar');await editor.getByTestId('save-worksheet').click();
 const job=await (await request.get(`${base}/ServiceJobs/ByAppointment/${a.id}`,{headers})).json();expect(job.id).toBeTruthy();expect(job.description).toBe('Created from calendar');
 await expect(page).toHaveURL(new RegExp('/worksheets/'+job.id+'$'));await page.getByRole('link',{name:'Naptár',exact:true}).click();await event.click();await page.getByRole('button',{name:/Munkalap (létrehozása|megnyitása)/}).click();await expect(page).toHaveURL(new RegExp('/worksheets/'+job.id+'$'));await expect(editor.getByLabel('Munka leírása *')).toHaveValue('Created from calendar');
 await editor.getByRole('button',{name:'Nyomtatás',exact:true}).click();await expect(page.locator('.modal-overlay').last()).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('authToken','invalid'));await page.reload();await expect(page.getByPlaceholder('Jelszó')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('authToken'))).toBeNull();
});
