// Cloudflare Worker: recebe palpite via POST do form em /palpites/,
// valida, gera YAML e commita em _data/palpites/<slug>.yml via GitHub API.

import { matches } from "./matches.js";

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
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

    const nome = (body.nome || "").trim().replace(/\s+/g, " ");
    if (!nome) {
      return jsonResponse({ error: "nome é obrigatório" }, 400, origin);
    }
    if (nome.length > 80) {
      return jsonResponse({ error: "nome muito longo (máx 80 caracteres)" }, 400, origin);
    }

    const palpites = [];
    for (const m of matches) {
      const gmRaw = body[`j${m.id}_m`];
      const gvRaw = body[`j${m.id}_v`];
      const gm = parseGoals(gmRaw);
      const gv = parseGoals(gvRaw);
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
    const yamlContent = renderYaml(nome, slug, today, palpites);
    const path = `_data/palpites/${slug}.yml`;

    try {
      await commitFile(env, path, yamlContent, `palpite: ${nome}`);
    } catch (err) {
      return jsonResponse(
        { error: "falha ao salvar no repo: " + err.message },
        502,
        origin
      );
    }

    return jsonResponse(
      { ok: true, slug, message: "palpite recebido — vai aparecer no site em ~1min" },
      200,
      origin
    );
  },
};

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

function yamlEscape(s) {
  if (/[:#&*!|>'"%@`,\[\]{}]/.test(s) || s !== s.trim()) {
    return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  return s;
}

function renderYaml(nome, slug, today, palpites) {
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

async function commitFile(env, path, content, message) {
  const apiBase = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const auth = `Bearer ${env.GITHUB_TOKEN}`;
  const headers = {
    Authorization: auth,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "palpite-bolao26-worker",
  };

  let existingSha = undefined;
  const head = await fetch(`${apiBase}?ref=${env.GITHUB_BRANCH}`, { headers });
  if (head.status === 200) {
    const data = await head.json();
    existingSha = data.sha;
  } else if (head.status !== 404) {
    throw new Error(`GET contents falhou: ${head.status} ${await head.text()}`);
  }

  const payload = {
    message,
    content: utf8ToBase64(content),
    branch: env.GITHUB_BRANCH,
  };
  if (existingSha) payload.sha = existingSha;

  const put = await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (put.status !== 200 && put.status !== 201) {
    throw new Error(`PUT contents falhou: ${put.status} ${await put.text()}`);
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
