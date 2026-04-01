import multer from "multer";

const IS_PROD = process.env.NODE_ENV === "production";

export function errorHandler(err, req, res, next) {
  // Multer file size limit exceeded
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ detail: "File too large. Maximum upload size is 500 MB." });
    }
    return res.status(400).json({ detail: `Upload error: ${err.message}` });
  }

  // CORS errors
  if (err.message?.startsWith("CORS:")) {
    return res.status(403).json({ detail: err.message });
  }

  // JWT / auth errors surfaced as plain Error
  if (err.name === "UnauthorizedError" || err.status === 401) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  // Mongoose bad ObjectId cast
  if (err.name === "CastError") {
    return res.status(404).json({ detail: "Resource not found" });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({ detail: err.message });
  }

  const status = err.status || err.statusCode || 500;
  const detail = IS_PROD && status >= 500
    ? "An internal error occurred. Please try again."
    : (err.message || "Internal server error");

  if (status >= 500) {
    console.error("[Error]", {
      method: req.method,
      path: req.path,
      status,
      message: err.message,
      stack: IS_PROD ? undefined : err.stack,
    });
  }

  res.status(status).json({ detail });
}
