import type {
  ChatToolName,
  DeadlineKind,
  DeadlineStep,
  DocumentStatus,
  ErrorCode,
  HolidayId,
  LetterType,
  PeriodUnit,
  ProcessingStep,
  ReminderOrigin,
  ReplyType,
  ReplyWarning,
  SenderType,
  Urgency,
} from "@briefklar/shared";
import { plural } from "../plural";

/**
 * English texts. This file defines the shape of all messages: the other languages are typed
 * as `Messages`, so a missing or extra text is a compile error.
 * Functions take values that are already formatted for the reader (dates, names).
 */
export const en = {
  app: {
    nav: { upload: "Upload", documents: "My letters", reminders: "Reminders", usage: "Usage", profile: "Profile" },
    language: "Language",
    dueReminders: (count: number) => `Due reminders: ${count}`,
  },

  auth: {
    loginTitle: "Sign in",
    registerTitle: "Create your account",
    intro: "BriefKlar explains letters from German authorities in plain language. Only you can see your letters.",
    email: "E-mail address",
    password: "Password",
    passwordHint: (min: number) => `At least ${min} characters.`,
    name: "Name (optional)",
    login: "Sign in",
    register: "Create account",
    logout: "Sign out",
    submitting: "Please wait…",
    noAccount: "No account yet?",
    haveAccount: "Already have an account?",
  },

  guest: {
    intro: (count: number) => `No account needed: try BriefKlar with ${count} letter and see its analysis. A free account adds more letters, explanations in plain language, the chat, reply drafts and reminders.`,
    yourLetter: "Your letter",
    lockedTitle: "Available with a free account",
    lockedText: "Sign in or create an account for more letters, the explanation in plain language, the chat, reply drafts, reminders and your usage. A letter you uploaded as a guest stays with you.",
  },

  common: {
    loading: "Loading…",
    saving: "Saving…",
    saved: "Saved.",
    cancel: "Cancel",
    delete: "Delete",
    remove: "Remove",
    tryAgain: "Try again",
    starting: "Starting…",
  },

  status: { UPLOADED: "Queued", PROCESSING: "Processing", DONE: "Ready", FAILED: "Failed" },

  processing: {
    preprocessing: "Preparing the file",
    extracting: "Reading and analyzing the letter",
    translating: "Translating the results",
    saving: "Saving the results",
    retrying: "The AI service is busy, trying again shortly",
    processing: "Processing…",
    queued: "Waiting in queue…",
  },

  upload: {
    title: "Understand your official letter",
    intro:
      "Upload a letter from the Finanzamt, Jobcenter, Ausländerbehörde or any other authority. " +
      "We'll explain it in plain language and tell you what to do and by when.",
    drop: "Drop your letter here or click to choose a file",
    hint: "PDF, JPG or PNG · max 10 MB",
    uploading: "Uploading…",
    invalidType: "Only PDF, JPG and PNG files are supported.",
    tooLarge: "File is too large (max 10 MB).",
    disclaimer: "BriefKlar does not provide legal advice. Always double-check important deadlines.",
  },

  documents: {
    title: "My letters",
    empty: "No letters yet.",
    uploadFirst: "Upload your first letter",
  },

  detail: {
    deletePermanently: "Delete permanently",
    deleting: "Deleting…",
    noWorkerBefore: "No background worker is running, so this letter can't be processed. Start the app with",
    noWorkerAfter: ".",
    originalLetter: "Original letter",
    failed: "Processing failed.",
    noAnalysis: "No analysis available for this letter.",
  },

  analysis: {
    urgency: { LOW: "Low urgency", MEDIUM: "Action needed", HIGH: "Urgent" },
    senderTypes: {
      FINANZAMT: "Tax office (Finanzamt)",
      JOBCENTER: "Jobcenter",
      AGENTUR_FUER_ARBEIT: "Employment agency (Agentur für Arbeit)",
      AUSLAENDERBEHOERDE: "Immigration office (Ausländerbehörde)",
      BUERGERAMT: "Citizens' office (Bürgeramt)",
      KRANKENKASSE: "Health insurance (Krankenkasse)",
      RUNDFUNKBEITRAG: "Broadcasting fee (Rundfunkbeitrag)",
      FAMILIENKASSE: "Family benefits office (Familienkasse)",
      COURT: "Court",
      EMPLOYER: "Employer",
      LANDLORD: "Landlord",
      COMPANY: "Company",
      OTHER: "Other",
    },
    letterTypes: {
      BESCHEID: "Official decision (Bescheid)",
      MAHNUNG: "Payment reminder (Mahnung)",
      AUFFORDERUNG: "Request for action",
      TERMIN: "Appointment",
      KUENDIGUNG: "Termination of contract (Kündigung)",
      INVOICE: "Invoice",
      INFO: "Information / confirmation",
      OTHER: "Other",
    },
    deadlineKinds: {
      PAYMENT: "Payment",
      RESPONSE: "Reply",
      OBJECTION: "Objection (Widerspruch)",
      APPOINTMENT: "Appointment",
      DOCUMENTS: "Send documents",
      OTHER: "Other",
    },
    /** Names of analysis fields the model was unsure about */
    fields: {
      summary: "summary",
      sender: "sender",
      letterType: "type of letter",
      letterDate: "letter date",
      subject: "subject",
      references: "reference numbers",
      amounts: "amounts",
      deadlines: "deadlines",
      requiredActions: "what you need to do",
      requiredDocuments: "documents to send",
      objectionPossible: "right to object",
      urgency: "urgency",
    },
    sections: {
      explained: "Explained in plain language",
      todo: "What you need to do",
      deadlines: "Deadlines",
      amounts: "Amounts",
      documents: "Documents to send",
      references: "Reference numbers",
      reply: "Write a reply in German",
      chat: "Ask about this letter",
    },
    notOfficial: "This does not look like an official letter. The results may not be useful.",
    uncertain: (fields: string) =>
      `Please double-check: ${fields}. Parts of the letter were hard to read or unclear.`,
    nothingToDo: "Nothing to do. This letter is for your information.",
    estimated: "Estimated",
    howCalculated: "How this date was calculated",
    undated: "the date could not be calculated, please check the letter",
    objectionRight:
      "You have the right to object to this decision (Widerspruch / Einspruch). Check the deadline in the letter.",
    footer: (model: string, version: string) =>
      `Analyzed by ${model} (${version}). BriefKlar does not provide legal advice. ` +
      "Always check important details in the original letter.",
    translating: (language: string) => `Translating the analysis into ${language}…`,
    translationFailed: "The analysis could not be translated, so it is shown in English.",
  },

  deadlineSteps: {
    START_ASSUMED: () => "The letter does not say when the period starts, so it is assumed to start on delivery.",
    RECEIVED_ON: (date: string) => `You received the letter on ${date}.`,
    STARTS_ON_LETTER_DATE: (date: string) => `The period starts with the letter date, ${date}.`,
    DEEMED_DELIVERY: (days: number, letterDate: string, deliveryDate: string) =>
      `A letter from an authority sent by post counts as delivered on the ${days === 4 ? "4th" : "3rd"} day ` +
      `after it was posted (§ 122 AO, § 41 VwVfG, § 37 SGB X). Assuming it was posted on the letter date, ` +
      `${letterDate}, that is ${deliveryDate}.`,
    COUNTED_FROM_LETTER_DATE: (date: string) =>
      `The letter does not say when it reached you. To be on the safe side, the period is counted from the ` +
      `letter date, ${date}. If you received it later, your deadline may be later.`,
    YELLOW_ENVELOPE: () =>
      "If the letter came in a yellow envelope (Zustellung), the delivery date is written on the envelope.",
    DELIVERY_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} is ${reason}, so the delivery date moves to the next working day, ${movedTo}.`,
    PERIOD_ENDS: (period: string, start: string, end: string) =>
      `${period} after ${start} ends on ${end} (§§ 187, 188 BGB).`,
    DEADLINE_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} is ${reason}, so the deadline moves to the next working day, ${movedTo} (§ 193 BGB).`,
    REGIONAL_HOLIDAY: (date: string, states: string) =>
      `${date} is a public holiday in some federal states (${states}). ` +
      "If you live there, the deadline is the next working day.",
  },

  /** Why a day is not a working day, as used in the steps above */
  nonWorkingDay: {
    SATURDAY: "a Saturday",
    SUNDAY: "a Sunday",
    holiday: (name: string) => `${name}, a public holiday`,
  },

  period: (amount: number, unit: PeriodUnit) =>
    plural("en", amount, {
      DAY: { one: "# day", other: "# days" },
      WEEK: { one: "# week", other: "# weeks" },
      MONTH: { one: "# month", other: "# months" },
      YEAR: { one: "# year", other: "# years" },
    }[unit]),

  holidays: {
    NEW_YEAR: "New Year's Day",
    EPIPHANY: "Epiphany",
    WOMENS_DAY: "International Women's Day",
    GOOD_FRIDAY: "Good Friday",
    EASTER_MONDAY: "Easter Monday",
    LABOUR_DAY: "Labour Day",
    LIBERATION_DAY: "Liberation Day",
    ASCENSION_DAY: "Ascension Day",
    WHIT_MONDAY: "Whit Monday",
    CORPUS_CHRISTI: "Corpus Christi",
    ASSUMPTION_DAY: "Assumption Day",
    CHILDRENS_DAY: "World Children's Day",
    GERMAN_UNITY_DAY: "German Unity Day",
    REFORMATION_DAY: "Reformation Day",
    ALL_SAINTS_DAY: "All Saints' Day",
    REPENTANCE_DAY: "Day of Repentance and Prayer",
    CHRISTMAS_DAY: "Christmas Day",
    BOXING_DAY: "Boxing Day",
  },

  explanation: {
    language: "Language of the explanation",
    explain: "Explain in plain language",
    reading: "Reading the letter…",
    writing: "Writing…",
    writtenBy: (model: string) => `Written by ${model}. Check names, amounts and dates in the original letter.`,
  },

  receivedDate: {
    question: "When did the letter arrive?",
    use: "Use this date",
    hint:
      "Deadlines that start on delivery are then counted from this day instead of an assumed date. " +
      "For a yellow envelope (Zustellung), use the date written on it.",
    noState: "Public holidays of your federal state are not included yet.",
    setState: "Set your state",
  },

  replies: {
    types: {
      OBJECTION: "Objection (Widerspruch / Einspruch)",
      EXTENSION_REQUEST: "Ask for more time (Fristverlängerung)",
      SEND_DOCUMENTS: "Cover letter for documents",
      INSTALLMENT_PLAN: "Ask to pay in instalments (Ratenzahlung)",
      QUESTION: "Ask a question (Rückfrage)",
    },
    hints: {
      OBJECTION: "Why do you disagree? Leave empty to object now and send the reasons later.",
      EXTENSION_REQUEST: "Why do you need more time, and until when?",
      SEND_DOCUMENTS: "Anything to add about the documents (optional).",
      INSTALLMENT_PLAN: "How much can you pay per month, and why can't you pay at once?",
      QUESTION: "What do you want to ask?",
    },
    ownLanguage: "You can write in your own language.",
    type: "Type of reply",
    translationLanguage: "Language of the translation",
    translationOption: (language: string) => `Translation: ${language}`,
    notes: "Your notes for the reply",
    write: "Write a German draft",
    writing: "Writing the draft…",
    copy: "Copy German text",
    copied: "Copied",
    deleteDraft: "Delete draft",
    letter: "German reply letter",
    save: "Save changes",
    undo: "Undo changes",
    whatItSays: (language: string) => `What it says (${language})`,
    warnings: {
      NO_OBJECTION_RIGHT: () =>
        "The letter does not mention a right to object. Check whether an objection is possible at all.",
      OBJECTION_DEADLINE_PASSED: (date: string) =>
        `The objection deadline (${date}) may have passed. Get advice quickly: late objections are usually rejected.`,
      OBJECTION_DEADLINE: (date: string) =>
        `It must arrive by ${date}. Sign it and keep proof that you sent it (e.g. Einwurf-Einschreiben or a fax report).`,
      REQUEST_ONLY: () => "This is a request: the deadline stays in place until the sender agrees.",
      FILL_PLACEHOLDERS: (placeholders: string) => `Fill in before sending: ${placeholders}`,
    },
  },

  chat: {
    intro: "Ask anything about this letter. The assistant reads its analysis, calculates dates with the deadline engine and searches a knowledge base with official sources. It does not provide legal advice.",
    placeholder: "Your question…",
    send: "Send",
    thinking: "Thinking…",
    clear: "Start a new conversation",
    clearConfirm: "Delete this conversation",
    toolsUsed: "Tools used",
    /** What each tool does, shown while the assistant uses it */
    tools: {
      get_letter_details: "Letter data",
      search_knowledge_base: "Knowledge base",
      calculate_deadline: "Deadline calculation",
      check_date: "Calendar",
      list_public_holidays: "Public holidays",
      list_reminders: "Reminders",
      create_reminder: "New reminder",
    },
    sources: "Sources",
    seeReminders: "See your reminders",
    answeredBy: (model: string) => `Answered by ${model}. Check important details in the original letter.`,
    suggestions: [
      "What do I have to do, and by when?",
      "What happens if I do nothing?",
      "Remind me two days before the deadline.",
    ],
  },

  reminders: {
    title: "Reminders",
    intro: "BriefKlar reminds you three days before every deadline in your letters. You can add your own reminders here, or ask the chat on a letter's page.",
    due: "Due now",
    upcoming: "Upcoming",
    empty: "No open reminders.",
    deadline: (kind: string, date: string) => `${kind}: due ${date}`,
    remindOn: (date: string) => `Reminder on ${date}`,
    markDone: "Done",
    origins: { DEADLINE: "Automatic", USER: "Added by you", CHAT: "Set in the chat" },
    add: "Add a reminder",
    note: "What do you want to be reminded of?",
    date: "Date",
    letter: "Letter (optional)",
    noLetter: "No letter",
    save: "Add reminder",
  },

  profile: {
    title: "Profile",
    account: "Account",
    email: "E-mail address",
    name: "Name",
    saveName: "Save name",
    memberSince: (date: string) => `Member since ${date}`,
    password: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    savePassword: "Change password",
    passwordChanged: "Password changed. Other devices were signed out.",
    wrongPassword: "The current password is wrong.",
  },

  settings: {
    title: "Settings",
    state: "Federal state (Bundesland)",
    stateHint:
      "Deadlines that end on a public holiday move to the next working day. Some holidays only apply in " +
      "some states, so your state can change a due date. Without it, only nationwide holidays are used.",
    stateNotSet: "Not set (nationwide holidays only)",
    language: "Your language",
    languageHint:
      "BriefKlar is shown in this language: the pages, the analysis of your letters, explanations and " +
      "the translations of reply drafts.",
    privacy: {
      title: "Your data and privacy",
      processing:
        "To analyze a letter, BriefKlar sends it to Google's Gemini API. Everything else (your letters, analyses, " +
        "chats and reminders) is stored by BriefKlar until you delete it.",
      retention: "Delete letters automatically",
      retentionHint:
        "A letter is deleted this many days after you uploaded it, with its analysis, explanations, reply drafts, " +
        "chat and reminders.",
      retentionNever: "Never (keep until I delete them)",
      retentionDays: (days: number) => `After ${days} days`,
      export: "Download my data",
      exportHint:
        "A JSON file with your settings and every letter, including the original file, the analysis, reply drafts, " +
        "chat and reminders.",
      delete: "Delete my account",
      deleteHint: "Deletes your account with every letter, file, analysis, chat and reminder.",
      deleteConfirm: "This cannot be undone. Delete everything now?",
      deleteYes: "Yes, delete everything",
    },
  },

  usage: {
    title: "Usage and cost",
    intro: (date: string) =>
      `Every AI call for your letters is logged. Costs are estimates at the paid-tier prices of each model (checked on ${date}); ` +
      "development runs on the free tier.",
    period: (days: number) => `Last ${days} days`,
    cost: "Estimated cost",
    calls: "AI calls",
    failed: (count: number) => `${count} failed`,
    fallbackSwitches: "Switches to the fallback model",
    fallbackHint: "The main model failed or timed out and the smaller model answered.",
    costPerLetter: "Average cost per letter",
    letters: (count: number) => `Letters: ${count}`,
    latency: "Response time (median / 95%)",
    tokens: "Tokens (input / output)",
    perDay: "Cost per day",
    byPurpose: "By task",
    byModel: "By model",
    columns: { name: "Name", calls: "Calls", failed: "Failed", switches: "Fallback", tokens: "Tokens", cost: "Cost", latency: "Median / 95%" },
    purposes: {
      "extract-letter": "Letter analysis",
      "translate-analysis": "Translation",
      "explain-letter": "Explanation",
      "reply-draft": "Reply draft",
      chat: "Chat",
      "embed-query": "Knowledge base search",
      "embed-knowledge": "Knowledge base setup",
      "eval-extract-letter": "Evaluation run",
    } as Record<string, string>,
    unpriced: "no price known, counted as 0",
    recentFailures: "Latest failures",
    switched: "fallback answered",
    noFailures: "No failed calls in this period.",
    empty: "No AI calls in this period.",
  },

  errors: {
    NOT_FOUND: "This page or item does not exist.",
    NOT_AUTHENTICATED: "You are not signed in.",
    INVALID_BODY: "The request was not valid.",
    INVALID_PARAM: "The request was not valid.",
    INVALID_LANGUAGE: "This language is not supported.",
    INTERNAL: "Something went wrong on our side. Please try again.",
    INVALID_CREDENTIALS: "Wrong e-mail address or password.",
    EMAIL_TAKEN: "This e-mail address is already registered.",
    TOO_MANY_ATTEMPTS: "Too many failed attempts. Please wait 15 minutes and try again.",
    ACCOUNT_REQUIRED: "Sign in or create an account to use this.",
    GUEST_LIMIT: "Guests can try BriefKlar with one letter. Create a free account to upload more.",
    NO_FILE: "No file was uploaded.",
    UNSUPPORTED_TYPE: "Only PDF, JPG and PNG files are supported.",
    LIMIT_FILE_SIZE: "File is too large (max 10 MB).",
    DOCUMENT_NOT_FOUND: "This letter was not found.",
    ACTION_ITEM_NOT_FOUND: "This task was not found.",
    DRAFT_NOT_FOUND: "This draft was not found.",
    ALREADY_PROCESSING: "This letter is being processed. Try again in a moment.",
    NOT_ANALYZED: "This letter has not been analyzed yet.",
    INVALID_DATE: "This date does not exist.",
    DATE_IN_FUTURE: "The delivery date cannot be in the future.",
    DATE_BEFORE_LETTER: "The letter cannot have arrived before its own date.",
    REMINDER_NOT_FOUND: "This reminder was not found.",
    DATE_IN_PAST: "The date is in the past.",
    AI_RATE_LIMITED: "The AI service has too many requests right now. Please try again in a few minutes.",
    AI_OVERLOADED: "The AI service is temporarily overloaded. Please try again in a few minutes.",
    AI_KEY_REJECTED: "The AI service rejected the API key. Check GEMINI_API_KEY.",
    AI_MODEL_NOT_FOUND: "The configured AI model was not found. Check GEMINI_MODEL.",
    AI_FAILED: "The AI service could not process this request.",
    AI_INCOMPLETE: "The AI returned an incomplete answer. Please try again.",
    PROCESSING_FAILED: "Something went wrong while processing this letter.",
    connectionLost: "The connection was lost. Please try again.",
    requestFailed: "The request failed. Please try again.",
  },
};

export type Messages = typeof en;

// Every value the API can send needs a text (checked once here; other languages copy the shape)
en.errors satisfies Record<ErrorCode, string>;
en.status satisfies Record<DocumentStatus, string>;
en.processing satisfies Record<ProcessingStep, string>;
en.analysis.senderTypes satisfies Record<SenderType, string>;
en.analysis.letterTypes satisfies Record<LetterType, string>;
en.analysis.deadlineKinds satisfies Record<DeadlineKind, string>;
en.analysis.urgency satisfies Record<Urgency, string>;
en.deadlineSteps satisfies Record<DeadlineStep["type"], unknown>;
en.holidays satisfies Record<HolidayId, string>;
en.replies.types satisfies Record<ReplyType, string>;
en.replies.hints satisfies Record<ReplyType, string>;
en.replies.warnings satisfies Record<ReplyWarning["code"], unknown>;
en.chat.tools satisfies Record<ChatToolName, string>;
en.reminders.origins satisfies Record<ReminderOrigin, string>;
