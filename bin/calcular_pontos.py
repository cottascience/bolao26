#!/usr/bin/env python3
"""Calcula pontuação dos participantes a partir de palpites + resultados.

Lê:
    _data/palpites/*.yml      (palpites por participante)
    _data/resultados.csv      (jogos concluídos)
    _data/matches.csv         (lookup do stage_id por match_id)

Escreve:
    _data/classificacao.yml   (lista ordenada com nome, pontos, exatos, ...)
"""

import csv
import datetime as dt
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "_data"
PALPITES_DIR = DATA / "palpites"
OUT = DATA / "classificacao.yml"

PONTOS_EXATO = 5
PONTOS_DIFERENCA = 3
PONTOS_VENCEDOR = 2

STAGE_MULTIPLIER = {
    1: 1.0,    # Group Stage
    2: 1.0,    # 16 avos de final (Round of 32)
    3: 1.5,    # Oitavas de final (Round of 16)
    4: 2.0,    # Quartas de final
    5: 2.5,    # Semifinais
    6: 2.0,    # Disputa de 3º lugar
    7: 3.0,    # Final
}


def fail(msg):
    print(f"ERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def score_match(pgm, pgv, rgm, rgv):
    """Devolve (pontos_base, tipo) — sem multiplicador de fase."""
    if pgm == rgm and pgv == rgv:
        return PONTOS_EXATO, "exato"
    p_diff = pgm - pgv
    r_diff = rgm - rgv
    if p_diff == r_diff:
        return PONTOS_DIFERENCA, "diferenca"
    p_outcome = (p_diff > 0) - (p_diff < 0)
    r_outcome = (r_diff > 0) - (r_diff < 0)
    if p_outcome == r_outcome:
        return PONTOS_VENCEDOR, "vencedor"
    return 0, "errado"


def load_palpites():
    if not PALPITES_DIR.exists():
        return []
    out = []
    for path in sorted(PALPITES_DIR.glob("*.yml")):
        out.append(parse_palpite_yml(path))
    return out


def parse_palpite_yml(path):
    """Parser ad-hoc: lê o YAML escrito por importar_palpite.py.

    Não usa PyYAML pra evitar mais uma dep. Formato é estável e nosso.
    """
    text = path.read_text(encoding="utf-8")
    nome = re.search(r"^nome:\s*(.+)$", text, re.M).group(1).strip().strip('"')
    slug = re.search(r"^slug:\s*(.+)$", text, re.M).group(1).strip()
    palpites = []
    for line in text.splitlines():
        m = re.match(r"\s*-\s*\{\s*(.+)\s*\}\s*$", line)
        if not m:
            continue
        body = m.group(1)
        fields = {}
        for kv in re.finditer(r"(\w+)\s*:\s*(\".*?\"|[^,]+?)(?=\s*,|\s*$)", body):
            k, v = kv.group(1), kv.group(2).strip()
            if v.startswith('"') and v.endswith('"'):
                v = v[1:-1]
            fields[k] = v
        palpites.append({
            "id": int(fields["id"]),
            "gm": int(fields["gm"]),
            "gv": int(fields["gv"]),
        })
    return {"nome": nome, "slug": slug, "palpites": palpites}


def load_resultados():
    out = {}
    with open(DATA / "resultados.csv", newline="") as f:
        for row in csv.DictReader(f):
            if not row.get("match_id"):
                continue
            try:
                mid = int(row["match_id"])
                gm = int(row["gm"])
                gv = int(row["gv"])
            except (ValueError, TypeError):
                fail(f"resultados.csv linha inválida: {row}")
            out[mid] = (gm, gv)
    return out


def load_match_stages():
    with open(DATA / "matches.csv", newline="") as f:
        return {int(r["id"]): int(r["stage_id"]) for r in csv.DictReader(f)}


def main():
    palpites = load_palpites()
    resultados = load_resultados()
    stages = load_match_stages()

    rows = []
    for p in palpites:
        pontos = 0.0
        exatos = diferencas = vencedores = errados = 0
        for guess in p["palpites"]:
            mid = guess["id"]
            if mid not in resultados:
                continue
            rgm, rgv = resultados[mid]
            base, kind = score_match(guess["gm"], guess["gv"], rgm, rgv)
            mult = STAGE_MULTIPLIER.get(stages[mid], 1.0)
            pontos += base * mult
            if kind == "exato":
                exatos += 1
            elif kind == "diferenca":
                diferencas += 1
            elif kind == "vencedor":
                vencedores += 1
            else:
                errados += 1
        rows.append({
            "nome": p["nome"],
            "slug": p["slug"],
            "pontos": round(pontos, 1),
            "exatos": exatos,
            "diferencas": diferencas,
            "vencedores": vencedores,
            "errados": errados,
            "jogos_pontuados": exatos + diferencas + vencedores + errados,
        })

    rows.sort(key=lambda r: (-r["pontos"], -r["exatos"], -r["vencedores"], r["nome"].lower()))
    for i, r in enumerate(rows, 1):
        r["posicao"] = i

    OUT.write_text(format_yaml(rows, len(resultados)), encoding="utf-8")
    print(f"OK: {len(rows)} participantes, {len(resultados)} jogos pontuados -> {OUT.relative_to(ROOT)}")


def format_yaml(rows, total_jogos):
    lines = [
        f"atualizado_em: {dt.date.today().isoformat()}",
        f"jogos_concluidos: {total_jogos}",
        "participantes:",
    ]
    for r in rows:
        nome = r["nome"]
        if any(c in nome for c in ":#&*!|>'\"%@`,[]{}") or nome.strip() != nome:
            nome = '"' + nome.replace("\\", "\\\\").replace('"', '\\"') + '"'
        pontos_str = f"{r['pontos']:.1f}".rstrip("0").rstrip(".")
        lines.append(
            f"  - {{ posicao: {r['posicao']:>2}, nome: {nome}, slug: {r['slug']}, "
            f"pontos: {pontos_str}, exatos: {r['exatos']}, diferencas: {r['diferencas']}, "
            f"vencedores: {r['vencedores']}, errados: {r['errados']}, "
            f"jogos_pontuados: {r['jogos_pontuados']} }}"
        )
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
