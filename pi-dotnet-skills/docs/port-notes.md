# Заметки по портированию dotnet/skills

Источник: https://github.com/dotnet/skills (Microsoft, MIT), зафиксирован коммит `95e7d0cb`.

## Что портировано

- `skills/<plugin>/` — 17 плагинов, 106 скиллов: `plugins/<plugin>/skills/*` скопированы
  без изменений содержимого.
- `skills/meta/` — 5 мета-скиллов из `.agents/skills/` (create-skill,
  create-custom-agent, create-skill-test, improve-skill-quality,
  authoring-github-workflows).
- У каждого плагона (и meta) — `install.ps1` для отдельной установки.
- Корневой `install.ps1` — установка набора плагинов (по умолчанию костяк),
  глобально (`~/.agents/skills`) или локально (`-Scope Local`, например в
  `.agents/skills` проекта).

## Дефолтный костяк (CorePlugins)

`dotnet`, `dotnet-msbuild`, `dotnet-test`, `dotnet-nuget`, `dotnet-upgrade`,
`dotnet-test-migration`, `dotnet-aspnetcore`, `dotnet-data`,
`dotnet-template-engine`, `dotnet-ai` — 72 скилла.

Остальные (`dotnet-blazor`, `dotnet-maui`, `dotnet-winforms`, `dotnet-diag`,
`dotnet-experimental`, `dotnet11`, `dotnet-advanced`, `meta`) портируются
(`-Plugins <name>` или `-All`), но в дефолтную установку не входят.

## Адаптации относительно оригинала

1. Вычищены Claude-специфичные поля frontmatter: `user-invocable`,
   `disable-model-invocation` (pi выдавал бы warnings на каждый скилл).
2. Скиллы устанавливаются плоско в каталог скиллов pi — коллизий имён нет
   (проверено, 106 имён уникальны).
3. Кросс-ссылок на sibling-скиллы и plugin root в SKILL.md нет — плоская
   установка ничего не ломает.

## Что НЕ портировано и почему

- **`lsp.json` / `.lsp.json`** — LSP-интеграция (csharp language server через
  `dnx roslyn-language-server`). У pi нет поддержки LSP-инфраструктуры
  плагинов. Скиллы полезны и без неё.
- **`plugin.json`** — метаданные плагина-контейнера (Claude/Cursor/Codex
  plugin manifests); pi скиллы дискаверит по каталогам, контейнер не нужен.
- **`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`** — манифесты
  других агентов.
- **`agentic-workflows/`** (4 workflow) — формат `aw.yml` специфичен для
  GitHub Copilot (copilot-auth, agents/, repo-variables). pi его не понимает.
- **`eng/`, `tests/`, `.github/`** — инфраструктура исходного репозитория.

## pi-package

`package.json` объявляет пакет (`keywords: pi-package`, `pi.skills: ./skills/*/*/`) —
все 111 скиллов дискаверятся pi как ресурсы пакета. Установка: `pi install ./pi-dotnet-skills`
(глобально) или с `-l` (проект), пробный запуск `pi -e ./pi-dotnet-skills`.
Фильтрация плагонов — через `pi config` (glob-фильтры ресурсов).

## Особенности

- Скрипты скиллов Windows-friendly: PowerShell (`*.ps1`), один Python, один C#.
- `global.json` в плагине dotnet — pin версии SDK; имеет смысл только с
  установленным .NET SDK.
- Обновление исходника: `git submodule update --remote pi-dotnet-skills/sources/skills`,
  затем повторное копирование `plugins/*/skills` (пока ручное).
