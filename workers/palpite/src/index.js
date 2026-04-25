// Cloudflare Worker: recebe palpites e resultados via POST do site,
// valida e commita _data/palpites/<slug>.yml ou _data/resultados.csv
// no repo via GitHub API.

import { matches } from "./matches.js";

const validMatchIds = new Set(matches.map((m) => m.id));
const palpiteMatches = matches.filter((m) => m.stage_id === 1);

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN;
    const path = new URL(request.url).pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "method not allowed" }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400, origin);
    }

    if (body.botcheck) {
      return jsonResponse({ ok: true }, 200, origin);
    }

    const expected = (env.SUBMISSION_KEYWORD || "").trim().toLowerCase();
    const provided = (body.palavra_chave || "").trim().toLowerCase();
    if (!expected) {
      return jsonResponse({ error: "servidor sem palavra-chave configurada" }, 500, origin);
    }
    if (provided !== expected) {
      return jsonResponse({ error: "palavra-chave inválida" }, 401, origin);
    }

    if (path === "/resultado") {
      return handleResultado(body, env, origin);
    }
    return handlePalpite(body, env, origin);
  },
};

async function handlePalpite(body, env, origin) {
  const deadlineMs = Date.parse(env.DEADLINE_FASE_GRUPOS);
  if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
    return jsonResponse(
      { error: "prazo encerrado em 10/06/2026, 23:59 BRT — não tô mais aceitando palpites de fase de grupos" },
      403,
      origin
    );
  }

  const nome = (body.nome || "").trim().replace(/\s+/g, " ");
  if (!nome) return jsonResponse({ error: "nome é obrigatório" }, 400, origin);
  if (nome.length > 80) return jsonResponse({ error: "nome muito longo (máx 80 caracteres)" }, 400, origin);

  const palpites = [];
  for (const m of palpiteMatches) {
    const gm = parseGoals(body[`j${m.id}_m`]);
    const gv = parseGoals(body[`j${m.id}_v`]);
    if (gm === null || gv === null) {
      return jsonResponse(
        { error: `jogo ${m.id} (${m.mandante} × ${m.visitante}): gols inválidos` },
        400,
        origin
      );
    }
    palpites.push({ ...m, gm, gv });
  }

  const slug = slugify(nome);
  const today = new Date().toISOString().slice(0, 10);
  const yamlContent = renderPalpiteYaml(nome, slug, today, palpites);
  const path = `_data/palpites/${slug}.yml`;

  try {
    await commitFile(env, path, yamlContent, `palpite: ${nome}`);
  } catch (err) {
    return jsonResponse({ error: "falha ao salvar no repo: " + err.message }, 502, origin);
  }

  return jsonResponse(
    { ok: true, slug, message: "palpite recebido — vai aparecer no site em ~1min" },
    200,
    origin
  );
}

async function handleResultado(body, env, origin) {
  const matchId = parseInt(body.match_id, 10);
  if (!Number.isInteger(matchId) || !validMatchIds.has(matchId)) {
    return jsonResponse({ error: `match_id ${body.match_id} inválido` }, 400, origin);
  }

  if (body.delete === true) {
    return handleResultadoDelete(matchId, env, origin);
  }

  const gm = parseGoals(body.gm);
  const gv = parseGoals(body.gv);
  if (gm === null || gv === null) {
    return jsonResponse({ error: "gols inválidos (use inteiro 0-20)" }, 400, origin);
  }
  const obs = (body.observacao || "")
    .toString()
    .replace(/[\r\n,]/g, " ")
    .trim()
    .slice(0, 200);

  let existing;
  try {
    existing = await readFile(env, "_data/resultados.csv");
  } catch (err) {
    return jsonResponse({ error: "falha ao ler resultados.csv: " + err.message }, 502, origin);
  }
  const currentCsv = existing?.content || "match_id,gm,gv,observacao\n";
  const updated = upsertResultadoCsv(currentCsv, matchId, gm, gv, obs);

  try {
    await commitFileWithSha(
      env,
      "_data/resultados.csv",
      updated,
      `resultado: jogo ${matchId} ${gm}x${gv}`,
      existing?.sha
    );
  } catch (err) {
    return jsonResponse({ error: "falha ao salvar no repo: " + err.message }, 502, origin);
  }

  return jsonResponse({ ok: true, match_id: matchId, gm, gv }, 200, origin);
}

async function handleResultadoDelete(matchId, env, origin) {
  let existing;
  try {
    existing = await readFile(env, "_data/resultados.csv");
  } catch (err) {
    return jsonResponse({ error: "falha ao ler resultados.csv: " + err.message }, 502, origin);
  }
  if (!existing) {
    return jsonResponse({ ok: true, removed: false }, 200, origin);
  }
  const lines = existing.content.replace(/\r\n/g, "\n").split("\n");
  const header = lines[0] || "match_id,gm,gv,observacao";
  const data = lines.slice(1).filter((l) => l.trim() !== "");
  const filtered = data.filter((line) => parseInt(line.split(",")[0], 10) !== matchId);
  if (filtered.length === data.length) {
    return jsonResponse({ ok: true, removed: false }, 200, origin);
  }
  const updated = [header, ...filtered].join("\n") + "\n";
  try {
    await commitFileWithSha(
      env,
      "_data/resultados.csv",
      updated,
      `remove resultado: jogo ${matchId}`,
      existing.sha
    );
  } catch (err) {
    return jsonResponse({ error: "falha ao salvar no repo: " + err.message }, 502, origin);
  }
  return jsonResponse({ ok: true, removed: true, match_id: matchId }, 200, origin);
}

function upsertResultadoCsv(csv, matchId, gm, gv, obs) {
  const lines = csv.replace(/\r\n/g, "\n").split("\n");
  const header = lines[0] || "match_id,gm,gv,observacao";
  const dataLines = lines.slice(1).filter((l) => l.trim() !== "");
  const newLine = `${matchId},${gm},${gv},${obs}`;
  let found = false;
  const out = dataLines.map((line) => {
    const id = parseInt(line.split(",")[0], 10);
    if (id === matchId) {
      found = true;
      return newLine;
    }
    return line;
  });
  if (!found) out.push(newLine);
  out.sort((a, b) => parseInt(a.split(",")[0], 10) - parseInt(b.split(",")[0], 10));
  return [header, ...out].join("\n") + "\n";
}

function parseGoals(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 20) return null;
  return n;
}

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "anonimo";
}

function utf8ToBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function yamlEscape(s) {
  if (/[:#&*!|>'"%@`,\[\]{}]/.test(s) || s !== s.trim()) {
    return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return s;
}

function renderPalpiteYaml(nome, slug, today, palpites) {
  const lines = [
    `nome: ${yamlEscape(nome)}`,
    `slug: ${slug}`,
    `recebido_em: ${today}`,
    "palpites:",
  ];
  for (const p of palpites) {
    const id = String(p.id).padStart(2, " ");
    lines.push(
      `  - { id: ${id}, grupo: ${p.grupo}, data: ${p.data}, hora: "${p.hora}", ` +
        `mandante: ${yamlEscape(p.mandante)}, visitante: ${yamlEscape(p.visitante)}, ` +
        `gm: ${p.gm}, gv: ${p.gv} }`
    );
  }
  return lines.join("\n") + "\n";
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "palpite-bolao26-worker",
  };
}

async function readFile(env, path) {
  const apiBase = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;
  const r = await fetch(apiBase, { headers: githubHeaders(env) });
  if (r.status === 200) {
    const data = await r.json();
    return { content: base64ToUtf8(data.content), sha: data.sha };
  }
  if (r.status === 404) return null;
  throw new Error(`GET contents falhou: ${r.status} ${await r.text()}`);
}

async function commitFile(env, path, content, message) {
  const existing = await readFile(env, path).catch(() => null);
  return commitFileWithSha(env, path, content, message, existing?.sha);
}

async function commitFileWithSha(env, path, content, message, existingSha) {
  const apiBase = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const payload = {
    message,
    content: utf8ToBase64(content),
    branch: env.GITHUB_BRANCH,
  };
  if (existingSha) payload.sha = existingSha;
  const r = await fetch(apiBase, {
    method: "PUT",
    headers: { ...githubHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`PUT contents falhou: ${r.status} ${await r.text()}`);
  }
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}
