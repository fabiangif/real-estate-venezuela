#!/usr/bin/env python3
"""
Convierte PSEO Venezuela.xlsx -> CSV + JSON, sin perder data.

Capa RAW: no limpia, no deduplica, no descarta filas. Volcado fiel del grid.
La normalizacion (enums, slugs, telefonos, tipos) va aparte, en el importador.

Lo que una conversion ingenua pierde y esta si preserva:
  - Los hipervinculos. 'Carpeta en Drive' muestra "Ver carpeta" en la celda,
    pero la URL de Drive (unica por inmueble) vive solo en el hyperlink.
    Se emiten como columnas extra "<Columna> URL".

Uso:  python3 scripts/xlsx_to_data.py
"""
import csv
import json
import sys
from pathlib import Path

import openpyxl

SRC = Path(__file__).resolve().parent.parent / "PSEO Venezuela.xlsx"
OUT = Path(__file__).resolve().parent.parent / "data" / "raw"
LINK_SUFFIX = " URL"


def headers_for(grid):
    """Fila 1 como cabecera. Celdas vacias -> col_N (la hoja Resumen las tiene)."""
    first = grid[0] if grid else []
    seen, out = {}, []
    for i, cell in enumerate(first):
        name = str(cell).strip() if cell not in (None, "") else f"col_{i + 1}"
        seen[name] = seen.get(name, 0) + 1
        out.append(name if seen[name] == 1 else f"{name}_{seen[name]}")
    return out


def convert(ws):
    grid = [[c.value for c in row] for row in ws.iter_rows()]
    if not grid:
        return [], [], {}

    # columnas (0-indexed) que traen al menos un hipervinculo
    links = {}
    for row in ws.iter_rows(min_row=2):
        for i, c in enumerate(row):
            if c.hyperlink and c.hyperlink.target:
                links.setdefault(i, {})[c.row] = c.hyperlink.target

    cols = headers_for(grid)
    width = max(len(r) for r in grid)
    cols += [f"col_{i + 1}" for i in range(len(cols), width)]  # cabecera mas corta que la data
    link_cols = sorted(links)
    fields = cols + [cols[i] + LINK_SUFFIX for i in link_cols]

    records = []
    for n, row in enumerate(grid[1:], start=2):  # n = fila real en Excel
        rec = {cols[i]: row[i] if i < len(row) else None for i in range(len(cols))}
        for i in link_cols:
            rec[cols[i] + LINK_SUFFIX] = links[i].get(n)
        records.append(rec)
    return fields, records, links


def main():
    if not SRC.exists():
        sys.exit(f"No encuentro {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.load_workbook(SRC, data_only=True)  # sin read_only: hace falta para los hyperlinks
    report, ok = [], True

    for name in wb.sheetnames:
        ws = wb[name]
        fields, records, links = convert(ws)
        stem = OUT / name

        with open(f"{stem}.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
            w.writeheader()
            for r in records:
                w.writerows([{k: ("" if v is None else v) for k, v in r.items()}])

        # JSON conserva tipos nativos: los numeros siguen siendo numeros, el vacio sigue siendo null
        with open(f"{stem}.json", "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2, default=str)

        # --- verificacion: nada entra al disco sin contarse contra el origen ---
        src_cells = sum(
            1 for row in ws.iter_rows(min_row=2) for c in row if c.value not in (None, "")
        )
        src_links = sum(len(v) for v in links.values())
        base = [c for c in fields if not c.endswith(LINK_SUFFIX)]
        out_cells = sum(1 for r in records for c in base if r[c] not in (None, ""))
        out_links = sum(
            1 for r in records for c in fields if c.endswith(LINK_SUFFIX) and r[c] not in (None, "")
        )
        # round-trip: releer el CSV y confirmar que la fila sigue completa
        with open(f"{stem}.csv", encoding="utf-8") as f:
            back = list(csv.DictReader(f))
        good = src_cells == out_cells and src_links == out_links and len(back) == len(records)
        ok &= good
        report.append(
            f"  {'OK ' if good else 'FAIL'} {name:<20} filas={len(records):>5}  "
            f"celdas={src_cells}->{out_cells}  hipervinculos={src_links}->{out_links}  "
            f"relectura={len(back)}"
        )

    print(f"Origen: {SRC.name}\nSalida: {OUT}/\n")
    print("\n".join(report))
    print("\n" + ("Conversion integra: cero celdas perdidas." if ok else "HAY PERDIDA DE DATA."))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
