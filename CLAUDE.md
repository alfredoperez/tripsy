@AGENTS.md

## Deploys

Deploys are manual: run `vercel --prod` from a clean checkout of the branch you mean to ship. Merging a PR does not deploy. Production lives at https://trips-ruby.vercel.app. If you deploy an unmerged branch, merge it before the next deploy from main, or that deploy removes the change.
