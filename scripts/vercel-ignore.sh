#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand): exit 0 skips the deployment, anything else builds.
# Skips only when nothing the site uses has changed since the last successful deployment of this branch:
# docs, notes, contracts and screenshots. Every deployment keeps its own copy of the server functions, and the
# free plan's storage for them is limited, so docs-only pushes should not create one.
# When in doubt (no previous deployment, or its commit is not in the clone) it builds.
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -n "$prev" ] || exit 1
git cat-file -e "${prev}^{commit}" 2>/dev/null || exit 1
if git diff --quiet "$prev" HEAD -- . \
  ':(exclude)docs' ':(exclude)*.md' ':(exclude)contracts' ':(exclude)near' ':(exclude)scratch' \
  ':(exclude)shots' ':(exclude)devshots' ':(exclude)supabase' ':(exclude)tools'; then
  echo "Only docs and notes changed since ${prev}: no deployment needed."
  exit 0
fi
exit 1
