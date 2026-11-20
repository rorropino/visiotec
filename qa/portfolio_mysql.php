<?php
require __DIR__.'/../site/portfolio/lib.php';
$db=vt_ready();
if(count(vt_projects($db))!==19)throw new RuntimeException('Seed count incorrect');
if(count(vt_categories($db))!==4)throw new RuntimeException('Category count incorrect');
$before=vt_projects($db)[0];$id=$before['id'];
$db->prepare('UPDATE vt_projects SET active=0 WHERE id=?')->execute([$id]);
if(count(vt_projects($db))!==18)throw new RuntimeException('Hide failed');
$db->prepare('UPDATE vt_projects SET active=1,title=? WHERE id=?')->execute(['QA <script>',$id]);
$markup=vt_portfolio_markup($db);
if(strpos($markup,'QA &lt;script&gt;')===false||strpos($markup,'data-portfolio-source="mysql"')===false)throw new RuntimeException('Render failed');
$db->prepare('UPDATE vt_projects SET title=? WHERE id=?')->execute([$before['title'],$id]);
if(!vt_url('https://example.com')||vt_url('javascript:alert(1)'))throw new RuntimeException('URL validation failed');
vt_install($db);if(count(vt_projects($db))!==19)throw new RuntimeException('Seed must not duplicate');
echo "MySQL seed, visibility, escaping, counters and idempotency OK\n";
