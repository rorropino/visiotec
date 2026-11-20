"""Deploy public frontend only. Existing logo, backend and application files remain untouched."""
import os,io,pathlib,posixpath as pp,stat,tempfile,time,urllib.request
import paramiko
required=('CPANEL_HOST','CPANEL_PORT','CPANEL_USER','CPANEL_PROD_PATH','CPANEL_SSH_KEY','CPANEL_KNOWN_HOSTS')
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
client=paramiko.SSHClient()
with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8') as known:
    known.write(env['CPANEL_KNOWN_HOSTS'].strip()+'\n');known.flush();client.load_host_keys(known.name)
client.set_missing_host_key_policy(paramiko.RejectPolicy())
client.connect(host,port=port,username=user,pkey=key,allow_agent=False,look_for_keys=False,timeout=20,auth_timeout=20)
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
    if b'<?php' in old.lower() or b'<?=' in old:raise RuntimeError('Entry contains PHP logic; migrate manually to preserve backend')
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
        prior=read(dest) if st else None;data=local.read_bytes()
        if prior==data:continue
        mkdir(pp.dirname(dest))
        if prior is not None:
            saved=pp.join(backup,entry if rel=='index.html' else rel);mkdir(pp.dirname(saved));write(saved,prior,0o600)
        tmp=dest+'.visiotec-stage'
        if exists(tmp):raise RuntimeError('Stale staging file: '+rel)
        write(tmp,data)
        try:sftp.posix_rename(tmp,dest)
        except Exception:
            if exists(tmp):sftp.remove(tmp)
            raise
        changes.append((dest,prior))
        if read(dest)!=data:raise RuntimeError('File verification failed: '+rel)
    q='?deploy_check='+str(time.time_ns())
    for attempt in range(4):
        try:
            assert b'solution.engine' in http(q) and b'data-filter' in http(q)
            assert b'.project' in http('assets/css/visiotec-v2.css'+q)
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
