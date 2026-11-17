import { env } from "../config/env";
import { LocalStorage } from "./LocalStorage";
import type { StorageService } from "./StorageService";

const localStorage = new LocalStorage(env.UPLOAD_DIR);

export const storage: StorageService = localStorage;

export async function initStorage(): Promise<void> {
  await localStorage.init();
}
