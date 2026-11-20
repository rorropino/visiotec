<?php
declare(strict_types=1);
require dirname(__DIR__).'/portfolio/lib.php';
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
session_name('vt_portfolio_admin');
session_set_cookie_params(['lifetime'=>0,'path'=>'/portfolio-admin/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);
ini_set('session.use_strict_mode','1');session_start();
if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
if(isset($_SESSION['last'])&&time()-$_SESSION['last']>3600){unset($_SESSION['auth']);}
if(!empty($_SESSION['auth']))$_SESSION['last']=time();
function h($v):string{return vt_e($v);}
function csrf():string{return '<input type="hidden" name="csrf" value="'.h($_SESSION['csrf']).'">';}
function fail(string $s):void{throw new InvalidArgumentException($s);}
function redirect(string $to=''):void{header('Location: /portfolio-admin/'.$to, true,303);exit;}
function field(string $k,int $max,bool $required=true):string{$v=trim((string)($_POST[$k]??''));if(($required&&$v==='')||mb_strlen($v)>$max)fail('Revisa el campo '.$k.' (máximo '.$max.' caracteres).');return $v;}
function id_field(string $k):int{$v=filter_var($_POST[$k]??null,FILTER_VALIDATE_INT);if(!$v||$v<1)fail('Identificador inválido.');return $v;}
function order_field():int{$v=filter_var($_POST['sort_order']??'0',FILTER_VALIDATE_INT);if($v===false||$v<0||$v>100000)fail('Orden inválido.');return $v;}
function password_field():string{$p=(string)($_POST['password']??'');if(strlen($p)<8||strlen($p)>72)fail('Utiliza una contraseña de 8 a 72 caracteres (máximo 72 bytes).');return $p;}
$db=null;$mode='unavailable';$error='';$flash=$_SESSION['flash']??'';unset($_SESSION['flash']);
try{$config=vt_config();$db=vt_ready();$hash=$db->query("SELECT setting_value FROM vt_settings WHERE setting_key='admin_hash'")->fetchColumn();$mode=$hash!==false?'login':'setup';if($hash!==false&&!empty($_SESSION['auth']))$mode='admin';}
catch(Throwable $e){http_response_code(503);$error='El portafolio está pendiente de configuración de MySQL. La web pública conserva su contenido.';error_log('VisioTec portfolio admin: database unavailable');}
if($db&&$_SERVER['REQUEST_METHOD']==='POST'){
    try{
        if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??'')))fail('Sesión vencida; vuelve a cargar la página.');
        $action=(string)($_POST['action']??'');
        if($action==='logout'){$_SESSION=[];session_destroy();redirect();}
        if(in_array($action,['login','setup'],true)){
            $finger=hash('sha256',($_SERVER['REMOTE_ADDR']??'unknown').'|vt-admin');
            $s=$db->prepare('INSERT INTO vt_login_attempts(fingerprint,attempts,window_start) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=IF(window_start < ?,1,attempts+1),window_start=IF(window_start < ?,VALUES(window_start),window_start)');
            $now=time();$s->execute([$finger,$now,$now-900,$now-900]);
            $s=$db->prepare('SELECT attempts FROM vt_login_attempts WHERE fingerprint=?');$s->execute([$finger]);if((int)$s->fetchColumn()>8){http_response_code(429);fail('Demasiados intentos. Intenta nuevamente en 15 minutos.');}
            if($action==='setup'&&$mode==='setup'){
                $code=(string)($_POST['setup_code']??'');
                $valid=isset($config['setup_code_hash'])?hash_equals((string)$config['setup_code_hash'],hash('sha256',$code)):(!empty($config['setup_code'])&&hash_equals((string)$config['setup_code'],$code));
                if(!$valid)fail('Código de activación incorrecto.');
                $p=password_field();if(!hash_equals($p,(string)($_POST['confirm']??'')))fail('Las contraseñas no coinciden.');
                $s=$db->prepare("INSERT IGNORE INTO vt_settings(setting_key,setting_value) VALUES('admin_hash',?)");$s->execute([password_hash($p,PASSWORD_DEFAULT)]);if($s->rowCount()!==1)fail('Administrador ya configurado; inicia sesión.');
            }elseif($action==='login'&&$mode==='login'){
                $p=(string)($_POST['password']??'');if(strlen($p)>128||!password_verify($p,(string)$hash))fail('Contraseña incorrecta.');
            }else fail('Acción inválida.');
            $s=$db->prepare('DELETE FROM vt_login_attempts WHERE fingerprint=?');$s->execute([$finger]);
            session_regenerate_id(true);$_SESSION['auth']=true;$_SESSION['last']=time();$_SESSION['csrf']=bin2hex(random_bytes(32));redirect();
        }
        if($mode!=='admin')fail('Inicia sesión para continuar.');
        if($action==='save_project'){
            $id=filter_var($_POST['id']??0,FILTER_VALIDATE_INT);if($id===false||$id<0)fail('Proyecto inválido.');
            $cat=id_field('category_id');$s=$db->prepare('SELECT 1 FROM vt_categories WHERE id=?');$s->execute([$cat]);if(!$s->fetchColumn())fail('Categoría inválida.');
            $title=field('title',150);$kind=field('kind',120);$status=field('status',80);$desc=field('description',3000);$url=field('url',600,false);$mono=field('monogram',12,false);$sort=order_field();$active=isset($_POST['active'])?1:0;
            if(!vt_url($url))fail('Ingresa una URL http:// o https:// válida.');
            $blob=null;$mime=null;$upload=$_FILES['image']??null;
            if($upload&&($upload['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){
                if($upload['error']!==UPLOAD_ERR_OK||$upload['size']>3*1024*1024||!is_uploaded_file($upload['tmp_name']))fail('Imagen inválida. Máximo 3 MB.');
                $info=@getimagesize($upload['tmp_name']);$mime=$info['mime']??'';
                if(!$info||!in_array($mime,['image/jpeg','image/png','image/webp'],true)||$info[0]>5000||$info[1]>5000||$info[0]*$info[1]>18000000)fail('Usa JPG, PNG o WebP (máximo 18 megapíxeles).');
                $blob=file_get_contents($upload['tmp_name']);if($blob===false)fail('No se pudo leer la imagen.');
            }
            $values=[$cat,$title,$kind,$status,$desc,$url,$mono,$sort,$active];
            if($id){$q='UPDATE vt_projects SET category_id=?,title=?,kind=?,status=?,description=?,url=?,monogram=?,sort_order=?,active=?';if($blob!==null){$q.=',image_mime=?,image_data=?';$values[]=$mime;$values[]=$blob;}elseif(isset($_POST['remove_image']))$q.=',image_mime=NULL,image_data=NULL';$q.=' WHERE id=?';$values[]=$id;}
            else{$q='INSERT INTO vt_projects(category_id,title,kind,status,description,url,monogram,sort_order,active,image_mime,image_data) VALUES(?,?,?,?,?,?,?,?,?,?,?)';$values[]=$mime;$values[]=$blob;}
            $s=$db->prepare($q);$s->execute($values);$_SESSION['flash']='Proyecto guardado.';redirect();
        }
        if($action==='toggle_project'||$action==='delete_project'){
            $id=id_field('id');if($action==='delete_project'&&($_POST['confirm_delete']??'')!=='ELIMINAR')fail('Confirma la eliminación escribiendo ELIMINAR.');
            $s=$db->prepare($action==='delete_project'?'DELETE FROM vt_projects WHERE id=?':'UPDATE vt_projects SET active=1-active WHERE id=?');$s->execute([$id]);$_SESSION['flash']=$action==='delete_project'?'Proyecto eliminado.':'Visibilidad actualizada.';redirect();
        }
        if($action==='save_category'){
            $id=filter_var($_POST['id']??0,FILTER_VALIDATE_INT);if($id===false||$id<0)fail('Categoría inválida.');
            $slug=field('slug',48);if(!preg_match('/^[a-z0-9][a-z0-9-]*$/D',$slug)||$slug==='all')fail('Identificador: letras minúsculas, números o guiones; all está reservado.');
            $label=field('label',90);$group=field('group_type',10);if(!in_array($group,['web','system','other'],true))fail('Grupo inválido.');
            $v=[$slug,$label,$group,order_field()];$q=$id?'UPDATE vt_categories SET slug=?,label=?,group_type=?,sort_order=? WHERE id=?':'INSERT INTO vt_categories(slug,label,group_type,sort_order) VALUES(?,?,?,?)';if($id)$v[]=$id;
            $s=$db->prepare($q);$s->execute($v);$_SESSION['flash']='Categoría guardada.';redirect('?view=categories');
        }
        if($action==='delete_category'){$id=id_field('id');$s=$db->prepare('SELECT COUNT(*) FROM vt_projects WHERE category_id=?');$s->execute([$id]);if((int)$s->fetchColumn())fail('Reasigna primero los proyectos de esta categoría.');$s=$db->prepare('DELETE FROM vt_categories WHERE id=?');$s->execute([$id]);$_SESSION['flash']='Categoría eliminada.';redirect('?view=categories');}
        if($action==='password'){$p=password_field();if(!password_verify((string)($_POST['current']??''),(string)$hash))fail('Contraseña actual incorrecta.');if($p!==(string)($_POST['confirm']??''))fail('Las contraseñas no coinciden.');$s=$db->prepare("UPDATE vt_settings SET setting_value=? WHERE setting_key='admin_hash'");$s->execute([password_hash($p,PASSWORD_DEFAULT)]);$_SESSION['flash']='Contraseña actualizada.';redirect();}
        fail('Acción desconocida.');
    }catch(InvalidArgumentException $e){$error=$e->getMessage();}catch(Throwable $e){$error='No se pudo completar la operación. Revisa los datos (por ejemplo, un identificador de categoría duplicado).';error_log('VisioTec portfolio admin: operation failed');}
}
$view=(string)($_GET['view']??'projects');$edit=filter_input(INPUT_GET,'edit',FILTER_VALIDATE_INT)?:0;$cats=[];$projects=[];$row=null;
if($mode==='admin')try{$cats=vt_categories($db);$projects=vt_projects($db,false);if($edit){foreach(($view==='categories'?$cats:$projects) as $r){if((int)$r['id']===$edit){$row=$r;break;}}}}catch(Throwable $e){$error='No se pudieron cargar los datos.';}
?><!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Portafolio | VisioTec Admin</title><link rel="stylesheet" href="/portfolio-admin/admin.css?v=1"></head><body><header><a class="brand" href="/portfolio-admin/">VISIO<span>TEC</span> / ADMIN</a><a href="/" target="_blank" rel="noopener">Ver web ↗</a><?php if($mode==='admin'): ?><form method="post"><?= csrf() ?><button name="action" value="logout" class="secondary">Salir</button></form><?php endif; ?></header><main>
<?php if($error): ?><p role="alert" class="message error"><?= h($error) ?></p><?php endif; ?><?php if($flash): ?><p role="status" class="message"><?= h($flash) ?></p><?php endif; ?>
<?php if($mode==='unavailable'): ?><section class="auth"><h1>Configuración pendiente</h1><p>La administración se activa una vez configurada la base de datos MySQL.</p></section>
<?php elseif($mode==='setup'||$mode==='login'): ?><section class="auth"><p class="eyebrow">GESTIÓN DEL PORTAFOLIO</p><h1><?= $mode==='setup'?'Activar administrador':'Iniciar sesión' ?></h1><form method="post"><?= csrf() ?><input type="hidden" name="action" value="<?= h($mode) ?>"><?php if($mode==='setup'): ?><label>Código de activación<input name="setup_code" type="password" required autocomplete="off"></label><?php endif; ?><label><?= $mode==='setup'?'Nueva contraseña':'Contraseña' ?><input type="password" name="password" required autocomplete="<?= $mode==='setup'?'new-password':'current-password' ?>" <?= $mode==='setup'?'minlength="8"':'' ?>></label><?php if($mode==='setup'): ?><label>Confirmar contraseña<input type="password" name="confirm" minlength="8" required autocomplete="new-password"></label><?php endif; ?><button><?= $mode==='setup'?'Activar':'Entrar' ?></button></form></section>
<?php else: ?><div class="head"><div><p class="eyebrow">PORTAFOLIO / MYSQL</p><h1>Administrar proyectos</h1><p>Los cambios se reflejan en la web sin deploy.</p></div><div class="metrics"><b><?= count($projects) ?></b> proyectos · <b><?= count(array_filter($projects,fn($p)=>(bool)$p['active'])) ?></b> visibles</div></div><nav><a class="<?= $view==='projects'?'selected':'' ?>" href="/portfolio-admin/">Proyectos</a><a class="<?= $view==='categories'?'selected':'' ?>" href="?view=categories">Categorías</a><a class="<?= $view==='password'?'selected':'' ?>" href="?view=password">Contraseña</a></nav>
<?php if($view==='categories'): ?><div class="layout"><section class="panel"><h2><?= $row?'Editar categoría':'Nueva categoría' ?></h2><form method="post"><?= csrf() ?><input type="hidden" name="action" value="save_category"><input type="hidden" name="id" value="<?= (int)($row['id']??0) ?>"><label>Nombre<input name="label" required maxlength="90" value="<?= h($row['label']??'') ?>"></label><label>Identificador<input name="slug" required pattern="[a-z0-9][a-z0-9-]*" maxlength="48" value="<?= h($row['slug']??'') ?>"></label><label>Grupo para contador<select name="group_type"><?php foreach(['web'=>'Webs y propuestas','system'=>'Sistemas','other'=>'Otros proyectos'] as $k=>$v): ?><option value="<?= h($k) ?>" <?= ($row['group_type']??'web')===$k?'selected':'' ?>><?= h($v) ?></option><?php endforeach; ?></select></label><label>Orden<input type="number" name="sort_order" min="0" max="100000" value="<?= (int)($row['sort_order']??50) ?>"></label><button>Guardar categoría</button><a href="?view=categories">Limpiar</a></form></section><section class="panel"><h2>Categorías</h2><?php foreach($cats as $c): ?><div class="item"><div><b><?= h($c['label']) ?></b><small><?= h($c['slug']) ?> / <?= (int)$c['sort_order'] ?></small></div><div class="actions"><a class="secondary" href="?view=categories&amp;edit=<?= (int)$c['id'] ?>">Editar</a><form method="post"><?= csrf() ?><input type="hidden" name="id" value="<?= (int)$c['id'] ?>"><button class="danger" name="action" value="delete_category">Eliminar</button></form></div></div><?php endforeach; ?></section></div>
<?php elseif($view==='password'): ?><section class="panel auth"><h2>Cambiar contraseña</h2><form method="post"><?= csrf() ?><input type="hidden" name="action" value="password"><label>Contraseña actual<input type="password" required name="current" autocomplete="current-password"></label><label>Nueva contraseña<input type="password" required name="password" minlength="8" autocomplete="new-password"></label><label>Confirmar<input type="password" required name="confirm" minlength="8" autocomplete="new-password"></label><button>Guardar contraseña</button></form></section>
<?php else: ?><div class="layout"><section class="panel"><h2><?= $row?'Editar proyecto':'Nuevo proyecto' ?></h2><form method="post" enctype="multipart/form-data"><?= csrf() ?><input type="hidden" name="action" value="save_project"><input type="hidden" name="id" value="<?= (int)($row['id']??0) ?>"><label>Nombre<input name="title" required maxlength="150" value="<?= h($row['title']??'') ?>"></label><label>Categoría<select name="category_id" required><?php foreach($cats as $c): ?><option value="<?= (int)$c['id'] ?>" <?= (int)($row['category_id']??0)===(int)$c['id']?'selected':'' ?>><?= h($c['label']) ?></option><?php endforeach; ?></select></label><label>Tipo de proyecto<input name="kind" required maxlength="120" placeholder="WEB / E-COMMERCE" value="<?= h($row['kind']??'') ?>"></label><label>Estado<input name="status" required maxlength="80" placeholder="Operativo / Propuesta" value="<?= h($row['status']??'') ?>"></label><label>Descripción<textarea name="description" required maxlength="3000" rows="4"><?= h($row['description']??'') ?></textarea></label><label>Enlace<input type="url" name="url" maxlength="600" value="<?= h($row['url']??'') ?>"></label><div class="two"><label>Iniciales<input name="monogram" maxlength="12" value="<?= h($row['monogram']??'') ?>"></label><label>Orden<input name="sort_order" type="number" min="0" max="100000" value="<?= (int)($row['sort_order']??200) ?>"></label></div><label>Imagen real (JPG, PNG, WebP; hasta 3 MB)<input type="file" name="image" accept="image/jpeg,image/png,image/webp"></label><?php if(!empty($row['has_image'])): ?><p>El proyecto ya tiene una imagen.</p><label class="check"><input type="checkbox" name="remove_image"> Quitar imagen actual</label><?php endif; ?><label class="check"><input type="checkbox" name="active" <?= !isset($row['active'])||$row['active']?'checked':'' ?>> Visible en la web</label><button>Guardar proyecto</button><a href="/portfolio-admin/">Nuevo / limpiar</a></form></section><section class="panel"><h2>Proyectos existentes</h2><?php foreach($projects as $p): ?><div class="item"><div><b><?= h($p['title']) ?></b><small><?= h($p['label']) ?> · #<?= (int)$p['sort_order'] ?> · <?= $p['active']?'Visible':'Oculto' ?> · <?= $p['has_image']?'Con imagen':'Sin captura' ?></small></div><div class="actions"><a class="secondary" href="?edit=<?= (int)$p['id'] ?>">Editar</a><form method="post"><?= csrf() ?><input type="hidden" name="id" value="<?= (int)$p['id'] ?>"><button class="secondary" name="action" value="toggle_project"><?= $p['active']?'Ocultar':'Mostrar' ?></button></form><details><summary>Eliminar</summary><form method="post"><?= csrf() ?><input type="hidden" name="id" value="<?= (int)$p['id'] ?>"><input name="confirm_delete" required placeholder="ELIMINAR" aria-label="Escribir ELIMINAR"><button class="danger" name="action" value="delete_project">Confirmar</button></form></details></div></div><?php endforeach; ?></section></div><?php endif; ?>
<?php endif; ?></main></body></html>
