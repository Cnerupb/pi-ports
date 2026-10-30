# Порт dotnet/skills

Источник: https://github.com/dotnet/skills (Microsoft, MIT) — сабмодуль в `sources/skills`.

## Состав

- `sources/skills` — сабмодуль с исходниками
- `skills/` — 17 плагонов (106 скиллов) + `meta/` (5 мета-скиллов), портировано без адаптации содержимого
- `install.ps1` — общий установщик
- `uninstall.ps1` — удаление junction'ов
- `package.json` — pi-package манифест (скиллы + extension roslyn-lsp)
- `docs/port-notes.md` — что и как портировано, что пропущено и почему

## Установка

### Требования

Скиллам требования не нужны. Для LSP-инструмента `csharp_lsp` (идёт с пакетом
в Варианте A):

1. .NET SDK 10+ — проверка: `dotnet --version`
2. Roslyn Language Server:
   ```powershell
   dotnet tool install --global roslyn-language-server --prerelease
   ```

Без них пакет и скиллы работают, `csharp_lsp` лишь сообщит, чего не хватает.

### Вариант A — pi-package (Recommended)

```powershell
pi install ./pi-dotnet-skills        # глобально
pi install ./pi-dotnet-skills -l     # в проект
pi remove ./pi-dotnet-skills         # удаление
```

Пробный запуск без установки: `pi -e ./pi-dotnet-skills`.
Ставит всё: 111 скиллов + extension roslyn-lsp (инструмент `csharp_lsp`).

### Вариант B — install.ps1 (пер-плагонная гранулярность, дефолтный костяк)

Дефолтный костяк (10 плагонов, 72 скилла) глобально:

```powershell
./install.ps1
```

Все плагины (включая meta):

```powershell
./install.ps1 -All
```

Выборочно:

```powershell
./install.ps1 -Plugins dotnet-blazor, dotnet-diag
```

Локально (в `.agents/skills` текущего проекта):

```powershell
./install.ps1 -Scope Local          # или -LocalDir <путь>
```

Отдельный плагон — свой `install.ps1` (только скиллы, без extension):

```powershell
./skills/dotnet-diag/install.ps1 [-Scope Global|Local]
```

Удаление (только junction'ы этого репозитория, чужие скиллы не трогаются;
по умолчанию удаляется костяк, `-All` — всё установленное):

```powershell
./uninstall.ps1            # костяк
./uninstall.ps1 -All       # все плагины, включая meta
```

Проверка: `npx skills list -g`, в pi — автоматическая загрузка по описанию
или `/skill:<name>`.

> Не комбинируйте оба варианта одновременно: скилл не должен приходить
> и из пакета, и из junction — используйте либо A, либо B.
