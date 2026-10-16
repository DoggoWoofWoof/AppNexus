"""Download public geometry for the static, offline concept map."""
import concurrent.futures
import json
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "reference" / "maps"
OUT.mkdir(parents=True, exist_ok=True)

def get_json(url, data=None):
    request = urllib.request.Request(url, data=data, headers={"User-Agent": "FieldProConcept/1.0 (public map reference)"})
    with urllib.request.urlopen(request, timeout=55) as response:
        return json.load(response)

def hospitals():
    url = "https://health.data.ny.gov/resource/vn5v-hh5r.json?" + urllib.parse.urlencode({"$where": "facility_name like '%Mount Sinai%'", "$limit": 150})
    data = get_json(url)
    (OUT / "ny-health-facilities.json").write_text(json.dumps(data), encoding="utf-8")
    print("NY public facility matches:", len(data), flush=True)
    for row in data:
        if row.get("facility_name") in ["Mount Sinai West", "Mount Sinai Morningside", "Mount Sinai Hospital"]:
            print(json.dumps(row), flush=True)

def geometry():
    bounds = "40.745,-74.025,40.825,-73.925"
    query = '[out:json][timeout:40];(way["highway"~"^(primary|secondary|tertiary|residential|unclassified)$"](' + bounds + ');way["leisure"="park"](' + bounds + ');node["place"~"^(neighbourhood|suburb)$"](' + bounds + '););out geom;'
    osm = get_json("https://overpass-api.de/api/interpreter", urllib.parse.urlencode({"data": query}).encode())
    (OUT / "osm-midtown-reference.json").write_text(json.dumps(osm), encoding="utf-8")
    boroughs = get_json("https://data.cityofnewyork.us/api/v3/views/gthc-hcne/query.geojson?accessType=DOWNLOAD")
    (OUT / "nyc-boroughs-reference.json").write_text(json.dumps(boroughs), encoding="utf-8")
    print("OSM features:", len(osm.get("elements", [])), "NYC boroughs:", len(boroughs.get("features", [])), flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    futures = [pool.submit(hospitals), pool.submit(geometry)]
    for future in futures:
        future.result()
