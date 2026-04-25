---
layout: page
title: Palpites
permalink: /palpites/
---

### Como mandar seu palpite

1. Baixe o template abaixo. É um arquivo Excel com as 72 partidas da fase de grupos, agrupadas A→L.
2. **Coloque seu nome** na célula amarela no topo (campo `NOME`).
3. Preencha **só** as duas células amarelas de cada jogo — gols do mandante e do visitante. Não mexa nas demais colunas.
4. Salve mantendo o formato `.xlsx` e me mande pelo grupo até **10/06/2026, 23:59 BRT** (véspera do jogo de abertura).
5. Eu importo seu palpite aqui no site. Quando aparecer nesta página, está valendo.

<a href="{{ '/assets/palpites_template.xlsx' | relative_url }}" download class="download-btn">⬇ baixar template (Excel)</a>

### Palpites recebidos

{% if site.data.palpites.size == 0 %}
Ainda nenhum. Conforme forem chegando, cada participante ganha uma seção aqui com seus 72 palpites organizados por grupo.
{% else %}

{% for entry in site.data.palpites %}
{% assign p = entry[1] %}

#### {{ p.nome }}
<p class="palpite-meta">recebido em {{ p.recebido_em }} · {{ p.palpites.size }} palpites</p>

{% assign por_grupo = p.palpites | group_by: "grupo" %}
<div class="palpite-grupos">
{% for g in por_grupo %}
<div class="palpite-grupo">
<h5>Grupo {{ g.name }}</h5>
<ul class="palpite-list">
{% for palpite in g.items %}
<li class="palpite">
  <span class="palpite-mandante">{{ palpite.mandante }}</span>
  <span class="palpite-placar">{{ palpite.gm }} × {{ palpite.gv }}</span>
  <span class="palpite-visitante">{{ palpite.visitante }}</span>
</li>
{% endfor %}
</ul>
</div>
{% endfor %}
</div>

{% endfor %}
{% endif %}
