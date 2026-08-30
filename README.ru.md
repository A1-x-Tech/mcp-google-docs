# <img src="./assets/a1-logo.svg" alt="A1" width="40"> Google Docs MCP

[English](./README.md) | **Русский**

[![npm](https://img.shields.io/npm/v/%40a1-x-tech%2Fmcp-google-docs)](https://www.npmjs.com/package/@a1-x-tech/mcp-google-docs)
[![CI](https://github.com/A1-x-Tech/mcp-google-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/A1-x-Tech/mcp-google-docs/actions/workflows/ci.yml)
[![Glama](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-docs/badges/score.svg)](https://glama.ai/mcp/servers/A1-x-Tech/mcp-google-docs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A1 Google Docs MCP** позволяет AI-приложению читать и редактировать Google Docs на естественном языке. Можно прочитать документ как текст или Markdown, точечно изменить нужный фрагмент, оформить заголовки, списки и таблицы, разобрать ветки комментариев и выгрузить результат в PDF или DOCX.

Сервер работает с Google Docs API через ваш Google-аккаунт. Он правит текст по точным диапазонам индексов, а не наугад, и явно показывает ограничения Docs API, а не создаёт впечатление, что с документом можно сделать всё.

- **21 инструмент.** Чтение документа как текста, структуры или Markdown, правка точных диапазонов, стили символов и абзацев, списки, таблицы, разрывы, изображения, ветки комментариев и экспорт в PDF, DOCX и другие форматы.
- **Точечные правки.** Изменения адресуются точными диапазонами индексов, и сервер подталкивает ассистента перечитывать документ перед каждой правкой, потому что каждое изменение сдвигает индексы после него.
- **Markdown в обе стороны.** Документ можно создать из Markdown или выгрузить в Markdown, PDF, DOCX и другие форматы; замена всего документа из Markdown — отдельный, явно разрушительный шаг.
- **Без скрытого доступа к Drive.** Экспорт, конвертация Markdown и комментарии внутри используют эндпоинты Drive, но отдельного инструмента общего назначения для Drive у сервера нет.

Начните с запроса, который только читает данные:

> Прочитай документ с планом запуска и кратко перескажи открытые ветки комментариев.

[Подключить сервер](#быстрый-старт) · [Посмотреть сценарии](#что-можно-поручить) · [Открыть техническую документацию](#техническая-документация)

---

## Увидеть работу за минуту

> **Вы:** Покажи текст и комментарии документа с планом запуска.
>
> **Ассистент:** Читает документ как компактные текстовые блоки и перечисляет ветки комментариев. Ничего не меняется.
>
> **Вы:** Перепиши абзац «Сроки»: бета начинается 3 марта.
>
> **Ассистент:** Показывает точный диапазон, который заменит, и предлагаемый текст, затем запрашивает подтверждение перед правкой.
>
> **Вы:** Подтверждаю.
>
> **Ассистент:** Заменяет только этот диапазон. Остальной текст, форматирование и комментарии остаются как были.

## Содержание

- [Быстрый старт](#быстрый-старт)
- [Что можно поручить](#что-можно-поручить)
- [Как меняется документ](#как-меняется-документ)
- [Что может измениться](#что-может-измениться)
- [Как получить доступ](#как-получить-доступ)
- [Конфигурация](#конфигурация)
- [Данные, лимиты и работа в фоне](#данные-лимиты-и-работа-в-фоне)
- [Техническая документация](#техническая-документация)
- [Поддержка](#поддержка)

## Быстрый старт

Нужны Node.js 20+, Google-аккаунт и OAuth-данные из проекта Google Cloud с включёнными Google Docs API и Google Drive API.

1. [Подготовьте Google OAuth-доступ](#как-получить-доступ).
2. Добавьте сервер в AI-приложение.
3. Отправьте запрос, который только читает данные.

<details open>
<summary><strong>Codex</strong></summary>

<br>

**В приложении:** откройте **Settings → MCP servers**, нажмите **Add server**, выберите **STDIO**, укажите команду `npx -y @a1-x-tech/mcp-google-docs@latest` и переменные окружения `GOOGLE_DOCS_CLIENT_ID`, `GOOGLE_DOCS_CLIENT_SECRET`, `GOOGLE_DOCS_REFRESH_TOKEN`, затем нажмите **Save**, потом **Restart**.

**В командной строке:**

```bash
codex mcp add google-docs \
  --env GOOGLE_DOCS_CLIENT_ID=your_client_id \
  --env GOOGLE_DOCS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_DOCS_REFRESH_TOKEN=your_refresh_token \
  -- npx -y @a1-x-tech/mcp-google-docs@latest
```

```bash
codex mcp list
```

[Документация Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

</details>

<details>
<summary><strong>Claude Code</strong></summary>

<br>

```bash
claude mcp add \
  --env GOOGLE_DOCS_CLIENT_ID=your_client_id \
  --env GOOGLE_DOCS_CLIENT_SECRET=your_client_secret \
  --env GOOGLE_DOCS_REFRESH_TOKEN=your_refresh_token \
  --transport stdio --scope user google-docs \
  -- npx -y @a1-x-tech/mcp-google-docs@latest
```

```bash
claude mcp list
```

[Документация Claude Code MCP](https://code.claude.com/docs/en/mcp)

</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

<br>

Актуальный официальный путь — **Settings → Extensions**. Для пользовательского desktop extension откройте **Advanced settings → Extension Developer → Install Extension…**, выберите файл `.mcpb` и следуйте подсказкам.

Этот репозиторий сейчас публикует npm-пакет со stdio и пока не содержит `.mcpb`. Поэтому используйте приведённый ниже JSON stdio-конфиг как fallback только в сборках Claude Desktop, где ещё поддерживается локальная конфигурация:

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-docs@latest"],
      "env": {
        "GOOGLE_DOCS_CLIENT_ID": "your_client_id",
        "GOOGLE_DOCS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_DOCS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

В таких сборках сохраните его в `~/Library/Application Support/Claude/claude_desktop_config.json` на macOS или `%APPDATA%\Claude\claude_desktop_config.json` на Windows.

[Документация Claude Desktop MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)

</details>

<details>
<summary><strong>Cursor</strong></summary>

<br>

Добавьте в `~/.cursor/mcp.json` на macOS/Linux или `%USERPROFILE%\.cursor\mcp.json` на Windows:

```json
{
  "mcpServers": {
    "google-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-docs@latest"],
      "env": {
        "GOOGLE_DOCS_CLIENT_ID": "your_client_id",
        "GOOGLE_DOCS_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_DOCS_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

[Документация Cursor MCP](https://cursor.com/docs/mcp)

</details>

<details>
<summary><strong>VS Code</strong></summary>

<br>

Запустите **MCP: Open User Configuration** и добавьте:

```json
{
  "servers": {
    "google-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@a1-x-tech/mcp-google-docs@latest"],
      "env": {
        "GOOGLE_DOCS_CLIENT_ID": "${input:docs_client_id}",
        "GOOGLE_DOCS_CLIENT_SECRET": "${input:docs_client_secret}",
        "GOOGLE_DOCS_REFRESH_TOKEN": "${input:docs_refresh_token}"
      }
    }
  },
  "inputs": [
    { "type": "promptString", "id": "docs_client_id", "description": "Google OAuth client ID" },
    { "type": "promptString", "id": "docs_client_secret", "description": "Google OAuth client secret", "password": true },
    { "type": "promptString", "id": "docs_refresh_token", "description": "Google OAuth refresh token", "password": true }
  ]
}
```

Проверьте сервер командой **MCP: List Servers**.

[Документация VS Code MCP](https://code.visualstudio.com/docs/agent-customization/mcp-servers)

</details>

## Что можно поручить

### Прочитать и выгрузить документ

- Прочитай этот документ как текст с заголовками и таблицами и перескажи его.
- Покажи дерево вкладок документа-справочника.
- Выгрузи спецификацию в Markdown; сохрани договор в PDF-файл.

### Написать и отредактировать текст

- Создай документ с заметками встречи из этого Markdown.
- Вставь абзац с выводами после введения.
- Замени все «Q3» на «Q4» по всему документу.
- Удали устаревший раздел с ценами.

### Оформить и структурировать

- Преврати эти абзацы в нумерованный список; сделай эту строку заголовком второго уровня.
- Выдели ключевые термины жирным и добавь на них ссылки на глоссарий.
- Вставь таблицу 3×4 для дорожной карты и заполни строку заголовков.
- Добавь разрыв страницы перед приложением; вставь изображение по публичному URL.

### Работать с комментариями

- Перечисли открытые ветки комментариев и суммируй их.
- Ответь на комментарий про дедлайн и отметь его решённым.
- Добавь комментарий с цитатой предложения, которое нужно показать юристам.

## Как меняется документ

1. `create_document` создаёт **документ** — пустой или сразу сконвертированный из Markdown.
2. Содержимое адресуется **индексами** — позициями UTF-16 внутри тела вкладки, — и каждая вставка или удаление сдвигает все последующие индексы. Сервер требует от ассистента брать свежие индексы из `read_document_text` перед каждой правкой и править с конца документа к началу.
3. `import_markdown` заменяет **всё тело документа**: якоря комментариев, позиционированные объекты, колонтитулы и дополнительные вкладки конвертацию не переживают.
4. **Вкладки** можно читать и адресовать, но API не умеет их создавать, переименовывать, удалять и переставлять.
5. **Комментарии** живут в Drive и управляются как ветки. Новый комментарий нельзя привязать к диапазону текста — формат якоря не опубликован, — поэтому он добавляется на уровне документа, при желании с цитатой текста, к которому относится.

Экспорт ограничен 10 МБ и не включает комментарии и предложенные правки. Встраиваемые изображения Google скачивает по публичному URL (PNG/JPEG/GIF, до 50 МБ и 25 мегапикселей); канала загрузки файлов изображений нет.

## Что может измениться

| Операция | Что происходит | Граница подтверждения |
|---|---|---|
| Чтение документа, вкладок и комментариев | Читает содержимое и структуру | Ничего не меняет |
| Экспорт документа | Пишет локальный файл, если задан `output_path`; сам документ не меняется | Меняет только локальные файлы |
| Создание документа | Добавляет новый документ | Меняет Google Docs |
| Вставка текста, таблицы, разрыва или изображения | Добавляет содержимое | Меняет документ |
| Стили текста и абзацев, управление списками | Перезаписывает форматирование диапазона | Меняет документ |
| Замена или удаление диапазона, поиск с заменой | Удаляет существующее содержимое | Разрушительно |
| Замена всего документа из Markdown | Заменяет всё тело документа | Разрушительно |
| Управление комментариями | Создаёт, отвечает, закрывает или безвозвратно удаляет | Потенциально разрушительно |
| Технический запрос API | Может вызвать метод API без отдельного инструмента | Потенциально разрушительно |

Как AI-приложение просит подтверждение, определяет само приложение. Сервер помечает операции чтения, записи и удаления, чтобы оно отличило проверку от рабочего изменения.

## Как получить доступ

Google Docs требует OAuth 2.0: одного API-ключа недостаточно.

1. Создайте или выберите проект Google Cloud и включите оба API — **Google Docs API** и **Google Drive API** (экспорт, конвертация Markdown и комментарии идут через эндпоинты Drive).
2. Настройте OAuth consent screen и создайте OAuth-клиент типа **Desktop app**.
3. Авторизуйте Google-аккаунт, который владеет документами или может их редактировать. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) поможет получить refresh token, если включить **Use your own OAuth credentials**.
4. Запросите оба scope:

   ```text
   https://www.googleapis.com/auth/documents
   https://www.googleapis.com/auth/drive
   ```

   Для более узкой настройки достаточно `drive.file`, если экспорт, Markdown и комментарии касаются только документов, созданных этим OAuth-клиентом, а пары `documents.readonly` + `drive.readonly` хватает для инструментов, которые только читают.

Refresh token OAuth-приложения в режиме Testing может истечь через семь дней. Для долгого доступа опубликуйте OAuth-приложение или используйте Internal-приложение в домене Workspace. Храните client secret и refresh token как пароли.

## Конфигурация

| Переменная | Обязательна | Описание |
|---|---|---|
| `GOOGLE_DOCS_CLIENT_ID` | Да* | OAuth client ID. |
| `GOOGLE_DOCS_CLIENT_SECRET` | Да* | OAuth client secret. |
| `GOOGLE_DOCS_REFRESH_TOKEN` | Да* | OAuth refresh token. |
| `GOOGLE_DOCS_ACCESS_TOKEN` | Да* | Короткоживущая альтернатива OAuth-тройке (~1 час). |
| `GOOGLE_DOCS_API_BASE` | Нет | Переопределяет базовый URL Google Docs API. |
| `GOOGLE_DOCS_DRIVE_API_BASE` | Нет | Переопределяет базовый URL Drive API (экспорт, Markdown, комментарии). |
| `GOOGLE_DOCS_TIMEOUT_MS` | Нет | Тайм-аут одного запроса; по умолчанию `60000` мс. |
| `GOOGLE_DOCS_MAX_RETRIES` | Нет | Повторы временных ошибок; по умолчанию `3`. |

\* Передайте OAuth-тройку или access token.

## Данные, лимиты и работа в фоне

- **Запросы идут в Google.** Локальный сервер обновляет OAuth-токены Google и вызывает Docs API; экспорт, конвертация Markdown и комментарии внутри используют эндпоинты Drive API. Анонимная телеметрия содержит ID установки, версию пакета, версии AI-клиента и платформы и имена инструментов — но не OAuth-токены, содержимое документов, аргументы или промпты. Чтобы отключить её, задайте `ASKADS_TELEMETRY=0`.
- **У Google есть поминутные квоты.** При `429` сервер выдерживает паузу и повторяет запрос; чтение также повторяется после сетевых и `5xx` ошибок, а запись после неопределённой ошибки не повторяется никогда — повторённая запись могла бы продублировать правку.
- **Постоянного опроса нет.** Сервер работает только при вызове. Если AI-приложение поддерживает задания по расписанию, оно может периодически проверять документ или его комментарии.

## Техническая документация

- [Каталог MCP-возможностей](./docs/capabilities/index.md) — страницы по пользовательским задачам для каждого инструмента.
- [Все инструменты и параметры](./docs/TOOLS.md)
- [Документация по разработке](./docs/DEVELOPMENT.md)
- [Документация по публикации](./docs/PUBLISHING.md)
- [Справочник Google Docs API](https://developers.google.com/docs/api)

## Поддержка

Нашли ошибку или не хватает сценария? [Создайте issue](https://github.com/A1-x-Tech/mcp-google-docs/issues) или напишите в [Telegram](https://t.me/a1_mcp).

<br>

<p align="center">
  <img src="https://github.com/ztemerbekov/a1-yandex-kit-skills/raw/main/assets/images/mona-hifive-yandex-kit-warm.gif" alt="Две Моны дают пять" width="256">
</p>

<p align="center">
  Вы дочитали до конца!
</p>
