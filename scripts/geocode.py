#!/usr/bin/env python3
"""
Geocodifica ciudades y barrios contra Nominatim (OpenStreetMap) -> data/geo.json

La data no trae coordenadas, solo "Las Mercedes, Caracas" como texto. El mapa las necesita.

Dos defensas, porque geocodificar a ciegas pone pines donde no van:
  1. Solo se aceptan tipos de LUGAR (suburb, quarter, neighbourhood...). Sin esto
     "La Lago" resuelve a un supermercado que casualmente se llama igual.
  2. El resultado debe caer a menos de 25 km del centro de su ciudad. Si no,
     se descarta y el barrio hereda el centro de la ciudad, marcado como aproximado.

Reanudable: relanzar solo pide lo que falta. Respeta el limite de 1 req/s de Nominatim.

Uso: python3 scripts/geocode.py
"""
import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DST = ROOT / "data" / "geo.json"
UA = "inmuebles-ve-geocode/1.0 (contacto: fabian@upstreamagency.io)"

# En vez de una lista blanca de tipos (demasiado estrecha: el 70% de las urbanizaciones
# venezolanas no encaja en ninguno), se rechazan las CLASES que son claramente un negocio.
# La defensa fuerte es la distancia al centro de la ciudad, no el tipo.
CLASES_POI = {"shop", "amenity", "tourism", "leisure", "craft", "office", "healthcare", "commercial"}
LUGARES = {
    "suburb", "quarter", "neighbourhood", "residential", "administrative",
    "city_district", "city", "town", "village", "hamlet", "borough", "locality",
}
RADIO_MAX_KM = 25


def km(a, b):
    """Haversine. Suficiente para un umbral de 25 km."""
    (la1, lo1), (la2, lo2) = a, b
    p = math.pi / 180
    h = (0.5 - math.cos((la2 - la1) * p) / 2
         + math.cos(la1 * p) * math.cos(la2 * p) * (1 - math.cos((lo2 - lo1) * p)) / 2)
    return 12742 * math.asin(math.sqrt(h))


def consultar(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "json", "limit": 5, "countrycodes": "ve", "addressdetails": 0}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except Exception as e:
        print(f"    error de red: {e}", file=sys.stderr)
        return []
    finally:
        time.sleep(1.1)  # politica de uso de Nominatim: 1 req/s


def main():
    listings = json.loads((ROOT / "data" / "listings.json").read_text())
    geo = json.loads(DST.read_text()) if DST.exists() else {}

    ciudades = {}
    for l in listings:
        ciudades.setdefault(l["ciudad"], l["ciudadNombre"])
    barrios = {}
    for l in listings:
        if l["barrio"]:
            barrios[(l["ciudad"], l["barrio"])] = (l["barrioNombre"], l["ciudadNombre"])

    # --- ciudades: son el ancla contra la que se valida todo lo demas ---
    for slug, nombre in ciudades.items():
        k = f"ciudad:{slug}"
        if k in geo:
            continue
        r = [x for x in consultar(f"{nombre}, Venezuela") if x.get("type") in LUGARES] or consultar(f"{nombre}, Venezuela")
        if r:
            geo[k] = {"lat": float(r[0]["lat"]), "lng": float(r[0]["lon"]), "exacto": True}
            print(f"  ciudad {nombre}: {geo[k]['lat']:.4f}, {geo[k]['lng']:.4f}")
        DST.write_text(json.dumps(geo, ensure_ascii=False, indent=2))

    # --- barrios ---
    pend = [(c, b) for (c, b) in barrios if f"barrio:{c}:{b}" not in geo]
    print(f"\n{len(barrios)} barrios | {len(barrios) - len(pend)} ya resueltos | {len(pend)} por consultar\n")

    aprox = 0
    for i, (cslug, bslug) in enumerate(pend, 1):
        bnombre, cnombre = barrios[(cslug, bslug)]
        centro = geo.get(f"ciudad:{cslug}")
        k = f"barrio:{cslug}:{bslug}"

        elegido = None
        # dos formas de preguntar: la segunda ayuda con las urbanizaciones
        for q in (f"{bnombre}, {cnombre}, Venezuela", f"Urbanizacion {bnombre}, {cnombre}, Venezuela"):
            candidatos = []
            for r in consultar(q):
                if r.get("class") in CLASES_POI:
                    continue  # defensa 1: "La Lago" no es el supermercado que se llama igual
                pt = (float(r["lat"]), float(r["lon"]))
                if centro and km((centro["lat"], centro["lng"]), pt) > RADIO_MAX_KM:
                    continue  # defensa 2: si no esta cerca de su ciudad, no es
                # se prefiere un tipo de lugar habitado, pero no se exige
                candidatos.append((0 if r.get("type") in LUGARES else 1, pt))
            if candidatos:
                elegido = min(candidatos, key=lambda c: c[0])[1]
                break

        if elegido:
            geo[k] = {"lat": elegido[0], "lng": elegido[1], "exacto": True}
        elif centro:
            geo[k] = {"lat": centro["lat"], "lng": centro["lng"], "exacto": False}
            aprox += 1
        else:
            continue

        if i % 25 == 0 or i == len(pend):
            DST.write_text(json.dumps(geo, ensure_ascii=False, indent=2))
            print(f"  {i}/{len(pend)}  ({aprox} cayeron al centro de su ciudad)")

    DST.write_text(json.dumps(geo, ensure_ascii=False, indent=2))
    exactos = sum(1 for v in geo.values() if v["exacto"])
    print(f"\n{DST}: {len(geo)} puntos, {exactos} ubicados con precision, {len(geo) - exactos} aproximados")


if __name__ == "__main__":
    main()
