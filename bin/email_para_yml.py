#!/usr/bin/env python3
"""Converte email Web3Forms (palpite) em _data/palpites/<slug>.yml.

Uso:
    bin/email_para_yml.py <arquivo>          # lê arquivo de texto
    cat email.txt | bin/email_para_yml.py -  # lê stdin

Aceita o corpo de texto do email enviado pelo Web3Forms (campos no formato
`chave: valor` em linhas separadas), ou um JSON com os mesmos campos.

Campos esperados:
    nome:       nome do participante
    j1_m:       gols do mandante na partida 1
    j1_v:       gols do visitante na partida 1
    ... (até j72)
"""

import argparse
import csv
import datetime as dt
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "_data"
OUT_DIR = DATA / "palpites"


def fail(msg):
    print(f"ERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def slugify(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "anonimo"


def parse_text(text):
    """Extrai campos `chave: valor` de um corpo de email."""
    fields = {}
    for line in text.splitlines():
        m = re.match(r"^\s*([\w-]+)\s*:\s*(.+?)\s*$", line)
        if m:
            k, v = m.group(1), m.group(2)
            if k not in fields:
                fields[k] = v
    return fields


def parse_input(raw):
    raw = raw.strip()
    if raw.startswith("{"):
        try:
            return {k: str(v) for k, v in json.loads(raw).items()}
        except json.JSONDecodeError:
            pass
    return parse_text(raw)


def yaml_str(s):
    if any(c in s for c in ":#&*!|>'\"%@`,[]{}") or s.strip() != s:
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("arquivo", help="caminho do arquivo de texto, ou '-' pra stdin")
    ap.add_argument("--apelido", help="override do slug derivado do nome")
    args = ap.parse_args()

    if args.arquivo == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(args.arquivo).read_text(encoding="utf-8")

    fields = parse_input(raw)
    nome = (fields.get("nome") or "").strip()
    if not nome:
        fail("campo 'nome' não encontrado ou vazio")
    nome = " ".join(nome.split())

    with open(DATA / "matches.csv", newline="") as f:
        matches_rows = list(csv.DictReader(f))
    with open(DATA / "teams.csv", newline="") as f:
        teams = {t["id"]: t for t in csv.DictReader(f)}

    matches_by_id = {}
    for m in matches_rows:
        if m["stage_id"] != "1":
            continue
        date_part, time_part = m["kickoff_brt"].split(" ", 1)
        _, mo, d = date_part.split("-")
        hh, mm, _ = time_part.split(":", 2)
        matches_by_id[int(m["id"])] = {
            "data": f"{d}/{mo}",
            "hora": f"{hh}:{mm}",
            "mandante": teams[m["home_team_id"]]["team_name_pt"],
            "visitante": teams[m["away_team_id"]]["team_name_pt"],
            "grupo": teams[m["home_team_id"]]["group_letter"],
        }

    palpites = []
    erros = []
    for mid in sorted(matches_by_id):
        gm_key = f"j{mid}_m"
        gv_key = f"j{mid}_v"
        if gm_key not in fields or gv_key not in fields:
            erros.append(f"jogo {mid}: campos faltando ({gm_key}, {gv_key})")
            continue
        try:
            gm = int(fields[gm_key])
            gv = int(fields[gv_key])
        except ValueError:
            erros.append(f"jogo {mid}: gols não inteiros ('{fields[gm_key]}', '{fields[gv_key]}')")
            continue
        if gm < 0 or gv < 0:
            erros.append(f"jogo {mid}: gols negativos ({gm}, {gv})")
            continue
        m = matches_by_id[mid]
        palpites.append({
            "id": mid,
            "grupo": m["grupo"],
            "data": m["data"],
            "hora": m["hora"],
            "mandante": m["mandante"],
            "visitante": m["visitante"],
            "gm": gm,
            "gv": gv,
        })

    if erros:
        for e in erros[:10]:
            print(f"  - {e}", file=sys.stderr)
        if len(erros) > 10:
            print(f"  ... e mais {len(erros) - 10} erros", file=sys.stderr)
        fail(f"{len(erros)} problema(s) no palpite")

    if len(palpites) != 72:
        fail(f"esperava 72 palpites, parsei {len(palpites)}")

    slug = args.apelido or slugify(nome)
    if not slug.replace("-", "").replace("_", "").isalnum():
        fail(f"slug '{slug}' inválido")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / f"{slug}.yml"
    if dest.exists():
        print(f"AVISO: sobrescrevendo {dest.relative_to(ROOT)}")

    lines = [
        f"nome: {yaml_str(nome)}",
        f"slug: {slug}",
        f"recebido_em: {dt.date.today().isoformat()}",
        "palpites:",
    ]
    for p in palpites:
        lines.append(
            f"  - {{ id: {p['id']:>2}, grupo: {p['grupo']}, data: {p['data']}, hora: \"{p['hora']}\", "
            f"mandante: {yaml_str(p['mandante'])}, visitante: {yaml_str(p['visitante'])}, "
            f"gm: {p['gm']}, gv: {p['gv']} }}"
        )
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"OK: {nome} ({slug}) — {len(palpites)} palpites -> {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
