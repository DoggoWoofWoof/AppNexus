// Insights: a territory snapshot. Where patients leave, who is growing, and what's coming later.

import { allHcps, allOrgs, destination, getOrg, procedureTotal, procedureYoy, proceduresOf } from '../data/index.js';
import { addSeries } from '../data/series.js';
import { REP } from '../data/seed.js';
import { formatNumber, html, plural } from '../format.js';
import { avatar, barRow, button, card, delta, icon, kpis, sectionHead, soon, sparkline, tag } from '../ui.js';

const ASK_NEXT = ['Which accounts are growing the most?', 'What has declined?', 'Where am I losing the most volume?', 'Who sends the most patients out of the system?'];

export const resource = () => ({ key: 'insights', resolve: () => true });

export const title = () => 'Insights';

export function render(ctx) {
  const system = getOrg('msh-system');
  const leaking = allOrgs().filter((o) => o.leakage && o.id !== system.id).sort((a, b) => b.leakage.leftPct - a.leakage.leftPct);
  const rising = allHcps()
    .map((h) => ({ h, growth: procedureYoy(h) }))
    .filter((r) => r.growth != null)
    .sort((a, b) => b.growth - a.growth);
  const risingCount = rising.filter((r) => r.growth >= 10).length;
  const outside = system.leakage.destinations.filter((d) => d.ref);
  const maxOut = Math.max(...outside.map((d) => d.patients));

  return html`
    <header class="page-head">
      <p class="eyebrow">Territory · ${REP.team}</p>
      <h1>Insights</h1>
      <p class="page-sub">Sample claims signals for your book over the last 12 months.</p>
    </header>
    ${kpis([
      { label: 'Procedures in your territory', value: formatNumber(procedureTotal(system)), delta: procedureYoy(system) },
      { label: 'Patients leaving the system', value: `${system.leakage.leftPct}%`, sub: `of ${formatNumber(system.leakage.patients)} patients`, tone: 'orange' },
      { label: 'Accounts with leakage risk', value: String(leaking.filter((o) => o.leakage.leftPct >= 20).length), sub: `of ${plural(leaking.length, 'reporting site')}` },
      { label: 'HCPs with rising volume', value: String(risingCount), sub: 'Up 10% or more on last year' },
    ])}
    <div class="grid-2">
      ${card(html`
        ${sectionHead('Where patients leave', { sub: 'Share of cardiovascular patients who left the system' })}
        <ul class="entity-list">${leaking.map((o) => html`<li><button type="button" class="entity-row" data-action="openProfile" data-id="${o.id}" data-tab="leakage">
          ${avatar(o)}
          <span class="entity-main"><span class="row-title">${o.name}</span><span class="caption">${formatNumber(o.leakage.patients)} patients · biggest gap ${o.leakage.byFamily[0].family}</span>
            <span class="bar bar-orange" style="--w:${Math.round((o.leakage.leftPct / 50) * 100)}%"></span></span>
          <span class="entity-figure">${o.leakage.leftPct}%<span class="caption">left</span></span>
        </button></li>`)}</ul>
        ${allOrgs().filter((o) => !o.leakage && o.leakageUnavailable).map((o) => html`<p class="caption">${icon('lock')} ${o.name}: leakage not reported.</p>`)}
      `)}
      ${card(html`
        ${sectionHead('Top destinations outside the system', { sub: 'Fictional names · patients, last 12 months' })}
        ${outside.map((d) => barRow({ label: destination(d.ref).name, sub: destination(d.ref).note, value: d.patients, max: maxOut, tone: 'orange', display: html`${formatNumber(d.patients)} ${d.trend ? html`<span class="delta delta-${d.trend > 0 ? 'up-bad' : 'down-good'}">${d.trend > 0 ? '+' : ''}${d.trend}%</span>` : ''}` }))}
        <p class="insight">${icon('lightbulb')}<span>${system.leakage.insight}</span></p>
      `)}
    </div>
    ${card(html`
      ${sectionHead('Volume trends by HCP', { sub: 'Procedures, last 12 months vs the 12 before · tap for the full breakdown' })}
      <ul class="entity-list trend-list">${rising.map(({ h, growth }) => html`<li><button type="button" class="entity-row" data-action="openProfile" data-id="${h.id}" data-tab="volumes">
        ${avatar(h)}
        <span class="entity-main"><span class="row-title">${h.name}</span><span class="caption">${h.specialty}</span></span>
        <span class="trend-spark">${sparkline(addSeries(proceduresOf(h).map((r) => r.series)))}</span>
        <span class="entity-figure">${formatNumber(procedureTotal(h))}${delta(growth, { suffix: '' })}</span>
      </button></li>`)}</ul>
      <p class="fineprint">${icon('info')} Illustrative sample figures. Referring physicians without procedures in your code group are not listed.</p>
    `)}
    ${yourWeek(ctx)}
    ${card(html`
      ${sectionHead('Ask about your territory', { sub: 'Answers with the ranked figures behind them', actions: button({ label: 'Open Ask', icon: 'sparkles', action: 'tab', data: { tab: 'ask' }, size: 'sm', variant: 'ghost' }) })}
      <ul class="chip-list">${ASK_NEXT.map((q) => html`<li><button type="button" class="chip chip-ask" data-action="askSuggestion" data-q="${q}">${q}</button></li>`)}</ul>
    `, 'ask-card')}
    ${card(html`
      ${sectionHead('Coming later', { sub: 'Planned for the app; available on the web platform today where noted' })}
      <div class="soon-grid">
        <div class="soon-item">${icon('file-chart-column')}<div><h3>Leakage reports</h3><p class="caption">Shareable PDF summaries for an account. On the web platform today.</p></div>${soon('Generate report')}</div>
        <div class="soon-item">${icon('refresh-cw')}<div><h3>CRM sync</h3><p class="caption">Notes and follow-ups are kept on this device for now.</p></div>${soon('Connect CRM')}</div>
      </div>
      ${tag('Sample data', 'neutral')}
    `)}
  `;
}

/** The rep's own coverage, so the territory numbers sit next to what they've done about them. */
function yourWeek(ctx) {
  const s = ctx.weekStats();
  return card(html`
    ${sectionHead('Your coverage', { sub: 'Activity on this device and in the sample history' })}
    ${kpis([
      { label: 'Logged · last 7 days', value: String(s.logged), sub: 'Visits, calls and notes' },
      { label: 'People seen · 30 days', value: `${s.seen}/${s.people}` },
      { label: 'Open follow-ups', value: String(s.open), tone: s.overdue ? 'orange' : '', sub: s.overdue ? `${s.overdue} overdue` : 'None overdue' },
    ])}
  `);
}
