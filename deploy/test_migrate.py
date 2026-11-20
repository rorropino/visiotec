from migrate_php import migrate
old=b"""<?php session_start(); $csrf='safe-test'; ?>
<!doctype html><html><form><input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf) ?>"></form><footer>2026 <?php echo date('Y'); ?></footer></html>"""
new=b'<!doctype html><html><form id="contact-form"></form><footer>\xc2\xa9 2026 VisioTec</footer></html>'
out=migrate(old,new)
assert b'session_start()' in out and b'htmlspecialchars($csrf)' in out and b"date('Y')" in out
assert migrate(out,new)==out
try:
    migrate(b'<!doctype html><html><?php include "secret.php"; ?></html>',new)
except RuntimeError:pass
else:raise AssertionError('Unknown PHP was not blocked')
print('PHP migration regression passed')
