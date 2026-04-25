#!/usr/bin/env python3
"""Gera workers/palpite/src/matches.js a partir de _data/matches.csv.

Roda quando _data/matches.csv ou _data/teams.csv mudar (ex: mata-mata).
Depois precisa redeployar o worker: cd workers/palpite && wrangler deploy.
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "_data"
OUT = ROOT / "workers" / "palpite" / "src" / "matches.js"


def main():
    with open(DATA / "matches.csv", newline="") as f:
        matches = list(csv.DictReader(f))
    with open(DATA / "teams.csv", newline="") as f:
        teams = {t["id"]: t for t in csv.DictReader(f)}

    rows = []
    for m in matches:
        if m["stage_id"] != "1":
            continue
        date_part, time_part = m["kickoff_brt"].split(" ", 1)
        _, mo, d = date_part.split("-")
        hh, mm, _ = time_part.split(":", 2)
        rows.append({
            "id": int(m["id"]),
            "grupo": teams[m["home_team_id"]]["group_letter"],
            "data": f"{d}/{mo}",
            "hora": f"{hh}:{mm}",
            "mandante": teams[m["home_team_id"]]["team_name_pt"],
            "visitante": teams[m["away_team_id"]]["team_name_pt"],
        })
    rows.sort(key=lambda r: r["id"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(rows, ensure_ascii=False, indent=2)
    OUT.write_text(f"export const matches = {body};\n", encoding="utf-8")
    print(f"wrote {len(rows)} matches -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
