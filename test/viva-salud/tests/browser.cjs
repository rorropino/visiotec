const puppeteer=require('puppeteer');
const assert=require('assert');
(async()=>{
 let browser;
 const errors=[];
 try {
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 page.on('pageerror',err=>errors.push('pageerror: '+err.message));
 page.on('console',msg=>{if(msg.type()==='error') errors.push('console: '+msg.text());});
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:18887/viva-salud/',{waitUntil:'networkidle2'});
 await page.waitForSelector('#auth-screen:not([hidden])');
 await page.click('#switch-register');
 await page.type('#auth-name','Persona Test');
 await page.type('#auth-email','browser_'+Date.now()+'@example.test');
 await page.type('#auth-password','SuperPassTest2026#');
 await page.click('#auth-submit');
 await page.waitForSelector('#app:not(.is-hidden)',{timeout:12000});
 await page.waitForSelector('#view-perfil.active',{timeout:6000});
 await page.type('input[name=age]','42');
 await page.type('input[name=height_cm]','179');
 await page.type('input[name=weight_kg]','88.7');
 await page.click('input[name=goal][value=bajar]');
 await page.click('#profile-form button[type=submit]');
 await page.waitForSelector('#view-inicio.active');
 const heroBackground=await page.$eval('.hero-photography',el=>getComputedStyle(el).backgroundImage);
 assert(heroBackground.includes('athlete.webp'),'Missing premium hero photo');
 assert(await page.$eval('.insights-grid',el=>getComputedStyle(el).display)==='grid','Insights not rendered');

 await page.screenshot({path:'/tmp/viva-dashboard-desktop.png',fullPage:true});
 await page.click('button[data-tab=comer]');
 await page.waitForSelector('#view-comer.active');
 await page.type('#pantry-ingredient','huevo');
 await page.click('#pantry-form button');
 await page.waitForFunction(()=>document.querySelector('#pantry-count').textContent.includes('1 ingredientes'));
 await page.waitForSelector('.recipe-card');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.recipe-photo')).every(img=>img.complete && img.naturalWidth>0),{timeout:10000});
 await page.screenshot({path:'/tmp/viva-kitchen.png',fullPage:true});

 await page.click('.recipe-card');
 await page.waitForSelector('#recipe-modal:not([hidden])');
 await page.click('#recipe-close');
 await page.click('#meal-text');
 await page.type('#meal-text','Comida de prueba');
 await page.click('#meal-form button');
 await page.waitForFunction(()=>document.querySelector('#meal-list').textContent.includes('Comida de prueba'));
 await page.click('button[data-tab=entrenar]');
 await page.waitForSelector('#view-entrenar.active');
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'/tmp/viva-studio-full-desktop.png',fullPage:false});
 assert(await page.$eval('.studio-streak-badge',x=>getComputedStyle(x).display!=='none'),'Header streak missing');
 assert(await page.$eval('.studio-icon-button',x=>getComputedStyle(x).display!=='none'),'Header quick actions missing');

 await page.click('#open-coach');
 await page.waitForSelector('#coach-overlay:not([hidden])');
 const inline=await page.$eval('#coach-overlay',el=>({container:el.parentElement.id,position:getComputedStyle(el).position}));
 assert(inline.container==='coach-stage' && inline.position==='static','Coach must be integrated into dashboard, not modal: '+JSON.stringify(inline));
 const desktopColumns=await page.$eval('.studio-grid',x=>getComputedStyle(x).gridTemplateColumns.split(' ').length);
 assert(desktopColumns===3,'Desktop requires three working dashboard columns');
 assert(await page.$eval('#studio-weight',el=>el.textContent).then(x=>x.includes('88')),'Right-side weight must show recorded data');

 await page.waitForFunction(()=>window.VivaSprite?.getInfo().loaded && !document.querySelector('#coach-sprite').hidden,{timeout:12000});
 assert((await page.evaluate(()=>window.VivaSprite.getInfo())).mode==='march','Warmup must show marching sprite');
 const before=await page.$eval('#coach-sprite',el=>el.toDataURL());
 await new Promise(r=>setTimeout(r,650));
 const after=await page.$eval('#coach-sprite',el=>el.toDataURL());
 assert(before!==after,'Sprite must advance through animation frames');
 await page.screenshot({path:'/tmp/viva-coach.png',fullPage:false});
 await page.click('#coach-next');
 await page.waitForFunction(()=>!document.querySelector('#coach-demo').hidden && document.querySelector('#coach-demo').readyState>=2,{timeout:12000});
 assert(await page.$eval('#coach-demo',e=>e.currentSrc.includes('guide-squat.mp4')),'Squat must use its smooth MP4 loop');
 assert(await page.$eval('#coach-demo',e=>e.loop),'Video must loop');
 assert((await page.$eval('#coach-title',x=>x.textContent)).toLowerCase().includes('sentadilla'));
 await page.click('#coach-next');
 assert(await page.$eval('#coach-rest-visual',x=>!x.hidden),'Rest period must show breathing animation');
 await page.click('#coach-next');
 await page.waitForFunction(()=>!document.querySelector('#coach-demo').hidden && document.querySelector('#coach-demo').readyState>=2,{timeout:12000});
 assert(await page.$eval('#coach-demo',e=>e.currentSrc.includes('guide-pushup.mp4')),'Wall pushups must use guide video');
 await page.screenshot({path:'/tmp/viva-fidelity-pushup.png',fullPage:false});

 assert(await page.$eval('#coach-demo',x=>!x.hidden),'Training actor video must be visible');
 const begin=await page.$eval('#coach-demo',x=>x.currentTime);
 await new Promise(r=>setTimeout(r,550));
 const end=await page.$eval('#coach-demo',x=>x.currentTime);
 assert(end>begin,'Video must actually animate (not freeze)');
 await page.click('#coach-play');
 await new Promise(r=>setTimeout(r,1300));
 const clock=await page.$eval('#coach-timer',el=>el.textContent);
 assert(clock!== '03:00','Timer did not start');
 for(const [visual,expected] of [['rest',null],['video','bridge'],['rest',null],['video','birddog'],['rest',null],['video','heels']]){
   await page.click('#coach-next');
   if(visual==='rest')assert(await page.$eval('#coach-rest-visual',x=>!x.hidden),'Rest breathing visual missing');

   if(visual==='video'){
     assert(await page.$eval('#coach-demo',x=>!x.hidden),'Missing custom animation for heel raises');
     await page.waitForFunction(()=>document.querySelector('#coach-demo').readyState>=2,{timeout:12000});
     if(expected)assert(await page.$eval('#coach-demo',(el,expected)=>el.currentSrc.includes((expected==='heels'?'demo-':'guide-')+expected+'.mp4'),expected),'Wrong exercise video: '+expected);
   }
 }

 await page.click('#coach-exit');
 await page.click('button[data-tab=progreso]');
 await page.waitForSelector('#view-progreso.active');
 await page.type('#measure-weight','88.1');
 await page.click('#measurement-form button[type=submit]');
 await page.waitForFunction(()=>document.querySelector('#weight-chart svg')!==null);
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});
 await page.click('.mobile-nav button[data-tab=inicio]');
 await page.waitForSelector('#view-inicio.active');
 await page.screenshot({path:'/tmp/viva-dashboard-mobile.png',fullPage:true});
 const horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
 assert(!horizontal,'Unexpected horizontal scrolling on mobile');
 await page.click('.mobile-nav button[data-tab=entrenar]');
 await page.waitForSelector('#view-entrenar.active');
 await page.click('#open-coach');
 await page.waitForFunction(()=>window.VivaSprite?.getInfo().loaded && !document.querySelector('#coach-sprite').hidden);
 await page.screenshot({path:'/tmp/viva-coach-mobile-debug.png',fullPage:false});
 const nextRect=await page.$eval('#coach-next',x=>{const r=x.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,viewport:window.innerHeight};});
 assert(nextRect.top>=0 && nextRect.bottom<=nextRect.viewport,'Next button not visible on mobile: '+JSON.stringify(nextRect));
 await page.screenshot({path:'/tmp/viva-coach-mobile.png',fullPage:false});
 await page.click('#coach-next');
 await page.waitForFunction(()=>document.querySelector('#coach-demo').readyState>=2 && !document.querySelector('#coach-demo').hidden,{timeout:12000});
 assert(await page.$eval('#coach-demo',x=>x.currentSrc.includes('guide-squat.mp4')),'Mobile next must change to squat MP4');
 await page.click('#coach-exit');

 assert(errors.length===0,'Browser JS errors: '+errors.join(' | '));
 console.log('PASS: browser + hybrid sprite/5 exercise MP4 loops, warmup, squat, rest, pushups, bridge, bird dog, timer, recipes, measurements, mobile');
 }catch(e){console.error('FAIL:',e.message,errors);process.exitCode=1;}
 finally{if(browser)await browser.close();}
})();
