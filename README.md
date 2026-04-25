# BigBolaBrasil

Bolão da Copa do Mundo 2026 entre amigos. Site Jekyll estático hospedado no GitHub Pages.

**Site**: https://cottascience.github.io/bolao26/

---

## Para participantes

1. Abre [a página de palpites](https://cottascience.github.io/bolao26/palpites/).
2. Coloca seu nome e os gols dos 72 jogos direto no formulário (mandante × visitante em cada linha).
3. Clica em **enviar palpites**. Se aparecer "Recebido!", deu certo — em ~1 min o site rebuilda e seu palpite aparece logo abaixo, no painel de "Palpites recebidos".
4. Prazo: **10/06/2026, 23:59 BRT** (véspera do jogo de abertura). Antes disso, pode abrir o form e re-enviar quantas vezes quiser — vale o último.

O formulário salva rascunho local automaticamente, então pode fechar a página e voltar depois sem perder o que já preencheu.

Quem prefere preencher offline tem o caminho Excel: dentro de `Prefere Excel?` na própria página de palpites (eu importo manualmente).

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

### Palpite via form (caminho default — automático, você não faz nada)

A página de palpites tem um form HTML que posta direto pro Cloudflare Worker em `palpite-bolao26.leoabreucotta.workers.dev`. O Worker valida e commita o YAML em `_data/palpites/<slug>.yml` via GitHub API. Pages rebuilda em ~1min. **Você não precisa fazer absolutamente nada** — palpite aparece sozinho no site.

Onde está o quê:

- Código do Worker: `workers/palpite/src/index.js`
- Config: `workers/palpite/wrangler.toml` (vars públicas)
- Secret (PAT do GitHub): armazenado no Cloudflare, set via `wrangler secret put GITHUB_TOKEN`
- Dados embutidos (matches.js): regenerar com `bin/gerar_worker_data.py` quando `_data/matches.csv` ou `_data/teams.csv` mudar (ex: mata-mata)

#### Quando o calendário/times mudar (regenerar dados do worker)

```bash
.venv/bin/python bin/gerar_worker_data.py
cd workers/palpite && wrangler deploy
cd ../..
git add workers/palpite/src/matches.js
git commit -m "worker: atualiza matches" && git push
```

#### Renovar PAT do GitHub (a cada ~6 meses, conforme expiração)

1. https://github.com/settings/personal-access-tokens — gera um novo, mesmos parâmetros.
2. `cd workers/palpite && wrangler secret put GITHUB_TOKEN` (cola o novo no prompt).
3. Revoga o antigo.

### Palpite via Excel (caminho fallback — manual)

Se um amigo preferiu o caminho Excel (a opção em `Prefere Excel?` da página):

```bash
.venv/bin/python bin/importar_palpite.py ~/Downloads/palpite_fulano.xlsx
git add _data/palpites/ && git commit -m "palpite: Fulano" && git push
```

O importador valida tudo (gols ≥ 0, 72 jogos, sem faltas) antes de gravar. Se dois amigos têm o mesmo nome, usa `--apelido` pra forçar slug.

### Registrar resultado de um jogo

**Caminho default — via página `/jogos/`:**

1. Abre [`/jogos/`](https://cottascience.github.io/bolao26/jogos/).
2. Preenche a palavra-chave no topo (mesma do site, persiste em localStorage).
3. Em cada jogo concluído, preenche os dois inputs de gols e clica em ✓.
4. Worker valida, faz upsert em `_data/resultados.csv` e commita.
5. Action recalcula a classificação no build (`bin/calcular_pontos.py`) e Pages atualiza em ~1min.

Reenviar sobrescreve, então é seguro corrigir sem se preocupar.

**Caminho manual (sem internet, ou correção em massa):**

```bash
# editar _data/resultados.csv direto e push
git add _data/resultados.csv && git commit -m "resultados: rodada N" && git push
```

A Action regenera `_data/classificacao.yml` no build, então não precisa rodar `calcular_pontos.py` localmente nem commitar o yml.

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
  ├── gerar_worker_data.py  # _data/matches → workers/palpite/src/matches.js
  ├── importar_palpite.py   # xlsx preenchido → _data/palpites/<slug>.yml (manual)
  └── calcular_pontos.py    # palpites + resultados → _data/classificacao.yml

workers/palpite/      # Cloudflare Worker que recebe palpites do form
  ├── src/index.js          # main: validação + commit via GitHub API
  ├── src/matches.js        # gerado por bin/gerar_worker_data.py
  └── wrangler.toml         # config (env vars + secret slot GITHUB_TOKEN)

assets/
  ├── main.scss             # estilo (paleta, tipografia, componentes)
  └── palpites_template.xlsx # template Excel (gerado, mas commitado)

_includes/, _layouts/ # tema baseado em jekyll-minima
*.md                  # páginas (index, regras, jogos, palpites, classificacao)
.github/workflows/    # build + deploy em GitHub Pages
```

Pontuação: 5 (placar exato), 3 (vencedor + diferença), 2 (só vencedor), 0 (errou). Multiplicador por fase: ×1 grupos e 16 avos, ×1.5 oitavas, ×2 quartas, ×2.5 semis, ×2 disputa de 3º, ×3 final. Detalhes em [`/regras/`](https://cottascience.github.io/bolao26/regras/).
