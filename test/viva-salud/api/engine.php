<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';

function workoutPlan(array $p,array $recent): array {
 $count=count($recent);
 $phase=$count%3;
 $type=['Fuerza funcional','Movimiento y cardio suave','Fuerza + core'][$phase];
 $rpe=$count?(int)$recent[0]['rpe']:7;
 $experience=$p['experience']??'principiante';
 $push=$p['pushups']??'0';$squat=$p['squats']??'0';
 $sensitive=in_array('presion_alta',$p['health_flags']??[],true)||in_array('dolor_articular',$p['health_flags']??[],true)||in_array('retorno',$p['health_flags']??[],true);
 $seconds=$experience==='avanzado'?40:($experience==='intermedio'?35:30);
 if($rpe>=8)$seconds=max(20,$seconds-5);
 if($rpe>0 && $rpe<=5 && !$sensitive)$seconds=min(45,$seconds+5);
 $rest=$experience==='principiante'?30:25;
 $base=[
 ['id'=>'sentadilla','name'=>'Sentadilla a silla','icon'=>'🦵','tip'=>'Baja lento hacia una silla firme, exhala al levantarte.','easy'=>'Usa apoyo de manos o reduce el rango.','muscle'=>'Piernas y glúteos'],
 ['id'=>'pared','name'=>'Flexiones en pared','icon'=>'💪','tip'=>'Manos al ancho de hombros, abdomen activo. Exhala al empujar.','easy'=>'Acerca los pies a la pared.','muscle'=>'Pecho y brazos'],
 ['id'=>'puente','name'=>'Puente de glúteos','icon'=>'🍑','tip'=>'Boca arriba, rodillas dobladas. Sube cadera sin forzar la espalda.','easy'=>'Eleva menos la cadera.','muscle'=>'Glúteos y zona media'],
 ['id'=>'bird','name'=>'Bird dog','icon'=>'🧘','tip'=>'En cuatro apoyos, estira brazo y pierna opuestos sin girar el tronco.','easy'=>'Estira solo una extremidad.','muscle'=>'Core y estabilidad'],
 ['id'=>'marcha','name'=>'Marcha activa','icon'=>'🚶','tip'=>'Camina en tu lugar a un ritmo que te permita hablar.','easy'=>'Marcha muy suave, con apoyo si lo necesitas.','muscle'=>'Cardio suave'],
 ['id'=>'equilibrio','name'=>'Equilibrio apoyado','icon'=>'⚖️','tip'=>'Sujétate de una silla firme y mantén equilibrio de un pie por vez.','easy'=>'Mantén ambos pies en el suelo y eleva apenas un talón.','muscle'=>'Estabilidad'],
 ['id'=>'remo','name'=>'Remo con banda','icon'=>'🧵','tip'=>'Banda sujeta de forma estable; lleva codos atrás sin elevar hombros.','easy'=>'Usa menor tensión.','muscle'=>'Espalda y brazos'],
 ['id'=>'talones','name'=>'Elevación de talones','icon'=>'🦶','tip'=>'Junto a una silla, sube lentamente sobre puntas de pies.','easy'=>'Sube menos y usa ambas manos de apoyo.','muscle'=>'Pantorrillas'],
 ['id'=>'plancha','name'=>'Plancha inclinada','icon'=>'🔥','tip'=>'Apóyate en mesa firme, cuerpo alineado y respiración constante.','easy'=>'Eleva más las manos o acorta el tiempo.','muscle'=>'Abdomen y hombros']
 ];
 $sets=[[0,1,2,3,7],[4,5,7,3,2],[0,1,6,8,4]];
 $indices=$sets[$phase];
 if(($p['equipment']??'ninguno')==='ninguno')$indices=array_map(fn($x)=>$x===6?1:$x,$indices);
 if($push==='11-20'||$push==='20+'){$base[1]['name']='Flexiones inclinadas';$base[1]['tip']='Manos sobre mesa fija, cuerpo alineado. Exhala al subir.';}
 if(($squat==='21-40'||$squat==='40+')&& !$sensitive){$base[0]['name']='Sentadilla controlada';$base[0]['tip']='Sin silla, baja hasta donde controles sin dolor y exhala al subir.';}
 $exercises=array_map(fn($i)=>$base[$i],$indices);
 $minutes=max(10,min(40,(int)($p['minutes']??20)));
 $rounds=max(2,min(5,(int)floor(max(0,($minutes-4)*60)/(count($exercises)*($seconds+$rest)))));
 return ['type'=>$type,'date'=>today(),'exercises'=>$exercises,'seconds'=>$seconds,'rest'=>$rest,'rounds'=>$rounds,'warmup'=>3,'cooldown'=>2,'approx_minutes'=>max(10,(int)round(($rounds*count($exercises)*($seconds+$rest)+300)/60)),'notice'=>'Muévete sin dolor y sin aguantar la respiración. Si aparecen dolor de pecho, mareo intenso o falta de aire inusual, detén la sesión.','adapted'=>$count>0];
}

function recipeCatalog(): array {
 return [
 ['id'=>'huevos','name'=>'Tortilla de verduras','icon'=>'🍳','time'=>15,'ingredients'=>['huevo','espinaca','tomate','cebolla'],'tags'=>['sin gluten','proteína'],'steps'=>['Lava y corta las verduras.','Saltea con una cucharadita de aceite de oliva.','Añade los huevos batidos y cocina por ambos lados.'],'portion'=>'2 huevos + 2 puñados de verduras por persona'],
 ['id'=>'pollo','name'=>'Pollo con arroz y ensalada','icon'=>'🥗','time'=>25,'ingredients'=>['pollo','arroz','lechuga','tomate'],'tags'=>['almuerzo','proteína'],'steps'=>['Cocina el arroz según el envase.','Cocina el pollo completamente, con condimentos y poca sal.','Sirve con abundante ensalada.'],'portion'=>'1 palma de pollo + 1 puño de arroz cocido + 2 puños de verduras'],
 ['id'=>'lentejas','name'=>'Ensalada tibia de lentejas','icon'=>'🥣','time'=>20,'ingredients'=>['lentejas','zanahoria','cebolla','pimentón'],'tags'=>['vegetal','fibra'],'steps'=>['Usa lentejas previamente cocidas y escurridas.','Corta y cocina las verduras hasta que estén tiernas.','Mezcla, añade limón y una pequeña cantidad de aceite.'],'portion'=>'1 taza de lentejas cocidas + 2 puños de verduras'],
 ['id'=>'atun','name'=>'Bowl rápido de atún','icon'=>'🐟','time'=>10,'ingredients'=>['atún','arroz','pepino','tomate'],'tags'=>['rápida','proteína'],'steps'=>['Escurre el atún, idealmente bajo en sodio.','Mezcla con arroz cocido y vegetales frescos.','Aliña con limón y aceite de oliva.'],'portion'=>'1 porción de atún + ½–1 taza arroz cocido + 2 puños verduras'],
 ['id'=>'avena','name'=>'Avena con fruta y semillas','icon'=>'🍓','time'=>8,'ingredients'=>['avena','plátano','chía'],'tags'=>['desayuno','fibra'],'steps'=>['Cocina la avena en agua o bebida apta.','Corta el plátano.','Agrega fruta y una cucharadita de semillas.'],'portion'=>'½ taza de avena seca + 1 fruta + 1 cucharadita de semillas'],
 ['id'=>'yogur','name'=>'Bastones con salsa fresca','icon'=>'🥕','time'=>10,'ingredients'=>['zanahoria','apio','pepino','yogur sin lactosa'],'tags'=>['colación','crujiente'],'steps'=>['Lava y corta verduras en bastones.','Mezcla yogur natural sin azúcar con limón y hierbas.','Sirve frío.'],'portion'=>'2 puños de bastones + 3 cucharadas de salsa'],
 ['id'=>'pescado','name'=>'Pescado al horno con papas','icon'=>'🐟','time'=>30,'ingredients'=>['pescado','papa','brócoli','limón'],'tags'=>['horno','proteína'],'steps'=>['Precalienta el horno a 190 °C.','Hornea papas en trozos hasta ablandar.','Agrega pescado y brócoli; cocina hasta que el pescado esté listo.'],'portion'=>'1 palma de pescado + 1 papa pequeña + 2 puños verduras'],
 ['id'=>'garbanzos','name'=>'Salteado de garbanzos','icon'=>'🫘','time'=>15,'ingredients'=>['garbanzos','zapallo italiano','pimentón','cebolla'],'tags'=>['vegetal','sin gluten'],'steps'=>['Escurre y enjuaga garbanzos cocidos.','Saltea las verduras a fuego medio.','Agrega garbanzos y condimenta con hierbas.'],'portion'=>'¾–1 taza de garbanzos cocidos + 2 puños de verduras']
 ];
}
function normIngredient(string $s): string {
 $s=strtolower(trim($s));
 $s=strtr($s,['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n']);
 return $s;
}
function isAvoided(array $recipe,array $p): bool {
 $all=array_merge($p['allergies']??[],$p['avoid_foods']??[]);
 $check=normIngredient(implode(' ',$recipe['ingredients']));
 foreach($all as $v){$a=normIngredient($v);if($a==='')continue;
  if(str_contains($check,$a))return true;
  if($a==='lactosa'&&str_contains($check,'yogur'))return true;
  if($a==='gluten'&&str_contains($check,'avena'))return true;
  if($a==='huevo'&&str_contains($check,'huevo'))return true;
  if($a==='pescado'&&str_contains($check,'atun'))return true;
 }
 return false;
}
function recipeSuggestions(array $ingredients,array $p): array {
 $items=array_map('normIngredient',$ingredients);
 $recipes=[];
 foreach(recipeCatalog() as $r) {
  if(isAvoided($r,$p))continue;
  $have=[];$missing=[];
  foreach($r['ingredients'] as $ing){$found=false;foreach($items as $item){if(str_contains($item,normIngredient($ing))||str_contains(normIngredient($ing),$item)){$found=true;break;}}if($found)$have[]=$ing;else $missing[]=$ing;}
  $r['have']=$have;$r['missing']=$missing;$r['score']=count($have)/max(1,count($r['ingredients']));$recipes[]=$r;
 }
 usort($recipes,fn($a,$b)=>($b['score']<=>$a['score'])?:($a['time']<=>$b['time']));
 return $recipes;
}
function foodMessage(array $p): string {
 $goal=$p['goal']??'salud';
 if($goal==='bajar')return 'Prioriza proteína, muchas verduras y carbohidratos según hambre y actividad. Evita dietas extremas.';
 if($goal==='musculo'||$goal==='definir')return 'Incluye proteína en cada comida y acompaña el entrenamiento de fuerza con suficiente energía.';
 return 'Busca variedad, verduras, proteína, fibra, grasas saludables y comidas sostenibles.';
}


function nutritionInsights(array $p,array $workouts): array {
 $goal=$p['goal']??'salud';
 $weight=$p['weight_kg']??null;
 $target=$p['target_kg']??null;
 $recent=null;
 foreach($workouts as $w) { if($w['day']===today()){$recent=$w;break;} }
 $effort=$recent && (int)$recent['rpe']>=7 && (int)$recent['minutes']>=15;
 $weightNote='';
 if(is_numeric($weight)&&is_numeric($target)) {
  $delta=round(abs((float)$weight-(float)$target),1);
  $weightNote='Distancia a tu meta: '.number_format($delta,1,',','.').' kg. Los cambios toman tiempo.';
 }
 $protein=($goal==='musculo'||$goal==='definir')?'1–2 palmas':'1 palma';
 $carb=$effort?'1–2 puños':'1 puño';
 $recovery=$effort?'Hoy registraste esfuerzo alto: acompaña tu recuperación con proteína, carbohidratos y descanso.':'Ajusta las porciones según tu apetito y actividad; evita saltarte comidas para compensar.';
 $caution='';
 if(in_array('calculos_renales',$p['health_flags']??[],true))$caution='Si tienes antecedentes de cálculos renales, consulta con tu equipo médico antes de aumentar mucho las proteínas o modificar la hidratación.';
 if(in_array('presion_alta',$p['health_flags']??[],true))$caution.=($caution?' ':'').'Prioriza alimentos frescos y modera la sal.';
 return [
   'intro'=>$weightNote?:'Una guía visual flexible; no necesitas contar cada caloría.',
   'vegetables'=>'½ plato',
   'protein'=>$protein,
   'carbohydrate'=>$carb,
   'recovery'=>$recovery,
   'caution'=>trim($caution)
 ];
}
