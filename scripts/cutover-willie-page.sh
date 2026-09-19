#!/bin/sh
# Walks the domain cutover for willie.page in order, printing each step and
# collecting what it needs as it goes. Safe to rerun; every step checks
# before it acts. See docs/deploy.md.
set -eu

ORIGIN_HOST="willie.page"
HOSTS="willie.page www.willie.page tour.willie.page diaries.willie.page williecubed.me www.williecubed.me"

step() { printf '\n==> Step %s: %s\n' "$1" "$2"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1. Install it and rerun."; exit 1; }; }

step 1 "Check the tools"
need vercel; need dig; need curl
vercel whoami >/dev/null 2>&1 || { echo "Run 'vercel login' first, then rerun."; exit 1; }
echo "Signed in to Vercel as $(vercel whoami 2>/dev/null)."

step 2 "Link this checkout to the Vercel project"
if [ ! -f .vercel/project.json ]; then
  vercel link
fi
PROJECT=$(node --input-type=module -e "import { readFileSync } from 'node:fs'; console.log(JSON.parse(readFileSync('./.vercel/project.json', 'utf8')).projectName || '')")
echo "Project: ${PROJECT:-unknown}"

step 3 "Attach every hostname to the project"
for host in $HOSTS; do
  if vercel domains ls 2>/dev/null | grep -q "^$host"; then
    echo "  $host already attached"
  else
    echo "  attaching $host"
    vercel domains add "$host" || true
  fi
done

step 4 "Point DNS at Vercel in Cloudflare (DNS-only, grey cloud)"
cat <<'DNS'
  In the Cloudflare dashboard, for each zone (willie.page and williecubed.me):
    apex (@)        A      76.76.21.21           DNS only
    www             CNAME  cname.vercel-dns.com  DNS only
    tour            CNAME  cname.vercel-dns.com  DNS only   (willie.page only)
    diaries         CNAME  cname.vercel-dns.com  DNS only   (willie.page only)
  Delete the Worker route for willie.page/* so the Worker no longer answers.
  'vercel domains inspect <host>' prints the exact records Vercel expects if
  they differ from the above.
DNS
printf '  Press Enter once the records are saved: '; read -r _

step 5 "Wait for DNS and verify every host"
fail=0
for host in $HOSTS; do
  answer=$(dig +short "$host" | tail -n 1)
  printf '  %-24s -> %s\n' "$host" "${answer:-no answer}"
  [ -n "$answer" ] || fail=1
done
[ "$fail" -eq 0 ] || { echo "Some hosts have no DNS answer yet. Wait and rerun from step 5."; exit 1; }

step 6 "Deploy to production"
vercel --prod

step 7 "Check the redirects"
for host in www.willie.page williecubed.me www.williecubed.me; do
  code=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://$host/about")
  printf '  %-22s %s\n' "$host" "$code"
done
for host in tour.willie.page diaries.willie.page; do
  code=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://$host/")
  printf '  %-22s %s\n' "$host" "$code"
done
echo "  Expect 308 to https://$ORIGIN_HOST/about for the first three and 307 to the initiative pages for the last two."

step 8 "Confirm the canonical site answers"
curl -s -o /dev/null -w "  https://$ORIGIN_HOST/ -> %{http_code}\n" "https://$ORIGIN_HOST/"
echo "Done."
