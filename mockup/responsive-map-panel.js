// Shared composed view, embedded into the standalone conversation concept.
function mapPanel(data) {
  const records = mapRecords(data);
  const sites = [...new Set(records.map(p => p.account || p.id))];
  if (!sites.includes(state.mapSelected)) state.mapSelected = sites[0] || '';
  const org = find(state.mapSelected);
  const record = records.find(p => (p.account || p.id) === state.mapSelected);
  const plannedItem = record && activeDay().find(i => i.target === record.id || (record.kind === 'hco' && find(i.target).account === record.id));
  const peopleHere = people.filter(p => p.account === state.mapSelected);
  const detail = record ? `
    <section class="day-map-detail" aria-live="polite">
      <div class="day-row"><span class="day-kicker">${plannedItem ? 'In your day' : state.mapLayer === 'opportunity' ? 'Sample opportunity' : 'Assigned target'}</span><span class="day-pill">${sites.indexOf(state.mapSelected) + 1}</span></div>
      <h2 style="margin-top:8px">${record.name}</h2>
      <p class="day-muted">${record.kind === 'hcp' ? record.sub + ' · ' + org.name : mapData.sites.find(s => s.id === org.id)?.address || org.city}</p>
      ${record.kind === 'hco' ? `<p class="day-muted" style="margin-top:8px">${peopleHere.length ? peopleHere.map(p => p.name).join(', ') : 'Open the account to review associated people.'}</p>` : ''}
      <p class="day-reason">${record.id === 'maya' || org.id === 'riverside' ? 'Sample reason · Follow-up due' : org.id === 'eastside' ? 'Sample reason · Account review opportunity' : record.reason}</p>
      <div class="day-actions">${button('Open brief', `data-profile="${record.id}"`)}${button(plannedItem ? 'Edit visit' : 'Add to day', `data-add="${plannedItem?.target || record.id}"`, 'primary')}</div>
    </section>` : `<div class="day-notice">${state.mapLayer === 'day' ? 'No matching visits in this day. Select targets to start planning.' : 'No matching targets. Adjust the search or layer.'}</div>`;
  return `
    <div class="day-map-layers" role="group" aria-label="Map layers">${[['all', 'Assigned'], ['day', 'My day'], ['opportunity', 'Opportunities'], ['nearby', 'Nearby']].map(([id, label]) => `<button type="button" class="cursor-interaction" data-map-layer="${id}" aria-pressed="${state.mapLayer === id}">${label}</button>`).join('')}</div>
    <div class="day-map-workspace">
      <div class="day-map-scene">${mapFrame(records)}${mapAttribution()}</div>
      <div class="day-map-context">
        <p class="day-caption" style="margin:8px 0">${sites.length} ${sites.length === 1 ? 'site' : 'sites'} · ${state.mapLayer === 'nearby' ? 'Within 5 km of ' + find(state.mapAnchor).name + ' · Straight-line distance' : 'Public facility locations · Sample assignments'} · No live location</p>
        ${detail}
        ${state.mapLayer === 'day' ? button('Review day & route', 'data-open="plan" class="day-full"', 'secondary') : ''}
      </div>
    </div>`;
}
