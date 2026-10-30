# Порт decision-records

Источник: https://github.com/decision-records/decision-records.git

## Состав

- `sources/` — склонированные исходники (оригинальный репозиторий v3.1.0)
- `skills/decision-records/` — портированный pi-скилл (пишем decision records)
- `docs/port-notes.md` — что и как портировано, что пропущено и почему

## Установка

```powershell
./install.ps1
```

Скрипт создаёт junction `~/.agents/skills/decision-records` → `skills/decision-records` этого репозитория (правки скилла сразу видны pi, без переустановки; junction не требует прав администратора). Проверить можно командой `npx skills list`.

Затем в pi: `/skill:decision-records` или через автоматическую загрузку по описанию.
