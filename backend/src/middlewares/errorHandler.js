import multer from "multer";

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

  console.error("[Error]", err.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ detail: err.message || "Internal server error" });
}