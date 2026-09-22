/** Envoltorio HTML mínimo y sin dependencias para /admin y /dashboard. */
export function htmlPage(title: string, activeNav: "admin" | "dashboard", body: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; --brand: #2563eb; --line: #d9dee6; --bg: #fff; --fg: #14181f; --muted: #667085; }
  @media (prefers-color-scheme: dark) { :root { --line: #2a3040; --bg: #0e1117; --fg: #e7eaf0; --muted: #8b93a3; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: -apple-system, "Segoe UI", Arial, sans-serif; }
  header { border-bottom: 1px solid var(--line); padding: 14px 24px; display: flex; align-items: center; gap: 20px; }
  header a { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 600; }
  header a.active { color: var(--fg); }
  main { max-width: 860px; margin: 0 auto; padding: 28px 24px 60px; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 0 0 10px; }
  p.hint { color: var(--muted); font-size: 13px; margin: 0 0 18px; }
  section.card { border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; margin-bottom: 20px; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; margin-top: 12px; }
  label:first-of-type { margin-top: 0; }
  input[type=text], input[type=number], input[type=password], input[type=url], input[type=email], textarea, select {
    width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: var(--fg); font-size: 14px;
  }
  textarea { min-height: 70px; font-family: inherit; }
  button { margin-top: 16px; background: var(--brand); color: #fff; border: 0; border-radius: 6px; padding: 9px 16px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--line); }
  button.danger { background: #dc2626; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: var(--line); }
  .row-actions form { display: inline; }
  .flash { background: #16a34a22; border: 1px solid #16a34a55; padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
  code { background: var(--line); padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
</style>
</head>
<body>
<header>
  <strong>Agente de Ventas</strong>
  <a href="/dashboard" class="${activeNav === "dashboard" ? "active" : ""}">Dashboard</a>
  <a href="/admin" class="${activeNav === "admin" ? "active" : ""}">Ajustes</a>
</header>
<main>
${body}
</main>
</body>
</html>`;
}

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
