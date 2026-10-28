"""Export both navigation layouts with the bundled visualization renderer."""
from pathlib import Path
import importlib.util
import sys
import html

repo=Path(__file__).resolve().parents[2]
runtime=Path(sys.argv[1]) if len(sys.argv)>1 else Path('C:/Users/Swastik/.codex/plugins/cache/openai-bundled/visualize/1.0.57/skills/visualize/scripts/render.py')
spec=importlib.util.spec_from_file_location('review_renderer',runtime)
module=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=module
spec.loader.exec_module(module)
out=repo/'design/published-review/dist'
out.mkdir(parents=True,exist_ok=True)
mobile='''<style>
@media(max-width:480px){#field-live-workflow .fp-preview-caption{display:none}#field-live-workflow .fp-stage{padding:0;min-height:0}#field-live-workflow .fp-phone{height:100dvh;max-width:100%!important;border:0;border-radius:0!important;box-shadow:none}#field-live-workflow .fp-nav{padding-bottom:max(10px,env(safe-area-inset-bottom))}}
</style>'''
for key,folder,title in [('field','field','Field / Ask / History'),('opportunity','targets','Targets / Ask / Opportunity')]:
    source=repo/f'design/mockups/field-review-{key}.html'
    fragment=source.read_text(encoding='utf-8')+mobile
    rendered=module._render_document(fragment,title)
    rendered=rendered.replace('sandbox="allow-scripts"','sandbox="allow-scripts allow-downloads"')
    rendered=rendered.replace('</head>','<style>@media(max-width:480px){html,body{padding:0!important}iframe{height:100dvh!important;width:100%!important}}</style></head>',1)
    dest=out/folder/'index.html'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(rendered,encoding='utf-8')
    print(folder, dest.stat().st_size)
