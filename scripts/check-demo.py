"""Check the static demo build, local assets and scope manifest without APIs."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]

class Assets(HTMLParser):
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        value=attrs.get('src') if tag=='script' else attrs.get('href') if tag=='link' else None
        if value and not urlsplit(value).scheme:
            assert (ROOT/'demo'/value).is_file(), f'Missing demo asset: {value}'

page=(ROOT/'demo/index.html').read_text(encoding='utf-8')
Assets().feed(page)
assert '<!-- PRODUCT_MARKUP -->' not in page and '<!-- MAP_DATA -->' not in page
assert page.count('id="field-pro-responsive"')==1
assert page.count('data-variant=')==3
inventory=json.loads((ROOT/'docs/surface-area.json').read_text(encoding='utf-8'))
assert len(inventory['screens'])==39
assert all(s.get('responsiveRule') for s in inventory['screens'])
assert len(inventory['hcpSections'])==18 and len(inventory['hcoSections'])==19
print('Static assets, build markers, responsive inventory and profile destinations verified')
