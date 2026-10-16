function todayMap() {
  if (!cfg.mapPreview) return `<button type="button" class="day-link cursor-interaction" data-show-mini>${ic('map')}Show map preview</button>`;
  const planned = activeDay();
  const sites = planned.length ? orgs.filter(p => planned.some(i => (find(i.target).account || i.target) === p.id)) : orgs;
  return `
    <section class="day-map-card" aria-label="Today map preview">
      <div class="day-row day-map-card-head">
        <div><h2>${planned.length ? 'Your day, on the map' : 'Your territory, at a glance'}</h2><p class="day-muted">${sites.length} ${planned.length ? 'planned' : 'sample assigned'} ${sites.length === 1 ? 'site' : 'sites'} · Manhattan</p></div>
        <button type="button" class="day-icon cursor-interaction" aria-label="Hide map preview" data-hide-mini>${ic('minus')}</button>
      </div>
      <div class="day-mini-wrap">${mapFrame(sites, true)}</div>
      ${mapAttribution()}
      <div class="day-map-card-foot">${button(ic('expand') + ' Open map', 'data-map-home', 'secondary')}</div>
    </section>`;
}
