import { plural } from "../plural";
import type { Messages } from "./en";

/** Einfaches Deutsch: kurze Sätze, bekannte Wörter, Sie-Form */
export const de: Messages = {
  app: {
    nav: { upload: "Hochladen", documents: "Meine Briefe", settings: "Einstellungen" },
    language: "Sprache",
  },

  common: {
    loading: "Wird geladen …",
    saving: "Wird gespeichert …",
    saved: "Gespeichert.",
    cancel: "Abbrechen",
    delete: "Löschen",
    remove: "Entfernen",
    tryAgain: "Noch einmal versuchen",
    starting: "Wird gestartet …",
  },

  status: { UPLOADED: "Wartet", PROCESSING: "In Arbeit", DONE: "Fertig", FAILED: "Fehler" },

  processing: {
    preprocessing: "Die Datei wird vorbereitet",
    extracting: "Der Brief wird gelesen und geprüft",
    translating: "Die Ergebnisse werden übersetzt",
    saving: "Die Ergebnisse werden gespeichert",
    retrying: "Der KI-Dienst ist gerade voll. Wir versuchen es gleich noch einmal.",
    processing: "In Arbeit …",
    queued: "Wartet in der Reihe …",
  },

  upload: {
    title: "Verstehen Sie Ihren Brief vom Amt",
    intro:
      "Laden Sie einen Brief hoch, zum Beispiel vom Finanzamt, Jobcenter oder von der Ausländerbehörde. " +
      "Wir erklären ihn in einfachen Worten. Und wir sagen Ihnen, was Sie tun müssen und bis wann.",
    drop: "Legen Sie den Brief hier ab oder klicken Sie, um eine Datei zu wählen",
    hint: "PDF, JPG oder PNG · höchstens 10 MB",
    uploading: "Wird hochgeladen …",
    invalidType: "Nur PDF-, JPG- und PNG-Dateien sind möglich.",
    tooLarge: "Die Datei ist zu groß (höchstens 10 MB).",
    disclaimer: "BriefKlar ist keine Rechtsberatung. Prüfen Sie wichtige Fristen immer selbst.",
  },

  documents: {
    title: "Meine Briefe",
    empty: "Noch keine Briefe.",
    uploadFirst: "Ersten Brief hochladen",
  },

  detail: {
    deletePermanently: "Für immer löschen",
    deleting: "Wird gelöscht …",
    noWorkerBefore: "Es läuft kein Hintergrund-Prozess. Darum kann der Brief nicht bearbeitet werden. Starten Sie die App mit",
    noWorkerAfter: ".",
    originalLetter: "Original-Brief",
    failed: "Die Bearbeitung hat nicht geklappt.",
    noAnalysis: "Für diesen Brief gibt es keine Auswertung.",
  },

  analysis: {
    urgency: { LOW: "Nicht eilig", MEDIUM: "Sie müssen etwas tun", HIGH: "Eilig" },
    senderTypes: {
      FINANZAMT: "Finanzamt",
      JOBCENTER: "Jobcenter",
      AGENTUR_FUER_ARBEIT: "Agentur für Arbeit",
      AUSLAENDERBEHOERDE: "Ausländerbehörde",
      BUERGERAMT: "Bürgeramt",
      KRANKENKASSE: "Krankenkasse",
      RUNDFUNKBEITRAG: "Rundfunkbeitrag",
      FAMILIENKASSE: "Familienkasse",
      COURT: "Gericht",
      EMPLOYER: "Arbeitgeber",
      LANDLORD: "Vermieter",
      COMPANY: "Firma",
      OTHER: "Andere",
    },
    letterTypes: {
      BESCHEID: "Bescheid (Entscheidung vom Amt)",
      MAHNUNG: "Mahnung (Zahlungserinnerung)",
      AUFFORDERUNG: "Aufforderung (Sie sollen etwas tun)",
      TERMIN: "Termin",
      KUENDIGUNG: "Kündigung",
      INVOICE: "Rechnung",
      INFO: "Information / Bestätigung",
      OTHER: "Andere",
    },
    deadlineKinds: {
      PAYMENT: "Zahlung",
      RESPONSE: "Antwort",
      OBJECTION: "Widerspruch",
      APPOINTMENT: "Termin",
      DOCUMENTS: "Unterlagen schicken",
      OTHER: "Andere",
    },
    fields: {
      summary: "Zusammenfassung",
      sender: "Absender",
      letterType: "Art des Briefs",
      letterDate: "Datum des Briefs",
      subject: "Betreff",
      references: "Aktenzeichen und Nummern",
      amounts: "Beträge",
      deadlines: "Fristen",
      requiredActions: "Was Sie tun müssen",
      requiredDocuments: "Unterlagen",
      objectionPossible: "Recht auf Widerspruch",
      urgency: "Dringlichkeit",
    },
    sections: {
      explained: "In einfachen Worten erklärt",
      todo: "Das müssen Sie tun",
      deadlines: "Fristen",
      amounts: "Beträge",
      documents: "Diese Unterlagen schicken",
      references: "Aktenzeichen und Nummern",
      reply: "Eine Antwort auf Deutsch schreiben",
    },
    notOfficial: "Das sieht nicht wie ein Brief vom Amt aus. Die Ergebnisse helfen vielleicht nicht.",
    uncertain: (fields: string) =>
      `Bitte prüfen Sie: ${fields}. Teile vom Brief waren schwer zu lesen oder unklar.`,
    nothingToDo: "Sie müssen nichts tun. Der Brief ist nur zur Information.",
    estimated: "Geschätzt",
    howCalculated: "So wurde das Datum berechnet",
    undated: "das Datum konnte nicht berechnet werden, bitte schauen Sie in den Brief",
    objectionRight:
      "Sie dürfen gegen diese Entscheidung Widerspruch oder Einspruch einlegen. Die Frist steht im Brief.",
    footer: (model: string, version: string) =>
      `Ausgewertet von ${model} (${version}). BriefKlar ist keine Rechtsberatung. ` +
      "Prüfen Sie wichtige Angaben immer im Original-Brief.",
    translating: (language: string) => `Die Auswertung wird übersetzt: ${language} …`,
    translationFailed: "Die Auswertung konnte nicht übersetzt werden. Sie sehen sie auf Englisch.",
  },

  deadlineSteps: {
    START_ASSUMED: () =>
      "Im Brief steht nicht, wann die Frist beginnt. Darum beginnt sie hier mit der Zustellung.",
    RECEIVED_ON: (date: string) => `Sie haben den Brief am ${date} bekommen.`,
    STARTS_ON_LETTER_DATE: (date: string) => `Die Frist beginnt mit dem Datum des Briefs: ${date}.`,
    DEEMED_DELIVERY: (days: number, letterDate: string, deliveryDate: string) =>
      `Ein Brief vom Amt mit der Post gilt am ${days}. Tag nach dem Absenden als zugestellt ` +
      `(§ 122 AO, § 41 VwVfG, § 37 SGB X). Wenn er am Datum des Briefs abgeschickt wurde ` +
      `(${letterDate}), ist das der ${deliveryDate}.`,
    COUNTED_FROM_LETTER_DATE: (date: string) =>
      `Im Brief steht nicht, wann er bei Ihnen ankam. Zur Sicherheit zählt die Frist ab dem Datum ` +
      `des Briefs: ${date}. Wenn der Brief später kam, endet Ihre Frist vielleicht später.`,
    YELLOW_ENVELOPE: () =>
      "Kam der Brief in einem gelben Umschlag (Zustellung)? Dann steht das Datum der Zustellung auf dem Umschlag.",
    DELIVERY_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} ist ${reason}. Darum gilt der nächste Werktag als Tag der Zustellung: ${movedTo}.`,
    PERIOD_ENDS: (period: string, start: string, end: string) =>
      `${period} nach dem ${start} endet die Frist am ${end} (§§ 187, 188 BGB).`,
    DEADLINE_MOVED: (date: string, reason: string, movedTo: string) =>
      `${date} ist ${reason}. Darum endet die Frist erst am nächsten Werktag: ${movedTo} (§ 193 BGB).`,
    REGIONAL_HOLIDAY: (date: string, states: string) =>
      `${date} ist in manchen Bundesländern ein Feiertag (${states}). ` +
      "Wenn Sie dort wohnen, endet die Frist am nächsten Werktag.",
  },

  nonWorkingDay: {
    SATURDAY: "ein Samstag",
    SUNDAY: "ein Sonntag",
    holiday: (name: string) => `ein Feiertag (${name})`,
  },

  period: (amount: number, unit) =>
    plural("de", amount, {
      DAY: { one: "# Tag", other: "# Tage" },
      WEEK: { one: "# Woche", other: "# Wochen" },
      MONTH: { one: "# Monat", other: "# Monate" },
      YEAR: { one: "# Jahr", other: "# Jahre" },
    }[unit]),

  holidays: {
    NEW_YEAR: "Neujahr",
    EPIPHANY: "Heilige Drei Könige",
    WOMENS_DAY: "Frauentag",
    GOOD_FRIDAY: "Karfreitag",
    EASTER_MONDAY: "Ostermontag",
    LABOUR_DAY: "Tag der Arbeit",
    LIBERATION_DAY: "Tag der Befreiung",
    ASCENSION_DAY: "Christi Himmelfahrt",
    WHIT_MONDAY: "Pfingstmontag",
    CORPUS_CHRISTI: "Fronleichnam",
    ASSUMPTION_DAY: "Mariä Himmelfahrt",
    CHILDRENS_DAY: "Weltkindertag",
    GERMAN_UNITY_DAY: "Tag der Deutschen Einheit",
    REFORMATION_DAY: "Reformationstag",
    ALL_SAINTS_DAY: "Allerheiligen",
    REPENTANCE_DAY: "Buß- und Bettag",
    CHRISTMAS_DAY: "1. Weihnachtstag",
    BOXING_DAY: "2. Weihnachtstag",
  },

  explanation: {
    language: "Sprache der Erklärung",
    explain: "In einfachen Worten erklären",
    reading: "Der Brief wird gelesen …",
    writing: "Wird geschrieben …",
    writtenBy: (model: string) =>
      `Geschrieben von ${model}. Prüfen Sie Namen, Beträge und Daten im Original-Brief.`,
  },

  receivedDate: {
    question: "Wann ist der Brief angekommen?",
    use: "Dieses Datum nehmen",
    hint:
      "Fristen, die mit der Zustellung beginnen, zählen dann ab diesem Tag und nicht ab einem geschätzten Datum. " +
      "Bei einem gelben Umschlag (Zustellung) nehmen Sie das Datum auf dem Umschlag.",
    noState: "Die Feiertage Ihres Bundeslands sind noch nicht dabei.",
    setState: "Bundesland wählen",
  },

  replies: {
    types: {
      OBJECTION: "Widerspruch / Einspruch",
      EXTENSION_REQUEST: "Um mehr Zeit bitten (Fristverlängerung)",
      SEND_DOCUMENTS: "Anschreiben für Unterlagen",
      INSTALLMENT_PLAN: "In Raten zahlen (Ratenzahlung)",
      QUESTION: "Eine Frage stellen (Rückfrage)",
    },
    hints: {
      OBJECTION:
        "Warum sind Sie nicht einverstanden? Sie können das Feld leer lassen. Dann legen Sie jetzt Widerspruch ein und schicken die Gründe später.",
      EXTENSION_REQUEST: "Warum brauchen Sie mehr Zeit, und bis wann?",
      SEND_DOCUMENTS: "Möchten Sie etwas zu den Unterlagen sagen? (freiwillig)",
      INSTALLMENT_PLAN: "Wie viel können Sie im Monat zahlen? Und warum können Sie nicht alles auf einmal zahlen?",
      QUESTION: "Was möchten Sie fragen?",
    },
    ownLanguage: "Sie können in Ihrer eigenen Sprache schreiben.",
    type: "Art der Antwort",
    translationLanguage: "Sprache der Übersetzung",
    translationOption: (language: string) => `Übersetzung: ${language}`,
    notes: "Ihre Notizen für die Antwort",
    write: "Antwort auf Deutsch schreiben",
    writing: "Die Antwort wird geschrieben …",
    copy: "Deutschen Text kopieren",
    copied: "Kopiert",
    deleteDraft: "Entwurf löschen",
    letter: "Antwort-Brief auf Deutsch",
    save: "Änderungen speichern",
    undo: "Änderungen verwerfen",
    whatItSays: (language: string) => `Was im Brief steht (${language})`,
    warnings: {
      NO_OBJECTION_RIGHT: () =>
        "Im Brief steht nichts von einem Recht auf Widerspruch. Prüfen Sie, ob ein Widerspruch überhaupt möglich ist.",
      OBJECTION_DEADLINE_PASSED: (date: string) =>
        `Die Frist für den Widerspruch (${date}) ist vielleicht schon vorbei. Holen Sie sich schnell Hilfe: ` +
        "Ein Widerspruch nach der Frist wird meistens abgelehnt.",
      OBJECTION_DEADLINE: (date: string) =>
        `Der Brief muss bis zum ${date} ankommen. Unterschreiben Sie ihn. Heben Sie einen Beweis für das ` +
        "Absenden auf (zum Beispiel Einwurf-Einschreiben oder Fax-Bericht).",
      REQUEST_ONLY: () => "Das ist eine Bitte: Die Frist gilt weiter, bis der Absender zustimmt.",
      FILL_PLACEHOLDERS: (placeholders: string) => `Vor dem Absenden ausfüllen: ${placeholders}`,
    },
  },

  settings: {
    title: "Einstellungen",
    state: "Bundesland",
    stateHint:
      "Endet eine Frist an einem Feiertag, gilt der nächste Werktag. Manche Feiertage gibt es nur in " +
      "manchen Bundesländern. Darum kann Ihr Bundesland ein Datum ändern. Ohne Bundesland zählen nur " +
      "die Feiertage in ganz Deutschland.",
    stateNotSet: "Nicht gewählt (nur Feiertage in ganz Deutschland)",
    language: "Ihre Sprache",
    languageHint:
      "BriefKlar zeigt alles in dieser Sprache: die Seiten, die Auswertung Ihrer Briefe, die Erklärungen " +
      "und die Übersetzung von Antwort-Entwürfen.",
  },

  errors: {
    NOT_FOUND: "Diese Seite gibt es nicht.",
    NOT_AUTHENTICATED: "Sie sind nicht angemeldet.",
    INVALID_BODY: "Die Anfrage war nicht gültig.",
    INVALID_PARAM: "Die Anfrage war nicht gültig.",
    INVALID_LANGUAGE: "Diese Sprache gibt es hier nicht.",
    INTERNAL: "Bei uns ist ein Fehler passiert. Bitte versuchen Sie es noch einmal.",
    NO_FILE: "Es wurde keine Datei hochgeladen.",
    UNSUPPORTED_TYPE: "Nur PDF-, JPG- und PNG-Dateien sind möglich.",
    LIMIT_FILE_SIZE: "Die Datei ist zu groß (höchstens 10 MB).",
    DOCUMENT_NOT_FOUND: "Dieser Brief wurde nicht gefunden.",
    ACTION_ITEM_NOT_FOUND: "Diese Aufgabe wurde nicht gefunden.",
    DRAFT_NOT_FOUND: "Dieser Entwurf wurde nicht gefunden.",
    ALREADY_PROCESSING: "Der Brief wird gerade bearbeitet. Bitte versuchen Sie es gleich noch einmal.",
    NOT_ANALYZED: "Dieser Brief ist noch nicht ausgewertet.",
    INVALID_DATE: "Dieses Datum gibt es nicht.",
    DATE_IN_FUTURE: "Das Datum der Zustellung darf nicht in der Zukunft liegen.",
    DATE_BEFORE_LETTER: "Der Brief kann nicht vor seinem eigenen Datum angekommen sein.",
    REMINDER_NOT_FOUND: "Diese Erinnerung gibt es nicht.",
    DATE_IN_PAST: "Das Datum liegt in der Vergangenheit.",
    AI_RATE_LIMITED: "Der KI-Dienst hat gerade zu viele Anfragen. Bitte versuchen Sie es in ein paar Minuten noch einmal.",
    AI_OVERLOADED: "Der KI-Dienst ist gerade voll. Bitte versuchen Sie es in ein paar Minuten noch einmal.",
    AI_KEY_REJECTED: "Der KI-Dienst hat den API-Schlüssel abgelehnt. Prüfen Sie GEMINI_API_KEY.",
    AI_MODEL_NOT_FOUND: "Das KI-Modell wurde nicht gefunden. Prüfen Sie GEMINI_MODEL.",
    AI_FAILED: "Der KI-Dienst konnte die Anfrage nicht bearbeiten.",
    AI_INCOMPLETE: "Die Antwort der KI war nicht vollständig. Bitte versuchen Sie es noch einmal.",
    PROCESSING_FAILED: "Beim Bearbeiten des Briefs ist ein Fehler passiert.",
    connectionLost: "Die Verbindung wurde unterbrochen. Bitte versuchen Sie es noch einmal.",
    requestFailed: "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.",
  },
};
