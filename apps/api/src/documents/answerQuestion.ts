import type { Document } from "@prisma/client";
import type { AnswerQuestionInput, GermanState, PendingQuestionDto } from "@briefklar/shared";
import { resumeLetterRun, waitingRun } from "../agents/resumeRun";
import { isIsoDate, todayInGermany } from "../deadlines/calendarDate";
import { recomputeDeadlines } from "../deadlines/recomputeDeadlines";
import { HttpError } from "../lib/httpError";
import { prisma } from "../lib/prisma";
import { latestExtraction, letterOf } from "./extractions";

/** A delivery date the user entered must exist, lie in the past and not before the letter's date */
export async function checkReceivedDate(documentId: string, receivedDate: string): Promise<void> {
  if (!isIsoDate(receivedDate)) throw new HttpError(400, "This date does not exist.", "INVALID_DATE");
  if (receivedDate > todayInGermany()) {
    throw new HttpError(400, "The delivery date cannot be in the future.", "DATE_IN_FUTURE");
  }
  const letterDate = letterOf(await latestExtraction(documentId))?.letterDate;
  if (letterDate && receivedDate < letterDate) {
    throw new HttpError(400, "The letter cannot have arrived before its own date.", "DATE_BEFORE_LETTER");
  }
}

/** The question card of a letter: the question of its latest run, if that run waits for the user */
export async function pendingQuestion(documentId: string): Promise<PendingQuestionDto | null> {
  const waiting = await waitingRun(documentId);
  if (!waiting) return null;
  const estimatedDeadlines = await prisma.deadline.count({ where: { documentId, isEstimate: true } });
  return { question: waiting.question, estimatedDeadlines };
}

/**
 * The deadlines of a letter after the user entered its delivery date: a run that asked for it goes
 * on with the answer (and is done), any other letter is only calculated again.
 */
export async function afterReceivedDate(documentId: string, receivedDate: string | null): Promise<void> {
  if (receivedDate && (await resumeLetterRun(documentId, { question: "RECEIVED_DATE", value: receivedDate }))) return;
  await recomputeDeadlines(documentId);
}

/**
 * Regional holidays can move due dates, so every analysed letter of the user is calculated again
 * after the federal state changed; runs that asked for the state go on with it.
 */
export async function afterStateChange(userId: string, state: GermanState | null): Promise<void> {
  const docs = await prisma.document.findMany({ where: { userId, status: "DONE" }, select: { id: true } });
  for (const doc of docs) {
    if (state && (await resumeLetterRun(doc.id, { question: "FEDERAL_STATE", value: state }))) continue;
    await recomputeDeadlines(doc.id);
  }
}

/**
 * The user answered the question card. The answer is stored where the deadline engine reads it
 * (the delivery date on the letter, the state on the user) and the waiting run goes on with it.
 * "I don't know" (null) stores nothing: the run ends and the estimated dates stay.
 */
export async function answerQuestion(doc: Document, input: AnswerQuestionInput): Promise<void> {
  if (doc.status !== "DONE") {
    throw new HttpError(409, "This letter is being processed. Try again in a moment.", "ALREADY_PROCESSING");
  }
  const waiting = await waitingRun(doc.id);
  if (!waiting || waiting.question !== input.question) {
    throw new HttpError(409, "This question has already been answered.", "NO_QUESTION");
  }

  if (input.question === "RECEIVED_DATE") {
    if (input.receivedDate) {
      await checkReceivedDate(doc.id, input.receivedDate);
      await prisma.document.update({
        where: { id: doc.id },
        data: { receivedDate: new Date(`${input.receivedDate}T00:00:00Z`) },
      });
    }
    if (!(await resumeLetterRun(doc.id, { question: input.question, value: input.receivedDate }))) {
      throw new HttpError(409, "This question has already been answered.", "NO_QUESTION");
    }
    return;
  }

  if (input.state) {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: doc.userId }, select: { state: true } });
    await prisma.user.update({ where: { id: doc.userId }, data: { state: input.state } });
    // This letter and every other one that asked for the state go on with it
    if (before.state !== input.state) {
      await afterStateChange(doc.userId, input.state);
      return;
    }
  }
  if (!(await resumeLetterRun(doc.id, { question: input.question, value: input.state }))) {
    throw new HttpError(409, "This question has already been answered.", "NO_QUESTION");
  }
}
