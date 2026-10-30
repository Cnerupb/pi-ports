# Заметки по портированию decision-records

## Что портировано

- `skills/decision-records/` — порт `decision-records-skill` (авторский workflow
  написания decision records, шаги 0–5).
- `skills/decision-records/references/` — шесть контент-файлов из
  `locales/en-us/` исходного репозитория (`guide`, `template`, `tutorial`,
  `examples`, `checklist`, `help`), переименованы в `*.md`.

## Что НЕ портировано и почему

- **`decision-records-maintainer-skill`** — предназначен для мейнтейнеров
  исходного репозитория: symlink-конвенции `README.md -> index.md` (на Windows
  неприменимы), git-зеркала (GitHub/Codeberg/GitLab), конвенции обновления
  версий в шапке README. Для пользователя pi не имеет ценности.
- **Полные примеры** (`locales/en-us/examples/*`) — 25 полноценных DR по
  доменам. В порт вшит только индекс (`references/examples.md`); при
  необходимости можно добандлить выборочные примеры.
- **Сайт** `decision-records.github.io` (SvelteKit) — не относится к скиллу.
- **Локали** (переводы) — порт английского источника истины (`en-us`).

## Изменения относительно оригинала

1. Пути `../../locales/en-us/<x>/index.md` заменены на `references/<x>.md`
   (pi-конвенция: скилл самодостаточен, всё бандлится внутрь каталога скилла).
2. `name: decision-records-skill` → `decision-records` (каталог скилла
   `decision-records`, имя совпадает с каталогом — переносимость по спецификации
   Agent Skills).
3. Добавлено `metadata.ported-from` с указанием источника и версии.
4. Ссылки на полные примеры в `references/examples.md` ведут на GitHub-репозиторий
   исходника — локальных копий нет.

## Лицензия

В исходном репозитории файла LICENSE не обнаружено. Автор — Joel Parker
Henderson (joelparkerhenderson.com). Поле `license` в frontmatter не заполнено
намеренно; перед публикацией пакета уточнить условия использования контента.

## Установка (ручная)

Скопировать `skills/decision-records/` в `~/.agents/skills/decision-records/`
(пользовательский уровень) или в `.agents/skills/decision-records/` проекта,
затем в pi: `/skill:decision-records` или автоматический выбор по описанию.
