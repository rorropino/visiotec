<?php
declare(strict_types=1);
ini_set('display_errors','0');
ini_set('log_errors','1');
date_default_timezone_set('America/Santiago');
$isHttps=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off') || (($_SERVER['HTTP_X_FORWARDED_PROTO']??'')==='https');
session_name('viva_salud_sid');
session_set_cookie_params(['lifetime'=>0,'path'=>'/viva-salud/','secure'=>$isHttps,'httponly'=>true,'samesite'=>'Lax']);
if(session_status()!==PHP_SESSION_ACTIVE) session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, private');
header('Referrer-Policy: no-referrer');
if(empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32));

function fail(int $code,string $message): never {http_response_code($code);echo json_encode(['ok'=>false,'error'=>$message],JSON_UNESCAPED_UNICODE);exit;}
function out(array $data=[]): never {echo json_encode(['ok'=>true]+$data,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
function requestBody(): array {$raw=file_get_contents('php://input');if(strlen($raw)>120000)fail(413,'Solicitud demasiado grande');$v=json_decode($raw,true);if(!is_array($v))fail(400,'JSON inválido');return $v;}
function postOnly(): void {if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')fail(405,'Método no permitido');}
function verifyCsrf(array $v): void {if(!hash_equals((string)($_SESSION['csrf']??''),(string)($v['csrf']??'')))fail(419,'Sesión caducada. Recarga la página.');}
function uid(): int {$id=(int)($_SESSION['uid']??0);if(!$id)fail(401,'Inicia sesión para continuar');return $id;}
function clean($value,int $max=255): string {if(!is_string($value))return '';return trim(preg_replace('/[<>\x00-\x1F]/u','',substr($value,0,$max))??'');}
function numeric($value,float $min,float $max,bool $nullable=false): ?float {if($nullable && ($value===null||$value===''))return null;if(!is_numeric($value))fail(422,'Número inválido');$n=(float)$value;if(!is_finite($n)||$n<$min||$n>$max)fail(422,'Número fuera de rango');return $n;}
function allowed($v,array $options,string $default): string {return in_array($v,$options,true)?$v:$default;}
function arrayText($v): array {if(!is_array($v))return [];$list=[];foreach(array_slice($v,0,25) as $item){$s=clean($item,60);if($s!=='')$list[]=$s;}return array_values(array_unique($list));}
function db(): PDO {
 static $pdo=null;
 if($pdo!==null)return $pdo;
 if(!extension_loaded('pdo_sqlite'))fail(503,'El servidor debe habilitar la extensión pdo_sqlite');
 $path=getenv('VIVA_DB_PATH') ?: dirname(__DIR__,3).'/viva_salud_private/viva_salud.sqlite';
 $dir=dirname($path);
 if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))fail(500,'No se pudo crear la carpeta privada');
 $fresh=!is_file($path);
 try {
  $pdo=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_TIMEOUT=>5]);
  $pdo->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  if($fresh){$schema=file_get_contents(__DIR__.'/schema.sql');if($schema===false)throw new RuntimeException('schema missing');$pdo->exec($schema);@chmod($path,0600);}
  $pdo->exec('CREATE TABLE IF NOT EXISTS ai_usage (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,day))');
 }catch(Throwable $e){error_log('Viva salud DB: '.$e->getMessage());fail(503,'No fue posible conectar la base de datos');}
 return $pdo;
}
function one(string $sql,array $args=[]): ?array {$q=db()->prepare($sql);$q->execute($args);$r=$q->fetch();return $r?:null;}
function rows(string $sql,array $args=[]): array {$q=db()->prepare($sql);$q->execute($args);return $q->fetchAll();}
function run(string $sql,array $args=[]): int {$q=db()->prepare($sql);$q->execute($args);return $q->rowCount();}
function profile(int $id): array {$p=one('SELECT * FROM profiles WHERE user_id=?',[$id]);if(!$p)fail(500,'Perfil no disponible');foreach(['allergies','health_flags','avoid_foods'] as $f)$p[$f]=json_decode($p[$f],true)??[];unset($p['user_id']);return $p;}
function today(): string {return date('Y-m-d');}
function validDay(string $value): string {$d=DateTimeImmutable::createFromFormat('!Y-m-d',$value);if(!$d||$d->format('Y-m-d')!==$value)fail(422,'Fecha inválida');return $value;}
function ipFingerprint(): string {return hash('sha256',(string)($_SERVER['REMOTE_ADDR']??'unknown'));}
function loginGuard(): void {$f=ipFingerprint();$row=one('SELECT attempts,last_attempt FROM login_attempts WHERE fingerprint=?',[$f]);if($row && $row['attempts']>=7 && time()-(int)$row['last_attempt']<900)fail(429,'Demasiados intentos, prueba en 15 minutos');}
function loginAttempt(bool $ok): void {$f=ipFingerprint();if($ok){run('DELETE FROM login_attempts WHERE fingerprint=?',[$f]);return;}run('INSERT INTO login_attempts (fingerprint,attempts,last_attempt) VALUES (?,1,?) ON CONFLICT(fingerprint) DO UPDATE SET attempts=CASE WHEN excluded.last_attempt-login_attempts.last_attempt>900 THEN 1 ELSE attempts+1 END,last_attempt=excluded.last_attempt',[$f,time()]);}
