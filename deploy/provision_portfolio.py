"""Provision a dedicated MySQL schema on cPanel or use supplied DB secrets. Never log credentials."""
import os,json,shlex,base64,secrets,re
def configure(sftp,client,target,exists,mkdir,write,read):
    import posixpath as pp
    directory=pp.join(target,'portfolio','private')
    config=pp.join(directory,'config.php')
    if exists(config):
        print('Existing private portfolio configuration preserved',flush=True)
        return True
    env=os.environ
    db={k.lower():env.get(k,'') for k in ('DB_HOST','DB_NAME','DB_USER','DB_PASS')}
    if any(db[k] for k in ('db_name','db_user','db_pass')) and not all(db[k] for k in ('db_name','db_user','db_pass')):
        print('Incomplete DB secrets; MySQL configuration pending',flush=True);return False
    if not db['db_name']:
        account=env['CPANEL_USER']
        if not re.fullmatch(r'[A-Za-z0-9_]{1,16}',account):print('Automatic MySQL provisioning unavailable: account format',flush=True);return False
        db={'db_host':'localhost','db_name':account+'_vtportfolio','db_user':account+'_vtp','db_pass':secrets.token_urlsafe(32)+'A9!'}
        def uapi(function,**args):
            command=shlex.join(['uapi','--output=json','Mysql',function]+[k+'='+v for k,v in args.items()])
            _,stdout,stderr=client.exec_command(command,timeout=20)
            output=stdout.read(100000)
            code=stdout.channel.recv_exit_status()
            if code:raise RuntimeError('cPanel UAPI execution unavailable')
            result=json.loads(output)['result']
            if not result.get('status'):raise RuntimeError('cPanel UAPI operation rejected')
            return result.get('data')
        made_db=False;made_user=False
        try:
            uapi('list_databases')
            uapi('create_database',name=db['db_name']);made_db=True
            uapi('create_user',name=db['db_user'],password=db['db_pass']);made_user=True
            uapi('set_privileges_on_database',user=db['db_user'],database=db['db_name'],privileges='ALL PRIVILEGES')
        except Exception:
            try:
                if made_user:uapi('delete_user',name=db['db_user'])
                if made_db:uapi('delete_database',name=db['db_name'])
            except Exception:print('Automatic provisioning cleanup requires cPanel review',flush=True)
            print('Automatic MySQL provisioning unavailable; use DB_HOST, DB_NAME, DB_USER, DB_PASS secrets',flush=True)
            return False
        print('Dedicated cPanel MySQL schema and user created',flush=True)
    db['db_host']=db['db_host'] or 'localhost'
    db['setup_code']=env.get('PORTFOLIO_SETUP_CODE') or secrets.token_urlsafe(32)
    # PHP-only file: encoded as data, never echoed. Directory denied by .htaccess.
    # Base64 is serialization, not encryption; protect with mode 0600.
    encoded=base64.b64encode(json.dumps(db).encode()).decode()
    body=("<?php\n// Private runtime configuration; edit only in cPanel.\nreturn json_decode(base64_decode('"+encoded+"'),true,512,JSON_THROW_ON_ERROR);\n").encode()
    mkdir(directory)
    sftp.chmod(directory,0o700)
    deny=pp.join(directory,'.htaccess')
    if not exists(deny):write(deny,b'Require all denied\n',0o644)
    tmp=pp.join(directory,'.config-'+secrets.token_hex(10)+'.php')
    write(tmp,body,0o600)
    try:sftp.rename(tmp,config)
    except Exception:
        if exists(tmp):sftp.remove(tmp)
        raise
    # Separate protected text file for initial activation if operator did not set a secret.
    # It contains only the one-time setup code, not the DB credentials.
    codefile=pp.join(directory,'activation.php')
    if not exists(codefile):write(codefile,("<?php exit; // One-time setup code: "+db['setup_code']+"\n").encode(),0o600)
    print('Private config created; admin activation code available in cPanel portfolio/private/activation.php',flush=True)
    return True
