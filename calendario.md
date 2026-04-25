---
layout: page
title: Calendário
permalink: /calendario/
---

Todos os horários em **horário de Brasília** (BRT, UTC−3). 104 partidas no total — 72 de fase de grupos, 32 de mata-mata (16 avos de final → final).

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
  <li class="match">
    <span class="match-time">{{ match.kickoff_brt | date: "%H:%M" }}</span>
    {% if home and away %}
    <span class="match-teams">{{ home.team_name_pt }} × {{ away.team_name_pt }}</span>
    <span class="match-stage">Grupo {{ home.group_letter }}</span>
    {% else %}
    <span class="match-teams">{{ match.match_label }}</span>
    <span class="match-stage">{{ stage.stage_name_pt }}</span>
    {% endif %}
    <span class="match-city">{{ city.city_name_pt }}</span>
  </li>
{% endfor %}
{% if last_day != "" %}</ul>{% endif %}
