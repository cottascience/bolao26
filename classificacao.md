---
layout: page
title: Classificação
permalink: /classificacao/
---

{% assign c = site.data.classificacao %}
{% if c == nil or c.jogos_concluidos == 0 %}
A tabela começa a valer no primeiro jogo da Copa. Volte aqui depois de **11/06/2026**.
{% else %}
<p class="palpite-meta">atualizado em {{ c.atualizado_em }} · {{ c.jogos_concluidos }} jogos concluídos</p>

<table class="ranking">
  <thead>
    <tr>
      <th class="num">#</th>
      <th>Participante</th>
      <th class="num">Pts</th>
      <th class="num" title="Placares exatos">Exatos</th>
      <th class="num" title="Acertou diferença de gols">Diferença</th>
      <th class="num" title="Acertou só o vencedor">Vencedor</th>
    </tr>
  </thead>
  <tbody>
  {% for p in c.participantes %}
    <tr>
      <td class="num">{{ p.posicao }}</td>
      <td>{{ p.nome }}</td>
      <td class="num pts">{{ p.pontos }}</td>
      <td class="num">{{ p.exatos }}</td>
      <td class="num">{{ p.diferencas }}</td>
      <td class="num">{{ p.vencedores }}</td>
    </tr>
  {% endfor %}
  </tbody>
</table>
{% endif %}
