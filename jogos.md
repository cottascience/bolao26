---
layout: page
title: Jogos
permalink: /jogos/
---

Todos os horários em **horário de Brasília** (BRT, UTC−3). 104 partidas no total — 72 de fase de grupos, 32 de mata-mata (16 avos de final → final).

Pra registrar resultado de um jogo, preencha a palavra-chave (a mesma do site) abaixo, depois cada placar e clique em ✓. Reenviar sobrescreve.

<div class="resultado-config">
  <label for="resultado_palavra_chave" class="palpite-form-label">Palavra-chave</label>
  <input type="text" id="resultado_palavra_chave" class="palpite-form-nome" autocomplete="off" placeholder="combinada no grupo do bolão">
</div>

{% assign resultados = site.data.resultados | where_exp: "r", "r.match_id" %}
{% assign resultados_map = "" | split: "" %}

{% assign last_day = "" %}
{% for match in site.data.matches %}
  {% assign day = match.kickoff_brt | date: "%Y-%m-%d" %}
  {% if day != last_day %}
    {% if last_day != "" %}</ul>{% endif %}
<h3 class="match-day">{{ match.kickoff_brt | date: "%d/%m" }}</h3>
<ul class="match-list">
    {% assign last_day = day %}
  {% endif %}
  {% assign home = site.data.teams | where: "id", match.home_team_id | first %}
  {% assign away = site.data.teams | where: "id", match.away_team_id | first %}
  {% assign city = site.data.host_cities | where: "id", match.city_id | first %}
  {% assign stage = site.data.tournament_stages | where: "id", match.stage_id | first %}
  {% assign result = resultados | where: "match_id", match.id | first %}
  <li class="match" data-match-id="{{ match.id }}">
    <span class="match-time">{{ match.kickoff_brt | date: "%H:%M" }}</span>
    {% if home and away %}
    <span class="match-teams">{{ home.team_name_pt }} × {{ away.team_name_pt }}</span>
    <span class="match-stage">Grupo {{ home.group_letter }}</span>
    {% else %}
    <span class="match-teams">{{ match.match_label }}</span>
    <span class="match-stage">{{ stage.stage_name_pt }}</span>
    {% endif %}
    <span class="match-city">{{ city.city_name_pt }}</span>
    <form class="resultado-form" data-match-id="{{ match.id }}">
      <input type="number" name="gm" min="0" max="20" inputmode="numeric" required value="{% if result %}{{ result.gm }}{% endif %}" aria-label="gols mandante">
      <span class="resultado-x">×</span>
      <input type="number" name="gv" min="0" max="20" inputmode="numeric" required value="{% if result %}{{ result.gv }}{% endif %}" aria-label="gols visitante">
      <button type="submit" class="resultado-submit" aria-label="enviar resultado">✓</button>
      <button type="button" class="resultado-delete" aria-label="remover resultado">✕</button>
      <span class="resultado-status" hidden></span>
    </form>
  </li>
{% endfor %}
{% if last_day != "" %}</ul>{% endif %}

<script>
(function() {
  const KEY = 'bolao26_resultado_palavra_chave';
  const palavraInput = document.getElementById('resultado_palavra_chave');

  // restaura/salva palavra-chave em localStorage
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) palavraInput.value = saved;
  } catch (e) {}
  palavraInput.addEventListener('input', () => {
    try { localStorage.setItem(KEY, palavraInput.value); } catch (e) {}
  });

  function checkPalavra(status) {
    const palavra = palavraInput.value.trim();
    if (!palavra) {
      status.hidden = false;
      status.textContent = 'preenche a palavra-chave acima';
      status.className = 'resultado-status erro';
      palavraInput.focus();
      return null;
    }
    return palavra;
  }

  async function postResultado(data, status, onOk) {
    status.hidden = false;
    status.textContent = '...';
    status.className = 'resultado-status';
    try {
      const r = await fetch('https://palpite-bolao26.leoabreucotta.workers.dev/resultado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await r.json().catch(() => ({}));
      if (r.ok && out.ok) {
        onOk(out);
      } else {
        status.textContent = out.error || r.statusText;
        status.className = 'resultado-status erro';
      }
    } catch (err) {
      status.textContent = 'rede: ' + err.message;
      status.className = 'resultado-status erro';
    }
  }

  document.querySelectorAll('.resultado-form').forEach(form => {
    const status = form.querySelector('.resultado-status');
    const deleteBtn = form.querySelector('.resultado-delete');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const palavra = checkPalavra(status);
      if (!palavra) return;
      const data = {
        palavra_chave: palavra,
        match_id: parseInt(form.dataset.matchId, 10),
        gm: parseInt(form.elements.gm.value, 10),
        gv: parseInt(form.elements.gv.value, 10),
      };
      await postResultado(data, status, () => {
        status.textContent = 'salvo ✓';
        status.className = 'resultado-status ok';
      });
    });

    deleteBtn.addEventListener('click', async () => {
      const palavra = checkPalavra(status);
      if (!palavra) return;
      if (!confirm('Remover o resultado deste jogo?')) return;
      const data = {
        palavra_chave: palavra,
        match_id: parseInt(form.dataset.matchId, 10),
        delete: true,
      };
      await postResultado(data, status, (out) => {
        if (out.removed) {
          form.elements.gm.value = '';
          form.elements.gv.value = '';
          status.textContent = 'removido ✓';
          status.className = 'resultado-status ok';
        } else {
          status.textContent = 'nada pra remover';
          status.className = 'resultado-status';
        }
      });
    });
  });
})();
</script>
