import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const api = 'http://localhost:5232/api', ui = 'http://127.0.0.1:5173';
async function fixture(request: APIRequestContext) {
  const token = (await (await request.post(api+'/Auth/login',{data:{email:'admin@test.com',password:'admin123'}})).json()).token;
  const headers = {Authorization:'Bearer '+token}, tag = Math.random().toString(36).slice(2,9);
  const customer = await (await request.post(api+'/Customers',{headers,data:{name:'Worksheet customer '+tag,phoneNumber:'123456'}})).json();
  const vehicle = await (await request.post(api+'/Vehicle',{headers,data:{customerId:customer.id,licensePlate:'WS-'+tag,make:'Ford',model:'Focus',year:2020}})).json();
  const part = await (await request.post(api+'/parts',{headers,data:{partNumber:'PART-'+tag,name:'Filter '+tag,stockQuantity:7,netPrice:800,grossPrice:1000}})).json();
  const makeJob = async (description:string, isCompleted=false) => (await (await request.post(api+'/ServiceJobs',{headers,data:{vehicleId:vehicle.id,date:'2028-05-16T12:00:00Z',description,isCompleted,laborCost:500,jobParts:[]}})).json());
  const open = await makeJob('Open '+tag), completed = await makeJob('Completed '+tag,true);
  return {headers,tag,customer,vehicle,part,open,completed};
}
async function login(page:Page,path:string) {
  await page.goto(ui+path); await page.getByPlaceholder('Felhasználónév (Email)').fill('admin@test.com'); await page.getByPlaceholder('Jelszó').fill('admin123'); await page.getByRole('button',{name:/belépés/i}).click();
}
const editor = (page:Page) => page.getByRole('region',{name:'Munkalap szerkesztő'});

test('beforeunload protects dirty changes and clears after saving',async({page,request})=>{
  const f=await fixture(request); await login(page,'/worksheets/'+f.open.id); const w=editor(page);
  const protectedUnload=()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
  await expect(w.getByRole('status')).toHaveText('Nincs nem mentett módosítás'); expect(await protectedUnload()).toBe(false);
  await w.getByLabel('Munka leírása *').fill('Unload draft '+f.tag); expect(await protectedUnload()).toBe(true);
  const dialogPromise=page.waitForEvent('dialog'); const reload=page.reload({timeout:1500}).catch(()=>null); const dialog=await dialogPromise; expect(dialog.type()).toBe('beforeunload'); await dialog.dismiss(); await reload;
  await expect(w.getByLabel('Munka leírása *')).toHaveValue('Unload draft '+f.tag);
  await w.getByTestId('save-worksheet').click(); await expect(w.getByRole('status')).toHaveText('Nincs nem mentett módosítás'); expect(await protectedUnload()).toBe(false);
  await page.reload(); await expect(editor(page).getByLabel('Munka leírása *')).toHaveValue('Unload draft '+f.tag); expect(await protectedUnload()).toBe(false);
  await editor(page).getByLabel('Munka leírása *').fill('Edited again '+f.tag); expect(await protectedUnload()).toBe(true);
});

test('print preview shows every saved part and calculated cost',async({page,request})=>{
  const f=await fixture(request); await login(page,'/worksheets/'+f.open.id); const w=editor(page);
  for(const part of [{name:'Bearing '+f.tag,quantity:'2',price:'1450'},{name:'Seal '+f.tag,quantity:'3',price:'275'}]) {
    await w.getByLabel('Megnevezés *',{exact:true}).fill(part.name); await w.getByLabel('Mennyiség *',{exact:true}).fill(part.quantity); await w.getByLabel('Egységár (Ft) *',{exact:true}).fill(part.price); await w.getByRole('button',{name:'Tétel hozzáadása'}).click();
  }
  await w.getByLabel('Munkadíj (Ft) *').fill('1333'); await w.getByTestId('save-worksheet').click(); await expect(w.getByRole('status')).toHaveText('Nincs nem mentett módosítás');
  const saved=await(await request.get(api+'/ServiceJobs/'+f.open.id,{headers:f.headers})).json(); expect(saved.id).toBe(f.open.id); expect(saved.jobParts).toHaveLength(2);
  expect(saved.jobParts.map((p:{partName:string;quantity:number;unitPrice:number})=>[p.partName,p.quantity,p.unitPrice])).toEqual([['Bearing '+f.tag,2,1450],['Seal '+f.tag,3,275]]); expect(saved.laborCost).toBe(1333);
  await w.getByRole('button',{name:'Nyomtatás',exact:true}).click(); const preview=page.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'}); const table=preview.getByRole('table',{name:'Mentett munkalap költségei'}); await expect(table).toContainText('Munkalap #'+saved.id);
  const format=(n:number)=>new Intl.NumberFormat('hu-HU',{style:'currency',currency:'HUF',maximumFractionDigits:2}).format(n);
  for(const part of saved.jobParts as {partName:string;quantity:number;unitPrice:number}[]) { const cells=table.getByRole('row').filter({hasText:part.partName}).locator('td'); await expect(cells).toHaveCount(4); await expect(cells.nth(0)).toContainText(part.partName); await expect(cells.nth(1)).toHaveText(String(part.quantity)); await expect(cells.nth(2)).toHaveText(format(part.unitPrice)); await expect(cells.nth(3)).toHaveText(format(part.quantity*part.unitPrice)); }
  const subtotal=saved.jobParts.reduce((sum:number,p:{quantity:number;unitPrice:number})=>sum+p.quantity*p.unitPrice,0); await expect(table.getByRole('row').filter({hasText:'Alkatrészek összesen'}).locator('td').last()).toHaveText(format(subtotal)); await expect(table.getByRole('row').filter({hasText:'Munkadíj'}).locator('td').last()).toHaveText(format(saved.laborCost)); await expect(preview.getByTestId('print-total')).toHaveText(format(subtotal+saved.laborCost));
});

test('repeated save actions during a pending create produce one persisted worksheet',async({page,request})=>{
  const f=await fixture(request); await login(page,'/worksheets/new?vehicleId='+f.vehicle.id); const w=editor(page); const description='Single pending '+f.tag; await w.getByLabel('Munka leírása *').fill(description);
  let release!:()=>void; const held=new Promise<void>(resolve=>release=resolve); let mutations=0;
  await page.route('**/api/ServiceJobs',async route=>{if(route.request().method()!=='POST')return route.continue(); mutations++; const response=await route.fetch(); await held; await route.fulfill({response});});
  const save=w.getByTestId('save-worksheet'); await save.click(); await expect.poll(()=>mutations).toBe(1); await expect(save).toBeDisabled(); await expect(save).toHaveText('Mentés…');
  await save.evaluate((button:HTMLButtonElement)=>button.click()); await save.focus(); await page.keyboard.press('Enter'); await save.dispatchEvent('click'); expect(mutations).toBe(1);
  release(); await expect(page).toHaveURL(/\/worksheets\/\d+$/); await expect(editor(page).getByRole('status')).toHaveText('Nincs nem mentett módosítás'); await expect(editor(page).getByTestId('save-worksheet')).toBeEnabled();
  const jobs=await(await request.get(api+'/ServiceJobs',{headers:f.headers})).json(); const matches=jobs.filter((j:{description:string})=>j.description===description); expect(mutations).toBe(1); expect(matches).toHaveLength(1); expect(matches[0].vehicleId).toBe(f.vehicle.id); expect(matches[0].jobParts).toEqual([]); expect(page.url()).toBe(ui+'/worksheets/'+matches[0].id);
});

test('list search, status filters, worksheet route and direct refresh',async({page,request})=>{
  const f=await fixture(request); await login(page,'/worksheets');
  await page.getByLabel('Keresés').fill(f.tag); const row=page.getByRole('row').filter({hasText:'Open '+f.tag});
  await expect(row).toContainText('Nyitott'); await expect(page.getByRole('row').filter({hasText:'Completed '+f.tag})).toContainText('Befejezett');
  await page.getByLabel('Állapot').selectOption('completed'); await expect(row).toHaveCount(0); await page.getByLabel('Állapot').selectOption('open');
  await row.getByRole('link',{name:'Megnyitás'}).click(); await expect(page).toHaveURL(ui+'/worksheets/'+f.open.id);
  await page.reload(); await expect(editor(page).getByLabel('Munka leírása *')).toHaveValue('Open '+f.tag); await expect(editor(page)).toContainText(f.customer.name);
});

test('parts, calculations, failed save, save and print use stored data without stock changes',async({page,request})=>{
  const f=await fixture(request); await login(page,'/worksheets/'+f.open.id); const w=editor(page);
  await w.getByLabel('Cikktörzsből másolás').selectOption(String(f.part.id)); await w.getByLabel('Mennyiség *',{exact:true}).fill('2'); await w.getByRole('button',{name:'Tétel hozzáadása'}).click();
  await w.getByLabel('Megnevezés *',{exact:true}).fill('Manual '+f.tag); await w.getByLabel('Mennyiség *',{exact:true}).fill('3'); await w.getByLabel('Egységár (Ft) *',{exact:true}).fill('200'); await w.getByRole('button',{name:'Tétel hozzáadása'}).click();
  await w.getByLabel('Munkadíj (Ft) *').fill('400'); await expect(w.getByTestId('parts-subtotal')).toContainText('2600'); await expect(w.getByTestId('worksheet-total')).toContainText('3000');
  await page.route('**/api/ServiceJobs/'+f.open.id,route=>route.request().method()==='PUT'?route.fulfill({status:400,body:'Teszt mentési hiba'}):route.continue());
  await w.getByTestId('save-worksheet').click(); await expect(w.getByRole('alert').filter({hasText:'Teszt mentési hiba'})).toBeVisible(); await expect(w.getByLabel('Megnevezés 2 *')).toHaveValue('Manual '+f.tag);
  await page.unroute('**/api/ServiceJobs/'+f.open.id); await w.getByLabel('Munka leírása *').fill('Saved print '+f.tag); await w.getByRole('button',{name:'Mentés és nyomtatás'}).click();
  const preview=page.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'}); await expect(preview).toBeVisible(); await expect(preview).toContainText('Munkalap #'+f.open.id); await expect(preview).toContainText('Manual '+f.tag); await expect(preview.getByTestId('print-total')).toHaveText(await w.getByTestId('worksheet-total').innerText());
  await expect(preview.locator('input[value="'+f.vehicle.licensePlate+'"]')).toHaveCount(1); await expect(preview.locator('input[value="'+f.customer.name+'"]')).toHaveCount(1); await expect(preview.locator('textarea')).toHaveValue('Saved print '+f.tag); await expect(preview.locator('input[value="2028. 05. 16."]')).toHaveCount(1); await expect(preview).toContainText('Nyitott'); await expect(preview).toContainText('GTA Szerviz');
  const saved=await(await request.get(api+'/ServiceJobs/'+f.open.id,{headers:f.headers})).json(); expect(saved.description).toBe('Saved print '+f.tag); expect(saved.jobParts).toHaveLength(2); expect(saved.laborCost).toBe(400);
  const parts=await(await request.get(api+'/parts',{headers:f.headers})).json(); expect(parts.find((p:{id:number})=>p.id===f.part.id).stockQuantity).toBe(7); expect(parts.some((p:{name:string})=>p.name==='Manual '+f.tag)).toBe(false);
});

test('browser back, switching and logout protect unsaved worksheet data',async({page,request})=>{
 const f=await fixture(request); await login(page,'/worksheets'); await page.getByRole('row').filter({hasText:'Open '+f.tag}).getByRole('link',{name:'Megnyitás'}).click(); const w=editor(page); await w.getByLabel('Munka leírása *').fill('Unsaved '+f.tag);
 await page.goBack(); let guard=page.getByRole('dialog',{name:'Nem mentett módosítások'}); await expect(guard).toBeVisible(); await guard.getByRole('button',{name:'Mégse'}).click(); await expect(w.getByLabel('Munka leírása *')).toHaveValue('Unsaved '+f.tag);
 await page.getByRole('button',{name:'Kilépés',exact:true}).click(); await page.getByRole('dialog',{name:'Kijelentkezés'}).getByRole('button',{name:'Kijelentkezés',exact:true}).click(); guard=page.getByRole('dialog',{name:'Nem mentett módosítások'}); await expect(guard).toBeVisible(); await guard.getByRole('button',{name:'Mégse'}).click(); await expect(w.getByLabel('Munka leírása *')).toHaveValue('Unsaved '+f.tag);
 await w.getByRole('link',{name:'Munkalapok listája'}).click(); await page.getByRole('dialog',{name:'Nem mentett módosítások'}).getByRole('button',{name:'Módosítások elvetése'}).click(); await expect(page).toHaveURL(ui+'/worksheets'); await page.getByRole('row').filter({hasText:'Completed '+f.tag}).getByRole('link',{name:'Megnyitás'}).click(); await expect(page).toHaveURL(ui+'/worksheets/'+f.completed.id);
});

test('completion, reopen and dirty navigation protection',async({page,request})=>{
  const f=await fixture(request); await login(page,'/worksheets/'+f.open.id); const w=editor(page);
  await w.getByLabel('Munka leírása *').fill('Draft '+f.tag); await w.getByRole('link',{name:'Munkalapok listája'}).click(); const guard=page.getByRole('dialog',{name:'Nem mentett módosítások'}); await expect(guard).toBeVisible(); await guard.getByRole('button',{name:'Mégse'}).click();
  await w.getByTestId('save-worksheet').click(); await expect(w.getByRole('status')).toHaveText('Nincs nem mentett módosítás');
  await w.getByRole('button',{name:'Munkalap befejezése'}).click(); await page.getByRole('dialog',{name:'Munkalap befejezése'}).getByRole('button',{name:'Megerősítés'}).click(); await expect(w).toContainText('Befejezett');
  await w.getByRole('link',{name:'Munkalapok listája'}).click(); await expect(page.getByRole('row').filter({hasText:'Draft '+f.tag})).toContainText('Befejezett');
  await page.goto(ui+'/vehicles/'+f.vehicle.id); await expect(page.locator('.records-history article').filter({hasText:'Draft '+f.tag})).toContainText('Befejezett');
  await page.goto(ui+'/worksheets/'+f.open.id); await editor(page).getByRole('button',{name:'Munkalap újranyitása'}).click(); await page.getByRole('dialog',{name:'Munkalap újranyitása'}).getByRole('button',{name:'Megerősítés'}).click(); await expect(editor(page)).toContainText('Nyitott');
});

test('browser history switching between worksheets preserves a dirty draft',async({page,request})=>{
 const f=await fixture(request); await login(page,'/worksheets/'+f.open.id); await editor(page).getByRole('link',{name:'Munkalapok listája'}).click(); await page.getByRole('row').filter({hasText:'Completed '+f.tag}).getByRole('link',{name:'Megnyitás'}).click(); await editor(page).getByLabel('Munka leírása *').fill('Switch draft '+f.tag);
 await page.evaluate(()=>history.go(-2)); const guard=page.getByRole('dialog',{name:'Nem mentett módosítások'}); await expect(guard).toBeVisible(); await guard.getByRole('button',{name:'Mégse'}).click(); await expect(editor(page).getByLabel('Munka leírása *')).toHaveValue('Switch draft '+f.tag);
 await page.evaluate(()=>history.go(-2)); await guard.getByRole('button',{name:'Módosítások elvetése'}).click(); await expect(page).toHaveURL(ui+'/worksheets/'+f.open.id);
});

test('walk-in validation, explicit catalog creation and duplicate submission protection',async({page,request})=>{
  const f=await fixture(request); await login(page,'/worksheets/new'); const w=editor(page);
  await w.getByLabel('Jármű *').selectOption(String(f.vehicle.id)); await w.getByLabel('Munka leírása *').fill('Walk in '+f.tag);
  await w.getByRole('button',{name:'Tétel hozzáadása'}).click(); await expect(w.getByRole('alert')).toContainText('megnevezést');
  await w.getByLabel('Megnevezés *',{exact:true}).fill('Catalog '+f.tag); await w.getByLabel('Mennyiség *',{exact:true}).fill('0'); await w.getByRole('button',{name:'Tétel hozzáadása'}).click(); await expect(w.getByRole('alert')).toContainText('pozitív');
  await w.getByLabel('Mennyiség *',{exact:true}).fill('1'); await w.getByLabel('Egységár (Ft) *',{exact:true}).fill('-1'); await w.getByRole('button',{name:'Tétel hozzáadása'}).click(); await expect(w.getByRole('alert')).toContainText('egységárat');
  await w.getByLabel('Egységár (Ft) *',{exact:true}).fill('125'); await w.getByLabel('Cikkszám',{exact:true}).fill('NEW-'+f.tag); await w.getByLabel('Új cikkszám mentése a cikktörzsbe is').check(); await w.getByLabel('Új cikktörzs-tétel nettó ára (Ft) *').fill('100'); await w.getByRole('button',{name:'Tétel hozzáadása'}).click();
  await expect(w.getByLabel('Megnevezés 1 *')).toHaveValue('Catalog '+f.tag); const parts=await(await request.get(api+'/parts',{headers:f.headers})).json(); expect(parts.find((p:{partNumber:string})=>p.partNumber==='NEW-'+f.tag)).toMatchObject({stockQuantity:0,netPrice:100,grossPrice:125});
  let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let calls=0;
  await page.route('**/api/ServiceJobs',async route=>{if(route.request().method()!=='POST')return route.continue();calls++;const response=await route.fetch();await held;await route.fulfill({response});});
  await w.getByTestId('save-worksheet').click(); await expect.poll(()=>calls).toBe(1); await expect(w.getByTestId('save-worksheet')).toBeDisabled(); release(); await expect(page).toHaveURL(/\/worksheets\/\d+$/); expect(calls).toBe(1);
  const id=Number(page.url().split('/').pop());const saved=await(await request.get(api+'/ServiceJobs/'+id,{headers:f.headers})).json();expect(saved.vehicleId).toBe(f.vehicle.id);expect(saved.appointmentId).toBeNull();
});

test('appointment linkage redirects existing job and backend rejects duplicates',async({page,request})=>{
  const f=await fixture(request); const a=await(await request.post(api+'/Appointments',{headers:f.headers,data:{vehicleId:f.vehicle.id,startTime:'2028-05-16T09:00:00',endTime:'2028-05-16T10:00:00',note:'Linked'}})).json();
  await login(page,'/worksheets/new?appointmentId='+a.id); const w=editor(page); await expect(w).toContainText(f.customer.name); await w.getByLabel('Munka leírása *').fill('Appointment '+f.tag); await w.getByTestId('save-worksheet').click(); await expect(page).toHaveURL(/\/worksheets\/\d+$/);
  const id=Number(page.url().split('/').pop()); const saved=await(await request.get(api+'/ServiceJobs/'+id,{headers:f.headers})).json(); expect(saved.appointmentId).toBe(a.id); expect(saved.vehicleId).toBe(f.vehicle.id);
  const duplicate=await request.post(api+'/ServiceJobs',{headers:f.headers,data:{vehicleId:f.vehicle.id,appointmentId:a.id,description:'Duplicate',jobParts:[]}}); expect(duplicate.status()).toBe(409);
  await page.goto(ui+'/worksheets/new?appointmentId='+a.id); await expect(page).toHaveURL(ui+'/worksheets/'+id);
});

for(const width of [1440,1024,768,390]) test('workspace responsive '+width,async({page,request})=>{
  const f=await fixture(request); await page.setViewportSize({width,height:900}); await login(page,'/worksheets/'+f.open.id); await expect(editor(page)).toContainText(f.vehicle.licensePlate);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await expect(editor(page).getByTestId('save-worksheet')).toBeVisible();
  await editor(page).getByRole('link',{name:'Munkalapok listája'}).click(); await expect(page.getByLabel('Keresés')).toBeVisible(); expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test('worksheet visual review artifacts',async({page,request})=>{
 const f=await fixture(request); await page.setViewportSize({width:1440,height:900}); await login(page,'/worksheets'); await page.getByLabel('Keresés').fill(f.tag); await expect(page.getByRole('row').filter({hasText:'Open '+f.tag})).toBeVisible();
 await page.screenshot({path:'C:/CarServiceApp/stage26-artifacts/worksheet-list-desktop.png',fullPage:true});
 await page.goto(ui+'/worksheets/'+f.open.id); const w=editor(page); await expect(w).toContainText(f.vehicle.licensePlate); await page.screenshot({path:'C:/CarServiceApp/stage26-artifacts/worksheet-open-desktop.png',fullPage:true});
 await w.getByLabel('Cikktörzsből másolás').selectOption(String(f.part.id)); await w.getByRole('button',{name:'Tétel hozzáadása'}).click(); await w.getByLabel('Megnevezés *',{exact:true}).fill('Tömítés'); await w.getByLabel('Egységár (Ft) *',{exact:true}).fill('500'); await w.getByRole('button',{name:'Tétel hozzáadása'}).click(); await page.screenshot({path:'C:/CarServiceApp/stage26-artifacts/worksheet-multiple-parts.png',fullPage:true});
 await w.getByRole('button',{name:'Mentés és nyomtatás'}).click(); const preview=page.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'}); await expect(preview).toBeVisible(); await page.screenshot({path:'C:/CarServiceApp/stage26-artifacts/worksheet-print-preview.png'}); await page.keyboard.press('Escape');
 await page.goto(ui+'/worksheets/'+f.completed.id); await expect(editor(page)).toContainText('Befejezett'); await page.screenshot({path:'C:/CarServiceApp/stage26-artifacts/worksheet-completed-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844}); await page.goto(ui+'/worksheets/'+f.open.id); await expect(editor(page)).toContainText(f.vehicle.licensePlate); await page.screenshot({path:'C:/CarServiceApp/stage26-artifacts/worksheet-mobile.png',fullPage:true});
});
