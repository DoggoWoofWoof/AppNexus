# Field Pro map experience

16 October 2026 · Extension of the four-tab proposal.

## Placement

Keep Today / Targets / Activity / Insights. A map is a view of target records and the current plan, so it does not need a fifth primary tab.

- **Today:** an optional compact map card. Before planning, show assigned sites in the current territory. After planning, show the selected day's active sites. Tap a pin or Open map to enter Targets with the relevant scope. Let the rep hide and restore the card.
- **Targets:** equally visible List / Map controls. Share entity type, search, selected scope, filters and selection context. A selected pin exposes one brief card with identity, site, known opportunity reason, Open brief and Add to day. Several HCPs at one facility share a location marker; individual visit outcomes remain separate.
- **Plan and route review:** preserve confirmed commitments and display real road routes, origin, ordered stops, travel time and buffers when integrated. No route line or ETA should be invented from pin order.
- **Future device home-screen widget:** a separate native extension could expose the next visit, a map snapshot and a deep link into the selected day. It is an additional product surface, not implemented by the in-app card. Keep it focused; do not move full discovery filters into it. See [Apple's widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets).

## Routing decision from the discussion

Use a real routing provider for production travel distances, duration, feasibility and route geometry. The user explicitly suggested Google Maps or OSM and identified Haversine as an approximation.

- **Google:** Maps SDK for display and [Routes / Compute Route Matrix](https://developers.google.com/maps/documentation/routes/compute-route-matrix-over) for road distances and travel durations. Respect travel mode, departure time, supported traffic options, failures and provider status.
- **OSM stack:** OpenStreetMap supplies map data; add an actual routing engine/service such as [OSRM](https://project-osrm.org/docs/v26.5.0/http) or Valhalla for routes and travel-time matrices. An OSM basemap alone does not provide a routing service or traffic estimates.
- Straight-line geographic distance may generate candidate nearby accounts. It must not become a drive-time estimate or establish that a visit fits in a gap. Rank feasible candidates using the provider's travel matrix, appointment constraints, visit duration and configured working day. Distinguish travel, visit and buffer time.
- Use a selected stop or manually chosen origin without requiring GPS. Offer live location only when requested; a missing location permission must leave target discovery usable. Preserve the selected campus/site, since an organization's headquarters is not necessarily the visit entrance.

## Current interactive concept

The maintained `mockup/source/field-pro-responsive.html`, published through `demo/`, incorporates the static geographic preview and daily-flow interactions. Its two entries are the optional Today map card and Targets Map view. The earlier map-only conversation concept is superseded.

The concept includes List / Map, account/person modes, shared search, Assigned / My day / Opportunities / Nearby filters, selectable site pins, profile opening, Add to day and the optional Today card. Nearby is explicitly a five-kilometer straight-line filter around the selected public facility. Opportunity reasons and assignments are illustrative, without fabricated commercial scores. Live routing, map tiles/panning, traffic, GPS and remote persistence are not connected.

Basemap streets/parks are derived from [OpenStreetMap](https://www.openstreetmap.org/copyright), land boundaries from [NYC Open Data](https://data.cityofnewyork.us/d/gthc-hcne), and the three facility coordinates from [New York's Health Facility General Information](https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r). The facilities are real public locations used as map references. People, assignments and activity are fictional. Raw inputs and the reduced geometry are retained under `reference/maps`; the fragment embeds the reduced data and makes no runtime data requests.

Browser verification covered Today → map, pin selection, shared opportunity filtering in map/list, map → Add to day → saved plan → My day map, person search → brief → Back with query retained, hiding/restoring the Today card, and map/card layouts at 320 pixels without horizontal overflow. Routing-service behavior and the native widget have not been tested because they are not implemented.

This changes the depth of S07 and adds a state of S03. The audit remains **39 screen families and 12 reusable sheets/dialogs**. A future native widget needs its own design and platform scope before adding it to delivery estimates.
