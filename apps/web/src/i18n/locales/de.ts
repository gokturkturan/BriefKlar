import { plural } from "../plural";
import type { Messages } from "./en";

/** Einfaches Deutsch: kurze Sätze, bekannte Wörter, Sie-Form */
export const de: Messages = {
  app: {
    nav: { upload: "Hochladen", documents: "Meine Briefe", reminders: "Erinnerungen", usage: "Verbrauch", profile: "Profil" },
    language: "Sprache",
    dueReminders: (count) => `Fällige Erinnerungen: ${count}`,
  },

  auth: {
    loginTitle: "Anmelden",
    registerTitle: "Konto erstellen",
    intro: "BriefKlar erklärt Briefe von deutschen Behörden in einfacher Sprache. Nur Sie sehen Ihre Briefe.",
    email: "E-Mail-Adresse",
    password: "Passwort",
    passwordHint: (min) => `Mindestens ${min} Zeichen.`,
    name: "Name (optional)",
    login: "Anmelden",
    register: "Konto erstellen",
    logout: "Abmelden",
    submitting: "Bitte warten…",
    noAccount: "Noch kein Konto?",
    haveAccount: "Sie haben schon ein Konto?",
  },

  guest: {
    intro: (count) => `Ohne Konto: Probieren Sie BriefKlar mit ${count} Brief aus und sehen Sie die Analyse. Mit einem kostenlosen Konto kommen mehr Briefe, Erklärungen in einfacher Sprache, der Chat, Antwortentwürfe und Erinnerungen dazu.`,
    yourLetter: "Ihr Brief",
    lockedTitle: "Mit einem kostenlosen Konto verfügbar",
    lockedText: "Melden Sie sich an oder erstellen Sie ein Konto für mehr Briefe, die Erklärung in einfacher Sprache, den Chat, Antwortentwürfe, Erinnerungen und Ihren Verbrauch. Ein Brief, den Sie als Gast hochgeladen haben, bleibt Ihnen erhalten.",
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
    pageCrashed: "Beim Anzeigen dieser Seite ist ein Fehler aufgetreten.",
  },

  status: { UPLOADED: "Wartet", PROCESSING: "In Arbeit", DONE: "Fertig", FAILED: "Fehler" },

  processing: {
    preprocessing: "Die Datei wird vorbereitet",
    extracting: "Der Brief wird gelesen und geprüft",
    verifying: "Die Auswertung wird mit dem Brief abgeglichen",
    translating: "Die Ergebnisse werden übersetzt",
    saving: "Die Ergebnisse werden gespeichert",
    retrying: "Der KI-Dienst ist gerade voll. Wir versuchen es gleich noch einmal.",
    processing: "In Arbeit …",
    queued: "Wartet in der Reihe …",
  },

  landing: {
    eyebrow: "Für Briefe von deutschen Behörden",
    title: "Jeden Behördenbrief verstehen, in Ihrer Sprache",
    intro: "Laden Sie einen Brief vom Finanzamt, Jobcenter oder von der Ausländerbehörde hoch. BriefKlar sagt Ihnen, was darin steht, was Sie tun müssen und bis wann.",
    tryCta: "Mit einem Brief ausprobieren",
    registerCta: "Kostenloses Konto erstellen",
    ctaNote: "Zum Ausprobieren kein Konto nötig · PDF, JPG oder PNG",
    sample: {
      label: "Beispiel für einen analysierten Brief",
      summary: (amount) => `Ihre Einkommensteuer für 2025 wurde festgesetzt. Sie bekommen ${amount} zurück. Wenn etwas nicht stimmt, können Sie innerhalb eines Monats Einspruch einlegen.`,
      deadline: "Einspruch möglich bis",
      deadlineHint: "Ein Monat nach Zugang, berechnet von Code, nicht von KI",
      todos: ["Bescheid mit der Steuererklärung vergleichen", "Schriftlich Einspruch einlegen, wenn etwas falsch ist"],
    },
    how: {
      title: "So funktioniert es",
      steps: [
        { title: "Brief hochladen", text: "Fotografieren Sie den Brief oder laden Sie das PDF hoch. Sie müssen nichts ausfüllen." },
        { title: "In einfachen Worten lesen", text: "Zusammenfassung, Aufgaben, Beträge und Fristen erscheinen in Sekunden in Ihrer Sprache." },
        { title: "Rechtzeitig handeln", text: "Lassen Sie sich vor Fristen erinnern, stellen Sie Fragen zum Brief und entwerfen Sie eine Antwort auf Deutsch." },
      ],
    },
    features: {
      title: "Alles, was ein Brief von Ihnen verlangt",
      items: [
        { title: "Erklärung in einfacher Sprache", text: "Was der Brief für Sie bedeutet, ohne Amtsdeutsch, live geschrieben." },
        { title: "Verlässliche Fristen", text: "Fristen berechnet Code, nicht die KI: Zugangsregeln, gesetzliche Fristen und die Feiertage Ihres Bundeslandes." },
        { title: "Antworten auf Deutsch", text: "Einspruch, Bitte um Fristverlängerung oder Begleitschreiben: ein korrekter deutscher Brief mit Übersetzung." },
        { title: "Antworten auf Ihre Fragen", text: "Fragen Sie im Chat zu Ihrem Brief. Er prüft Fristen und nennt offizielle Quellen." },
        { title: "Erinnerungen", text: "Jede Frist bekommt eine Erinnerung, und Sie können eigene hinzufügen." },
        { title: "Sechs Sprachen", text: "Die ganze Seite, die Analyse und die Erklärungen in Ihrer Sprache, wo nötig von rechts nach links." },
      ],
    },
    languages: "Sprachen",
    privacy: {
      title: "Ihre Briefe bleiben Ihre",
      intro: "Behördenbriefe sind persönlich. Sie entscheiden, was gespeichert wird und wie lange.",
      items: [
        "Nur Sie sehen Ihre Briefe.",
        "Briefe können nach 30 bis 365 Tagen automatisch gelöscht werden.",
        "Laden Sie jederzeit alle Ihre Daten herunter oder löschen Sie Ihr Konto.",
        "Zur Analyse sendet BriefKlar den Brief an die KI-Dienste von Anthropic (Claude) und OpenAI.",
      ],
    },
    final: {
      title: "Ein Brief, den Sie nicht verstehen?",
      text: "Laden Sie ihn jetzt hoch und wissen Sie in einer Minute, was er bedeutet und was zu tun ist. Ohne Konto.",
    },
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
      chat: "Fragen zu diesem Brief",
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

  chat: {
    intro: "Fragen Sie alles zu diesem Brief. Der Assistent liest die Auswertung, berechnet Daten mit dem Fristenrechner und sucht in einer Wissensdatenbank mit amtlichen Quellen. Das ist keine Rechtsberatung.",
    placeholder: "Ihre Frage…",
    send: "Senden",
    thinking: "Denkt nach…",
    clear: "Neues Gespräch beginnen",
    clearConfirm: "Gespräch löschen",
    toolsUsed: "Benutzte Werkzeuge",
    /** What each tool does, shown while the assistant uses it */
    tools: {
      get_letter_details: "Daten des Briefs",
      search_knowledge_base: "Wissensdatenbank",
      calculate_deadline: "Fristberechnung",
      check_date: "Kalender",
      list_public_holidays: "Feiertage",
      list_reminders: "Erinnerungen",
      create_reminder: "Neue Erinnerung",
    },
    sources: "Quellen",
    seeReminders: "Zu Ihren Erinnerungen",
    answeredBy: (model) => `Antwort von ${model}. Prüfen Sie wichtige Angaben im Original-Brief.`,
    suggestions: [
      "Was muss ich tun und bis wann?",
      "Was passiert, wenn ich nichts mache?",
      "Erinnere mich zwei Tage vor der Frist.",
    ],
  },

  reminders: {
    title: "Erinnerungen",
    intro: "BriefKlar erinnert Sie drei Tage vor jeder Frist in Ihren Briefen. Hier können Sie eigene Erinnerungen anlegen. Sie können auch im Chat auf der Seite eines Briefs danach fragen.",
    due: "Jetzt fällig",
    upcoming: "Demnächst",
    empty: "Keine offenen Erinnerungen.",
    deadline: (kind, date) => `${kind}: Frist am ${date}`,
    remindOn: (date) => `Erinnerung am ${date}`,
    markDone: "Erledigt",
    origins: { DEADLINE: "Automatisch", USER: "Von Ihnen", CHAT: "Im Chat erstellt" },
    add: "Erinnerung hinzufügen",
    note: "Woran sollen wir Sie erinnern?",
    date: "Datum",
    letter: "Brief (freiwillig)",
    noLetter: "Kein Brief",
    save: "Erinnerung speichern",
  },

  profile: {
    title: "Profil",
    account: "Konto",
    email: "E-Mail-Adresse",
    name: "Name",
    saveName: "Namen speichern",
    memberSince: (date) => `Mitglied seit ${date}`,
    password: "Passwort ändern",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    savePassword: "Passwort ändern",
    passwordChanged: "Das Passwort wurde geändert. Andere Geräte wurden abgemeldet.",
    wrongPassword: "Das aktuelle Passwort ist falsch.",
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
    privacy: {
      title: "Ihre Daten und Datenschutz",
      processing:
        "Um einen Brief zu analysieren, schickt BriefKlar ihn an die APIs von Anthropic (Claude) und OpenAI: Die eine liest ihn, die andere prüft die Auswertung. Alles andere (Ihre Briefe, " +
        "Analysen, Chats und Erinnerungen) speichert BriefKlar, bis Sie es löschen.",
      retention: "Briefe automatisch löschen",
      retentionHint:
        "Ein Brief wird so viele Tage nach dem Hochladen gelöscht, mit Analyse, Erklärungen, Antwort-Entwürfen, " +
        "Chat und Erinnerungen.",
      retentionNever: "Nie (behalten, bis ich sie lösche)",
      retentionDays: (days) => `Nach ${days} Tagen`,
      export: "Meine Daten herunterladen",
      exportHint:
        "Eine JSON-Datei mit Ihren Einstellungen und allen Briefen, mit Original-Datei, Analyse, Antwort-Entwürfen, " +
        "Chat und Erinnerungen.",
      delete: "Konto löschen",
      deleteHint: "Löscht Ihr Konto mit allen Briefen, Dateien, Analysen, Chats und Erinnerungen.",
      deleteConfirm: "Das kann man nicht rückgängig machen. Jetzt alles löschen?",
      deleteYes: "Ja, alles löschen",
    },
  },

  usage: {
    title: "Verbrauch und Kosten",
    intro: (date) =>
      `Jeder KI-Aufruf für Ihre Briefe wird gespeichert. Die Kosten sind geschätzt, mit den Preisen der bezahlten Stufe (Stand: ${date}). ` +
      "Bei der Entwicklung wird die kostenlose Stufe genutzt.",
    period: (days) => `Letzte ${days} Tage`,
    cost: "Geschätzte Kosten",
    calls: "KI-Aufrufe",
    failed: (count) => `${count} fehlgeschlagen`,
    fallbackSwitches: "Wechsel zum Ersatz-Modell",
    fallbackHint: "Das Haupt-Modell hatte einen Fehler oder war zu langsam. Das kleinere Modell hat geantwortet.",
    costPerLetter: "Kosten pro Brief (Durchschnitt)",
    letters: (count) => `Briefe: ${count}`,
    latency: "Antwortzeit (Median / 95 %)",
    tokens: "Tokens (Eingabe / Ausgabe)",
    perDay: "Kosten pro Tag",
    byPurpose: "Nach Aufgabe",
    byModel: "Nach Modell",
    columns: { name: "Name", calls: "Aufrufe", failed: "Fehler", switches: "Ersatz", tokens: "Tokens", cost: "Kosten", latency: "Median / 95 %" },
    purposes: {
      "extract-letter": "Brief-Analyse",
      "verify-letter": "Prüfung der Analyse",
      "revise-letter": "Korrektur der Analyse",
      "translate-analysis": "Übersetzung",
      "explain-letter": "Erklärung",
      "reply-draft": "Antwort-Entwurf",
      chat: "Chat",
      "embed-query": "Suche im Wissen",
      "embed-knowledge": "Wissen einrichten",
      "eval-extract-letter": "Test-Lauf (Evaluation)",
      "eval-verify-letter": "Test-Lauf (Prüfung)",
      "eval-revise-letter": "Test-Lauf (Korrektur)",
    },
    unpriced: "kein Preis bekannt, zählt als 0",
    recentFailures: "Letzte Fehler",
    switched: "Ersatz-Modell hat geantwortet",
    noFailures: "Keine Fehler in diesem Zeitraum.",
    empty: "Keine KI-Aufrufe in diesem Zeitraum.",
  },

  errors: {
    NOT_FOUND: "Diese Seite gibt es nicht.",
    NOT_AUTHENTICATED: "Sie sind nicht angemeldet.",
    INVALID_BODY: "Die Anfrage war nicht gültig.",
    INVALID_PARAM: "Die Anfrage war nicht gültig.",
    INVALID_LANGUAGE: "Diese Sprache gibt es hier nicht.",
    INTERNAL: "Bei uns ist ein Fehler passiert. Bitte versuchen Sie es noch einmal.",
    INVALID_CREDENTIALS: "E-Mail-Adresse oder Passwort ist falsch.",
    EMAIL_TAKEN: "Diese E-Mail-Adresse ist schon registriert.",
    TOO_MANY_ATTEMPTS: "Zu viele Fehlversuche. Bitte warten Sie 15 Minuten und versuchen Sie es dann erneut.",
    ACCOUNT_REQUIRED: "Melden Sie sich an oder erstellen Sie ein Konto, um das zu nutzen.",
    GUEST_LIMIT: "Als Gast können Sie BriefKlar mit einem Brief ausprobieren. Erstellen Sie ein kostenloses Konto, um mehr hochzuladen.",
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
    AI_KEY_REJECTED: "Der KI-Dienst hat den API-Schlüssel abgelehnt. Prüfen Sie ANTHROPIC_API_KEY und OPENAI_API_KEY.",
    AI_MODEL_NOT_FOUND: "Das KI-Modell wurde nicht gefunden. Prüfen Sie ANTHROPIC_MODEL und OPENAI_MODEL.",
    AI_FAILED: "Der KI-Dienst konnte die Anfrage nicht bearbeiten.",
    AI_INCOMPLETE: "Die Antwort der KI war nicht vollständig. Bitte versuchen Sie es noch einmal.",
    PROCESSING_FAILED: "Beim Bearbeiten des Briefs ist ein Fehler passiert.",
    connectionLost: "Die Verbindung wurde unterbrochen. Bitte versuchen Sie es noch einmal.",
    requestFailed: "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.",
  },
};
