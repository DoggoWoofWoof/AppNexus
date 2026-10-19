// HCP profile: overview, affiliations & locations, volumes, referrals, activity.

import { destination, diagnosesOf, getEntity, getHcp, getOrg, parentOf, primaryOrg, procedureTotal, procedureYoy } from '../data/index.js';
import { formatNumber, html, sum } from '../format.js';
import { mapView } from '../map.js';
import { avatar, barRow, card, copyButton, details, emptyState, kpis, panel, sectionHead, signalTags, tabs, tag } from '../ui.js';
import { activityPanel, profileActions, profileHeader, sampleNote, volumesPanel, webSections, whyCard } from './profile-parts.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'affiliations', label: 'Affiliations' },
  { id: 'volumes', label: 'Volumes' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'activity', label: 'Activity' },
];

export const resource = ({ id }) => ({ key: `hcp:${id}`, resolve: () => getHcp(id) });

export const title = ({ entry }) => getHcp(entry.params.id)?.name || 'Profile';

export function render(ctx) {
  const hcp = getHcp(ctx.entry.params.id);
  const current = TABS.some((t) => t.id === ctx.entry.ui.tab) ? ctx.entry.ui.tab : 'overview';
  const org = primaryOrg(hcp);
  const activityCount = ctx.ws.interactions.filter((i) => !i.deleted && (i.targetId === hcp.id || i.attendees?.includes(hcp.id))).length;
  const panels = { overview, affiliations, volumes: volumesPanel, referrals, activity: activityPanel };

  return html`
    ${profileHeader(hcp, ctx, {
      kicker: `HCP · ${hcp.specialty}`,
      title: `${hcp.name}, ${hcp.credentials}`,
      sub: html`<button type="button" class="link" data-action="openProfile" data-id="${org.id}">${org.name}</button> · ${org.city.replace(/ \d{5}$/, '')}`,
      chips: signalTags(ctx.signals(hcp), 4),
    })}
    ${profileActions(hcp, ctx)}
    ${tabs(TABS.map((t) => (t.id === 'activity' ? { ...t, count: activityCount } : t)), current, { label: 'Profile sections' })}
    ${panel(current, panels[current](hcp, ctx))}
  `;
}

function overview(hcp, ctx) {
  const org = primaryOrg(hcp);
  const patientsLastQ = sum((diagnosesOf(hcp) || []).map((d) => d.series.at(-1)));
  const inbound = sum(hcp.referrals.inbound.map((r) => r.count));
  const outbound = sum(hcp.referrals.outbound.map((r) => r.count));
  const leaving = sum(hcp.referrals.outbound.filter((r) => r.ref).map((r) => r.count));
  const total = procedureTotal(hcp);

  return html`
    ${whyCard(hcp, ctx, hcp.insight)}
    ${kpis([
      hcp.procedures ? { label: 'Procedures · 12 mo', value: formatNumber(total), delta: procedureYoy(hcp) } : { label: 'Procedures · 12 mo', value: '—', sub: 'Not in your code group' },
      { label: 'Patients · last quarter', value: formatNumber(patientsLastQ), sub: 'Across tracked diagnoses' },
      { label: 'Referrals in · 12 mo', value: formatNumber(inbound) },
      { label: 'Referrals out · 12 mo', value: formatNumber(outbound), sub: outbound ? `${Math.round((leaving / outbound) * 100)}% leave the system` : 'None recorded', tone: leaving ? 'orange' : '' },
    ])}
    <div class="grid-2">
      ${card(html`
        ${sectionHead('Identity')}
        ${details([
          ['Specialty', hcp.specialty],
          ['NPI', html`${hcp.npi} ${tag('Sample', 'neutral')}`],
          ['Board certification', hcp.boards.join(', ')],
          ['In practice', `${hcp.yearsInPractice} years`],
          ['Languages', hcp.languages.join(', ')],
          ...hcp.education,
        ])}
      `)}
      ${card(html`
        ${sectionHead('Contact & location')}
        ${details([
          ['Phone', hcp.contact.phone, copyButton(hcp.contact.phone, 'phone number')],
          ['Email', hcp.contact.email, copyButton(hcp.contact.email, 'email address')],
          ['Best time to reach', hcp.contact.preferred || html`<span class="muted">Not recorded yet</span>`],
          hcp.contact.assistant && ['Scheduler / assistant', hcp.contact.assistant],
          ['Primary practice', html`<button type="button" class="link" data-action="openProfile" data-id="${org.id}">${org.name}</button><br>${org.address}, ${org.city}`],
        ])}
        <button type="button" class="btn btn-ghost btn-sm" data-action="profileTab" data-tab="affiliations"><span>All practice locations</span></button>
      `)}
    </div>
    ${webSections(hcp)}
    ${sampleNote()}
  `;
}

function affiliations(hcp, ctx) {
  const rows = [...hcp.affiliations].sort((a, b) => b.share - a.share);
  const system = parentOf(getOrg(rows[0].orgId)) || null;
  return html`
    ${card(html`
      ${sectionHead('Practice locations', { sub: `${rows.length} ${rows.length === 1 ? 'site' : 'sites'} · tap a pin to open the facility` })}
      ${mapView({
        points: rows.map((a, i) => ({ id: a.orgId, coords: getOrg(a.orgId).coords, text: String(i + 1), title: `${i + 1}. ${getOrg(a.orgId).name}` })),
        action: 'openSiteProfile',
        label: `Map of ${hcp.name}'s practice locations`,
        height: 210,
      })}
    `)}
    ${card(html`
      ${sectionHead('Associated HCOs', { sub: 'Share of their procedures at each site (sample)' })}
      <ol class="affil-list">${rows.map((a, i) => {
        const org = getOrg(a.orgId);
        return html`<li class="affil">
          <span class="pin-number" aria-hidden="true">${i + 1}</span>
          <div class="affil-body">
            <button type="button" class="row-link" data-action="openProfile" data-id="${org.id}">
              <span class="row-title">${org.name}</span>${i === 0 ? tag('Primary', 'accent') : ''}
            </button>
            <p class="caption">${org.typeDetail} · ${org.address}, ${org.city}</p>
            <p>${a.role} · ${a.days}</p>
            ${barRow({ label: 'Share of procedures', value: a.share, display: `${a.share}%`, max: 100 })}
          </div>
        </li>`;
      })}</ol>
      ${system ? html`<p class="caption">Part of <button type="button" class="link" data-action="openProfile" data-id="${system.id}">${system.name}</button></p>` : ''}
    `)}
  `;
}

function referrals(hcp) {
  const { inbound, outbound } = hcp.referrals;
  const maxIn = Math.max(1, ...inbound.map((r) => r.count));
  const maxOut = Math.max(1, ...outbound.map((r) => r.count));
  const who = (r) => {
    if (r.hcpId) {
      const p = getHcp(r.hcpId);
      return html`<button type="button" class="link" data-action="openProfile" data-id="${p.id}">${p.name}</button>`;
    }
    if (r.ref) return html`${destination(r.ref).name} ${tag('Out of system', 'orange')}`;
    return r.label;
  };
  const outOfSystem = sum(outbound.filter((r) => r.ref).map((r) => r.count));
  const outTotal = sum(outbound.map((r) => r.count));

  return html`
    ${kpis([
      { label: 'Referred in · 12 mo', value: formatNumber(sum(inbound.map((r) => r.count))), sub: `${inbound.length} sources` },
      { label: 'Referred out · 12 mo', value: formatNumber(outTotal), sub: `${outbound.length} destinations` },
      { label: 'Leaving the system', value: outTotal ? `${Math.round((outOfSystem / outTotal) * 100)}%` : '—', sub: `${formatNumber(outOfSystem)} patients`, tone: outOfSystem ? 'orange' : '' },
    ])}
    <div class="grid-2">
      ${card(html`
        ${sectionHead('Who refers to them', { sub: 'Patients referred in, last 12 months (sample)' })}
        ${inbound.length ? inbound.map((r) => barRow({ labelHtml: who(r), value: r.count, max: maxIn })) : emptyState({ icon: 'git-branch', title: 'No inbound referrals', body: 'Nobody in the claims sample referred patients to this HCP.' })}
      `)}
      ${card(html`
        ${sectionHead('Where they refer', { sub: 'Patients referred out, last 12 months (sample)' })}
        ${outbound.length ? outbound.map((r) => barRow({ labelHtml: who(r), sub: r.reason, value: r.count, max: maxOut, tone: r.ref ? 'orange' : 'accent' })) : emptyState({ icon: 'git-branch', title: 'No outbound referrals', body: 'They treat their own patients rather than referring them on.' })}
      `)}
    </div>
    ${card(html`
      ${sectionHead('Professional relationships', { sub: 'Co-authors, care teams and shared patients' })}
      ${hcp.relationships.length
        ? html`<ul class="entity-list">${hcp.relationships.map((r) => {
          const p = getEntity(r.hcpId);
          return html`<li><button type="button" class="entity-row" data-action="openProfile" data-id="${p.id}">
            ${avatar(p)}<span class="entity-main"><span class="row-title">${p.name}</span><span class="caption">${p.specialty} · ${r.detail}</span></span>${tag(r.type, 'accent')}
          </button></li>`;
        })}</ul>`
        : emptyState({ icon: 'users', title: 'No relationships found', body: 'No co-authors, care teams or shared patients in the sample data.' })}
    `)}
  `;
}
