"""Build the public static demo from the maintained conversation fragment."""
import json
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
bundle('FLOWS_UI',['app/flows-ui.js'])
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
(ROOT/'demo/index.html').write_text(document,encoding='utf-8')
(ROOT/'demo/app.css').write_text(styles[0],encoding='utf-8')
(ROOT/'demo/app.js').write_text(code[0],encoding='utf-8')
print('Built demo/index.html, demo/app.css and demo/app.js')
