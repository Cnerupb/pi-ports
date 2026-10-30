# Порт decision-records

Источник: https://github.com/decision-records/decision-records.git

## Состав

- `sources/` — склонированные исходники (оригинальный репозиторий v3.1.0)
- `skills/decision-records/` — портированный pi-скилл (пишем decision records)
- `docs/port-notes.md` — что и как портировано, что пропущено и почему

## Установка

Через [skills CLI](https://agentskills.io) (после пуша репозитория на GitHub):

```sh
npx skills add -g Cnerupb/pi-ports pi-decision-records/skills/decision-records
```

Или вручную — скопировать каталог скилла:

```sh
cp -r skills/decision-records ~/.agents/skills/
```

Затем в pi: `/skill:decision-records` или через автоматическую загрузку по описанию.
