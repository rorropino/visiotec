<?php
declare(strict_types=1);
function vt_e($v): string { return htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8'); }
function vt_config(): array {
    $file=__DIR__.'/private/config.php';
    if(!is_file($file))throw new RuntimeException('not configured');
    $c=require $file;
    if(!is_array($c)||empty($c['db_name'])||empty($c['db_user']))throw new RuntimeException('invalid config');
    return $c;
}
function vt_db(): PDO {
    static $db=null;
    if($db instanceof PDO)return $db;
    $c=vt_config();
    $db=new PDO('mysql:host='.$c['db_host'].';dbname='.$c['db_name'].';charset=utf8mb4',$c['db_user'],$c['db_pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    return $db;
}
function vt_install(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS vt_categories (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(48) NOT NULL UNIQUE,label VARCHAR(90) NOT NULL,group_type ENUM('web','system','other') NOT NULL,sort_order INT NOT NULL DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS vt_projects (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,category_id INT UNSIGNED NOT NULL,title VARCHAR(150) NOT NULL,kind VARCHAR(120) NOT NULL,status VARCHAR(80) NOT NULL,description TEXT NOT NULL,url VARCHAR(600) NOT NULL DEFAULT '',monogram VARCHAR(12) NOT NULL DEFAULT '',sort_order INT NOT NULL DEFAULT 0,active TINYINT(1) NOT NULL DEFAULT 1,image_mime VARCHAR(40) NULL,image_data MEDIUMBLOB NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT vt_project_category FOREIGN KEY(category_id) REFERENCES vt_categories(id) ON DELETE RESTRICT,INDEX vt_public_order(active,sort_order,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS vt_settings (setting_key VARCHAR(80) PRIMARY KEY,setting_value VARCHAR(255) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE IF NOT EXISTS vt_login_attempts (fingerprint CHAR(64) PRIMARY KEY,attempts INT NOT NULL DEFAULT 0,window_start INT UNSIGNED NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    if($db->query("SELECT setting_value FROM vt_settings WHERE setting_key='seed_v1'")->fetchColumn()!==false)return;
    $db->beginTransaction();
    try {
        $guard=$db->prepare("INSERT IGNORE INTO vt_settings(setting_key,setting_value) VALUES('seed_v1','1')");
        $guard->execute();
        if($guard->rowCount()!==1){$db->commit();return;}
        $cat=$db->prepare('INSERT INTO vt_categories(slug,label,group_type,sort_order) VALUES(?,?,?,?)');
        foreach([['own','Webs propias','web',10],['client','Clientes','web',20],['system','Sistemas','system',30],['lab','Laboratorio','other',40]] as $row)$cat->execute($row);
        $seed=require __DIR__.'/seed.php';
        $stmt=$db->prepare('INSERT INTO vt_projects(category_id,title,kind,status,description,url,monogram,sort_order) SELECT id,?,?,?,?,?,?,? FROM vt_categories WHERE slug=?');
        foreach($seed as $r)$stmt->execute([$r['title'],$r['kind'],$r['status'],$r['description'],$r['url'],$r['monogram'],$r['sort'],$r['category']]);
        $db->commit();
    } catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function vt_ready(): PDO {
    $db=vt_db();
    try {$ready=$db->query("SELECT setting_value FROM vt_settings WHERE setting_key='seed_v1'")->fetchColumn();}
    catch(PDOException $e){if(($e->errorInfo[0]??'')!=='42S02')throw $e;$ready=false;}
    if($ready===false)vt_install($db);
    return $db;
}
function vt_url(string $url): bool {
    if($url==='')return true;
    if(!filter_var($url,FILTER_VALIDATE_URL))return false;
    $p=parse_url($url);
    return is_array($p)&&in_array(strtolower($p['scheme']??''),['http','https'],true)&&!empty($p['host'])&&!isset($p['user'])&&!isset($p['pass']);
}
function vt_categories(PDO $db): array {
    return $db->query('SELECT * FROM vt_categories ORDER BY sort_order,id')->fetchAll();
}
function vt_projects(PDO $db,bool $public=true): array {
    return $db->query('SELECT p.id,p.category_id,p.title,p.kind,p.status,p.description,p.url,p.monogram,p.sort_order,p.active,p.updated_at,(p.image_data IS NOT NULL) AS has_image,c.slug,c.label,c.group_type FROM vt_projects p JOIN vt_categories c ON c.id=p.category_id '.($public?'WHERE p.active=1 ':'').'ORDER BY p.sort_order,p.id')->fetchAll();
}
function vt_portfolio_markup(PDO $db): string {
    $projects=vt_projects($db);$cats=vt_categories($db);$count=['web'=>0,'system'=>0,'other'=>0];
    foreach($projects as $r)$count[$r['group_type']]++;
    ob_start(); ?>
<div class="stats reveal" data-portfolio-source="mysql"><?php foreach(['web'=>'Webs y propuestas','system'=>'Sistemas','other'=>'Otros proyectos'] as $k=>$label): ?><div><b><?= vt_e(str_pad((string)$count[$k],2,'0',STR_PAD_LEFT)) ?></b><span><?= vt_e($label) ?></span></div><?php endforeach; ?></div>
<div class="filters" role="group" aria-label="Filtrar proyectos"><button class="active" data-filter="all" aria-pressed="true">Todos</button><?php foreach($cats as $c): ?><button data-filter="<?= vt_e($c['slug']) ?>" aria-pressed="false"><?= vt_e($c['label']) ?></button><?php endforeach; ?></div>
<div class="projects" id="project-list"><?php foreach($projects as $i=>$p): ?><article class="project reveal" data-category="<?= vt_e($p['slug']) ?>"><div class="project-art art<?= $i%4 ?><?= $p['has_image']?' has-image':'' ?>" aria-hidden="true"><?php if($p['has_image']): ?><img src="/portfolio/image.php?id=<?= (int)$p['id'] ?>&amp;v=<?= vt_e(rawurlencode($p['updated_at'])) ?>" alt="" loading="lazy" width="1200" height="750"><span class="art-caption">CAPTURA DEL PROYECTO</span><?php else: ?><span class="art-index">PROJECT / <?= str_pad((string)($i+1),2,'0',STR_PAD_LEFT) ?></span><div class="art-window"><div class="art-bar"><i></i><i></i><i></i></div><div class="art-body"><div class="art-side"></div><div class="art-content"><b><?= vt_e($p['monogram']) ?></b><div class="art-lines"><i></i><i></i><i></i></div></div></div></div><span class="art-caption">VISUAL CONCEPT</span><?php endif; ?></div><div class="project-body"><div class="project-kicker"><?= vt_e($p['kind']) ?> <span><?= vt_e($p['status']) ?></span></div><h3><?= vt_e($p['title']) ?></h3><p><?= vt_e($p['description']) ?></p><?php if($p['url']!==''&&vt_url($p['url'])): ?><a class="project-link" href="<?= vt_e($p['url']) ?>" target="_blank" rel="noopener noreferrer">Visitar sitio ↗</a><?php else: ?><span class="project-status">Ficha de proyecto</span><?php endif; ?></div></article><?php endforeach; ?><?php if(!$projects): ?><p class="portfolio-empty">Estamos preparando nuevos proyectos.</p><?php endif; ?></div>
<?php return (string)ob_get_clean();
}
function vt_portfolio_render(string $html): string {
    $start='<!-- vt-portfolio:start -->';$end='<!-- vt-portfolio:end -->';
    $a=strpos($html,$start);$b=strpos($html,$end);
    if($a===false||$b===false||$b<=$a)return $html;
    try {$markup=vt_portfolio_markup(vt_ready());return substr($html,0,$a+strlen($start)).$markup.substr($html,$b);}
    catch(Throwable $e){error_log('VisioTec portfolio: database unavailable (static fallback)');return $html;}
}
