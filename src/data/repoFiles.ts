// Repo delivery — every file is fetched from the workspace at click time
// (new URL + import.meta.url works in vite dev, vite build and the static
// preview server alike — no ?raw imports, so no module-MIME issues).

export type Group = 'contract' | 'test' | 'frontend' | 'config';

export interface RepoFile {
  path: string;
  url: URL;
  group: Group;
}

const u = (rel: string) => new URL(rel, import.meta.url);

export const REPO_FILES: RepoFile[] = [
  { path: 'contracts/Onchain2048.sol', url: u('../../contracts/Onchain2048.sol'), group: 'contract' },
  { path: 'test/Onchain2048.t.sol', url: u('../../test/Onchain2048.t.sol'), group: 'test' },
  { path: 'foundry.toml', url: u('../../foundry.toml'), group: 'config' },
  { path: 'README.md', url: u('../../README.md'), group: 'config' },
  { path: 'package.json', url: u('../../package.json'), group: 'config' },
  { path: 'index.html', url: u('../../index.html'), group: 'config' },
  { path: 'tsconfig.json', url: u('../../tsconfig.json'), group: 'config' },
  { path: 'vite.config.js', url: u('../../vite.config.js'), group: 'config' },
  { path: 'src/App.tsx', url: u('../App.tsx'), group: 'frontend' },
  { path: 'src/main.tsx', url: u('../main.tsx'), group: 'frontend' },
  { path: 'src/index.css', url: u('../index.css'), group: 'frontend' },
  { path: 'src/components/ArchSection.tsx', url: u('../components/ArchSection.tsx'), group: 'frontend' },
  { path: 'src/components/Chrome.tsx', url: u('../components/Chrome.tsx'), group: 'frontend' },
  { path: 'src/components/ContractSection.tsx', url: u('../components/ContractSection.tsx'), group: 'frontend' },
  { path: 'src/components/DeploySection.tsx', url: u('../components/DeploySection.tsx'), group: 'frontend' },
  { path: 'src/components/GameBoard.tsx', url: u('../components/GameBoard.tsx'), group: 'frontend' },
  { path: 'src/components/OnchainBar.tsx', url: u('../components/OnchainBar.tsx'), group: 'frontend' },
  { path: 'src/components/RemixSection.tsx', url: u('../components/RemixSection.tsx'), group: 'frontend' },
  { path: 'src/components/SecurityReview.tsx', url: u('../components/SecurityReview.tsx'), group: 'frontend' },
  { path: 'src/components/SidePanel.tsx', url: u('../components/SidePanel.tsx'), group: 'frontend' },
  { path: 'src/components/ui.tsx', url: u('../components/ui.tsx'), group: 'frontend' },
  { path: 'src/data/contract.ts', url: u('../data/contract.ts'), group: 'frontend' },
  { path: 'src/game/logic.ts', url: u('../game/logic.ts'), group: 'frontend' },
  { path: 'src/game/useGame.ts', url: u('../game/useGame.ts'), group: 'frontend' },
  { path: 'src/hooks/useBaseChain.ts', url: u('../hooks/useBaseChain.ts'), group: 'frontend' },
  { path: 'src/hooks/useOnchain.ts', url: u('../hooks/useOnchain.ts'), group: 'frontend' },
];

// Files the static preview server refuses to serve, so they travel inline.
const GITIGNORE = `# Node / Vite
node_modules/
dist/
*.local
.env
.env.*

# Foundry
out/
cache/
broadcast/
lib/

# Editor / OS
.DS_Store
.vscode/
.idea/
*.log
`;

const PUSH_SH = `#!/usr/bin/env bash
# Push this project to https://github.com/msnik/Base2048
# Usage: bash push.sh
set -e
cd "$(dirname "$0")"

REMOTE_URL="https://github.com/msnik/Base2048.git"

if [ ! -d .git ]; then git init; fi

git add .
if git diff --cached --quiet; then
  echo "→ Nothing new to commit."
else
  git commit -m "Onchain 2048 on Base — Chainlink VRF randomness, ERC-721 trophy, Foundry tests + React frontend"
fi

git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "→ Pushing to $REMOTE_URL …"
if git push -u origin main; then
  echo "✓ Done — https://github.com/msnik/Base2048"
else
  echo ""
  echo "Push was rejected (the remote probably already has commits)."
  echo "Run:  git pull origin main --rebase && git push -u origin main"
  exit 1
fi
`;

const VERCEL_JSON = `{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
`;

const NETLIFY_TOML = `[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;

export const INLINE_FILES: { path: string; content: string; group: Group }[] = [
  { path: '.gitignore', content: GITIGNORE, group: 'config' },
  { path: 'push.sh', content: PUSH_SH, group: 'config' },
  { path: 'vercel.json', content: VERCEL_JSON, group: 'config' },
  { path: 'netlify.toml', content: NETLIFY_TOML, group: 'config' },
];

export const ALL_FILE_COUNT = REPO_FILES.length + INLINE_FILES.length;

async function fetchText(url: URL): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url.pathname} → HTTP ${res.status}`);
  return res.text();
}

export async function fetchRepoFile(path: string): Promise<string> {
  const inline = INLINE_FILES.find((f) => f.path === path);
  if (inline) return inline.content;
  const f = REPO_FILES.find((x) => x.path === path);
  if (!f) throw new Error(`unknown file: ${path}`);
  return fetchText(f.url);
}

/** Assemble the self-extracting bash installer from the live workspace files. */
export async function buildInstaller(): Promise<string> {
  const EOF = '__B2048_FILE__';
  const parts: { path: string; content: string }[] = [];

  for (const f of REPO_FILES) parts.push({ path: f.path, content: await fetchText(f.url) });
  for (const f of INLINE_FILES) parts.push({ path: f.path, content: f.content });

  let out = `#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Base2048 — full-repo installer (generated from the live site)
#  Creates every file exactly as it exists in the workspace, then
#  leaves you one command away from GitHub:  ./push.sh
# ═══════════════════════════════════════════════════════════════
set -e

echo "→ Writing ${parts.length} files…"

`;
  for (const f of parts) {
    out += `mkdir -p "$(dirname "${f.path}")"\n`;
    out += `cat > "${f.path}" << '${EOF}'\n${f.content}\n${EOF}\n\n`;
  }
  out += `chmod +x push.sh
echo "✓ ${parts.length} files written."
echo ""
echo "Next steps:"
echo "  1) npm install            # frontend deps (regenerates package-lock.json)"
echo "  2) ./push.sh              # commit everything and push to"
echo "                            # https://github.com/msnik/Base2048"
echo ""
echo "Contract-only path (Foundry): forge install foundry-rs/forge-std --no-commit && forge install smartcontractkit/chainlink --no-commit && forge test -vv"
`;
  return out;
}

export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const INSTALLER_NAME = 'install-base2048.sh';
