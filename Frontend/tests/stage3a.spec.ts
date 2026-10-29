import {test,expect} from '@playwright/test';
const origin='http://localhost:15232';

test('built Production SPA supports scoped login, raster images and actual print frame under CSP',async({page,request})=>{
 const login=await request.post(origin+'/api/Auth/login',{data:{email:'admin@test.com',password:'Admin-test-only-123'}});expect(login.ok()).toBeTruthy();
 const token=(await login.json()).token,headers={Authorization:'Bearer '+token};
 expect((await request.post(origin+'/api/Seed',{headers})).status()).toBe(404);
 const customer=await(await request.post(origin+'/api/Customers',{headers,data:{name:'Production customer',phoneNumber:'123'}})).json();
 const vehicle=await(await request.post(origin+'/api/Vehicle',{headers,data:{customerId:customer.id,licensePlate:'PROD-CSP',make:'Ford',model:'Focus',year:2020}})).json();
 const jobResponse=await request.post(origin+'/api/ServiceJobs',{headers,data:{vehicleId:vehicle.id,description:'Production print check',laborCost:100,jobParts:[{partName:'Production part',quantity:2,unitPrice:100}]}});
 expect(jobResponse.ok()).toBeTruthy();const job=await jobResponse.json();
 await page.addInitScript(()=>{
   type Probe=Window & {__cspViolations?:string[];__printResult?:{text:string;rules:number;font:string}};
   const win=window as Probe;win.__cspViolations=[];
   window.addEventListener('securitypolicyviolation',event=>{win.__cspViolations!.push(event.effectiveDirective);if(window.parent!==window)window.parent.postMessage({kind:'csp',directive:event.effectiveDirective},'*');});
   window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.kind==='print')win.__printResult=event.data;if(event.data?.kind==='csp')win.__cspViolations!.push(event.data.directive);});
   window.print=()=>{
     const content=document.querySelector('.print-wrapper');
     window.parent.postMessage({kind:'print',text:document.body.textContent+' '+Array.from(document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea')).map(e=>e.value).join(' '),
       rules:Array.from(document.styleSheets).reduce((sum,s)=>sum+s.cssRules.length,0),font:content?getComputedStyle(content).fontFamily:''},'*');
   };
 });
 const documentResponse=await page.goto(origin+'/login');
 const csp=documentResponse!.headers()['content-security-policy'];expect(csp).toContain("script-src 'self'");expect(csp).not.toContain('unsafe-eval');expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
 await page.getByLabel('Felhasználónév (Email)',{exact:true}).fill('admin@test.com');await page.getByLabel('Jelszó',{exact:true}).fill('Admin-test-only-123');await page.getByRole('button',{name:/belépés/i}).click();
 await expect(page.getByRole('link',{name:'Ügyfelek',exact:true})).toBeVisible();
 // Generate a browser-encoded PNG rather than trusting a filename/signature fixture.
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;c.getContext('2d')!.fillRect(0,0,2,2);return c.toDataURL('image/png').split(',')[1];});
 const uploaded=await request.post(origin+'/api/Auth/upload-profile-picture',{headers,multipart:{file:{name:'profile.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}}});expect(uploaded.ok()).toBeTruthy();
 const imagePath=(await uploaded.json()).filePath;const image=await request.get(origin+imagePath);expect(image.headers()['content-security-policy']).toBe("default-src 'none'; sandbox");expect(image.headers()['x-content-type-options']).toBe('nosniff');
 await page.goto(origin+'/settings');await expect(page.locator('.account-picture')).toBeVisible();await expect.poll(()=>page.locator('.account-picture').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(2);
 await page.goto(origin+'/worksheets/'+job.id+'?print=1');const preview=page.getByRole('dialog',{name:'Munkalap nyomtatási előnézet'});await expect(preview).toBeVisible();await preview.getByRole('button',{name:'Nyomtatás',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as Window & {__printResult?:{text:string}}).__printResult?.text)).toContain('Production print check');
 const result=await page.evaluate(()=>(window as Window & {__printResult?:{rules:number;font:string}}).__printResult!);expect(result.rules).toBeGreaterThan(0);expect(result.font).toContain('Times New Roman');
 expect(await page.evaluate(()=>(window as Window & {__cspViolations?:string[]}).__cspViolations)).toEqual([]);
});
