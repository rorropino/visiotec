'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const state={csrf:'',user:null,profile:null,data:null,register:false,tab:'inicio',trainer:null,toastTimer:null};
 const API='./api/index.php?action=';
 const money=v=>Number(v).toLocaleString('es-CL',{maximumFractionDigits:1});
 const uiIcon=name=>'<svg class="ui-icon" aria-hidden="true"><use href="./assets/icons.svg#'+name+'"></use></svg>';
 const exerciseIcon=id=>uiIcon(({sentadilla:'activity',pared:'dumbbell',puente:'activity',bird:'sparkles',marcha:'footprints',equilibrio:'target',remo:'dumbbell',talones:'footprints',plancha:'activity'})[id]||'activity');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const shortName=v=>String(v||'').trim().split(' ')[0]||'campeón';
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const niceDate=v=>{try{return new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(v+'T12:00:00Z'));}catch(e){return v;}};
 const goalNames={bajar:'Bajar grasa',definir:'Definir',musculo:'Ganar músculo',mantener:'Mantener',salud:'Bienestar'};
 function toast(message,error=false){const t=$('toast');t.textContent=message;t.classList.toggle('error',error);t.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),3600);}
 async function api(action,payload=null) {
  const opts={credentials:'same-origin',headers:{'Accept':'application/json'}};
  if(payload!==null){opts.method='POST';opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(Object.assign({},payload,{csrf:state.csrf}));}
  let res;
  try{res=await fetch(API+encodeURIComponent(action),opts);}catch(e){throw Error('Sin conexión con el servidor');}
  let json;try{json=await res.json();}catch(e){throw Error('La API respondió con un formato inesperado');}
  if(!res.ok||!json.ok)throw Error(json.error||'No se pudo completar la solicitud');
  return json;
 }
 async function refresh(){state.data=await api('dashboard');state.profile=state.data.profile;renderAll();}
 function setAuthMode(register){state.register=register;$('switch-login').classList.toggle('selected',!register);$('switch-register').classList.toggle('selected',register);$('auth-title').textContent=register?'Tu mejor versión comienza aquí.':'Qué bueno verte.';$('auth-submit').textContent=register?'Crear mi cuenta →':'Entrar a mi espacio →';document.querySelectorAll('.register-only').forEach(el=>el.hidden=!register);$('auth-name').required=register;$('auth-password').autocomplete=register?'new-password':'current-password';}
 function showApp(user){state.user=user;$('auth-screen').hidden=!!user;$('app').classList.toggle('is-hidden',!user);if(user)tab('inicio');}
 function tab(name) {if(!['inicio','entrenar','comer','progreso','perfil'].includes(name))return;if(state.tab==='entrenar' && name!=='entrenar'){if(state.trainer?.playing){stopTick();renderCoach();}const coachVideo=$('coach-demo');if(coachVideo&&!coachVideo.paused)coachVideo.pause();}state.tab=name;document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===name));document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+name));window.scrollTo({top:0,behavior:'smooth'});if(name==='entrenar'&&state.data){if(!state.trainer)startCoach(true);else renderCoach();}}
 function renderAll(){const d=state.data;if(!d)return;const p=d.profile;
  $('welcome-name').textContent=shortName(p.display_name);$('sidebar-user-name').textContent=shortName(p.display_name);$('sidebar-user-avatar').textContent=String(p.display_name||'V')[0].toUpperCase();$('sidebar-user-detail').textContent=({principiante:'Iniciando',intermedio:'Nivel intermedio',avanzado:'Nivel avanzado'})[p.experience]||'Tu plan personal';$('go-profile').textContent=(p.display_name||'V').trim()[0].toUpperCase();
  $('today-caption').textContent=new Intl.DateTimeFormat('es-CL',{weekday:'short',day:'numeric',month:'short',timeZone:'America/Santiago'}).format(new Date());
  const latest=d.measurements.length?d.measurements[d.measurements.length-1]:null;
  const weight=latest?latest.weight_kg:p.weight_kg;
  $('stat-weight').textContent=weight!==null&&weight!==''?money(weight):'—';
  $('stat-weight-note').textContent=latest?'Actualizado '+niceDate(latest.date):'Registra tu punto de partida';
  const dayNow=new Date(today()+'T12:00:00');const dow=(dayNow.getDay()+6)%7;dayNow.setDate(dayNow.getDate()-dow);const mon=dayNow.getFullYear()+'-'+String(dayNow.getMonth()+1).padStart(2,'0')+'-'+String(dayNow.getDate()).padStart(2,'0');
  const weekly=d.workouts.filter(w=>w.day>=mon).length;
  $('stat-workouts').textContent=weekly;$('stat-workouts-note').textContent='Meta: '+p.weekly_days+' días / semana';
  $('stat-goal').textContent=goalNames[p.goal]||'Bienestar';$('stat-goal-note').textContent=p.target_kg?'Meta de peso: '+money(p.target_kg)+' kg':'Personalizado a tu nivel';
  $('stat-minutes').textContent=p.minutes;
  updateVisualInsights(d,weekly,weight);
  $('sidebar-status').textContent=weekly?'Vas sumando entrenamiento':'Un paso a la vez';
  $('today-workout-copy').textContent=d.plan.type+': una sesión guiada con movimientos de tu nivel.';
  $('today-workout-time').textContent=d.plan.approx_minutes;$('today-workout-rounds').textContent=d.plan.rounds;
  $('today-food-suggestion').textContent=d.recipes.length && d.pantry.length?d.recipes[0].name+' · '+d.recipes[0].time+' minutos':'Añade tus ingredientes para descubrir qué cocinar.';
  $('train-type').textContent=d.plan.type;$('train-minutes').textContent=d.plan.approx_minutes;$('train-rounds').textContent=d.plan.rounds;$('train-level').textContent=p.experience.toUpperCase();
  renderStudio(d,weekly,weight);
  const h=d.habits.find(x=>x.day===today())||{water:0,sleep:null};$('water-count').textContent=h.water;$('sleep-hours').value=h.sleep??'';
  $('habit-constancy').textContent=weekly?weekly+' sesión'+(weekly===1?'':'es')+' esta semana. ¡Bien ahí!':'La primera sesión de la semana puede ser hoy.';
  $('pantry-count').textContent=d.pantry.length+' ingredientes';
  $('pantry-tags').innerHTML=d.pantry.length?d.pantry.map(x=>'<span class="pantry-tag">'+esc(x.ingredient)+(x.quantity?' · '+esc(x.quantity):'')+'<button data-remove="'+Number(x.id)+'" aria-label="Quitar '+esc(x.ingredient)+'">×</button></span>').join(''):'<p class="muted-note">Todavía no has agregado alimentos.</p>';
  $('food-advice').textContent=d.food_message;
  if(d.nutrition){$('nutrition-intro').textContent=d.nutrition.intro;const n=d.nutrition;$('nutrition-insights').innerHTML=[[uiIcon('utensils'),'Verduras',n.vegetables],[uiIcon('activity'),'Proteína',n.protein],[uiIcon('heart'),'Carbohidrato',n.carbohydrate]].map(item=>'<div class="nutrition-item"><span>'+item[0]+'</span><small>'+item[1]+'</small><strong>'+esc(item[2])+'</strong></div>').join('');$('nutrition-recovery').textContent=n.recovery;$('nutrition-caution').textContent=n.caution;}
  $('ai-generate').disabled=!d.ai_enabled;$('ai-status').textContent=d.ai_enabled?'IA conectada: puedes crear recetas según tus ingredientes y preferencias.':'IA generativa aún no configurada en el servidor. Las recomendaciones automáticas funcionan sin ella.';
  const recipePhotos={huevos:'meal-eggs',pollo:'food',lentejas:'meal-veg',atun:'meal-salad',avena:'meal-breakfast',yogur:'meal-eggs',pescado:'meal-salad',garbanzos:'meal-veg'};
  $('recipe-grid').innerHTML=d.recipes.map(r=>{const known=r.have.length;const total=r.ingredients.length;const photo=recipePhotos[r.id]||'food';return '<button class="recipe-card" data-recipe="'+esc(r.id)+'" aria-label="Ver receta '+esc(r.name)+'"><img class="recipe-photo" src="./assets/media/'+photo+'.webp" loading="lazy" alt="Fotografía referencial de una preparación saludable"><div class="recipe-body"><h3>'+esc(r.name)+'</h3><div class="ingredients">'+esc(r.ingredients.join(' · '))+'</div><div class="recipe-card-bottom"><span>◷ '+r.time+' min</span><strong>'+(!d.pantry.length?'Ver receta':known===total?'¡Tienes todo!':known+'/'+total+' ingredientes')+' →</strong></div></div></button>';}).join('');
  $('meal-list').innerHTML=d.meals.length?d.meals.slice(0,10).map(m=>'<div class="meal-item"><span>'+esc(niceDate(m.day))+' · '+esc(m.meal_type)+'</span><strong>'+esc(m.description)+'</strong></div>').join(''):'<div class="empty-state">Aquí aparecerán tus comidas registradas.</div>';
  renderChart(d.measurements);
  $('workout-history').innerHTML=d.workouts.length?d.workouts.map(w=>'<div class="history-item"><div><strong>✳ '+esc(w.type)+'</strong><p>'+esc(niceDate(w.day))+' · '+w.minutes+' min</p></div><span>Esfuerzo '+w.rpe+'/10</span></div>').join(''):'<div class="empty-state">Aún no hay entrenamientos registrados. ¡Tu primera sesión te está esperando!</div>';
  fillProfile(p);
  if(state.tab==='entrenar'&&!state.trainer)startCoach(true);
 }
 function studioExercisePreview(id){
  const photos={marcha:'march',sentadilla:'squat',pared:'pushup',puente:'bridge',bird:'birddog',plancha:'plank',talones:'heels',equilibrio:'balance',remo:'row'};
  const key=photos[id];
  return key?'<img class="studio-exercise-photo" loading="lazy" alt="" src="./assets/media/exercise/thumb-'+key+'.webp">':exerciseIcon(id);
 }
 function studioStepList(){
  const d=state.data,plan=d.plan,t=state.trainer;
  const steps=[{name:'Activación suave',detail:plan.warmup+' min · Marcha y movilidad',id:'marcha',step:0}];
  plan.exercises.forEach((e,i)=>{
   const idx=t?.segments.findIndex(x=>x.exercise===e.name)??-1;
   steps.push({name:e.name,detail:e.muscle+' · '+plan.seconds+' segundos',id:e.id,step:Math.max(0,idx),muscle:e.muscle});
  });
  steps.push({name:'Vuelta a la calma',detail:plan.cooldown+' min · Movimiento lento',id:'marcha',step:(t?.segments.length??1)-1});
  return steps;
 }
 function renderStudio(d,weekly,weight){
  const p=d.profile,logs=d.workouts||[],measures=d.measurements||[];
  $('studio-goal').textContent=goalNames[p.goal]||'Bienestar';
  $('studio-plan-goal').textContent=goalNames[p.goal]||'Bienestar';
  $('studio-days').textContent=p.weekly_days;
  $('studio-done').textContent=weekly;
  $('studio-ex-count').textContent=d.plan.exercises.length;
  $('studio-plan-minutes').textContent=d.plan.approx_minutes;
  const programDay=Math.min((new Set(logs.map(x=>x.day))).size+1,Number(p.weekly_days)||3);
  $('studio-day-badge').textContent='Día '+programDay+' de '+p.weekly_days;
  $('studio-footer-week').textContent=weekly+' / '+p.weekly_days;
  $('studio-footer-bar').style.width=Math.min(100,Math.round(weekly/Math.max(1,p.weekly_days)*100))+'%';
  $('studio-footer-goal-copy').textContent=(goalNames[p.goal]||'Bienestar')+' · Más fuerza · Mejor salud';
  $('studio-weight').textContent=weight!==null && weight!=='' && Number.isFinite(+weight)?money(weight)+' kg':'Sin registro';
  $('studio-target').textContent=p.target_kg?'Meta: '+money(p.target_kg)+' kg':'Meta sin definir';
  const first=measures[0]?.weight_kg, latest=weight, target=p.target_kg;
  const validStart=Number.isFinite(Number(first))&&first!=null;
  const difference=validStart&&Number.isFinite(Number(latest))?Number(first)-Number(latest):null;
  $('studio-weight-change').textContent=difference===null||measures.length<2?'—':(difference>0?'−':difference<0?'+':'')+money(Math.abs(difference))+' kg';
  const hasGoal=validStart&&target!=null&&Number.isFinite(Number(target))&&Math.abs(Number(first)-Number(target))>=.1;
  const percent=hasGoal?Math.max(0,Math.min(100,Math.round((Number(first)-Number(latest))/(Number(first)-Number(target))*100))):null;
  $('studio-goal-progress').textContent=percent===null?'—':percent+'%';
  $('studio-weight-foot').textContent=percent===null?'Tu avance se calcula con tus mediciones':'Según tu peso inicial, actual y meta';
  const recipe=d.recipes?.[0],lastMeal=d.meals?.find(m=>m.day===today());
  $('studio-food-name').textContent=lastMeal?'Registraste: '+lastMeal.description:recipe?'Idea para hoy: '+recipe.name:'Explora recetas según tu despensa';
  const h=d.habits.find(x=>x.day===today())||{water:0};
  const water=Math.max(0,Number(h.water)||0);
  $('studio-water').textContent=water+' vasos · '+(water*250)+' ml estimados';
  $('studio-water-dots').innerHTML=Array.from({length:8},(_,i)=>'<i class="'+(i<Math.min(water,8)?'filled':'')+'"></i>').join('');

  const chart=$('studio-weight-chart');
  if(measures.length>=2){
   const m=measures.slice(-16),v=m.map(x=>Number(x.weight_kg)),min=Math.min(...v)-.7,max=Math.max(...v)+.7;
   const pts=v.map((y,i)=>(8+i/(v.length-1)*272).toFixed(2)+','+(82-(y-min)/(max-min)*71).toFixed(2)).join(' ');
   chart.innerHTML='<svg role="img" aria-label="Tendencia de peso según tus registros" viewBox="0 0 290 95" preserveAspectRatio="none"><defs><linearGradient id="studio-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#68fa79" stop-opacity=".3"/><stop offset="1" stop-color="#68fa79" stop-opacity="0"/></linearGradient></defs><path d="M8,86L282,86" stroke="#52617a" stroke-width="1"/><polygon points="8,86 '+pts+' 280,86" fill="url(#studio-chart-fill)"/><polyline points="'+pts+'" fill="none" stroke="#7af76b" stroke-width="3" stroke-linejoin="round"/></svg>';
  }else if(measures.length===1){
    chart.innerHTML='<svg role="img" aria-label="Una medición registrada: '+esc(measures[0].weight_kg)+' kilogramos" viewBox="0 0 290 95" preserveAspectRatio="none"><path d="M8 21H281 M8 48H281 M8 77H281" stroke="#33465b" stroke-dasharray="4 4"/><circle cx="142" cy="48" r="6" fill="#95ff72"/><text x="153" y="41" font-size="12" fill="#cbff9b">'+esc(money(measures[0].weight_kg))+' kg</text><text x="8" y="91" font-size="10" fill="#9fbbd4">Agrega otra medición para ver la curva</text></svg>';
  }else{chart.innerHTML='<div class="studio-chart-empty"><span>Tu primera medición activará el gráfico.</span><button type="button" id="studio-measure-cta" class="studio-text-link">Registrar peso ↗</button></div>';}
  renderStudioRoutine();
 }
 function renderStudioRoutine(){
  if(!state.data)return;
  const t=state.trainer,list=studioStepList(),active=t?.index??0;
  $('exercise-items').innerHTML=list.map((x,i)=>{
    const next=list[i+1]?.step??Number.POSITIVE_INFINITY;
    const current=t?.segments[t.index];const same=current?.exercise && current.exercise===x.name;const cls=t?(same || (active>=x.step && active<next)?' active':x.step<active?' done':''):'';
    const done=t && x.step<active;
    return '<button type="button" class="studio-routine-step '+cls+'" data-studio-step="'+x.step+'"><span class="studio-step-icon">'+studioExercisePreview(x.id)+'</span><span class="studio-step-name"><strong>'+esc(x.name)+'</strong><small>'+esc(x.detail)+'</small></span><span class="studio-step-state">'+(done?'✓':cls?'●':'')+'</span></button>';
  }).join('');
  const upcoming=state.data.plan.exercises.map(e=>({e,index:t?.segments.findIndex(x=>x.exercise===e.name)??-1})).filter(({index})=>index>=(t?.index??0)).slice(0,4);
  $('studio-upcoming').innerHTML=upcoming.length?upcoming.map(({e,index})=>'<button class="studio-upcoming-tile" type="button" data-studio-step="'+index+'"><span class="studio-up-preview">'+studioExercisePreview(e.id)+'</span><span><strong>'+esc(e.name)+'</strong><small>'+esc(e.muscle)+'</small></span></button>').join(''):'<div class="muted-note">Último tramo de la rutina. ¡Casi terminas!</div>';
 }
 function jumpToStudioStep(index){
  const t=state.trainer;if(!t||!Number.isInteger(index)||index<0||index>=t.segments.length)return;
  if(t.playing)stopTick();
  t.index=index;t.remaining=t.segments[index].seconds;t.started=true;
  renderCoach();renderStudioRoutine();speak(t.segments[index].title);
 }

 function updateVisualInsights(d,weekly,weight){
  const p=d.profile;
  $('focus-weight').textContent=Number.isFinite(Number(weight))&&weight!==null&&weight!==''?money(weight):'—';
  $('focus-target').textContent=p.target_kg?money(p.target_kg):'—';
  $('weekly-total').textContent=weekly;
  const days=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const now=new Date(today()+'T12:00:00'); const monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));
  const logs=d.workouts||[];
  $('weekly-bars').innerHTML=days.map((label,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);const id=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');const matching=logs.filter(w=>w.day===id);const mins=matching.reduce((s,w)=>s+Number(w.minutes||0),0);const h=mins?Math.min(96,Math.max(24,16+mins*1.45)):8;return '<div class="activity-column '+(mins?'':'empty')+'"><div class="activity-bar" style="height:'+h+'px" title="'+mins+' minutos el '+esc(label)+'"></div><span>'+label+'</span></div>';}).join('');
  const unique=new Set(logs.map(x=>x.day));const pointer=new Date(now);if(!unique.has(today()))pointer.setDate(pointer.getDate()-1);let streak=0;
  for(let i=0;i<120;i++){const id=pointer.getFullYear()+'-'+String(pointer.getMonth()+1).padStart(2,'0')+'-'+String(pointer.getDate()).padStart(2,'0');if(!unique.has(id))break;streak++;pointer.setDate(pointer.getDate()-1);}
  $('studio-header-streak').textContent=streak+' día'+(streak===1?'':'s');$('studio-notification-dot').hidden=!!logs.find(x=>x.day===today());$('streak-days').textContent=streak;$('streak-copy').textContent=streak===0?'Empieza tu racha con una sesión posible para ti.':streak===1?'¡Ya empezaste! Hoy sumaste un día.':'Llevas '+streak+' días seguidos con sesiones registradas.';
  const measures=d.measurements.slice(-16);const spark=$('weight-sparkline');
  if(measures.length>1){const vals=measures.map(x=>Number(x.weight_kg));const lo=Math.min(...vals)-.5,hi=Math.max(...vals)+.5;const pts=vals.map((v,i)=>(10+380*i/(vals.length-1)).toFixed(1)+','+(43-(v-lo)/(hi-lo)*34).toFixed(1)).join(' ');spark.innerHTML='<svg viewBox="0 0 400 54" preserveAspectRatio="none" role="img" aria-label="Tendencia de peso registrado"><polyline points="'+pts+'" fill="none" stroke="#c3a1f5" stroke-width="3"/><line x1="0" y1="52" x2="400" y2="52" stroke="#ffffff30"/></svg>';}else{spark.innerHTML='<div style="font-size:10px;color:#acb3c6;padding-top:11px">Registra mediciones para ver tu tendencia ↗</div>';}
  $('weight-context').textContent=measures.length>1?'Solo tus mediciones, sin valores estimados.':'Tu progreso se construye paso a paso.';
 }
  function renderChart(points){const el=$('weight-chart');if(!points.length){el.innerHTML='<div class="empty-chart">Agrega tu primera medición para ver tu evolución.</div>';return;}
  const data=points.slice(-30);const values=data.map(p=>Number(p.weight_kg));let min=Math.min(...values),max=Math.max(...values);if(max-min<2){min-=1;max+=1;}else{min-=.6;max+=.6;}
  const x=i=>data.length===1?260:48+(i/(data.length-1))*450;
  const y=v=>196-(v-min)/(max-min)*150;
  const path=data.map((p,i)=>(i===0?'M':'L')+x(i).toFixed(1)+','+y(Number(p.weight_kg)).toFixed(1)).join(' ');
  let grid='';for(let i=0;i<4;i++){let value=max-i*(max-min)/3;let yy=y(value);grid+='<line x1="42" y1="'+yy+'" x2="515" y2="'+yy+'" stroke="#e4ebe0"/><text x="0" y="'+(yy+4)+'" font-size="12" fill="#8c9d90">'+value.toFixed(1)+'</text>';}
  let circles=data.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(Number(p.weight_kg))+'" r="4.3" fill="#7da94e"><title>'+esc(p.date)+': '+esc(p.weight_kg)+' kg</title></circle>').join('');
  el.innerHTML='<svg role="img" aria-label="Gráfico de evolución de peso en kilogramos" viewBox="0 0 540 235">'+grid+'<path d="'+path+'" fill="none" stroke="#80ac52" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>'+circles+'<text x="42" y="225" font-size="12" fill="#8c9d90">'+esc(niceDate(data[0].date))+'</text><text x="515" y="225" font-size="12" fill="#8c9d90" text-anchor="end">'+esc(niceDate(data[data.length-1].date))+'</text></svg>';
 }
 function fillProfile(p){const f=$('profile-form');['display_name','age','height_cm','weight_kg','target_kg','experience','pushups','squats','weekly_days','minutes','equipment'].forEach(k=>{const e=f.elements.namedItem(k);if(e)e.value=p[k]??'';});
  f.querySelectorAll('input[name="goal"]').forEach(el=>el.checked=el.value===p.goal);
  f.querySelectorAll('input[name="health_flags"]').forEach(el=>el.checked=(p.health_flags||[]).includes(el.value));
  $('allergy-input').value=(p.allergies||[]).join(', ');$('avoid-input').value=(p.avoid_foods||[]).join(', ');
 }
 function strList(s){return s.split(',').map(x=>x.trim()).filter(Boolean);}
 async function handleAuth(e){e.preventDefault();const button=$('auth-submit');button.disabled=true;
  try{const action=state.register?'register':'login';const payload={email:$('auth-email').value.trim(),password:$('auth-password').value};if(state.register)payload.name=$('auth-name').value.trim();const d=await api(action,payload);state.csrf=d.csrf;state.profile=d.profile;showApp(d.user);await refresh();if(state.register){tab('perfil');toast('Cuenta creada. Completa tu punto de partida.');}else toast('¡Qué bueno verte de nuevo!');$('auth-password').value='';}
  catch(err){toast(err.message,true);}finally{button.disabled=false;}
 }
 async function saveProfile(e){e.preventDefault();const f=e.currentTarget;const b=Object.fromEntries(new FormData(f).entries());b.health_flags=Array.from(f.querySelectorAll('input[name="health_flags"]:checked')).map(e=>e.value);b.allergies=strList($('allergy-input').value);b.avoid_foods=strList($('avoid-input').value);
  try{await api('profile',b);await refresh();toast('Tu plan quedó actualizado.');tab('inicio');}catch(err){toast(err.message,true);}
 }
 async function addPantry(e){e.preventDefault();const input=$('pantry-ingredient');try{await api('pantry_add',{ingredient:input.value,quantity:''});input.value='';await refresh();toast('Ingrediente agregado a tu cocina.');}catch(err){toast(err.message,true);}}
 async function removePantry(id){try{await api('pantry_remove',{id});await refresh();toast('Ingrediente quitado.');}catch(err){toast(err.message,true);}}
 async function logMeal(e){e.preventDefault();try{await api('meal',{type:$('meal-type').value,description:$('meal-text').value.trim()});$('meal-text').value='';await refresh();toast('Comida registrada.');}catch(err){toast(err.message,true);}}
 async function logMeasure(e){e.preventDefault();try{await api('measurement',{date:$('measure-date').value,weight_kg:$('measure-weight').value,waist_cm:$('measure-waist').value||null});await refresh();toast('Medición guardada.');}catch(err){toast(err.message,true);}}
 async function saveHabit(patch){const current=state.data.habits.find(h=>h.day===today())||{water:0,sleep:null,steps:null};const value=Object.assign({},current,patch);try{await api('habits',{water:value.water,sleep:value.sleep,steps:value.steps});await refresh();}catch(err){toast(err.message,true);}}
 function viewRecipe(id){const r=state.data.recipes.find(x=>x.id===id);if(!r)return;
  $('recipe-detail').innerHTML='<img src="./assets/media/'+({huevos:'meal-eggs',pollo:'food',lentejas:'meal-veg',atun:'meal-salad',avena:'meal-breakfast',yogur:'meal-eggs',pescado:'meal-salad',garbanzos:'meal-veg'}[r.id]||'food')+'.webp" alt="Imagen referencial de plato saludable" style="width:100%;height:190px;object-fit:cover;border-radius:12px;margin-bottom:14px"><h2 id="recipe-title">'+esc(r.name)+'</h2><p class="muted-note">◷ '+r.time+' minutos · '+esc(r.portion)+'</p><h3>Ingredientes</h3><ul>'+r.ingredients.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul><h3>Paso a paso</h3><ol>'+r.steps.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol><div class="missing">'+(r.missing.length?'Te faltaría comprar: <strong>'+esc(r.missing.join(', '))+'</strong>':'¡Ya tienes todos los ingredientes registrados!')+'</div>';
  $('recipe-modal').hidden=false;
 }
 async function aiRecipe(){const b=$('ai-generate');b.disabled=true;b.textContent='✦ Preparando tu receta...';try{const d=await api('ai_recipe',{request:$('ai-request').value.trim()});$('ai-answer').hidden=false;$('ai-answer').textContent=d.recipe;toast('Receta creada.');}catch(e){toast(e.message,true);}finally{b.disabled=!(state.data&&state.data.ai_enabled);b.textContent='✦ Crear receta con IA';}}
 let ctx=null;
 function beep(){try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;g.gain.value=.055;o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.12);}catch(e){}}
 function speak(s){if(!$('coach-voice').checked||!('speechSynthesis' in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(s);u.lang='es-CL';u.rate=1;u.pitch=1;speechSynthesis.speak(u);}catch(e){}}
 function buildSegments(plan){let seg=[{phase:'Calentamiento',title:'Calentamiento: marcha suave',icon:'🌤',tip:'Marcha en tu lugar alternando rodillas y brazos a ritmo cómodo. Después mueve suavemente los hombros. Debes poder conversar y respirar con normalidad.',seconds:plan.warmup*60}];for(let round=1;round<=plan.rounds;round++){plan.exercises.forEach((e,i)=>{seg.push({phase:'RONDA '+round+' / '+plan.rounds,title:e.name,icon:e.icon,tip:e.tip+' Alternativa: '+e.easy,seconds:plan.seconds,exercise:e.name});if(round!==plan.rounds||i!==plan.exercises.length-1)seg.push({phase:'RECUPERACIÓN',title:'Descansa y respira',icon:'◷',tip:'Suelta los hombros y toma aire. Si lo necesitas, alarga la pausa.',seconds:plan.rest});});}
 seg.push({phase:'VUELTA A LA CALMA',title:'Vuelta a la calma: marcha lenta',icon:'🌿',tip:'Camina despacio y reduce el ritmo gradualmente. Respira sin forzar. Si estiras, hazlo suave y sin dolor.',seconds:plan.cooldown*60});return seg;}
 function startCoach(silent=false){if(!state.data)return;if(state.trainer)stopTick();window.VivaSprite?.stop();window.VivaSprite?.start('coach-sprite');const p=state.data.plan;state.trainer={segments:buildSegments(p),index:0,remaining:0,playing:false,timer:null,started:false,activeSeconds:0,lastTick:null};state.trainer.remaining=state.trainer.segments[0].seconds;$('coach-overlay').hidden=false;$('coach-complete').hidden=true;$('coach-body')?.removeAttribute('hidden');renderCoach();renderStudioRoutine();if(!silent){beep();$('coach-stage').scrollIntoView({block:'start',behavior:'instant'});}}
 function renderCoach(){const t=state.trainer;if(!t)return;const seg=t.segments[t.index];
   const demo=$('coach-demo');
   const name=String(seg.exercise||'').toLowerCase();
   let mode='march';
   if(name.includes('sentadilla'))mode='squat';
   else if(name.includes('flexiones inclinadas'))mode='incline';
   else if(name.includes('flexion'))mode='pushup';
   else if(name.includes('puente'))mode='bridge';
   else if(name.includes('bird'))mode='birddog';
   else if(name.includes('marcha'))mode='march';
   else if(name.includes('plancha'))mode='plank';
   else if(name.includes('talones'))mode='heels';
   else if(name.includes('equilibrio'))mode='balance';
   else if(name.includes('remo'))mode='row';
   if(seg.phase==='RECUPERACIÓN')mode='rest';
   if(seg.phase==='VUELTA A LA CALMA'||seg.phase==='Calentamiento')mode='march';
   // Local MP4 from AI-drawn poses; no per-session generation or paid model credits.
   const cinematicModes=['squat','pushup','bridge','birddog'];
   const videoModes=['squat','pushup','bridge','birddog','incline','plank','heels','balance','row'];
   const useVideo=videoModes.includes(mode);
   const videoUrl='./assets/media/'+(cinematicModes.includes(mode)?'guide-':'demo-')+mode+'.mp4?v=8';
   const sprite=window.VivaSprite?.hasMode(mode) && (!useVideo || demo.dataset.failedSource===videoUrl);
   const info=$('studio-technique'),tip=$('studio-technique-text');
   if(info&&tip){info.hidden=seg.phase==='RECUPERACIÓN';tip.textContent=String(seg.tip||'').split(' Alternativa:')[0];}
   const canvas=$('coach-sprite');
   const rest=$('coach-rest-visual');
   const showRest=mode==='rest';
   canvas.hidden=!sprite;rest.hidden=!showRest;demo.hidden=!!sprite||showRest;
   if(sprite){
     if(!demo.paused)demo.pause();
     window.VivaSprite?.setMode(mode);
     canvas.setAttribute('aria-label','Animación del ejercicio: '+seg.title);
   }else if(showRest){
     if(!demo.paused)demo.pause();
   }else if(useVideo){
     if(demo.dataset.source!==videoUrl){
       demo.dataset.failedSource='';
       demo.dataset.source=videoUrl;
       demo.src=videoUrl;
       demo.load();
       demo.setAttribute('aria-label','Video en bucle con una demostración ilustrativa de '+seg.title);
       demo.poster='./assets/media/exercise/'+({'squat':'thumb-squat','pushup':'thumb-pushup','bridge':'thumb-bridge','birddog':'thumb-birddog','incline':'thumb-pushup','plank':'thumb-plank','heels':'thumb-heels','balance':'thumb-balance','row':'thumb-row'}[mode]||'thumb-march')+'.webp';
     }
     if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && demo.paused && !document.hidden && state.tab==='entrenar'){
       demo.play().catch(()=>{/* Poster visible if autoplay is blocked */});
     }
   }
   if(t.lastRenderedIndex!==t.index){
     const ghostLeft=document.querySelector('.studio-ghost-left'),ghostRight=document.querySelector('.studio-ghost-right');
     const modeImages=['march','squat','pushup','bridge','birddog'];
     const visualMode=modeImages.includes(mode)?mode:null;
     [ghostLeft,ghostRight].forEach((el,i)=>{el.hidden=!visualMode;if(visualMode)el.style.backgroundImage='url("./assets/media/exercise/'+visualMode+'-'+(i?'end':'start')+'.webp")';});
     const muscle=$('studio-muscle-card');muscle.hidden=!['pushup','incline','row'].includes(mode);
     $('studio-coach-eyebrow').textContent=seg.phase.includes('RONDA')?seg.phase:'ENTRENADOR GUIADO';
     const round=seg.phase.match(/RONDA\s+(\d+)\s*\/\s*(\d+)/);
     $('studio-series').textContent=round?'Ronda '+round[1]+' de '+round[2]:(seg.phase==='RECUPERACIÓN'?'Recuperación':'Calentamiento y movilidad');
     $('studio-series-detail').textContent=round?state.data.plan.seconds+' segundos · '+(seg.exercise||''):seg.phase==='RECUPERACIÓN'?'Respira a tu ritmo':'Empieza con calma';

     $('coach-next-list').innerHTML=t.segments.slice(t.index,t.index+4).map((x,i)=>'<span class="'+(i===0?'active':'')+'">'+esc(x.title)+'</span>').join('');
     t.lastRenderedIndex=t.index;
     renderStudioRoutine();
   }
 const mm=String(Math.floor(Math.ceil(t.remaining)/60)).padStart(2,'0');const ss=String(Math.ceil(t.remaining)%60).padStart(2,'0');$('coach-timer').textContent=mm+':'+ss;$('coach-phase').textContent=seg.phase;$('coach-title').textContent=seg.title;$('coach-icon').innerHTML=uiIcon(seg.exercise?'activity':'sparkles');$('coach-tip').textContent=seg.tip;$('coach-position').textContent='Paso '+(t.index+1)+' de '+t.segments.length;$('coach-progress-fill').style.width=((t.index+(1-t.remaining/seg.seconds))/t.segments.length*100).toFixed(1)+'%';$('coach-play').textContent=t.playing?'Ⅱ Pausar':(t.started?'▶ Continuar':'▶ Iniciar');const ring=document.querySelector('.studio-clock-circle');if(ring)ring.style.setProperty('--remaining',Math.max(0,Math.min(100,t.remaining/seg.seconds*100))+'%');}
 function stopTick(){const t=state.trainer;if(t){clearInterval(t.timer);t.timer=null;t.playing=false;}if('speechSynthesis' in window){try{speechSynthesis.cancel();}catch(e){}}}
 function tick(){const t=state.trainer;if(!t||!t.playing)return;const now=performance.now();const diff=Math.max(0,(now-t.lastTick)/1000);t.lastTick=now;t.remaining-=diff;t.activeSeconds+=diff;
  if(t.remaining<=0){nextCoach(true);return;}renderCoach();
 }
 function playPause(){const t=state.trainer;if(!t)return;if(t.playing){stopTick();renderCoach();return;}t.playing=true;t.started=true;t.lastTick=performance.now();t.timer=setInterval(tick,180);renderCoach();speak(t.segments[t.index].title);}
 function nextCoach(auto=false){const t=state.trainer;if(!t)return;const play=t.playing;clearInterval(t.timer);t.timer=null;t.index++;if(t.index>=t.segments.length){finishCoach();return;}t.remaining=t.segments[t.index].seconds;t.playing=false;if(play){t.playing=true;t.lastTick=performance.now();t.timer=setInterval(tick,180);}beep();renderCoach();if(play)speak(t.segments[t.index].title);}
 function prevCoach(){const t=state.trainer;if(!t)return;const play=t.playing;clearInterval(t.timer);t.index=Math.max(0,t.index-1);t.remaining=t.segments[t.index].seconds;t.playing=play;if(play){t.lastTick=performance.now();t.timer=setInterval(tick,180);}renderCoach();}
 function finishCoach(){const t=state.trainer;if(!t)return;stopTick();window.VivaSprite?.stop();$('coach-demo').pause();$('coach-body').hidden=true;$('coach-complete').hidden=false;beep();speak('¡Excelente trabajo! Finalizaste la sesión.');}
 function exitCoach(){stopTick();$('coach-demo').pause();window.VivaSprite?.stop();state.trainer=null;$('coach-overlay').hidden=true;$('coach-body').hidden=false;if(state.tab==='entrenar')tab('inicio');}
 async function saveCoach(){const t=state.trainer;if(!t||t.activeSeconds<45){toast('Para guardar necesitas haber entrenado al menos 45 segundos.',true);return;}
  try{await api('workout',{rpe:Number($('coach-rpe').value),minutes:Math.max(1,Math.round(t.activeSeconds/60)),type:state.data.plan.type,exercises:state.data.plan.exercises.map(x=>x.name)});exitCoach();await refresh();toast('¡Sesión registrada! Tu próximo plan se adaptará.');tab('inicio');}catch(e){toast(e.message,true);}
 }
 function wire(){
  const stage=$('coach-stage'), overlay=$('coach-overlay');
  if(stage&&overlay){stage.replaceChildren(overlay);}
  $('train-goal-open').onclick=()=>tab('perfil');
  $('studio-calendar').onclick=()=>tab('progreso');
  $('studio-weight-chart').addEventListener('click',ev=>{if(ev.target.closest('#studio-measure-cta'))tab('progreso');});
  $('studio-notifications').onclick=()=>{const d=state.data;const done=d?.workouts?.some(x=>x.day===today());if(!done){tab('entrenar');toast('Tu sesión de hoy está lista cuando tú quieras.');}else toast('Ya registraste una sesión hoy. ¡Bien hecho!');};
  $('nav-habits').onclick=()=>{tab('inicio');setTimeout(()=>$('habit-constancy')?.closest('.habits-grid')?.scrollIntoView({behavior:'smooth',block:'center'}),60);};
  $('nav-community').onclick=()=>toast('La comunidad todavía no está disponible. Tu información sigue siendo privada.');
  $('nav-settings').onclick=()=>tab('perfil');
  $('studio-water-add').onclick=()=>{const h=state.data?.habits?.find(x=>x.day===today());saveHabit({water:Math.min(20,(Number(h?.water)||0)+1)});};
  $('view-entrenar').addEventListener('click',ev=>{const b=ev.target.closest('[data-studio-step]');if(b)jumpToStudioStep(Number(b.dataset.studioStep));});
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
  $('go-profile').onclick=()=>tab('perfil');
  document.querySelectorAll('[data-goal-jump]').forEach(el=>el.addEventListener('click',()=>{tab('perfil');const goal=document.querySelector('input[name="goal"][value="'+el.dataset.goalJump+'"]');if(goal){goal.checked=true;goal.closest('.choice-card').scrollIntoView({behavior:'smooth',block:'center'});toast('Objetivo seleccionado. Guarda tu plan para aplicarlo.');}}));
  $('global-search').addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const q=e.currentTarget.value.trim().toLocaleLowerCase('es');if(!q)return;const matches=state.data?.recipes?.filter(x=>x.name.toLowerCase().includes(q)||x.ingredients.some(y=>y.toLowerCase().includes(q)));if(matches?.length){tab('comer');$('recipe-grid').scrollIntoView({block:'start',behavior:'smooth'});document.querySelectorAll('.recipe-card').forEach(x=>x.style.outline=matches.some(r=>r.id===x.dataset.recipe)?'2px solid #caff72':'');toast(matches.length+' recetas relacionadas.');}else if(state.data?.plan?.exercises?.some(x=>x.name.toLowerCase().includes(q))||/ejerci|entren|calisteni|fuerza/.test(q)){tab('entrenar');toast('Te llevé al entrenador.');}else if(/peso|medid|progreso|cintura/.test(q)){tab('progreso');}else if(/meta|objetivo|perfil|defin/.test(q)){tab('perfil');}else{toast('Sin coincidencias por ahora. Prueba con un ingrediente o ejercicio.',true);}});$('hero-food').onclick=()=>tab('comer');$('today-food-open').onclick=()=>tab('comer');
  $('hero-start').onclick=()=>tab('entrenar');$('today-workout-open').onclick=()=>tab('entrenar');
  $('switch-login').onclick=()=>setAuthMode(false);$('switch-register').onclick=()=>setAuthMode(true);
  $('auth-form').addEventListener('submit',handleAuth);$('profile-form').addEventListener('submit',saveProfile);
  $('pantry-form').addEventListener('submit',addPantry);$('meal-form').addEventListener('submit',logMeal);$('measurement-form').addEventListener('submit',logMeasure);
  $('pantry-tags').addEventListener('click',e=>{const btn=e.target.closest('[data-remove]');if(btn)removePantry(Number(btn.dataset.remove));});
  $('recipe-grid').addEventListener('click',e=>{const btn=e.target.closest('[data-recipe]');if(btn)viewRecipe(btn.dataset.recipe);});
  $('recipe-close').onclick=()=>$('recipe-modal').hidden=true;$('recipe-modal').addEventListener('click',e=>{if(e.target===$('recipe-modal'))$('recipe-modal').hidden=true;});
  $('ai-generate').onclick=aiRecipe;
  $('water-minus').onclick=()=>{const h=state.data.habits.find(x=>x.day===today());saveHabit({water:Math.max(0,(Number(h?.water)||0)-1)});};
  $('water-plus').onclick=()=>{const h=state.data.habits.find(x=>x.day===today());saveHabit({water:Math.min(20,(Number(h?.water)||0)+1)});};
  $('sleep-save').onclick=()=>saveHabit({sleep:$('sleep-hours').value===''?null:Number($('sleep-hours').value)});
  $('coach-demo').addEventListener('error',()=>{
    const demo=$('coach-demo'),mode=demo.dataset.source?.match(/(?:guide-|demo-)([a-z]+)\.mp4/)?.[1];
    if(window.VivaSprite?.hasMode(mode)){
      demo.dataset.failedSource=demo.dataset.source;
      demo.hidden=true;
      $('coach-sprite').hidden=false;
      window.VivaSprite?.setMode(mode);
    }else{demo.poster='./assets/media/training.webp';}
  });
  $('open-coach').onclick=()=>startCoach(false);$('coach-exit').onclick=exitCoach;$('coach-play').onclick=playPause;$('coach-next').onclick=()=>nextCoach(false);$('coach-prev').onclick=prevCoach;$('coach-discard').onclick=exitCoach;$('coach-save').onclick=saveCoach;
  $('coach-rpe').oninput=()=>$('coach-rpe-label').textContent=$('coach-rpe').value;
  $('export-data').onclick=async()=>{try{const data=await api('export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='viva-salud-mis-datos-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Exportación descargada.');}catch(e){toast(e.message,true);}};
  $('delete-account').onclick=async()=>{if(!confirm('¿Eliminar DEFINITIVAMENTE tu cuenta y todos tus datos?'))return;const pass=$('delete-password').value;if(!pass){toast('Escribe tu contraseña para confirmar.',true);return;}try{const data=await api('delete_account',{password:pass});state.csrf=data.csrf;state.user=null;state.data=null;state.profile=null;showApp(null);toast('Cuenta y datos eliminados.');}catch(e){toast(e.message,true);}};
  $('logout').onclick=async()=>{try{const d=await api('logout',{});state.csrf=d.csrf;state.user=null;state.profile=null;state.data=null;showApp(null);$('auth-password').value='';toast('Sesión cerrada.');}catch(e){toast(e.message,true);}};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('recipe-modal').hidden=true;}});
 }
 async function init(){wire();$('measure-date').value=today();try{const s=await api('session');state.csrf=s.csrf;if(s.user){showApp(s.user);await refresh();}else showApp(null);}catch(e){showApp(null);toast('No se pudo conectar con el servidor: '+e.message,true);$('auth-submit').disabled=true;}}
 document.addEventListener('DOMContentLoaded',()=>{init();if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});}});
})();
