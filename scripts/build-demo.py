"""Build the public static demo from the maintained conversation fragment."""
import json
import hashlib
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'mockup/source/field-pro-responsive.html').read_text(encoding='utf-8')
def bundle(marker, files):
    global source
    pattern=r'/\* BEGIN_'+marker+r' \*/[\s\S]*?/\* END_'+marker+r' \*/'
    code='\n'.join((ROOT/name).read_text(encoding='utf-8') for name in files)
    assert re.search(pattern,source), marker
    source=re.sub(pattern,lambda _: '/* BEGIN_'+marker+' */\n'+code+'\n/* END_'+marker+' */',source)

bundle('CAPTURE_RUNTIME',['app/capture-model.js','app/device-store.js','app/recording-session.js'])
bundle('CAPTURE_UI',['app/capture-ui.js'])
bundle('FLOWS_UI',['app/flows-ui.js','app/experience-ui.js'])
css=(ROOT/'app/experience.css').read_text(encoding='utf-8')
css_pattern=r'/\* BEGIN_EXPERIENCE_CSS \*/[\s\S]*?/\* END_EXPERIENCE_CSS \*/'
if not re.search(css_pattern,source):
    source=source.replace('</style>','/* BEGIN_EXPERIENCE_CSS */\n/* END_EXPERIENCE_CSS */\n</style>',1)
source=re.sub(css_pattern,lambda _: '/* BEGIN_EXPERIENCE_CSS */\n'+css+'\n/* END_EXPERIENCE_CSS */',source)
(ROOT/'mockup/source/field-pro-responsive.html').write_text(source,encoding='utf-8')
styles=re.findall(r'<style>([\s\S]*?)</style>',source)
scripts=list(re.finditer(r'<script([^>]*)>([\s\S]*?)</script>',source))
data=[m.group(0) for m in scripts if 'application/json' in m.group(1)]
code=[m.group(2) for m in scripts if 'application/json' not in m.group(1) and 'src=' not in m.group(1)]
assert len(styles)==1 and len(data)==1 and len(code)==1
json.loads(re.search(r'>([\s\S]*)</script>',data[0]).group(1))
markup=re.sub(r'<style>[\s\S]*?</style>|<script[^>]*>[\s\S]*?</script>','',source).strip()
template=(ROOT/'demo/template.html').read_text(encoding='utf-8')
document=template.replace('<!-- PRODUCT_MARKUP -->',markup).replace('<!-- MAP_DATA -->',data[0])
for name,body in [('app.js',code[0]),('app.css',styles[0]),('shell.js',(ROOT/'demo/shell.js').read_text(encoding='utf-8')),('shell.css',(ROOT/'demo/shell.css').read_text(encoding='utf-8'))]:
    version=hashlib.sha256(body.encode('utf-8')).hexdigest()[:12]
    document=document.replace('"'+name+'"','"'+name+'?v='+version+'"')
(ROOT/'demo/index.html').write_text(document,encoding='utf-8')
(ROOT/'demo/app.css').write_text(styles[0],encoding='utf-8')
(ROOT/'demo/app.js').write_text(code[0],encoding='utf-8')
print('Built demo/index.html, demo/app.css and demo/app.js')
