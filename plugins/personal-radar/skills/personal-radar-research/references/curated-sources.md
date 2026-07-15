# 精品渠道与个人配置

公开仓库不保存真实关注对象或精品链接。实际确认的精确渠道写入同级 Skill 的 `config/curated-sources.md`；该文件被 Git 忽略。不存在该文件时视为空基线，研究仍可继续。

## Route template

- Target: `Example target`
- Status: `user-confirmed`
- Exact URL: `https://community.example.com/topic/example`
- Purpose: describe the distinctive information value
- Freshness view: describe how to select newest-first content
- Read limit: define a small bounded number of items
- Caveats: advertising, community claims, login dependence, or other noise

Navigation rules must state what to open, how to verify the route, which view to select, what to skip, and which interactions are forbidden. Treat uncorroborated claims as `待核实`.

只有用户明确确认“有价值”或“加入精品渠道”后才能把对应条目写入私有文件。网站主站若还需要加入本地 `sources`，必须再得到用户确认并调用本地 API；不要把“发现”误当成“确认”。
