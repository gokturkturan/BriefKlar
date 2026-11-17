import type { Readable } from "node:stream";

/**
 * Abstraction over file storage. Today: local disk.
 * Later: an S3-compatible implementation without touching the routes.
 */
export interface StorageService {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  createReadStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
