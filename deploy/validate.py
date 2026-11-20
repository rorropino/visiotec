from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
from xml.etree import ElementTree
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.links=[]; self.categories=[]; self.assets=[]
    def handle_starttag(self,t,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if t=='a':self.links.append(a.get('href',''))
        if 'data-category' in a:self.categories.append(a['data-category'])
        for k in ('src','href'):
            v=a.get(k,'')
            if v.startswith('/assets/'):self.assets.append(v.split('?')[0])
p=P();p.feed(Path('site/index.html').read_text())
assert len(p.ids)==len(set(p.ids))
assert all(x[1:] in p.ids for x in p.links if x.startswith('#'))
assert Counter(p.categories)=={'own':9,'client':4,'system':4,'lab':2}
assert all(Path('site'+x).is_file() for x in p.assets)
assert Path('site/privacidad.html').is_file()
ElementTree.parse('site/sitemap.xml')
print('19 fichas, assets, anchors, IDs y sitemap: OK')
