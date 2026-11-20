"""HTTP integration checks against an isolated disposable MySQL database, never production."""
import base64,http.cookiejar,re,urllib.parse,urllib.request,urllib.error
ROOT='http://127.0.0.1:8767'
ADMIN='/portfolio-admin/'
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(path,fields=None,upload=False):
    data=None;headers={}
    if fields is not None:
        if upload:
            boundary='VT-CI-test-boundary'
            chunks=[]
            for k,v in fields.items():
                chunks.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+k+'"\r\n\r\n'+str(v)+'\r\n').encode())
            image=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2R8AAAAASUVORK5CYII=')
            chunks.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="image"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n').encode()+image+b'\r\n')
            chunks.append(('--'+boundary+'--\r\n').encode())
            data=b''.join(chunks);headers['Content-Type']='multipart/form-data; boundary='+boundary
        else:data=urllib.parse.urlencode(fields).encode()
    req=urllib.request.Request(ROOT+path,data=data,headers=headers)
    try:
        with opener.open(req,timeout=10) as resp:return resp.status,resp.read().decode('utf-8',errors='replace')
    except urllib.error.HTTPError as e:return e.code,e.read().decode('utf-8',errors='replace')
def get(path=ADMIN):
    status,body=request(path);assert status==200,(path,status)
    return body
def post(body,fields,upload=False):
    csrf=re.search(r'name="csrf" value="([0-9a-f]{64})"',body)
    assert csrf,'CSRF field missing'
    status,html=request(ADMIN,{'csrf':csrf.group(1),**fields},upload)
    assert status==200,('POST',fields.get('action'),status)
    return html
a=get();assert 'Activar administrador' in a
_,bad=request(ADMIN,{'action':'setup','csrf':'invalid','setup_code':'ci-test-only-code','password':'Admin123','confirm':'Admin123'})
assert 'Sesión vencida' in bad
a=post(a,{'action':'setup','setup_code':'ci-test-only-code','password':'Admin123','confirm':'Admin123'})
assert 'Administrar proyectos' in a and 'Proyectos existentes' in a
a=post(a,{'action':'logout'});assert 'Iniciar sesión' in a
a=post(a,{'action':'login','password':'Admin123'});assert 'Administrar proyectos' in a
print('Admin activation, session, logout, login and CSRF checks passed')
a=get(ADMIN+'?view=categories')
a=post(a,{'action':'save_category','id':'0','label':'QA Category','slug':'qa-category','group_type':'web','sort_order':'90'})
assert 'Categoría guardada' in a and 'QA Category' in a
a=get();m=re.search(r'<option value="(\d+)"\s*>QA Category</option>',a);assert m,'New category missing'
cat=m.group(1)
a=post(a,{'action':'save_project','id':'0','category_id':cat,'title':'QA Hidden Project','kind':'QA','status':'QA','description':'CI test project','url':'https://example.com/','monogram':'QA','sort_order':'999'},True)
assert 'Proyecto guardado' in a and 'QA Hidden Project' in a and 'Con imagen' in a
m=re.search(r'QA Hidden Project</b>[\s\S]*?href="\?edit=(\d+)"',a);assert m,'New project missing'
project=m.group(1)
public=get('/_qa-render.php');assert 'data-portfolio-source="mysql"' in public and 'QA Hidden Project' not in public
status,_=request('/portfolio/image.php?id='+project);assert status==404
a=post(a,{'action':'toggle_project','id':project});assert 'Visibilidad actualizada' in a
public=get('/_qa-render.php');assert 'QA Hidden Project' in public and 'portfolio/image.php?id='+project in public
status,_=request('/portfolio/image.php?id='+project);assert status==200
a=get(ADMIN+'?edit='+project)
a=post(a,{'action':'save_project','id':project,'category_id':cat,'title':'QA Edited Project','kind':'QA','status':'QA','description':'Edited','url':'https://example.com/','monogram':'QA','sort_order':'1','active':'on'})
assert 'Proyecto guardado' in a and 'QA Edited Project' in get('/_qa-render.php')
a=post(a,{'action':'delete_project','id':project,'confirm_delete':'ELIMINAR'});assert 'Proyecto eliminado' in a and 'QA Edited Project' not in get('/_qa-render.php')
a=get(ADMIN+'?view=categories');a=post(a,{'action':'delete_category','id':cat});assert 'Categoría eliminada' in a and 'QA Category' not in a
print('Category and project CRUD, visibility, uploaded image and public rendering passed')
a=get(ADMIN+'?view=password');a=post(a,{'action':'password','current':'Admin123','password':'NewQa456','confirm':'NewQa456'})
assert 'Contraseña actualizada' in a
a=post(a,{'action':'logout'});assert 'Iniciar sesión' in a
a=post(a,{'action':'login','password':'NewQa456'});assert 'Administrar proyectos' in a
print('Password change and re-login passed')
