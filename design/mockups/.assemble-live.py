from pathlib import Path
import re
import sys

repo=Path(__file__).resolve().parents[2]
out=Path(sys.argv[1]) if len(sys.argv)>1 else repo/'design/mockups/field-live-workflow.html'
s=(repo/'design/mockups/fieldpro-territory-preview.html').read_text(encoding='utf-8')
s=s.replace('fieldpro-territory-preview','field-live-workflow')
s=s.replace('Design preview · fictional figures · simulated AI, voice, reports and calendar','Live website flow study · illustrative data · simulated services')
s=s.replace('<div class="viz-carousel viz-dotted-background" aria-label="FieldPro summary layouts">','<div class="viz-dotted-background" aria-label="FieldPro and Field mobile flow">')
s=re.sub(r'    <section data-variant="Focused summary".*?</section>','    <section aria-label="Mobile FieldPro and Field"><div class="fp-stage"><div class="fp-phone" data-design="live" aria-label="FieldPro mobile workflow"></div></div></section>',s,count=1)
s=re.sub(r'    <section data-variant="Book summary".*?</section>\n','',s,count=1)
s=s.replace('stored?.schema===2','stored?.schema===7').replace('schema:2,sessionKey','schema:7,sessionKey').replace('p?.schema!==2','p?.schema!==7')
s=s.replace("const groups=['All codes','Hernia','Colectomy','Bariatric'];", "const groups=['All codes','Appendectomy','Bariatric','Cholecystectomy','Fundoplication / hiatal hernia','Gastrectomy','Lysis of adhesions','Small-bowel resection','Splenectomy','Colectomy','OB-GYN','Urology','Inguinal hernia','Ventral hernia'];")
s=s.replace("const weights={Hernia:.48,Colectomy:.32,Bariatric:.2};", "const weights={Appendectomy:.07,Bariatric:.06,Cholecystectomy:.18,'Fundoplication / hiatal hernia':.06,Gastrectomy:.05,'Lysis of adhesions':.04,'Small-bowel resection':.07,Splenectomy:.02,Colectomy:.16,'OB-GYN':.08,Urology:.05,'Inguinal hernia':.09,'Ventral hernia':.07};")
s=s.replace("return rows.sort((a,b)=>s.sort==='Name'?a.name.localeCompare(b.name):s.sort==='Nearest'?distance(a,s)-distance(b,s):vol(b,s)-vol(a,s));", "if(s.targetState&&s.targetState!=='all')rows=rows.filter(e=>e.state===s.targetState);if(s.targetCity&&s.targetCity!=='all')rows=rows.filter(e=>e.city===s.targetCity);return rows.sort((a,b)=>s.sort==='Name'?a.name.localeCompare(b.name):s.sort==='Nearest'?distance(a,s)-distance(b,s):s.sort==='Year on year'?b.trend-a.trend:s.sort==='Left %'?((S(b.id).left/S(b.id).volume)-(S(a.id).left/S(a.id).volume)):s.sort==='Leaking $'?S(b.id).leakingMoney-S(a.id).leakingMoney:s.sort==='Opportunity'&&s.kind==='hco'?b.opportunity-a.opportunity:vol(b,s)-vol(a,s));")
s=s.replace("let ids=mode==='route'?", "let ids=['territory','account'].includes(mode)?Object.keys(sites):mode==='route'?")
s=s.replace("reset:()=>{s=makeInitial();states", "reset:()=>{s=makeInitial();live.preTab='overview';live.about=null;live.voice='idle';live.handsFree=false;states")
s=s.replace("const factor=s=>s.group==='All codes'?1:s.group==='Hernia'?.48:s.group==='Colectomy'?.32:.2;", "const factor=s=>s.group==='All codes'?1:(weights[s.group]||0);")
s=re.sub(r"const vol=\(e,s\)=>.*?;", "const vol=(e,s)=>{const total=e.kind==='hco'?e.volume:e.vol;if(s.group==='All codes')return total;const keys=e.kind==='hco'?groups.slice(1):e.codes;if(!keys.includes(s.group))return 0;const denominator=keys.reduce((n,k)=>n+weights[k],0);return s.group===keys.at(-1)?total-keys.slice(0,-1).reduce((n,k)=>n+Math.round(total*weights[k]/denominator),0):Math.round(total*weights[s.group]/denominator);};",s,count=1)

old="    const allHco=Object.entries(sites).map"
new="    const scopeGroups={p1:['Appendectomy','Cholecystectomy','Colectomy','Inguinal hernia','Ventral hernia'],p2:['Bariatric','Gastrectomy','Fundoplication / hiatal hernia'],p3:['Colectomy','Small-bowel resection','Lysis of adhesions'],p4:['Cholecystectomy','Inguinal hernia','Ventral hernia'],p5:['Appendectomy','Splenectomy','Colectomy'],p6:['Bariatric','Gastrectomy','Fundoplication / hiatal hernia']};hcps.forEach(p=>p.codes=scopeGroups[p.id]);Object.values(sites).forEach(h=>h.leakingMoney=h.opportunity*.65);\n    const allHco=Object.entries(sites).map"
assert old in s
s=s.replace(old,new)
s=s.replace("selected:['p1','p3'],plan:[", "selected:['p1','p2','p3'],plan:[")
s=s.replace("{id:'v2',entity:'p3',site:'msw'", "{id:'v2',entity:'p2',site:'msh',status:'planned',mode:'Flexible',time:'',duration:30,goal:hcps[1].goal},{id:'v3',entity:'p3',site:'msw'")
s=s.replace("group:'Hernia'", "group:'Inguinal hernia'")
s=s.replace("function sheetContent(){", "function baseSheetContent(){",1)
s=s.replace("function act(action){", "function act(action){if(liveAct(action))return;",1)
s=s.replace("({targets,map:mapScreen,territories:territoriesPage,hco:hcoPage,hcp:hcpPage,route:routePage,visit:visitPage,recap,activity,reports,report:reportViewer,ask:askScreen}", "({targets:Vtargets,map:Vmap,territories:Vterritories,hco:Vhco,hcp:Vhcp,route:Vroute,visit:Vwork,recap,activity,reports,report:Vreport,'report-doc':reportViewer,ask:Vask}")
s=s.replace('${footer()}','${Vfooter()}')
s=s.replace("visit:'Current visit'", "visit:'Work'")
s=s.replace("report:'Report'", "report:'Report','report-doc':'Report PDF'")
s=s.replace('Math.max(...values)', 'Math.max(1,...values)')
s=s.replace("':scope > header,:scope > main,:scope > nav,:scope > .fp-bottombar,:scope > .fp-chat-composer'", "':scope > header,:scope > main,:scope > nav,:scope > .fp-bottombar,:scope > .fp-chat-composer,:scope > .live-composer,:scope > .live-workfoot,:scope > .live-voicepanel'")
s=s.replace('docnexus<span class="fp-logo">', 'Field Pro<span class="fp-logo">')
s=s.replace("duration:30,email:e.kind", "duration:60,email:e.kind")
s=s.replace("outcome:'',date:TODAY", "outcome:'Met',date:TODAY")
s=s.replace("title:sites[site].name+' · leakage'", "title:'Case Loss Analysis Report'")
s=s.replace("<h1>Day recap</h1>", "<h1>Summary</h1>")
s=s.replace("b('Back to targets','home:targets','fp-full')", "b('Plan tomorrow','plan-tomorrow','primary fp-full fp-gap')+b('Back to targets','home:targets','fp-full fp-gap')")

s=s.replace("b(icon('plus')+' Create territory','territory-new','primary fp-full')", "b(icon('plus')+' Create territory','territory-new','primary fp-full')+b('↑ Upload ZIP codes','zip-upload','fp-full fp-gap')")
s=s.replace("b('Generate leakage report','report:'", "b('Generate leakage report','pro-report:'")
s=s.replace("notes:rest.notes.slice(-8)", "turns:(rest.turns||[]).slice(-4),notes:rest.notes.slice(-8)")
s=s.replace("v.messages=[];v.notes", "v.messages=[];v.turns=(v.turns||[]).slice(-2);v.notes")

views=(repo/'design/mockups/.live-views.js').read_text(encoding='utf-8').replace('function Vroute(){','function sourceRouteView(){').replace('function extraSheet(kind,d){','function sourceExtraSheet(kind,d){').replace('function liveAct(action){','function sourceLiveAct(action){')
views += '\n'+(repo/'design/mockups/.refine-views.js').read_text(encoding='utf-8').replace('function liveAct(action){','function baseReviewAct(action){').replace('function extraSheet(kind,d){','function baseReviewSheet(kind,d){')
views=views.replace('${liveSummary()}<div class="live-sectionline">', '${s.source===\'new\'?\'<h1>Explore targets</h1>\':liveSummary()}<div class="live-sectionline">')
views=views.replace("[14,31,11,28,16]:[12,23,19,31,15]", "[20,22,8,35,15]:[18,24,9,31,18]")
views=views.replace('weights=[12,23,19,31,15,0,0]', 'weights=[18,24,9,31,18,0,0]')
views=views.replace("${metric(h?'Procedures 2025':'Claims 2025',fmt(vol(e,s)),e.trend+'% YoY')}${metric(h?'Opportunity 2025':'Referred in',h?cash(e.opportunity*factor(s)):fmt(Math.round(vol(e,s)*1.16)),h?(e.left/e.volume*100).toFixed(1)+'% left':'selected codes')}", "${metric(h?'Procedures 2025':'Claims 2025',fmt(vol(e,s)),'selected codes')}${metric(h?'Share 2025':'Lightest day',h?e.market+'%':'Wed',h?'in-radius procedures':'historical visits')}${metric('YoY vs 2024','+'+e.trend+'%','volume trend')}${metric(h?'Stayed / left':'Referred in',h?(100-e.left/e.volume*100).toFixed(1)+' / '+(e.left/e.volume*100).toFixed(1)+'%':fmt(vol(e,s)*1.16),h?'2025 measured procedures':'selected diagnoses')}${h?metric('Opportunity',cash(e.opportunity*factor(s)),'2025 · billed charges')+metric('Leaking $',cash(e.leakingMoney*factor(s)),'since 2022'):''}")

views += '\n'+(repo/'design/mockups/.review-views.js').read_text(encoding='utf-8')

def clean_module(path):
    text=path.read_text(encoding='utf-8')
    text=re.sub(r'^import .*?;\s*$', '',text,flags=re.M)
    return re.sub(r'^export ', '',text,flags=re.M)

engine='''\n    // Reused dev website question parser and answer builders, with a prototype data/context adapter.
    function createDevAsk(data){
      const {allHcps,allOrgs,destination,getEntity,getOrg,hcpsAt,primaryOrg,procedureTotal,procedureYoy,proceduresOf,siteFor,REP}=data;
      const activeItems=(items=[])=>items.filter(i=>i.status!=='cancelled');
      const routeOrder=(items=[])=>items;
'''+clean_module(repo/'demo/js/format.js')+'\n'+clean_module(repo/'demo/js/data/series.js')+'\n'+clean_module(repo/'demo/js/ask.js')+'''
      return {answer,findEntity,detectIntent,looksLikeQuestion,startersFor,spoken};
    }
'''
engine=engine.replace("getOrg('msh-system')", "(allOrgs()[0]||getOrg('msh'))")
engine=engine.replace('last 12 months','2025').replace('Last 12 months','2025').replace('Procedures · 12 months','Procedures · 2025')
s=s.replace('    function makeApp(app){',engine+'\n    function makeApp(app){',1)
assert '      render();const observer=' in s
s=s.replace('      render();const observer=',views+'\n      render();const observer=',1)
css=(repo/'design/mockups/.live-theme.css').read_text(encoding='utf-8').replace('font-size:10px','font-size:11px').replace('font-size:9px','font-size:11px')
css += '\n'+(repo/'design/mockups/.refine-theme.css').read_text(encoding='utf-8')
css += '\n'+(repo/'design/mockups/.review-theme.css').read_text(encoding='utf-8')
s=s.replace('  </style>',css+'\n  </style>',1)
s=s.replace('Restart preview</button></div>', 'Restart preview</button> <select data-preview-width aria-label="Preview phone width"><option value="430">430 px</option><option value="390">390 px</option><option value="320">320 px</option></select></div>')
s=s.replace('    function makeApp(app){', "    root.querySelector('[data-preview-width]').addEventListener('change',e=>{root.querySelectorAll('.fp-phone').forEach(p=>p.style.maxWidth=e.target.value+'px');});\n    function makeApp(app){")
s=s.replace('2026-10-29','2026-10-30').replace('2026-10-28','2026-10-29')
s=s.replace(' Activity & follow-ups',' History & follow-ups').replace(' Route & recap',' Route').replace('Resume route','Continue visits').replace('PDF · 1.2 MB','PDF').replace('1.2 MB','PDF')
s=s.replace("b('Assign territory','assign-batch')+b('Review route'","b('Review route'")
s=s.replace("b('Back to targets','home:targets'","b(design==='opportunity'?'Back to targets':'Back to Field','home:targets'")
# One shared engine and data model; independent state per navigation layout.
s=s.replace('<div class="viz-dotted-background" aria-label="FieldPro and Field mobile flow">','<div class="viz-carousel viz-dotted-background" aria-label="Navigation layouts">')
s=s.replace('<section aria-label="Mobile FieldPro and Field"><div class="fp-stage"><div class="fp-phone" data-design="live" aria-label="FieldPro mobile workflow"></div></div></section>', '<section data-variant="Field · Ask · History" aria-label="Field navigation"><div class="fp-stage"><div class="fp-phone" data-design="field" aria-label="Field navigation mock"></div></div></section>\n    <section data-variant="Targets · Ask · Opportunity" aria-label="Targets navigation" hidden><div class="fp-stage"><div class="fp-phone" data-design="opportunity" aria-label="Targets navigation mock"></div></div></section>')
out.write_text(s,encoding='utf-8')
(repo/'design/mockups/field-live-workflow.html').write_text(s,encoding='utf-8')
for key in ['field','opportunity']:
    single=re.sub(r'    <section data-variant="[^"]*".*?</section>\n?', lambda m: m.group(0).replace(' hidden','') if 'data-design="'+key+'"' in m.group(0) else '',s)
    single=single.replace('class="viz-carousel viz-dotted-background"','class="viz-dotted-background"')
    (repo/('design/mockups/field-review-'+key+'.html')).write_text(single,encoding='utf-8')
scripts=re.findall(r'<script(?![^>]*type="application/json")[^>]*>(.*?)</script>',s,re.S)
(repo/'design/mockups/.live-check.js').write_text('\n'.join(scripts),encoding='utf-8')
print('New fragment bytes:',out.stat().st_size)
print('Dev engine reused:',len(engine),'characters')
