#!/usr/bin/env bash
# Creates github.com/<your-user>/<repo> (default: delivery-super-app), adds origin, pushes main + super-app.
# Auth: either `gh auth login -h github.com -p https -w` or export GITHUB_TOKEN (classic: repo scope; fine-grained: Contents read/write, Metadata read).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_NAME="${GITHUB_REPO_NAME:-delivery-super-app}"
DESC="Multi-service delivery and live tracking (food, grocery, cab, parcel, shop)."

if command -v gh >/dev/null 2>&1 && gh auth status -h github.com &>/dev/null; then
  echo "Using GitHub CLI (authenticated)."
  if git remote get-url origin &>/dev/null; then
    git push -u origin main
    git push -u origin super-app
  else
    if ! gh repo create "${REPO_NAME}" --public --description "${DESC}" --source=. --remote=origin --push; then
      LOGIN="$(gh api user -q .login)"
      git remote remove origin 2>/dev/null || true
      git remote add origin "https://github.com/${LOGIN}/${REPO_NAME}.git"
      git push -u origin main
      git push -u origin super-app
    else
      git push -u origin super-app || true
    fi
  fi
  echo "Remote: $(git remote get-url origin)"
  exit 0
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "No GitHub authentication. Do one of:" >&2
  echo "  1) gh auth login -h github.com -p https -w" >&2
  echo "  2) GITHUB_TOKEN=ghp_... npm run github:push   (or: GITHUB_TOKEN=ghp_... $0)" >&2
  exit 1
fi

LOGIN="$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" https://api.github.com/user | jq -r .login)"
if [[ -z "$LOGIN" || "$LOGIN" == "null" ]]; then
  echo "Could not resolve GitHub user from GITHUB_TOKEN." >&2
  exit 1
fi

TMP="$(mktemp)"
HTTP_CODE="$(curl -sS -o "${TMP}" -w '%{http_code}' \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -X POST "https://api.github.com/user/repos" \
  -d "$(jq -n --arg name "${REPO_NAME}" --arg desc "${DESC}" '{name:$name, description:$desc, private:false}')")"

if [[ "${HTTP_CODE}" == "201" ]]; then
  echo "Created https://github.com/${LOGIN}/${REPO_NAME}"
elif [[ "${HTTP_CODE}" == "422" ]]; then
  echo "Repo ${REPO_NAME} likely already exists; continuing."
else
  echo "GitHub API error HTTP ${HTTP_CODE}:" >&2
  cat "${TMP}" >&2
  rm -f "${TMP}"
  exit 1
fi
rm -f "${TMP}"

REPO_URL="https://github.com/${LOGIN}/${REPO_NAME}.git"
AUTH_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${LOGIN}/${REPO_NAME}.git"

git remote remove origin 2>/dev/null || true
git remote add origin "${REPO_URL}"

git push -u "${AUTH_URL}" main
git push -u "${AUTH_URL}" super-app

git remote set-url origin "${REPO_URL}"
echo "Pushed branches main and super-app to ${REPO_URL}"
