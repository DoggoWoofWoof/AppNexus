"""Reduce downloaded public geometry for embedding in the concept."""
import json
import math
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "reference" / "maps"
BOUNDS = [-74.015, 40.75, -73.925, 40.82]

def simplify(points, epsilon=0.000045):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0]-a[0], b[1]-a[1]
    length = dx*dx + dy*dy
    best, index = 0, 0
    for i, p in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) if length else 0
        distance = math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy)
        if distance > best:
            best, index = distance, i
    if best <= epsilon:
        return [a, b]
    return simplify(points[:index+1], epsilon)[:-1] + simplify(points[index:], epsilon)

def intersects(points):
    xs, ys = zip(*points)
    return max(xs)>=BOUNDS[0] and min(xs)<=BOUNDS[2] and max(ys)>=BOUNDS[1] and min(ys)<=BOUNDS[3]

def tidy(points, closed=False):
    points = [[round(x, 5), round(y, 5)] for x, y in simplify(points)]
    if closed:
        if points[0] != points[-1]:
            points.append(points[0])
        if len(points) < 4:
            return []
    return points

boroughs = json.loads((BASE / "nyc-boroughs-reference.json").read_text())
land = []
for feature in boroughs['features']:
    polygons = feature['geometry']['coordinates']
    if feature['geometry']['type'] == 'Polygon':
        polygons = [polygons]
    for polygon in polygons:
        if intersects(polygon[0]):
            rings = [tidy(ring, True) for ring in polygon]
            rings = [ring for ring in rings if ring]
            if rings:
                for i, ring in enumerate(rings):
                    area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))
                    if (i == 0 and area > 0) or (i > 0 and area < 0):
                        ring.reverse()
                land.append({"type":"Feature","properties":{"name":feature['properties']['boroname']},"geometry":{"type":"Polygon","coordinates":rings}})

osm = json.loads((BASE / "osm-midtown-reference.json").read_text())
roads, parks, labels = [], [], []
for item in osm['elements']:
    tags = item.get('tags',{})
    if item['type']=='node':
        if tags.get('name') in ['Upper West Side','Upper East Side','Midtown','Morningside Heights','Hell\u2019s Kitchen','Hell\'s Kitchen']:
            labels.append({'name':tags['name'],'coordinates':[item['lon'],item['lat']]})
        continue
    points = [[p['lon'],p['lat']] for p in item.get('geometry',[])]
    if len(points)<2 or not intersects(points):
        continue
    if tags.get('highway'):
        roads.append({'type':'Feature','properties':{'kind':tags['highway']},'geometry':{'type':'LineString','coordinates':tidy(points)}})
    elif tags.get('leisure')=='park' and points[0]==points[-1]:
        ring = tidy(points,True)
        if ring:
            area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]))
            if area>0:
                ring.reverse()
            parks.append({'type':'Feature','properties':{'name':tags.get('name','Park')},'geometry':{'type':'Polygon','coordinates':[ring]}})

facilities = json.loads((BASE / "ny-health-facilities.json").read_text())
idmap={'Mount Sinai West':'riverside','Mount Sinai Morningside':'westside','Mount Sinai Hospital':'eastside'}
sites=[]
for row in facilities:
    if row['facility_name'] in idmap:
        sites.append({'id':idmap[row['facility_name']],'name':row['facility_name'],'address':row['address1'],'coordinates':[float(row['longitude']),float(row['latitude'])],'sourceId':row['fac_id']})

grouped_roads=[]
for kind in sorted({r['properties']['kind'] for r in roads}):
    grouped_roads.append({'type':'Feature','properties':{'kind':kind},'geometry':{'type':'MultiLineString','coordinates':[r['geometry']['coordinates'] for r in roads if r['properties']['kind']==kind]}})
result={'bounds':BOUNDS,'land':{'type':'FeatureCollection','features':land},'roads':{'type':'FeatureCollection','features':grouped_roads},'parks':{'type':'FeatureCollection','features':parks},'labels':labels,'sites':sites,'sources':{'streets':'https://www.openstreetmap.org/copyright','land':'https://data.cityofnewyork.us/d/gthc-hcne','sites':'https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r'}}
out=BASE/'manhattan-concept-map.json'
out.write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print('Embedded reference:',out.stat().st_size,'bytes;',len(roads),'roads,',len(parks),'parks,',len(land),'land polygons,',len(sites),'sites')
assert len(sites)==3 and out.stat().st_size<800000
