import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import type { ApiErrorBody } from "@briefklar/shared";
import { HttpError } from "../lib/httpError";

export const notFound: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: { message: "Not found", code: "NOT_FOUND" } };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: { message: err.message, code: err.code } };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    const body: ApiErrorBody = {
      error: tooLarge
        ? { message: "File is too large (max 10 MB).", code: "LIMIT_FILE_SIZE" }
        : { message: err.message, code: "INVALID_BODY" },
    };
    res.status(status).json(body);
    return;
  }

  console.error(err);
  const body: ApiErrorBody = { error: { message: "Internal server error", code: "INTERNAL" } };
  res.status(500).json(body);
};
