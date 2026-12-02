import { plural } from "../plural";
import type { Messages } from "./en";

/** Dates end with "г.", so a sentence that ends with a date needs no second full stop */
const dot = (date: string) => (date.endsWith(".") ? date : `${date}.`);

export const ru: Messages = {
  app: {
    nav: { upload: "Загрузить", documents: "Мои письма", settings: "Настройки", reminders: "Напоминания", usage: "Расходы" },
    language: "Язык",
    dueReminders: (count) => `Напоминания на сегодня: ${count}`,
  },

  common: {
    loading: "Загрузка…",
    saving: "Сохранение…",
    saved: "Сохранено.",
    cancel: "Отмена",
    delete: "Удалить",
    remove: "Убрать",
    tryAgain: "Попробовать снова",
    starting: "Запуск…",
  },

  status: { UPLOADED: "В очереди", PROCESSING: "Обработка", DONE: "Готово", FAILED: "Ошибка" },

  processing: {
    preprocessing: "Подготовка файла",
    extracting: "Чтение и анализ письма",
    translating: "Перевод результатов",
    saving: "Сохранение результатов",
    retrying: "Сервис ИИ сейчас перегружен, скоро попробуем снова",
    processing: "Обработка…",
    queued: "Ожидание в очереди…",
  },

  upload: {
    title: "Поймите своё официальное письмо",
    intro:
      "Загрузите письмо из Finanzamt, Jobcenter, Ausländerbehörde или другого ведомства. " +
      "Мы объясним его простыми словами и скажем, что нужно сделать и до какого срока.",
    drop: "Перетащите письмо сюда или нажмите, чтобы выбрать файл",
    hint: "PDF, JPG или PNG · не больше 10 МБ",
    uploading: "Загрузка…",
    invalidType: "Можно загружать только файлы PDF, JPG и PNG.",
    tooLarge: "Файл слишком большой (не больше 10 МБ).",
    disclaimer: "BriefKlar не даёт юридических консультаций. Всегда проверяйте важные сроки сами.",
  },

  documents: {
    title: "Мои письма",
    empty: "Писем пока нет.",
    uploadFirst: "Загрузите первое письмо",
  },

  detail: {
    deletePermanently: "Удалить навсегда",
    deleting: "Удаление…",
    noWorkerBefore: "Фоновый обработчик не запущен, поэтому письмо не может быть обработано. Запустите приложение командой",
    noWorkerAfter: ".",
    originalLetter: "Оригинал письма",
    failed: "Обработка не удалась.",
    noAnalysis: "Для этого письма нет анализа.",
  },

  analysis: {
    urgency: { LOW: "Не срочно", MEDIUM: "Нужно действовать", HIGH: "Срочно" },
    senderTypes: {
      FINANZAMT: "Налоговая (Finanzamt)",
      JOBCENTER: "Джобцентр (Jobcenter)",
      AGENTUR_FUER_ARBEIT: "Агентство по труду (Agentur für Arbeit)",
      AUSLAENDERBEHOERDE: "Ведомство по делам иностранцев (Ausländerbehörde)",
      BUERGERAMT: "Бюро для граждан (Bürgeramt)",
      KRANKENKASSE: "Больничная касса (Krankenkasse)",
      RUNDFUNKBEITRAG: "Взнос за радиовещание (Rundfunkbeitrag)",
      FAMILIENKASSE: "Семейная касса (Familienkasse)",
      COURT: "Суд",
      EMPLOYER: "Работодатель",
      LANDLORD: "Арендодатель",
      COMPANY: "Компания",
      OTHER: "Другое",
    },
    letterTypes: {
      BESCHEID: "Официальное решение (Bescheid)",
      MAHNUNG: "Напоминание об оплате (Mahnung)",
      AUFFORDERUNG: "Требование что-то сделать",
      TERMIN: "Назначенная встреча",
      KUENDIGUNG: "Расторжение договора (Kündigung)",
      INVOICE: "Счёт",
      INFO: "Информация / подтверждение",
      OTHER: "Другое",
    },
    deadlineKinds: {
      PAYMENT: "Оплата",
      RESPONSE: "Ответ",
      OBJECTION: "Возражение (Widerspruch)",
      APPOINTMENT: "Встреча",
      DOCUMENTS: "Отправить документы",
      OTHER: "Другое",
    },
    fields: {
      summary: "краткое содержание",
      sender: "отправитель",
      letterType: "тип письма",
      letterDate: "дата письма",
      subject: "тема",
      references: "номера дела",
      amounts: "суммы",
      deadlines: "сроки",
      requiredActions: "что нужно сделать",
      requiredDocuments: "документы",
      objectionPossible: "право на возражение",
      urgency: "срочность",
    },
    sections: {
      explained: "Объяснение простыми словами",
      todo: "Что нужно сделать",
      deadlines: "Сроки",
      amounts: "Суммы",
      documents: "Какие документы отправить",
      references: "Номера дела",
      reply: "Написать ответ на немецком",
      chat: "Спросите об этом письме",
    },
    notOfficial: "Это не похоже на официальное письмо. Результаты могут быть бесполезны.",
    uncertain: (fields: string) =>
      `Пожалуйста, проверьте: ${fields}. Некоторые части письма было трудно прочитать или они неясны.`,
    nothingToDo: "Ничего делать не нужно. Это письмо для информации.",
    estimated: "Примерно",
    howCalculated: "Как рассчитана эта дата",
    undated: "дату не удалось рассчитать, проверьте письмо",
    objectionRight:
      "Вы имеете право обжаловать это решение (Widerspruch / Einspruch). Срок указан в письме.",
    footer: (model: string, version: string) =>
      `Анализ: ${model} (${version}). BriefKlar не даёт юридических консультаций. ` +
      "Всегда проверяйте важные данные в оригинале письма.",
    translating: (language: string) => `Анализ переводится: ${language}…`,
    translationFailed: "Не удалось перевести анализ, поэтому он показан на английском.",
  },

  deadlineSteps: {
    START_ASSUMED: () =>
      "В письме не сказано, когда начинается срок, поэтому считается, что он начинается в день вручения.",
    RECEIVED_ON: (date: string) => `Вы получили письмо: ${dot(date)}`,
    STARTS_ON_LETTER_DATE: (date: string) => `Срок начинается с даты письма: ${dot(date)}`,
    DEEMED_DELIVERY: (days: number, letterDate: string, deliveryDate: string) =>
      `Письмо ведомства, отправленное по почте, считается врученным на ${days}-й день после отправки ` +
      `(§ 122 AO, § 41 VwVfG, § 37 SGB X). Если оно отправлено в день, указанный в письме (${letterDate}), ` +
      `это ${dot(deliveryDate)}`,
    COUNTED_FROM_LETTER_DATE: (date: string) =>
      `В письме не сказано, когда оно к вам пришло. Для надёжности срок считается от даты письма: ${dot(date)} ` +
      "Если вы получили его позже, ваш срок может закончиться позже.",
    YELLOW_ENVELOPE: () =>
      "Если письмо пришло в жёлтом конверте (Zustellung), дата вручения написана на конверте.",
    DELIVERY_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} — ${reason}, поэтому днём вручения считается следующий рабочий день: ${dot(movedTo)}`,
    PERIOD_ENDS: (period: string, start: string, end: string) =>
      `Начало срока: ${dot(start)} Длительность: ${period}. Конец срока: ${end} (§§ 187, 188 BGB).`,
    DEADLINE_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} — ${reason}, поэтому срок переносится на следующий рабочий день: ${movedTo} (§ 193 BGB).`,
    REGIONAL_HOLIDAY: (date: string, states: string) =>
      `${date} — праздник в некоторых федеральных землях (${states}). ` +
      "Если вы живёте там, срок заканчивается в следующий рабочий день.",
  },

  nonWorkingDay: {
    SATURDAY: "суббота",
    SUNDAY: "воскресенье",
    holiday: (name: string) => `государственный праздник (${name})`,
  },

  period: (amount: number, unit) =>
    plural("ru", amount, {
      DAY: { one: "# день", few: "# дня", many: "# дней", other: "# дня" },
      WEEK: { one: "# неделя", few: "# недели", many: "# недель", other: "# недели" },
      MONTH: { one: "# месяц", few: "# месяца", many: "# месяцев", other: "# месяца" },
      YEAR: { one: "# год", few: "# года", many: "# лет", other: "# года" },
    }[unit]),

  holidays: {
    NEW_YEAR: "Новый год",
    EPIPHANY: "Богоявление",
    WOMENS_DAY: "Международный женский день",
    GOOD_FRIDAY: "Страстная пятница",
    EASTER_MONDAY: "Пасхальный понедельник",
    LABOUR_DAY: "День труда",
    LIBERATION_DAY: "День освобождения",
    ASCENSION_DAY: "Вознесение",
    WHIT_MONDAY: "Духов день",
    CORPUS_CHRISTI: "Праздник Тела и Крови Христовых",
    ASSUMPTION_DAY: "Успение Богородицы",
    CHILDRENS_DAY: "Всемирный день ребёнка",
    GERMAN_UNITY_DAY: "День германского единства",
    REFORMATION_DAY: "День Реформации",
    ALL_SAINTS_DAY: "День всех святых",
    REPENTANCE_DAY: "День покаяния и молитвы",
    CHRISTMAS_DAY: "Рождество",
    BOXING_DAY: "Второй день Рождества",
  },

  explanation: {
    language: "Язык объяснения",
    explain: "Объяснить простыми словами",
    reading: "Письмо читается…",
    writing: "Пишется…",
    writtenBy: (model: string) =>
      `Написано моделью ${model}. Проверьте имена, суммы и даты в оригинале письма.`,
  },

  receivedDate: {
    question: "Когда пришло письмо?",
    use: "Использовать эту дату",
    hint:
      "Тогда сроки, которые начинаются с вручения, считаются от этого дня, а не от предполагаемой даты. " +
      "Если письмо пришло в жёлтом конверте (Zustellung), укажите дату на конверте.",
    noState: "Праздники вашей федеральной земли пока не учитываются.",
    setState: "Выбрать землю",
  },

  replies: {
    types: {
      OBJECTION: "Возражение (Widerspruch / Einspruch)",
      EXTENSION_REQUEST: "Попросить больше времени (Fristverlängerung)",
      SEND_DOCUMENTS: "Сопроводительное письмо к документам",
      INSTALLMENT_PLAN: "Попросить рассрочку (Ratenzahlung)",
      QUESTION: "Задать вопрос (Rückfrage)",
    },
    hints: {
      OBJECTION: "Почему вы не согласны? Оставьте поле пустым, чтобы возразить сейчас и прислать причины позже.",
      EXTENSION_REQUEST: "Почему вам нужно больше времени и до какого числа?",
      SEND_DOCUMENTS: "Хотите что-то добавить о документах? (необязательно)",
      INSTALLMENT_PLAN: "Сколько вы можете платить в месяц и почему не можете заплатить сразу?",
      QUESTION: "О чём вы хотите спросить?",
    },
    ownLanguage: "Можно писать на своём языке.",
    type: "Тип ответа",
    translationLanguage: "Язык перевода",
    translationOption: (language: string) => `Перевод: ${language}`,
    notes: "Ваши заметки для ответа",
    write: "Написать черновик на немецком",
    writing: "Черновик пишется…",
    copy: "Скопировать немецкий текст",
    copied: "Скопировано",
    deleteDraft: "Удалить черновик",
    letter: "Ответное письмо на немецком",
    save: "Сохранить изменения",
    undo: "Отменить изменения",
    whatItSays: (language: string) => `О чём это письмо (${language})`,
    warnings: {
      NO_OBJECTION_RIGHT: () =>
        "В письме не упоминается право на возражение. Проверьте, возможно ли возражение вообще.",
      OBJECTION_DEADLINE_PASSED: (date: string) =>
        `Срок для возражения (${date}), возможно, уже прошёл. Срочно обратитесь за помощью: ` +
        "поздние возражения обычно отклоняют.",
      OBJECTION_DEADLINE: (date: string) =>
        `Письмо должно прийти не позднее ${dot(date)} Подпишите его и сохраните подтверждение отправки ` +
        "(например, Einwurf-Einschreiben или отчёт факса).",
      REQUEST_ONLY: () => "Это просьба: срок остаётся в силе, пока отправитель не согласится.",
      FILL_PLACEHOLDERS: (placeholders: string) => `Заполните перед отправкой: ${placeholders}`,
    },
  },

  chat: {
    intro: "Спрашивайте что угодно об этом письме. Ассистент читает его анализ, вычисляет даты калькулятором сроков и ищет в базе знаний с официальными источниками. Это не юридическая консультация.",
    placeholder: "Ваш вопрос…",
    send: "Отправить",
    thinking: "Думает…",
    clear: "Начать новый разговор",
    clearConfirm: "Удалить этот разговор",
    toolsUsed: "Использованные инструменты",
    /** What each tool does, shown while the assistant uses it */
    tools: {
      get_letter_details: "Данные письма",
      search_knowledge_base: "База знаний",
      calculate_deadline: "Расчёт срока",
      check_date: "Календарь",
      list_public_holidays: "Праздничные дни",
      list_reminders: "Напоминания",
      create_reminder: "Новое напоминание",
    },
    sources: "Источники",
    seeReminders: "Посмотреть напоминания",
    answeredBy: (model) => `Ответ от ${model}. Проверьте важные данные в оригинале письма.`,
    suggestions: [
      "Что мне нужно сделать и до какого числа?",
      "Что будет, если я ничего не сделаю?",
      "Напомни мне за два дня до конца срока.",
    ],
  },

  reminders: {
    title: "Напоминания",
    intro: "BriefKlar напоминает вам за три дня до каждого срока в ваших письмах. Здесь можно добавить свои напоминания или попросить об этом в чате на странице письма.",
    due: "Пора",
    upcoming: "Предстоящие",
    empty: "Открытых напоминаний нет.",
    deadline: (kind, date) => `${kind}: срок до ${date}`,
    remindOn: (date) => `Напоминание ${date}`,
    markDone: "Готово",
    origins: { DEADLINE: "Автоматически", USER: "Добавлено вами", CHAT: "Создано в чате" },
    add: "Добавить напоминание",
    note: "О чём вам напомнить?",
    date: "Дата",
    letter: "Письмо (необязательно)",
    noLetter: "Без письма",
    save: "Добавить напоминание",
  },

  settings: {
    title: "Настройки",
    state: "Федеральная земля (Bundesland)",
    stateHint:
      "Если срок заканчивается в праздник, он переносится на следующий рабочий день. Некоторые праздники " +
      "есть только в отдельных землях, поэтому ваша земля может изменить дату. Без неё учитываются " +
      "только общегерманские праздники.",
    stateNotSet: "Не выбрана (только общегерманские праздники)",
    language: "Ваш язык",
    languageHint:
      "BriefKlar показывается на этом языке: страницы, анализ ваших писем, объяснения и переводы " +
      "черновиков ответов.",
  },

  usage: {
    title: "Использование и расходы",
    intro: (date) =>
      `Каждый запрос к ИИ записывается. Расходы оценены по ценам платного тарифа каждой модели (проверено ${date}); ` +
      "разработка идёт на бесплатном тарифе.",
    period: (days) => `Последние ${days} дней`,
    cost: "Примерные расходы",
    calls: "Запросы к ИИ",
    failed: (count) => `Неудачных: ${count}`,
    fallbackSwitches: "Переключения на резервную модель",
    fallbackHint: "Основная модель выдала ошибку или не ответила вовремя, и ответила меньшая модель.",
    costPerLetter: "Средняя стоимость одного письма",
    letters: (count) => `Писем: ${count}`,
    latency: "Время ответа (медиана / 95%)",
    tokens: "Токены (вход / выход)",
    perDay: "Расходы по дням",
    byPurpose: "По задачам",
    byModel: "По моделям",
    columns: { name: "Название", calls: "Запросы", failed: "Ошибки", switches: "Резерв", tokens: "Токены", cost: "Стоимость", latency: "Медиана / 95%" },
    purposes: {
      "extract-letter": "Анализ письма",
      "translate-analysis": "Перевод",
      "explain-letter": "Объяснение",
      "reply-draft": "Черновик ответа",
      chat: "Чат",
      "embed-query": "Поиск в базе знаний",
      "embed-knowledge": "Наполнение базы знаний",
      "eval-extract-letter": "Прогон оценки",
    },
    unpriced: "цена неизвестна, учтено как 0",
    recentFailures: "Последние ошибки",
    switched: "ответила резервная модель",
    noFailures: "За этот период неудачных запросов нет.",
    empty: "За этот период запросов к ИИ не было.",
  },

  errors: {
    NOT_FOUND: "Такой страницы или записи нет.",
    NOT_AUTHENTICATED: "Вы не вошли в систему.",
    INVALID_BODY: "Неверный запрос.",
    INVALID_PARAM: "Неверный запрос.",
    INVALID_LANGUAGE: "Этот язык не поддерживается.",
    INTERNAL: "У нас произошла ошибка. Пожалуйста, попробуйте снова.",
    NO_FILE: "Файл не был загружен.",
    UNSUPPORTED_TYPE: "Можно загружать только файлы PDF, JPG и PNG.",
    LIMIT_FILE_SIZE: "Файл слишком большой (не больше 10 МБ).",
    DOCUMENT_NOT_FOUND: "Письмо не найдено.",
    ACTION_ITEM_NOT_FOUND: "Задача не найдена.",
    DRAFT_NOT_FOUND: "Черновик не найден.",
    ALREADY_PROCESSING: "Письмо сейчас обрабатывается. Попробуйте чуть позже.",
    NOT_ANALYZED: "Это письмо ещё не проанализировано.",
    INVALID_DATE: "Такой даты не существует.",
    DATE_IN_FUTURE: "Дата получения не может быть в будущем.",
    DATE_BEFORE_LETTER: "Письмо не могло прийти раньше своей даты.",
    REMINDER_NOT_FOUND: "Это напоминание не найдено.",
    DATE_IN_PAST: "Эта дата уже прошла.",
    AI_RATE_LIMITED: "Сервис ИИ сейчас получает слишком много запросов. Попробуйте через несколько минут.",
    AI_OVERLOADED: "Сервис ИИ сейчас перегружен. Попробуйте через несколько минут.",
    AI_KEY_REJECTED: "Сервис ИИ отклонил ключ API. Проверьте GEMINI_API_KEY.",
    AI_MODEL_NOT_FOUND: "Указанная модель ИИ не найдена. Проверьте GEMINI_MODEL.",
    AI_FAILED: "Сервис ИИ не смог обработать этот запрос.",
    AI_INCOMPLETE: "ИИ вернул неполный ответ. Пожалуйста, попробуйте снова.",
    PROCESSING_FAILED: "При обработке письма произошла ошибка.",
    connectionLost: "Соединение прервалось. Пожалуйста, попробуйте снова.",
    requestFailed: "Запрос не удался. Пожалуйста, попробуйте снова.",
  },
};
