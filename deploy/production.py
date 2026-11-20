"""Deploy public frontend only. Existing logo, backend and application files remain untouched."""
import os,io,pathlib,posixpath as pp,stat,base64,hashlib,time,urllib.request
import paramiko
from migrate_php import migrate
required=('CPANEL_HOST','CPANEL_PORT','CPANEL_USER','CPANEL_PROD_PATH','CPANEL_SSH_KEY')
missing=[n for n in required if not os.environ.get(n)]
if missing: raise SystemExit('Deployment not configured; missing GitHub secrets: '+', '.join(missing))
env=os.environ
host=env['CPANEL_HOST'];port=int(env['CPANEL_PORT']);user=env['CPANEL_USER']
raw_key=env['CPANEL_SSH_KEY'].replace('\\n','\n').replace('\r','')
key=None
for cls in (paramiko.RSAKey,paramiko.Ed25519Key,paramiko.ECDSAKey):
    try:
        key=cls.from_private_key(io.StringIO(raw_key),password=env.get('CPANEL_SSH_PASSPHRASE') or None);break
    except (ValueError,paramiko.SSHException):pass
if key is None:raise SystemExit('Invalid configured SSH key')
# Continuity pins from the existing SubeTuFlyer hosting deployment.
class ObservedHostPolicy(paramiko.MissingHostKeyPolicy):
    def missing_host_key(self, client, hostname, key):
        fingerprint = base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
        if fingerprint not in {
            'NusQmp3q00mb2tDJpCCXMXxpViVFlK3/bRHfPq4tByU',
            '0oSY2khnJ0JQ/eBvnD4ts4kGq/GQ7BVuIauN40tFZMA',
            'q/neyf4Fuo0wC1ZdYLSiF4TbODLykQcGjBLEaEG2EFs',
        }:
            raise paramiko.SSHException('SSH host key differs from previous probe')
client=paramiko.SSHClient()
client.set_missing_host_key_policy(ObservedHostPolicy())
client.connect(host,port=port,username=user,pkey=key,allow_agent=False,look_for_keys=False,timeout=30,banner_timeout=30,auth_timeout=30)
sftp=client.open_sftp()
def exists(p):
    try:return sftp.lstat(p)
    except FileNotFoundError:return None
def mkdir(p):
    if exists(p):return
    mkdir(pp.dirname(p));sftp.mkdir(p)
def read(p):
    with sftp.open(p,'rb') as f:return f.read()
def write(p,b,mode=0o644):
    with sftp.open(p,'wb') as f:f.write(b)
    sftp.chmod(p,mode)
def same(b):
    return b'VisioTec' in b and ((b'typed-word' in b and b'circuit-canvas' in b) or b'solution.engine' in b)
def http(path):
    request=urllib.request.Request('https://www.visiotec.cl/'+path,headers={'User-Agent':'VisioTec-deploy-check/2','Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=15) as r:return r.read()
changes=[]
try:
    raw=pp.normpath(env['CPANEL_PROD_PATH'])
    if not raw.startswith('/') or raw in ('/','/home','/home/'+user):raise RuntimeError('Unsafe target path')
    candidates=[raw]
    if raw.startswith('/home/'+user+'/'):candidates.append(raw[len('/home/'+user):])
    target=next((p for p in candidates if exists(p) and stat.S_ISDIR(exists(p).st_mode)),None)
    if not target:raise RuntimeError('Configured document root does not exist')
    if not same(http('?deploy_preflight='+str(time.time_ns()))):raise RuntimeError('Public homepage does not match known VisioTec frontend')
    indexes=[]
    for n in ('index.php','index.html','index.htm'):
        p=pp.join(target,n)
        if exists(p) and stat.S_ISREG(exists(p).st_mode) and same(read(p)):indexes.append(n)
    if len(indexes)!=1:raise RuntimeError('Cannot safely identify unique VisioTec entry file')
    entry=indexes[0];old=read(pp.join(target,entry))
    new_entry=(pathlib.Path('site')/'index.html').read_bytes()
    if entry.endswith('.php'):new_entry=migrate(old,new_entry)
    print('Production entry identified: '+entry,flush=True)
    if not exists(pp.join(target,'enviar.php')):raise RuntimeError('Existing contact endpoint missing')
    if not exists(pp.join(target,'assets/img/logo.png')):raise RuntimeError('Existing logo not found')
    backup=pp.join(pp.dirname(target),'.visiotec-backups',time.strftime('%Y%m%d-%H%M%S')+'-'+os.getenv('GITHUB_SHA','manual')[:8])
    mkdir(backup);sftp.chmod(backup,0o700)
    root=pathlib.Path('site')
    files=[p for p in root.rglob('*') if p.is_file() and p.name!='index.html']+[root/'index.html']
    for local in files:
        rel=local.relative_to(root).as_posix(); dest=pp.join(target,entry if rel=='index.html' else rel)
        st=exists(dest)
        if st and not stat.S_ISREG(st.st_mode):raise RuntimeError('Non-regular destination: '+rel)
        prior=read(dest) if st else None;data=new_entry if rel=='index.html' else local.read_bytes()
        if prior==data:continue
        mkdir(pp.dirname(dest))
        if prior is not None:
            saved=pp.join(backup,entry if rel=='index.html' else rel);mkdir(pp.dirname(saved));write(saved,prior,0o600)
        tmp=pp.join(pp.dirname(dest),'.visiotec-stage-'+os.urandom(8).hex()+('.php' if dest.endswith('.php') else '.tmp'))
        if exists(tmp):raise RuntimeError('Stale staging file: '+rel)
        write(tmp,data)
        try:
            if prior is None:sftp.rename(tmp,dest)
            else:sftp.posix_rename(tmp,dest)
        except Exception:
            if exists(tmp):sftp.remove(tmp)
            raise
        changes.append((dest,prior))
        if read(dest)!=data:raise RuntimeError('File verification failed: '+rel)
    q='?deploy_check='+str(time.time_ns())
    for attempt in range(4):
        try:
            page=http(q)
            assert b'solution.engine' in page and b'data-filter' in page
            assert b'visiotec-whatsapp-float' in page and b'https://wa.me/56977725352?' in page
            assert b'.visiotec-whatsapp-float' in http('assets/css/visiotec-v2.css'+q)
            assert b'contact-form' in http('assets/js/visiotec-v2.js'+q)
            assert b'urlset' in http('sitemap.xml'+q)
            assert b'Privacidad' in http('privacidad.html'+q)
            break
        except Exception:
            if attempt==3:raise
            time.sleep(3)
    print('Production HTTP verified; updated files:',len(changes))
except Exception:
    for dest,prior in reversed(changes):
        if prior is None:sftp.remove(dest)
        else:
            tmp=dest+'.rollback-stage';write(tmp,prior);sftp.posix_rename(tmp,dest)
    if changes:print('Rollback applied to modified files')
    raise
finally:
    sftp.close();client.close()
