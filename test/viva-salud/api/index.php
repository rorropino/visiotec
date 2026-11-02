<?php
declare(strict_types=1);
require_once __DIR__.'/engine.php';
$action=clean($_GET['action']??'',40);

try {
 switch($action) {
 case 'health':
  $check=db()->query('SELECT 1')->fetchColumn();
  out(['database'=>$check?'ok':'error']);
 case 'session':
  $id=(int)($_SESSION['uid']??0);
  $user=$id?one('SELECT id,email FROM users WHERE id=?',[$id]):null;
  if(!$user){unset($_SESSION['uid']);out(['csrf'=>$_SESSION['csrf'],'user'=>null]);}
  out(['csrf'=>$_SESSION['csrf'],'user'=>$user,'profile'=>profile($id),'ai_enabled'=>(bool)getenv('VIVA_OPENROUTER_API_KEY')]);
 case 'register':
  postOnly();$b=requestBody();verifyCsrf($b);
  $email=strtolower(clean($b['email']??'',180));$pass=(string)($b['password']??'');$name=clean($b['name']??'',80);
  if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($pass)<12||strlen($pass)>200||$name==='')fail(422,'Indica nombre, correo válido y contraseña de al menos 12 caracteres');
  if(one('SELECT id FROM users WHERE email=?',[$email]))fail(409,'Ya existe una cuenta con ese correo');
  db()->beginTransaction();
  try{
   run('INSERT INTO users (email,password_hash) VALUES (?,?)',[$email,password_hash($pass,PASSWORD_DEFAULT)]);
   $id=(int)db()->lastInsertId();
   run('INSERT INTO profiles (user_id,display_name) VALUES (?,?)',[$id,$name]);
   db()->commit();
  }catch(Throwable $e){db()->rollBack();throw $e;}
  session_regenerate_id(true);$_SESSION['uid']=$id;$_SESSION['csrf']=bin2hex(random_bytes(32));out(['user'=>['id'=>$id,'email'=>$email],'csrf'=>$_SESSION['csrf'],'profile'=>profile($id)]);
 case 'login':
  postOnly();$b=requestBody();verifyCsrf($b);loginGuard();
  $email=strtolower(clean($b['email']??'',180));$pass=(string)($b['password']??'');
  $u=one('SELECT id,email,password_hash FROM users WHERE email=?',[$email]);
  $valid=$u&&password_verify($pass,$u['password_hash']);
  loginAttempt((bool)$valid);
  if(!$valid)fail(401,'Correo o contraseña incorrectos');
  session_regenerate_id(true);$_SESSION['uid']=(int)$u['id'];$_SESSION['csrf']=bin2hex(random_bytes(32));
  out(['user'=>['id'=>(int)$u['id'],'email'=>$u['email']],'csrf'=>$_SESSION['csrf'],'profile'=>profile((int)$u['id'])]);
 case 'logout':
  postOnly();$b=requestBody();verifyCsrf($b);$_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));out(['csrf'=>$_SESSION['csrf']]);
 case 'dashboard':
  $id=uid();$p=profile($id);$w=rows('SELECT id,day,type,minutes,rpe,exercises,created_at FROM workout_logs WHERE user_id=? ORDER BY id DESC LIMIT 40',[$id]);
  $measurements=rows('SELECT date,weight_kg,waist_cm,note FROM measurements WHERE user_id=? ORDER BY date ASC LIMIT 500',[$id]);
  $pantry=rows('SELECT id,ingredient,quantity FROM pantry WHERE user_id=? ORDER BY ingredient',[$id]);
  $meals=rows('SELECT id,day,meal_type,description FROM meal_logs WHERE user_id=? ORDER BY id DESC LIMIT 50',[$id]);
  $habits=rows('SELECT day,water,sleep,steps FROM habits WHERE user_id=? ORDER BY day DESC LIMIT 30',[$id]);
  $plan=workoutPlan($p,$w);$recipes=recipeSuggestions(array_column($pantry,'ingredient'),$p);
  out(['profile'=>$p,'workouts'=>$w,'measurements'=>$measurements,'pantry'=>$pantry,'meals'=>$meals,'habits'=>$habits,'plan'=>$plan,'recipes'=>$recipes,'food_message'=>foodMessage($p),'nutrition'=>nutritionInsights($p,$w),'ai_enabled'=>(bool)getenv('VIVA_OPENROUTER_API_KEY'),'today'=>today()]);
 case 'export':
  $id=uid();
  out(['exported_at'=>date(DATE_ATOM),'profile'=>profile($id),
       'measurements'=>rows('SELECT date,weight_kg,waist_cm,note FROM measurements WHERE user_id=? ORDER BY date',[$id]),
       'workouts'=>rows('SELECT day,type,minutes,rpe,exercises FROM workout_logs WHERE user_id=? ORDER BY id',[$id]),
       'pantry'=>rows('SELECT ingredient,quantity FROM pantry WHERE user_id=?',[$id]),
       'meals'=>rows('SELECT day,meal_type,description FROM meal_logs WHERE user_id=?',[$id]),
       'habits'=>rows('SELECT day,water,sleep,steps FROM habits WHERE user_id=?',[$id])]);
 case 'delete_account':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);
  $user=one('SELECT password_hash FROM users WHERE id=?',[$id]);
  if(!$user||!password_verify((string)($b['password']??''),$user['password_hash']))fail(403,'Contraseña incorrecta');
  run('DELETE FROM users WHERE id=?',[$id]);
  $_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));
  out(['csrf'=>$_SESSION['csrf']]);
 case 'profile':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);
  $age=(int)numeric($b['age']??null,16,100,true);if(empty($b['age']))$age=null;
  $height=numeric($b['height_cm']??null,120,230,true);
  $weight=numeric($b['weight_kg']??null,35,300,true);
  $target=numeric($b['target_kg']??null,35,300,true);
  $goal=allowed($b['goal']??'salud',['bajar','definir','musculo','mantener','salud'],'salud');
  $experience=allowed($b['experience']??'principiante',['principiante','intermedio','avanzado'],'principiante');
  $days=(int)numeric($b['weekly_days']??3,1,6);
  $minutes=(int)numeric($b['minutes']??20,10,40);
  $equipment=allowed($b['equipment']??'ninguno',['ninguno','bandas','mancuernas','mixto'],'ninguno');
  $push=allowed($b['pushups']??'0',['0','1-10','11-20','20+'],'0');
  $squats=allowed($b['squats']??'0',['0','1-10','11-20','21-40','40+'],'0');
  run('UPDATE profiles SET display_name=?,age=?,height_cm=?,weight_kg=?,target_kg=?,goal=?,experience=?,weekly_days=?,minutes=?,equipment=?,pushups=?,squats=?,allergies=?,health_flags=?,avoid_foods=?,updated_at=datetime(\'now\') WHERE user_id=?',[
    clean($b['display_name']??'',80),$age,$height,$weight,$target,$goal,$experience,$days,$minutes,$equipment,$push,$squats,
    json_encode(arrayText($b['allergies']??[]),JSON_UNESCAPED_UNICODE),json_encode(arrayText($b['health_flags']??[]),JSON_UNESCAPED_UNICODE),json_encode(arrayText($b['avoid_foods']??[]),JSON_UNESCAPED_UNICODE),$id
  ]);
  out(['profile'=>profile($id)]);
 case 'measurement':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);
  $day=validDay(clean($b['date']??today(),10));if($day>today())fail(422,'No puedes registrar peso futuro');
  $weight=numeric($b['weight_kg']??null,35,300);$waist=numeric($b['waist_cm']??null,40,200,true);
  run('INSERT INTO measurements (user_id,weight_kg,waist_cm,note,date) VALUES (?,?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET weight_kg=excluded.weight_kg,waist_cm=excluded.waist_cm,note=excluded.note',[$id,$weight,$waist,clean($b['note']??'',200),$day]);
  run('UPDATE profiles SET weight_kg=?,updated_at=datetime(\'now\') WHERE user_id=?',[$weight,$id]);out();
 case 'workout':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);
  $rpe=(int)numeric($b['rpe']??null,1,10);$minutes=(int)numeric($b['minutes']??null,1,120);
  $exercises=array_slice(arrayText($b['exercises']??[]),0,20);
  run('INSERT INTO workout_logs (user_id,day,type,minutes,rpe,exercises) VALUES (?,?,?,?,?,?)',[$id,today(),clean($b['type']??'Entrenamiento',80),$minutes,$rpe,json_encode($exercises,JSON_UNESCAPED_UNICODE)]);
  out();
 case 'pantry_add':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);
  $ingredient=clean($b['ingredient']??'',80);if(strlen($ingredient)<2)fail(422,'Escribe un ingrediente');
  run('INSERT INTO pantry (user_id,ingredient,quantity) VALUES (?,?,?) ON CONFLICT(user_id,ingredient) DO UPDATE SET quantity=excluded.quantity',[$id,$ingredient,clean($b['quantity']??'',60)]);out();
 case 'pantry_remove':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);run('DELETE FROM pantry WHERE user_id=? AND id=?',[$id,(int)numeric($b['id']??null,1,1000000000)]);out();
 case 'meal':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);
  $type=allowed($b['type']??'almuerzo',['desayuno','almuerzo','once','cena','colacion'],'almuerzo');
  $desc=clean($b['description']??'',400);if(!$desc)fail(422,'Indica qué comiste');
  run('INSERT INTO meal_logs (user_id,day,meal_type,description) VALUES (?,?,?,?)',[$id,today(),$type,$desc]);out();
 case 'habits':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);
  $water=(int)numeric($b['water']??0,0,20);$sleep=numeric($b['sleep']??null,0,24,true);$steps=isset($b['steps'])&&$b['steps']!==''?(int)numeric($b['steps'],0,100000):null;
  run('INSERT INTO habits (user_id,day,water,sleep,steps) VALUES (?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET water=excluded.water,sleep=excluded.sleep,steps=excluded.steps',[$id,today(),$water,$sleep,$steps]);out();
 case 'ai_recipe':
  postOnly();$id=uid();$b=requestBody();verifyCsrf($b);$p=profile($id);
  $key=(string)getenv('VIVA_OPENROUTER_API_KEY');
  if(!$key)fail(503,'IA externa no configurada. Las recetas automáticas siguen disponibles.');
  $model=getenv('VIVA_OPENROUTER_MODEL')?:'openrouter/free';
  if($model!=='openrouter/free'&&!str_ends_with($model,':free'))fail(503,'Por seguridad de costos, solo se aceptan modelos gratuitos.');
  $allowed=run('INSERT INTO ai_usage (user_id,day,attempts) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET attempts=attempts+1 WHERE attempts<3',[$id,today()]);
  if(!$allowed)fail(429,'Llegaste al límite de 3 recetas con IA por hoy. Usa las recetas automáticas.');
  $pantry=rows('SELECT ingredient FROM pantry WHERE user_id=?',[$id]);
  $prompt=clean($b['request']??'',280);if(!$prompt)$prompt='Propón una comida con lo disponible';
  $context=['ingredientes'=>array_column($pantry,'ingredient'),'objetivo'=>$p['goal'],'alergias'=>$p['allergies'],'evitar'=>$p['avoid_foods'],'solicitud'=>$prompt];
  $payload=json_encode([
    'model'=>$model,
    'messages'=>[
      ['role'=>'system','content'=>'Eres un asistente de cocina saludable. Responde en español de Chile con una receta práctica, cantidades para una persona, pasos y sustituciones. Respeta estrictamente alergias y evitaciones. No inventes ingredientes presentes, enumera faltantes. No ofrezcas consejos médicos, ayunos extremos ni dietas peligrosas. Nada de diagnósticos.'],
      ['role'=>'user','content'=>json_encode($context,JSON_UNESCAPED_UNICODE)]
    ],'max_tokens'=>600,'temperature'=>0.5
  ],JSON_UNESCAPED_UNICODE);
  $opts=['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\nAuthorization: Bearer ".$key."\r\nHTTP-Referer: https://test.visiotec.cl\r\nX-Title: Viva la Salud\r\n",'content'=>$payload,'timeout'=>15,'ignore_errors'=>true]];
  $response=@file_get_contents('https://openrouter.ai/api/v1/chat/completions',false,stream_context_create($opts));
  $status=$http_response_header[0]??'';
  if($response===false||!preg_match('/\s200\s/',$status))fail(502,'No se pudo generar la receta con IA. Usa las sugerencias disponibles.');
  $data=json_decode($response,true);$text=$data['choices'][0]['message']['content']??'';
  if(!is_string($text)||trim($text)==='')fail(502,'La IA no devolvió una receta válida');
  out(['recipe'=>substr($text,0,4500)]);
 default: fail(404,'Acción no encontrada');
 }
}catch(PDOException $e){error_log('Viva SQL: '.$e->getMessage());fail(500,'Error de almacenamiento');}
catch(Throwable $e){error_log('Viva error: '.$e->getMessage());fail(500,'No fue posible completar la solicitud');}
