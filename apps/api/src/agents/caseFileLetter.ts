import { storage } from "../lib/storage";
import type { DocumentCaseFile } from "./documentCaseFile";

/** The uploaded file of the run, read from storage once and then kept in the case file */
export async function caseFileLetter(caseFile: DocumentCaseFile): Promise<Buffer> {
  caseFile.file ??= await storage.read(caseFile.fileKey);
  return caseFile.file;
}
