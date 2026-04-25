---
layout: page
title: Palpites
permalink: /palpites/
---

### Mande seu palpite

Coloca seu nome, preenche os 72 jogos da fase de grupos (gols do mandante e do visitante) e clica em enviar. Prazo: **10/06/2026, 23:59 BRT**.

<form id="palpite-form" class="palpite-form">
  <input type="hidden" name="access_key" value="34a18ce2-56bb-4ba4-b64f-f93c2dc8d112">
  <input type="hidden" name="subject" value="Palpite BigBolaBrasil">
  <input type="hidden" name="from_name" value="BigBolaBrasil">
  <input type="checkbox" name="botcheck" style="display:none" tabindex="-1" autocomplete="off">

  <label class="palpite-form-label" for="nome">Nome</label>
  <input class="palpite-form-nome" type="text" id="nome" name="nome" required autocomplete="name" placeholder="Como aparece no ranking">

{% assign jogos = site.data.matches | where: "stage_id", "1" %}
{% assign grupos = "A,B,C,D,E,F,G,H,I,J,K,L" | split: "," %}
{% for letra in grupos %}
  <div class="palpite-form-grupo">
    <h5>Grupo {{ letra }}</h5>
    {% for jogo in jogos %}
      {% assign home = site.data.teams | where: "id", jogo.home_team_id | first %}
      {% if home.group_letter == letra %}
        {% assign away = site.data.teams | where: "id", jogo.away_team_id | first %}
    <div class="palpite-form-row">
      <span class="palpite-form-mandante">{{ home.team_name_pt }}</span>
      <input type="number" name="j{{ jogo.id }}_m" min="0" max="20" required inputmode="numeric">
      <span class="palpite-form-x">×</span>
      <input type="number" name="j{{ jogo.id }}_v" min="0" max="20" required inputmode="numeric">
      <span class="palpite-form-visitante">{{ away.team_name_pt }}</span>
    </div>
      {% endif %}
    {% endfor %}
  </div>
{% endfor %}

  <button type="submit" class="download-btn palpite-form-submit">enviar palpites</button>
  <p id="palpite-form-status" class="palpite-form-status" hidden></p>
</form>

<div id="palpite-form-thanks" class="palpite-form-thanks" hidden>
  <h4>Recebido! ⚽</h4>
  <p>Seu palpite chegou. Vai aparecer abaixo nas próximas horas, depois que eu importar e dar push no repo. Se mudar de ideia antes do prazo, manda outro — vale o último.</p>
</div>

<details class="palpite-form-fallback">
<summary>Prefere Excel?</summary>
Se você quer preencher offline e me mandar por outro canal, baixa o template, preenche, e me envia pelo grupo.
<a href="{{ '/assets/palpites_template.xlsx' | relative_url }}" download class="download-btn">⬇ baixar template (Excel)</a>
</details>

<script>
(function() {
  const form = document.getElementById('palpite-form');
  const status = document.getElementById('palpite-form-status');
  const thanks = document.getElementById('palpite-form-thanks');
  const KEY = 'bolao26_palpite_v1';

  // restaura rascunho local
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    Object.entries(saved).forEach(([k, v]) => {
      const el = form.elements[k];
      if (el && el.type !== 'hidden') el.value = v;
    });
  } catch (e) {}

  // salva rascunho local a cada digitação
  form.addEventListener('input', () => {
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (!['access_key', 'subject', 'from_name', 'botcheck'].includes(k)) data[k] = v;
    });
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  });

  // submit via fetch pra não sair da página
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.hidden = false;
    status.textContent = 'enviando...';
    const data = Object.fromEntries(new FormData(form));
    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        form.hidden = true;
        thanks.hidden = false;
        localStorage.removeItem(KEY);
        window.scrollTo({ top: thanks.offsetTop - 40, behavior: 'smooth' });
      } else {
        const body = await r.json().catch(() => ({}));
        status.textContent = 'erro ao enviar: ' + (body.message || r.statusText) + '. tenta de novo ou me chama no grupo.';
      }
    } catch (err) {
      status.textContent = 'erro de rede: ' + err.message + '. tenta de novo ou me chama no grupo.';
    }
  });
})();
</script>

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
