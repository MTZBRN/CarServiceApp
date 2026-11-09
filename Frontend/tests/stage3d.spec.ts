import {chooseLookup} from './lookup-helpers';
import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
const api='http://localhost:5232/api',ui='http://localhost:5173';
async function admin(request:APIRequestContext){const r=await request.post(api+'/Auth/login',{data:{email:'admin@test.com',password:'Admin-test-only-123'}});expect(r.ok()).toBeTruthy();return {Authorization:'Bearer '+(await r.json()).token};}
async function login(page:Page,path:string){await page.goto(ui+path);await page.getByLabel('Felhasználónév (Email)',{exact:true}).fill('admin@test.com');await page.getByLabel('Jelszó',{exact:true}).fill('Admin-test-only-123');await page.getByRole('button',{name:/belépés/i}).click();await expect(page.getByRole('button',{name:'Kilépés',exact:true})).toBeVisible();}

test('paged historical customer search and mutation retain every result',async({page,request})=>{
 const headers=await admin(request),prefix='PAGED-'+Date.now();const customers=[];
 for(let i=0;i<65;i++){const r=await request.post(api+'/Customers',{headers,data:{name:prefix+' '+i,phoneNumber:'123'}});expect(r.ok()).toBeTruthy();customers.push(await r.json());}
 await login(page,'/customers');await page.getByRole('textbox',{name:'Keresés',exact:true}).fill(prefix);
 const pager=page.getByRole('navigation',{name:'Lapozás',exact:true});await expect(pager).toContainText('1. oldal / 2 · 65 találat');
 await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(50);await pager.getByRole('button',{name:'Következő oldal'}).click();
 const last=customers[64],row=page.getByRole('row').filter({hasText:last.name});await expect(row).toBeVisible();await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(15);
 await row.getByRole('button',{name:'Szerkesztés',exact:true}).click();const form=page.getByRole('dialog');await form.getByLabel('Teljes név *',{exact:true}).fill(prefix+' Historical updated');await form.getByRole('button',{name:'Módosítások mentése',exact:true}).click();
 await expect(page.getByText(prefix+' Historical updated',{exact:true})).toBeVisible();await pager.getByRole('button',{name:'Előző oldal'}).click();await pager.getByRole('button',{name:'Következő oldal'}).click();await expect(page.getByText(prefix+' Historical updated',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Keresés',exact:true}).fill(prefix+' Historical updated');await expect(pager).toContainText('1. oldal / 1 · 1 találat');
});

test('selectors can search beyond first page and saved ID routes restore historical context',async({page,request})=>{
 const headers=await admin(request),prefix='LOOKUP-'+Date.now();const customer=await(await request.post(api+'/Customers',{headers,data:{name:prefix+' owner',phoneNumber:'123'}})).json();let vehicle,part;
 for(let i=0;i<55;i++){
  const v=await request.post(api+'/Vehicle',{headers,data:{customerId:customer.id,licensePlate:prefix+'-'+i,make:'Ford',model:'Focus',year:2020}});expect(v.ok()).toBeTruthy();vehicle=await v.json();
  const p=await request.post(api+'/parts',{headers,data:{name:prefix+' part '+i,partNumber:prefix+'-PART-'+i,stockQuantity:1,netPrice:100,grossPrice:127}});expect(p.ok()).toBeTruthy();part=await p.json();
 }
 await login(page,'/worksheets/new');const editor=page.getByRole('region',{name:'Munkalap szerkesztő'});
 await chooseLookup(editor,'Jármű *',vehicle.licensePlate);
 await expect(editor).toContainText(customer.name);await chooseLookup(editor,'Cikktörzsből másolás',part.partNumber);
 await editor.getByLabel('Munka leírása *').fill(prefix+' saved');await editor.getByRole('button',{name:'Tétel hozzáadása',exact:true}).click();await editor.getByTestId('save-worksheet').click();
 await expect(page).toHaveURL(/\/worksheets\/\d+$/);await page.reload();await expect(editor).toContainText(vehicle.licensePlate);await expect(editor.getByLabel('Megnevezés 1 *',{exact:true})).toHaveValue(part.name);
 await page.goto(ui+'/vehicles');await page.getByRole('button',{name:'Új jármű',exact:true}).click();const modal=page.getByRole('dialog');await chooseLookup(modal,'Ügyfél kiválasztása *',customer.name);await expect(modal.getByRole('combobox',{name:'Ügyfél kiválasztása *',exact:true})).toHaveValue(customer.name);
});

test('calendar requests only bounded windows and can retrieve historical bookings',async({page,request})=>{
 const headers=await admin(request),prefix='RANGE-'+Date.now();const c=await(await request.post(api+'/Customers',{headers,data:{name:prefix,phoneNumber:'1'}})).json();const v=await(await request.post(api+'/Vehicle',{headers,data:{customerId:c.id,licensePlate:prefix,make:'Ford',model:'Focus',year:2020}})).json();
 expect((await request.post(api+'/Appointments',{headers,data:{vehicleId:v.id,startTime:'2020-04-10T09:00:00Z',endTime:'2020-04-10T10:00:00Z',note:prefix}})).ok()).toBeTruthy();
 const ranges:URL[]=[];page.on('request',r=>{const url=new URL(r.url());if(r.method()==='GET'&&url.pathname==='/api/Appointments')ranges.push(url);});
 await login(page,'/calendar?date=2020-04-10&view=week');await expect(page.locator('.calendar-booking').filter({hasText:prefix})).toBeVisible();
 await page.getByRole('button',{name:'Következő időszak',exact:true}).click();await expect(page.locator('.calendar-booking').filter({hasText:prefix})).toHaveCount(0);await page.goBack();await expect(page.locator('.calendar-booking').filter({hasText:prefix})).toBeVisible();
 expect(ranges.length).toBeGreaterThan(1);for(const url of ranges){expect(url.searchParams.has('start')).toBe(true);expect(url.searchParams.has('end')).toBe(true);expect(+new Date(url.searchParams.get('end')!)-+new Date(url.searchParams.get('start')!)).toBeLessThanOrEqual(93*86400000);}
});

test('query cache shares pending work, invalidates active pages and separates sessions',async({page})=>{
 await page.goto(ui+'/login');let requests=0;
 await page.route(url=>url.pathname==='/api/Customers',async route=>{requests++;await new Promise(r=>setTimeout(r,40));const second=route.request().headers().authorization==='Bearer session-B';await route.fulfill({json:[{id:second?200:100,name:second?'Session B':'Session A',phoneNumber:'1'}],headers:{'Access-Control-Allow-Origin':ui,'Access-Control-Expose-Headers':'X-Total-Count,X-Page,X-Page-Size','X-Total-Count':'120','X-Page':'2','X-Page-Size':'50'}});});
 const result=await page.evaluate(async()=>{
  const {createWorkshopStore}=await import('/src/data/workshopStore.ts');const {resetApiSession}=await import('/src/api/client.ts');
  localStorage.setItem('authToken','session-A');resetApiSession();const store=createWorkshopStore();const first=store.query('customers',{q:'shared',page:2});const same=store.query('customers',{page:2,q:'shared'});const unsubscribe=first.subscribe(()=>{});
  await Promise.all([first.load(),same.load()]);const initial=first.snapshot();await store.refresh(['customers']);const refreshed=first.snapshot();unsubscribe();
  localStorage.setItem('authToken','session-B');resetApiSession();const other=createWorkshopStore().query('customers',{q:'shared',page:2});const empty=other.snapshot().data.length;await other.load();
  const evicted=store.query('customers',{q:'oldest'});for(let i=0;i<80;i++)store.query('customers',{q:'bounded-'+i});
  return {same:first===same,total:initial.totalCount,page:initial.page,first:initial.data[0].name,refreshed:refreshed.data[0].name,empty,next:other.snapshot().data[0].name,evicted:evicted!==store.query('customers',{q:'oldest'})};
 });
 expect(result).toEqual({same:true,total:120,page:2,first:'Session A',refreshed:'Session A',empty:0,next:'Session B',evicted:true});expect(requests).toBe(3);
});
