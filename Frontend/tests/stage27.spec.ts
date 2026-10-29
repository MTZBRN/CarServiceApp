import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
const ui='http://localhost:5173', api='http://localhost:5232/api';
async function login(page:Page,email='admin@test.com',password='admin123',path='/dashboard') {
  await page.goto(ui+path);
  await page.getByLabel('Felhasználónév (Email)',{exact:true}).fill(email);
  await page.getByLabel('Jelszó',{exact:true}).fill(password);
  await page.getByRole('button',{name:/belépés/i}).click();
  await expect(page.getByRole('button',{name:'Kilépés',exact:true})).toBeVisible();
}
async function admin(request:APIRequestContext) {
  const response=await request.post(api+'/Auth/login',{data:{email:'admin@test.com',password:'admin123'}});
  expect(response.ok()).toBeTruthy();
  return {Authorization:'Bearer '+(await response.json()).token};
}
async function newUser(request:APIRequestContext,role='mechanic') {
  const headers=await admin(request), email='stage27-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'@test.com';
  expect((await request.post(api+'/Users',{headers,data:{name:'Stage 27 account',email,password:'account123',role}})).ok()).toBeTruthy();
  const users=await (await request.get(api+'/Users',{headers})).json();
  return {email,id:users.find((u:{email:string})=>u.email===email).id,headers};
}

test('dashboard metrics use defined dates, status and stock boundaries with working filters',async({page})=>{
  await page.clock.install({time:new Date('2026-10-28T10:00:00+01:00')});
  const vehicles=[
    {id:1,customerId:1,licensePlate:'MA-001',make:'Ford',model:'Focus',year:2020,motExpiry:'2026-10-28'},
    {id:2,customerId:1,licensePlate:'LEJART-002',make:'Toyota',model:'Corolla',year:2021,motExpiry:'2026-10-27'},
    {id:3,customerId:1,licensePlate:'HARMINC-003',make:'Opel',model:'Astra',year:2019,motExpiry:'2026-11-27'},
    {id:4,customerId:1,licensePlate:'KESOBB-004',make:'VW',model:'Golf',year:2022,motExpiry:'2026-11-28'},
  ];
  await page.route('**/api/Vehicle',route=>route.fulfill({json:vehicles}));
  await page.route('**/api/Customers',route=>route.fulfill({json:[{id:1,name:'Teszt ügyfél',phoneNumber:'123'}]}));
  await page.route('**/api/Appointments',route=>route.fulfill({json:[
    {id:11,vehicleId:1,startTime:'2026-10-28T00:00:00Z',endTime:'2026-10-28T23:59:59Z',note:'Mai szerviz'},
    {id:12,vehicleId:2,startTime:'2026-10-27T10:00:00Z',endTime:'2026-10-27T11:00:00Z'},
  ]}));
  await page.route('**/api/ServiceJobs',route=>route.fulfill({json:[
    {id:31,vehicleId:1,date:'2026-10-25T12:00:00Z',description:'Nyitott munka',isCompleted:false,laborCost:100,jobParts:[]},
    {id:32,vehicleId:2,date:'2026-10-26T12:00:00Z',description:'Kész munka',isCompleted:true,laborCost:200,jobParts:[]},
  ]}));
  await page.route('**/api/parts',route=>route.fulfill({json:[0,4,5,-1,1.5].map((stockQuantity,i)=>({id:i+1,stockQuantity,name:'Alkatrész '+i,partNumber:'P'+i,netPrice:100,grossPrice:127}))}));
  await login(page);
  for(const label of ['Mai időpontok: 1','Aktív munkalapok: 1','Befejezett munkák: 1','Közelgő műszaki vizsgák: 2','Alacsony készlet: 2'])await expect(page.getByRole('link',{name:label,exact:true})).toBeVisible();
  await expect(page.locator('#inspections')).toContainText('Lejárt');
  await expect(page.locator('#inspections')).not.toContainText('KESOBB-004');
  await expect(page.locator('#stock')).not.toContainText('Alkatrész 3');
  await page.getByRole('link',{name:'Aktív munkalapok: 1',exact:true}).click();
  await expect(page).toHaveURL(ui+'/worksheets?status=open');
  await expect(page.getByRole('row').filter({hasText:'Nyitott munka'})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'Kész munka'})).toHaveCount(0);
});

test('dashboard handles empty resources and retries failed loads without displaying false zero metrics',async({page})=>{
  for(const name of ['Vehicle','Customers','Appointments','ServiceJobs','parts'])await page.route('**/api/'+name,r=>r.fulfill({json:[]}));
  await page.route('**/api/parts',r=>r.fulfill({status:500,body:'Készlet nem érhető el'}));
  await login(page);
  await expect(page.getByRole('alert')).toContainText('Készlet nem érhető el');
  await expect(page.locator('.overview-metrics')).toHaveCount(0);
  await page.unroute('**/api/parts');
  await page.route('**/api/parts',r=>r.fulfill({json:[]}));
  await page.getByRole('button',{name:'Újrapróbálás'}).click();
  await expect(page.getByRole('link',{name:'Aktív munkalapok: 0',exact:true})).toBeVisible();
  await expect(page.getByText('Nincs mára beírt munka.')).toBeVisible();
});

test('company settings validate, retain failed values, prevent duplicates, save zero values and refresh print data',async({page,request})=>{
  const headers=await admin(request);
  const previous=await (await request.get(api+'/Settings',{headers})).json();
  try {
    await login(page,'admin@test.com','admin123','/settings');
    await page.getByLabel('Cégnév',{exact:true}).fill('');
    await page.getByLabel('ÁFA (%)',{exact:true}).fill('101');
    await page.getByRole('button',{name:'Rendszeradatok mentése'}).click();
    await expect(page.getByText('Add meg a cégnevet.')).toBeVisible();
    await expect(page.getByText('Az ÁFA 0 és 100% közötti lehet.')).toBeVisible();
    const company='Stage 27 Műhely '+Date.now();
    await page.getByLabel('Cégnév',{exact:true}).fill(company);
    await page.getByLabel('Rezsióradíj (Ft)',{exact:true}).fill('0');
    await page.getByLabel('ÁFA (%)',{exact:true}).fill('0');
    await page.route('**/api/Settings',r=>r.request().method()==='POST'?r.fulfill({status:500,body:'Próbáld újra a mentést.'}):r.continue());
    await page.getByRole('button',{name:'Rendszeradatok mentése'}).click();
    await expect(page.getByRole('alert')).toContainText('Próbáld újra');
    await expect(page.getByLabel('Cégnév',{exact:true})).toHaveValue(company);
    await expect(page.locator('.toast-success')).toHaveCount(0);
    await page.unroute('**/api/Settings');
    let writes=0;
    await page.route('**/api/Settings',async r=>{
      if(r.request().method()==='POST'){writes++;await new Promise(resolve=>setTimeout(resolve,350));}
      await r.continue();
    });
    const save=page.getByRole('button',{name:'Rendszeradatok mentése'});
    await save.evaluate((el:HTMLButtonElement)=>{el.click();el.click();});
    await expect(page.getByText('A cégbeállítások mentve.',{exact:true})).toBeVisible();
    expect(writes).toBe(1);
    await expect(page.locator('.shell-brand-text strong')).toHaveText(company);
    await page.reload();
    await expect(page.getByLabel('Rezsióradíj (Ft)',{exact:true})).toHaveValue('0');
    await expect(page.getByLabel('ÁFA (%)',{exact:true})).toHaveValue('0');
    const jobs=await (await request.get(api+'/ServiceJobs',{headers})).json();
    if(jobs.length){
      await page.goto(ui+'/worksheets/'+jobs[0].id+'?print=1');
      await expect(page.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'})).toContainText(company);
    }
  } finally {expect((await request.post(api+'/Settings',{headers,data:previous})).ok()).toBeTruthy();}
});

test('settings company load error retries while personal controls remain available',async({page})=>{
  await page.route('**/api/Settings',r=>r.fulfill({status:500,body:'Cégadat hiba'}));
  await login(page,'admin@test.com','admin123','/settings');
  await expect(page.getByRole('heading',{name:'Személyes fiók'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Cégadat hiba');
  await page.unroute('**/api/Settings');
  await page.getByRole('button',{name:'Újrapróbálás'}).click();
  await expect(page.getByLabel('Cégnév',{exact:true})).toBeVisible();
});

test('personal password and profile image workflows accept responses and persist after refresh',async({page,request})=>{
  const account=await newUser(request,'admin');
  try {
    await login(page,account.email,'account123','/settings');
    await page.getByLabel('Jelenlegi jelszó',{exact:true}).fill('wrong');
    await page.getByLabel('Új jelszó',{exact:true}).fill('changed123');
    await page.getByLabel('Új jelszó megerősítése',{exact:true}).fill('different');
    await page.getByRole('button',{name:'Jelszó frissítése'}).click();
    await expect(page.getByText('A két új jelszó nem egyezik.')).toBeVisible();
    await page.getByLabel('Új jelszó megerősítése',{exact:true}).fill('changed123');
    await page.getByRole('button',{name:'Jelszó frissítése'}).click();
    await expect(page.getByRole('alert')).toContainText('A jelenlegi jelszó nem megfelelő');
    await expect(page.getByLabel('Új jelszó',{exact:true})).toHaveValue('changed123');
    await page.getByLabel('Jelenlegi jelszó',{exact:true}).fill('account123');
    await page.getByRole('button',{name:'Jelszó frissítése'}).click();
    await expect(page.getByText('A jelszó módosítva.',{exact:true})).toBeVisible();
    await expect(page.getByLabel('Új jelszó',{exact:true})).toHaveValue('');
    expect((await request.post(api+'/Auth/login',{data:{email:account.email,password:'changed123'}})).ok()).toBeTruthy();
    await page.getByLabel('Új profilkép',{exact:true}).setInputFiles({name:'profile.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
    await page.getByRole('button',{name:'Kép mentése'}).click();
    await expect(page.getByText('A profilkép mentve.',{exact:true})).toBeVisible();
    await expect(page.locator('.shell-avatar img')).toHaveAttribute('src',/uploads\/profile_/);
    await page.reload();
    await expect(page.getByRole('img',{name:'Saját profilkép'})).toBeVisible();
  } finally {expect((await request.delete(api+'/Users/'+account.id,{headers:account.headers})).ok()).toBeTruthy();}
});

test('user creation validates and retains failures; delete confirms, handles errors and refreshes',async({page,request})=>{
  const headers=await admin(request), email='ui-user-'+Date.now()+'@test.com';
  await login(page,'admin@test.com','admin123','/users');
  const trigger=page.getByRole('button',{name:'Új hozzáadása'});
  await trigger.click();const dialog=page.getByRole('dialog',{name:'Új felhasználó',exact:true});
  await expect(dialog.getByLabel('Teljes név')).toBeFocused();
  await dialog.getByRole('button',{name:'Létrehozás'}).click();
  await expect(dialog.getByText('Add meg a teljes nevet.')).toBeVisible();
  await dialog.getByLabel('Teljes név').fill('Új kolléga');
  await dialog.getByLabel('Felhasználónév (Email)',{exact:true}).fill(email);
  await dialog.getByLabel('Jelszó',{exact:true}).fill('user123');
  await expect(dialog.getByLabel('Szerepkör')).toHaveValue('mechanic');
  await page.route('**/api/Users',r=>r.request().method()==='POST'?r.fulfill({status:400,body:'Teszt mentési hiba'}):r.continue());
  await dialog.getByRole('button',{name:'Létrehozás'}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Teszt mentési hiba');
  await expect(dialog.getByLabel('Teljes név')).toHaveValue('Új kolléga');
  await page.unroute('**/api/Users');
  let writes=0;
  await page.route('**/api/Users',async r=>{if(r.request().method()==='POST'){writes++;await new Promise(resolve=>setTimeout(resolve,300));}await r.continue();});
  await dialog.getByRole('button',{name:'Létrehozás'}).evaluate((el:HTMLButtonElement)=>{el.click();el.click();});
  await expect(dialog).toHaveCount(0);expect(writes).toBe(1);
  const row=page.getByRole('row').filter({hasText:email});
  await expect(row).toContainText('Szerelő');
  const invalid=await request.post(api+'/Users',{headers,data:{name:'Invalid',email:'bad-'+email,password:'user123',role:'superuser'}});
  expect(invalid.status()).toBe(400);
  await row.getByRole('button',{name:'Új kolléga törlése'}).click();
  const confirm=page.getByRole('dialog',{name:'Törlés megerősítése'});
  await expect(confirm).toContainText('Új kolléga');
  await page.keyboard.press('Escape');await expect(confirm).toHaveCount(0);
  await expect(row.getByRole('button')).toBeFocused();
  await row.getByRole('button').click();
  await page.route('**/api/Users/*',r=>r.request().method()==='DELETE'?r.fulfill({status:400,body:'Törlés sikertelen'}):r.continue());
  await confirm.getByRole('button',{name:'Törlés',exact:true}).click();
  await expect(confirm.getByRole('alert')).toHaveText('Törlés sikertelen');
  await expect(row).toBeVisible();
  await page.unroute('**/api/Users/*');
  await confirm.getByRole('button',{name:'Törlés',exact:true}).click();
  await expect(row).toHaveCount(0);
  const users=await (await request.get(api+'/Users',{headers})).json(),admins=users.filter((u:{role:string})=>u.role==='admin');
  if(admins.length===1){
    await expect(page.getByRole('row').filter({hasText:admins[0].email}).getByRole('button')).toBeDisabled();
    expect((await request.delete(api+'/Users/'+admins[0].id,{headers})).status()).toBe(400);
  }
});

test('mechanic cannot load admin pages, user/company mutations or development tools',async({page,request})=>{
  const account=await newUser(request);
  try {
    const response=await request.post(api+'/Auth/login',{data:{email:account.email,password:'account123'}});
    const headers={Authorization:'Bearer '+(await response.json()).token};
    for(const url of ['/Users','/Settings','/Seed']){
      const response=await request.post(api+url,{headers,data:{}});
      expect(response.status()).toBe(403);
    }
    await login(page,account.email,'account123');
    await expect(page.getByRole('button',{name:'Fejlesztői eszközök',exact:true})).toHaveCount(0);
    for(const path of ['/settings','/users']){
      await page.goto(ui+path);
      await expect(page.getByRole('alert')).toHaveText('Nincs jogosultságod az oldal megtekintéséhez.');
    }
  } finally {await request.delete(api+'/Users/'+account.id,{headers:account.headers});}
});

test('login supports keyboard, autocomplete, pending requests and useful failed authentication',async({page})=>{
  await page.goto(ui+'/login');
  const username=page.getByLabel('Felhasználónév (Email)',{exact:true}), password=page.getByLabel('Jelszó',{exact:true});
  await expect(username).toBeFocused();
  await expect(username).toHaveAttribute('autocomplete','username');
  await expect(password).toHaveAttribute('autocomplete','current-password');
  await username.fill('admin@test.com');await page.keyboard.press('Tab');await expect(password).toBeFocused();
  await password.fill('wrong');
  let writes=0;
  await page.route('**/api/Auth/login',async r=>{writes++;await new Promise(resolve=>setTimeout(resolve,400));await r.continue();});
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Belépés…'})).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Hibás jelszó');
  expect(writes).toBe(1);
  await expect(username).toHaveValue('admin@test.com');
});


test('expired session is rejected by the backend and restores its destination after login',async({page,request})=>{
  const headers=await admin(request);
  const original=headers.Authorization.slice(7).split('.');
  const claims=JSON.parse(Buffer.from(original[1],'base64url').toString());
  claims.exp=Math.floor(Date.now()/1000)-120; claims.nbf=claims.exp-120; claims.iat=claims.nbf;
  const encoded=Buffer.from(JSON.stringify(claims)).toString('base64url');
  // The isolated validation server uses the existing development configuration.
  const key=process.env.Jwt__Key || JSON.parse(readFileSync('../Backend/CarServiceShop/CarServiceShop/appsettings.json','utf8')).Jwt.Key;
  const signed=original[0]+'.'+encoded;
  const expired=signed+'.'+createHmac('sha256',key).update(signed).digest('base64url');
  expect((await request.get(api+'/Auth/me',{headers:{Authorization:'Bearer '+expired}})).status()).toBe(401);
  await page.goto(ui+'/login');
  await page.evaluate(token=>{localStorage.setItem('authToken',token);localStorage.setItem('user_data','{"name":"Expired identity"}');},expired);
  await page.goto(ui+'/worksheets?status=open');
  await expect(page).toHaveURL(ui+'/login?returnTo=%2Fworksheets%3Fstatus%3Dopen');
  expect(await page.evaluate(()=>localStorage.getItem('user_data'))).toBeNull();
  await page.getByLabel('Felhasználónév (Email)',{exact:true}).fill('admin@test.com');
  await page.getByLabel('Jelszó',{exact:true}).fill('admin123');
  await page.getByRole('button',{name:/belépés/i}).click();
  await expect(page).toHaveURL(ui+'/worksheets?status=open');
});

test('user list load failure offers retry without implying an empty user list',async({page})=>{
  await page.route('**/api/Users',r=>r.fulfill({status:500,body:'Felhasználólista hiba'}));
  await login(page,'admin@test.com','admin123','/users');
  await expect(page.getByRole('alert')).toContainText('Felhasználólista hiba');
  await expect(page.getByText('Nincs felhasználó',{exact:true})).toHaveCount(0);
  await page.unroute('**/api/Users');
  await page.getByRole('button',{name:'Újrapróbálás'}).click();
  await expect(page.getByRole('table',{name:'Felhasználók'})).toContainText('Rendszergazda');
});

for(const width of [1440,1024,768,390]){
  test('complete frontend responsive and accessible controls '+width,async({page,request})=>{
    const headers=await admin(request);
    const vehicles=await (await request.get(api+'/Vehicle',{headers})).json();
    const jobs=await (await request.get(api+'/ServiceJobs',{headers})).json();
    await page.setViewportSize({width,height:960});
    await page.goto(ui+'/login');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    if(width===1440)await page.screenshot({path:'review-artifacts/stage27/login-desktop.png'});
    await login(page);
    const paths=['/dashboard','/calendar','/customers','/vehicles','/worksheets','/inventory','/users','/settings','/worksheets/new'];
    if(vehicles.length)paths.push('/vehicles/'+vehicles[0].id);
    if(jobs.length)paths.push('/worksheets/'+jobs[0].id);
    for(const path of paths){
      await page.goto(ui+path);
      await expect(page.getByRole('button',{name:'Kilépés',exact:true})).toBeVisible();
      await expect(page.getByRole('status').filter({hasText:/Betöltés|betöltése/})).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth),path).toBe(width);
      expect(await page.locator('.app-main').evaluate(el=>el.scrollWidth<=el.clientWidth),path+' main overflow').toBe(true);
      // Every editable control has an associated label or an explicit accessible name.
      const unlabeled=await page.locator('main input:not([type=hidden]),main select,main textarea').evaluateAll(els=>els.filter((el:HTMLInputElement)=>!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).length);
      expect(unlabeled,path).toBe(0);
      if((width===1440||width===390)&&['/dashboard','/users','/settings','/customers'].includes(path)){
        await page.screenshot({path:'review-artifacts/stage27/'+path.slice(1)+'-'+width+'.png',fullPage:true});
        if(path==='/settings'){await page.getByLabel('ÁFA (%)',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'review-artifacts/stage27/settings-company-'+width+'.png'});}
      }
    }
  });
}

test('complete workshop journey through appointment, worksheet, labor, completion, reopening, print and logout',async({page})=>{
  await login(page);
  const activeBefore=Number(await page.locator('.overview-metric').filter({hasText:'Aktív munkalapok'}).locator('strong').textContent());
  const tag=String(Date.now()),plate='J27-'+tag.slice(-6);
  await page.getByRole('link',{name:'Ügyfelek',exact:true}).click();
  await page.getByRole('button',{name:'Új ügyfél',exact:true}).click();
  let modal=page.getByRole('dialog',{name:'Új ügyfél',exact:true});
  await modal.getByPlaceholder('Teljes név').fill('Journey '+tag);
  await modal.getByPlaceholder('+36 30 123 4567').fill('123');
  await modal.getByRole('button',{name:/Ügyfél létrehozása/i}).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('link',{name:'Járművek',exact:true}).click();
  await page.getByRole('button',{name:'Új jármű',exact:true}).click();
  modal=page.getByRole('dialog',{name:'Új jármű',exact:true});
  await modal.getByPlaceholder('ABC-123').fill(plate);
  await modal.getByLabel('Márka *',{exact:true}).fill('Toyota');
  await modal.getByLabel('Típus *',{exact:true}).fill('Corolla');
  await modal.getByRole('combobox').first().selectOption({label:'Journey '+tag});
  await modal.getByRole('button',{name:'Mentés',exact:true}).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('row').filter({hasText:plate}).getByRole('link',{name:'Adatlap',exact:true}).click();
  await page.getByRole('button',{name:'Új időpont',exact:true}).click();
  modal=page.getByRole('dialog',{name:'Új időpont',exact:true});
  await modal.getByPlaceholder('Pl. Kopogó hang a futómű felől...').fill('Journey booking '+tag);
  const bookingResponse=page.waitForResponse(r=>r.url().endsWith('/api/Appointments')&&r.request().method()==='POST');
  await modal.getByRole('button',{name:'Mentés',exact:true}).click();
  const booking=await (await bookingResponse).json();
  await page.goto(ui+'/worksheets/new?appointmentId='+booking.id);
  const editor=page.getByRole('region',{name:'Munkalap szerkesztő'});
  await editor.getByLabel('Munka leírása *').fill('Journey repair '+tag);
  await editor.getByLabel('Munkadíj (Ft) *').fill('12000');
  await editor.getByPlaceholder('Megnevezés',{exact:true}).fill('Olajszűrő');
  await editor.getByLabel('Egységár (Ft) *',{exact:true}).fill('3000');
  await editor.getByRole('button',{name:'Tétel hozzáadása'}).click();
  await editor.getByTestId('save-worksheet').click();
  await expect(page).toHaveURL(/\/worksheets\/\d+$/);
  await editor.getByRole('button',{name:'Munkalap befejezése',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Megerősítés',exact:true}).click();
  await expect(editor.getByText('Befejezett',{exact:true})).toBeVisible();
  await editor.getByRole('button',{name:'Munkalap újranyitása',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Megerősítés',exact:true}).click();
  await expect(editor.getByText('Nyitott',{exact:true})).toBeVisible();
  const worksheetUrl=page.url();
  await page.getByRole('link',{name:'Áttekintés',exact:true}).click();
  await expect(page.getByRole('link',{name:'Aktív munkalapok: '+(activeBefore+1),exact:true})).toBeVisible();
  await page.goBack();await expect(page).toHaveURL(worksheetUrl);
  await editor.getByRole('button',{name:'Nyomtatás',exact:true}).click();
  const preview=page.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'});
  await expect(preview).toContainText('Olajszűrő');
  await expect(preview).toContainText('15');
  page.on('frameattached',async frame=>{await frame.evaluate(()=>{window.print=()=>{};}).catch(()=>{});});
  const printed=page.waitForEvent('frameattached');
  await preview.getByRole('button',{name:'Nyomtatás',exact:true}).click();
  await expect.poll(async()=> (await printed).locator('.print-wrapper').count()).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Kilépés',exact:true}).click();
  await page.getByRole('dialog',{name:'Kijelentkezés',exact:true}).getByRole('button',{name:'Kijelentkezés',exact:true}).click();
  await expect(page).toHaveURL(ui+'/login');
});
