# Constrained-random long-tail discovery

Use this pass after the mainstream and official dimensions. Novelty does not equal credibility.

## Build the pool

Search with the target name plus one enabled keyword. Collect three to seven results on distinct domains. Exclude curated domains, mainstream platforms already used, the target's official domain, login-only pages, paywalls, downloads, shorteners, mirrors, scraped copies, spam, unsafe sites, and results with no attributable publisher.

Prefer local media, specialist publications, independent technical blogs, alumni or student publications, focused forums, research-group pages, and recurring newsletters.

## Select and inspect

1. Assign stable indices in search-result order.
2. Run `node scripts/pick-random-source.mjs <url1> <url2> ...` from this Skill directory.
3. Record the pool, selected index, and selected URL.
4. Read at most two relevant pages from the selected domain.
5. If direct opening fails, run one focused exact-title or exact-URL search and label readable indexed evidence `搜索索引`.
6. If direct and indexed access both fail, remove the site and draw once more. Stop after two failed draws.

Label claims `事实`, `观点`, or `不确定信息`. Do not let a long-tail claim override stronger evidence. Never save or promote it without confirmation.
