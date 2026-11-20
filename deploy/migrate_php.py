"""Migrate known presentation PHP without leaking production source into logs."""
import json,re,subprocess,tempfile
from pathlib import Path

TOKENIZER=r"""$src=stream_get_contents(STDIN);
$tokens=token_get_all($src);$chunks=[];$offset=0;$start=null;$names=[];$vars=[];$funcs=[];
foreach($tokens as $t){
$s=is_array($t)?$t[1]:$t;$kind=is_array($t)?$t[0]:null;
if($kind===T_OPEN_TAG||$kind===T_OPEN_TAG_WITH_ECHO){$start=$offset;$names=[];$vars=[];$funcs=[];}
if($start!==null && is_array($t)){
 if(!in_array($kind,[T_WHITESPACE,T_COMMENT,T_DOC_COMMENT]))$names[]=token_name($kind);
 if($kind===T_VARIABLE)$vars[]=$s;
 if($kind===T_STRING)$funcs[]=strtolower($s);
}
$offset+=strlen($s);
if($kind===T_CLOSE_TAG&&$start!==null){$chunks[]=['start'=>$start,'end'=>$offset,'tokens'=>$names,'variables'=>$vars,'functions'=>$funcs];$start=null;}
}
if($start!==null)$chunks[]=['start'=>$start,'end'=>$offset,'tokens'=>$names,'variables'=>$vars,'functions'=>$funcs];
echo json_encode($chunks);"""

def chunks(src):
    r=subprocess.run(['php','-r',TOKENIZER],input=src,capture_output=True,check=True)
    return json.loads(r.stdout)

def lint(src):
    with tempfile.NamedTemporaryFile(suffix='.php') as f:
        f.write(src);f.flush()
        if subprocess.run(['php','-l',f.name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
            raise RuntimeError('Generated PHP failed syntax check')

def migrate(old,new):
    parts=chunks(old)
    if not parts:return new
    if b'solution.engine' in old:
        # Previous releases already retained initialization and dynamic year.
        print('Migrating current VisioTec PHP entry',flush=True)
    prefix=b''
    year=None
    hidden=[]
    doctype=re.search(br'<!doctype\s+html|<html\b',old,re.I)
    start=doctype.start() if doctype else 0
    for part in parts:
        a,z=part['start'],part['end'];code=old[a:z]
        if z<=start:
            prefix+=code+b'\n'
            continue
        if re.fullmatch(br'<\?(?:php\s+echo\s+|=\s*)date\s*\(\s*[\'"]Y[\'"]\s*\)\s*;?\s*\?>\s*',code,re.I):
            year=code.rstrip();continue
        # Preserve server-generated hidden inputs such as CSRF fields verbatim.
        nearby=old[max(0,a-400):min(len(old),z+200)]
        relative=a-max(0,a-400)
        for match in re.finditer(br'<input\b(?:(?:<\?[\s\S]*?\?>)|[^>])*?>',nearby,re.I):
            if match.start()<=relative<match.end() and re.search(br'\btype\s*=\s*["\']?hidden\b',match.group(),re.I):
                element=match.group()
                if element not in hidden:hidden.append(element)
                break
        else:
            # Logs intentionally never reveal source, variables, strings or credentials.
            print('Unmapped PHP block: token types '+','.join(part['tokens']),flush=True)
            raise RuntimeError('PHP block requires explicit migration; no production files modified')
    if year:
        new=new.replace('© 2026 VisioTec'.encode(),b'\xc2\xa9 '+year+b' VisioTec',1)
    if hidden:
        new=new.replace(b'<form id="contact-form">',b'<form id="contact-form">'+b'\n'.join(hidden),1)
    result=prefix+new
    lint(result)
    print('PHP migration: preserved initialization, '+str(len(hidden))+' hidden inputs and dynamic year='+str(bool(year)),flush=True)
    return result
