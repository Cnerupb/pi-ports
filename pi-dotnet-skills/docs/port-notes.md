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

## roslyn-lsp (C# LSP)

`extensions/roslyn-lsp/` — собственный мост к Roslyn Language Server: спавнит
`dnx roslyn-language-server --stdio`, проксирует hover/definition/references/
completion/diagnostics/symbols через инструмент `csharp_lsp`. Загружается как
extension пакета (`pi.extensions`).

**Требования (на пользователе):**
1. .NET SDK 10+ (`dotnet --version`)
2. `dotnet tool install --global roslyn-language-server --prerelease`

**Проверено:** hover и definition возвращают реальные данные
(`int Class1.Add(int a, int b)`). Первый вызов в сессии медленный
(старт сервера + загрузка проекта), сервер отменяет запросы (-32800) во время
индексации — инструмент делает одну повторную попытку.

**Альтернатива — pi-lsp (`pi install npm:pi-lsp`):** декларативный LSP через
`~/.pi/agent/lsp.json`. На текущий момент (pi-lsp 0.1.7) на Windows заблокирован
рядом багов самого пакета: глобальный конфиг ищется через `process.env.HOME`
(на Windows пуст — нужен `PI_AGENT_DIR`), поиск бинаря дублирует расширение
(`cmd.exe` не находится), `rootMarkers` без glob-поддержки, spawn только
`shell: false` (.cmd shim'ы .NET-тулов не запускаются, EINVAL). Плюс тот же
roslyn-сервер отменяет запросы при прогреве. Конфиг-пример (рабочий поиск
бинаря, но запросы отменяются) сохранён ниже. Если апстрим починит spawn/
HOME — можно мигрировать, инструменты `lsp_*` удобнее нашего моста.

Рабочий `~/.pi/agent/lsp.json` (эталон для pi-lsp, не используется мостом):

```json
{
  "version": 1,
  "servers": [{
    "id": "roslyn-csharp",
    "include": ["**/*.cs", "**/*.razor", "**/*.cshtml"],
    "rootMarkers": ["obj", ".git", "global.json", "Directory.Build.props", "nuget.config"],
    "bin": "C:\\Windows\\System32\\cmd.exe",
    "args": ["/d", "/s", "/c", "roslyn-language-server", "--stdio", "--autoLoadProjects"],
    "cwd": "{root}",
    "languageIdByExtension": { ".cs": "csharp", ".razor": "aspnetcorerazor", ".cshtml": "aspnetcorerazor" },
    "startupTimeoutMs": 120000,
    "diagnosticsWaitMs": 5000
  }]
}
```

Также требуется переменная окружения `PI_AGENT_DIR=C:\Users\<user>\.pi\agent`
(обход бага HOME).

## Особенности

- Скрипты скиллов Windows-friendly: PowerShell (`*.ps1`), один Python, один C#.
- `global.json` в плагине dotnet — pin версии SDK; имеет смысл только с
  установленным .NET SDK.
- Обновление исходника: `git submodule update --remote pi-dotnet-skills/sources/skills`,
  затем повторное копирование `plugins/*/skills` (пока ручное).
