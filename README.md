# BigBolaBrasil

Bolão da Copa do Mundo 2026 entre amigos. Site Jekyll estático hospedado no GitHub Pages.

**Site**: https://cottascience.github.io/bolao26/

---

## Para participantes

1. Abre [a página de palpites](https://cottascience.github.io/bolao26/palpites/).
2. Coloca seu nome e os gols dos 72 jogos direto no formulário (mandante × visitante em cada linha).
3. Clica em **enviar palpites**. Se aparecer "Recebido!", deu certo.
4. Vai aparecer na seção de baixo da página depois que eu importar e dar push (~1 dia). Se mudar de ideia antes do prazo, **10/06/2026, 23:59 BRT**, é só abrir o form e mandar de novo — vale o último.

O formulário salva rascunho local automaticamente, então pode fechar a página e voltar depois sem perder o que já preencheu.

Quem prefere preencher offline tem o caminho Excel: dentro de `Prefere Excel?` na própria página de palpites.

Regras de pontuação e prazos de mata-mata em [`/regras/`](https://cottascience.github.io/bolao26/regras/).

---

## Para o administrador

### Setup inicial em uma máquina nova

```bash
git clone https://github.com/cottascience/bolao26.git
cd bolao26

# Jekyll (Ruby)
bundle install

# Scripts auxiliares (Python)
python3 -m venv .venv
.venv/bin/pip install openpyxl
```

### Rodar o site localmente

```bash
bundle exec jekyll serve
# http://127.0.0.1:4000/
```

Auto-rebuild em `.md`, `.scss`, `_data/`. **Mexeu em `_config.yml`?** Reinicia o `serve`.

### Importar um palpite recebido (form HTML — caminho default)

Cada submissão do form na página de palpites cai no seu email via Web3Forms. O assunto vai ser `Palpite BigBolaBrasil`.

1. Abre o email, copia todo o corpo (inclui linhas tipo `nome: João`, `j1_m: 2`, etc.).
2. Cola num arquivo de texto:

```bash
pbpaste > /tmp/palpite.txt
.venv/bin/python bin/email_para_yml.py /tmp/palpite.txt
```

Ou direto via stdin:

```bash
pbpaste | .venv/bin/python bin/email_para_yml.py -
```

3. Commit + push:

```bash
git add _data/palpites/
git commit -m "palpite: Fulano"
git push
```

Se dois amigos têm o mesmo nome, usa `--apelido` pra forçar slug:

```bash
.venv/bin/python bin/email_para_yml.py /tmp/palpite.txt --apelido joao-segundo
```

### Importar um palpite recebido (Excel — fallback)

Se o amigo preferiu o caminho Excel:

```bash
.venv/bin/python bin/importar_palpite.py ~/Downloads/palpite_fulano.xlsx
git add _data/palpites/ && git commit -m "palpite: Fulano" && git push
```

Em ambos os caminhos, o importador valida tudo (gols ≥ 0, 72 jogos, sem faltas) antes de gravar e dá erro específico se algo está errado. Re-importar sobrescreve.

### Registrar resultado de um jogo

```bash
# 1. abre _data/resultados.csv e adiciona uma linha:
#    match_id,gm,gv,observacao
#    1,2,0,
#    (observacao é opcional — pode usar pra anotar "decidido nos pênaltis", etc.)

# 2. recalcula a classificação
.venv/bin/python bin/calcular_pontos.py

# 3. commit + push
git add _data/resultados.csv _data/classificacao.yml
git commit -m "resultados: rodada N"
git push
```

`match_id` é o número do jogo (1–72 fase de grupos, 73+ mata-mata) — pega da [tabela de calendário](https://cottascience.github.io/bolao26/calendario/) ou direto de `_data/matches.csv`.

O placar é o do **tempo regulamentar** (90 min). Se foi pra prorrogação/pênaltis, registra o placar dos 90 minutos.

### Regenerar o template Excel

Sempre que `_data/matches.csv` ou `_data/teams.csv` mudar (novos times pra mata-mata, ajuste de horário, correção de nome):

```bash
.venv/bin/python bin/gerar_template.py
# wrote 72 matches, 12 groups -> assets/palpites_template.xlsx

git add assets/palpites_template.xlsx
git commit -m "regenera template"
git push
```

### Deletar/corrigir um palpite

```bash
rm _data/palpites/fulano.yml          # apaga
.venv/bin/python bin/calcular_pontos.py    # recalcula a classificação
git add -A _data/ && git commit -m "remove palpite: Fulano" && git push
```

### Como o deploy acontece

Cada push pro `main` dispara o workflow em `.github/workflows/jekyll.yml` que:

1. Roda `bundle exec jekyll build` na versão correta do Ruby/gems.
2. Faz upload do `_site/` como artefato de Pages.
3. Deploya em `cottascience.github.io/bolao26`.

Tempo total: ~1min. Pra acompanhar: [aba Actions do repo](https://github.com/cottascience/bolao26/actions).

---

## Stack

```
_data/                # fontes de verdade (CSV/YAML, lidos pelo Jekyll)
  ├── teams.csv             # 48 seleções, com team_name_pt e group_letter
  ├── matches.csv           # 104 jogos, kickoff_brt em ISO com offset -03:00
  ├── host_cities.csv       # 16 sedes, com city_name_pt
  ├── tournament_stages.csv # 7 fases, com stage_name_pt
  ├── resultados.csv        # editado à mão conforme Copa rola
  ├── classificacao.yml     # gerado por bin/calcular_pontos.py
  └── palpites/<slug>.yml   # 1 arquivo por participante, gerado pelo importador

bin/                  # scripts Python (rodar via .venv/bin/python)
  ├── gerar_template.py     # _data/matches → assets/palpites_template.xlsx
  ├── importar_palpite.py   # xlsx preenchido → _data/palpites/<slug>.yml
  ├── email_para_yml.py     # email Web3Forms (form HTML) → _data/palpites/<slug>.yml
  └── calcular_pontos.py    # palpites + resultados → _data/classificacao.yml

assets/
  ├── main.scss             # estilo (paleta, tipografia, componentes)
  └── palpites_template.xlsx # template Excel (gerado, mas commitado)

_includes/, _layouts/ # tema baseado em jekyll-minima
*.md                  # páginas (index, regras, calendario, palpites, classificacao)
.github/workflows/    # build + deploy em GitHub Pages
```

Pontuação: 5 (placar exato), 3 (vencedor + diferença), 2 (só vencedor), 0 (errou). Multiplicador por fase: ×1 grupos e 16 avos, ×1.5 oitavas, ×2 quartas, ×2.5 semis, ×2 disputa de 3º, ×3 final. Detalhes em [`/regras/`](https://cottascience.github.io/bolao26/regras/).
