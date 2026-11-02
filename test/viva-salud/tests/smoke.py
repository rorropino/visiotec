#!/usr/bin/env python3
"""API smoke/integration test: run against isolated PHP server, no production writes."""
import json, time, uuid
import urllib.request
import urllib.error
import http.cookiejar

ROOT="http://127.0.0.1:18887/viva-salud/api/index.php?action="
jar=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
csrf=""
checks=0

def call(action, body=None, expected=200):
    global checks
    data=None
    if body is not None:
        data=json.dumps(dict(body,csrf=csrf),ensure_ascii=False).encode("utf-8")
    req=urllib.request.Request(ROOT+action,data=data,headers={"Content-Type":"application/json","Accept":"application/json"})
    try:
        res=opener.open(req,timeout=8)
        code=res.status
        payload=json.loads(res.read())
    except urllib.error.HTTPError as ex:
        code=ex.code
        payload=json.loads(ex.read())
    assert code==expected, (action,code,payload)
    assert payload["ok"]==(expected<400), (action,payload)
    checks+=1
    return payload

assert call("health")["database"]=="ok"
s=call("session")
csrf=s["csrf"]
assert s["user"] is None
call("dashboard",expected=401)
call("register",{"name":"Demo","email":"bad","password":"weak"},422)
email="viva_"+uuid.uuid4().hex[:15]+"@example.test"
u=call("register",{"name":"Prueba","email":email,"password":"password-Super-Test-2026!"})
csrf=u["csrf"]
assert u["user"]["email"]==email
d=call("dashboard")
assert d["plan"]["exercises"] and d["recipes"]
assert d["profile"]["goal"]=="salud"
call("profile",{"display_name":"Prueba","age":42,"height_cm":179,"weight_kg":88.7,"target_kg":79,"goal":"bajar","experience":"principiante","weekly_days":3,"minutes":20,"equipment":"ninguno","pushups":"0","squats":"1-10","allergies":["lactosa"],"health_flags":["presion_alta","dolor_articular"],"avoid_foods":["gluten"]})
d=call("dashboard")
assert d["profile"]["height_cm"]==179 and d["profile"]["health_flags"]==["presion_alta","dolor_articular"]
assert all("avena" not in r["name"].lower() for r in d["recipes"])
call("measurement",{"weight_kg":88.7,"waist_cm":99,"date":call("dashboard")["today"]})
d=call("dashboard")
assert d["measurements"][-1]["weight_kg"]==88.7
call("pantry_add",{"ingredient":"huevo","quantity":"6"})
call("pantry_add",{"ingredient":"tomate"})
call("pantry_add",{"ingredient":"espinaca"})
d=call("dashboard")
assert len(d["pantry"])==3
assert d["recipes"][0]["id"]=="huevos", d["recipes"][0]
rid=d["pantry"][0]["id"]
call("pantry_remove",{"id":rid})
assert len(call("dashboard")["pantry"])==2
call("meal",{"type":"almuerzo","description":"Pollo con ensalada y arroz"})
assert call("dashboard")["meals"][0]["meal_type"]=="almuerzo"
call("ai_recipe",{"request":"Cena sin gluten"},503)
call("habits",{"water":4,"sleep":7.5,"steps":6500})
assert call("dashboard")["habits"][0]["water"]==4
prev=call("dashboard")["plan"]
call("workout",{"rpe":9,"minutes":19,"type":prev["type"],"exercises":["Sentadilla a silla","Marcha activa"]})
after=call("dashboard")
assert after["plan"]["seconds"]<=prev["seconds"], (prev,after)
assert len(after["workouts"])==1
call("measurement",{"weight_kg":88.4,"date":call("dashboard")["today"]})
assert len(call("dashboard")["measurements"])==1
call("profile",{"display_name":"P","age":999,"goal":"bajar"},422)
oldcsrf=csrf
csrf="invalid"
call("pantry_add",{"ingredient":"hack"},419)
csrf=oldcsrf
call("logout",{})
s=call("session")
csrf=s["csrf"]
assert s["user"] is None
call("dashboard",expected=401)
call("login",{"email":email,"password":"wrong123456789"},401)
u=call("login",{"email":email,"password":"password-Super-Test-2026!"})
csrf=u["csrf"]
assert len(call("dashboard")["workouts"])==1
export=call("export")
assert export["profile"]["display_name"]=="Prueba" and len(export["workouts"])==1
call("delete_account",{"password":"wrongpass"},403)
done=call("delete_account",{"password":"password-Super-Test-2026!"})
csrf=done["csrf"]
assert call("session")["user"] is None
call("login",{"email":email,"password":"password-Super-Test-2026!"},401)
print("PASS:",checks,"requests tested (registration, persistence, CSRF, validation, auth, adaptation, recipes)")
