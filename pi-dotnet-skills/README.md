# Порт dotnet/skills

Источник: https://github.com/dotnet/skills (Microsoft, MIT) — сабмодуль в `sources/skills`.

## Состав

- `sources/skills` — сабмодуль с исходниками
- `skills/` — 17 плагонов (106 скиллов) + `meta/` (5 мета-скиллов), портировано без адаптации содержимого
- `install.ps1` — общий установщик
- `docs/port-notes.md` — что и как портировано, что пропущено и почему

## Установка

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

Отдельный плагон — свой `install.ps1`:

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
