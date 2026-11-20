<?php
declare(strict_types=1);
require __DIR__.'/lib.php';
header('X-Content-Type-Options: nosniff');
$id=filter_input(INPUT_GET,'id',FILTER_VALIDATE_INT);
if(!$id){http_response_code(404);exit;}
try {
    $s=vt_ready()->prepare('SELECT image_mime,image_data FROM vt_projects WHERE id=? AND active=1 AND image_data IS NOT NULL');
    $s->execute([$id]);$r=$s->fetch();
    if(!$r||!in_array($r['image_mime'],['image/jpeg','image/png','image/webp'],true)){http_response_code(404);exit;}
    $etag='"'.hash('sha256',$r['image_data']).'"';
    header('ETag: '.$etag);header('Cache-Control: public, max-age=300, must-revalidate');
    if(($_SERVER['HTTP_IF_NONE_MATCH']??'')===$etag){http_response_code(304);exit;}
    header('Content-Type: '.$r['image_mime']);header('Content-Length: '.strlen($r['image_data']));echo $r['image_data'];
} catch(Throwable $e){http_response_code(404);}
