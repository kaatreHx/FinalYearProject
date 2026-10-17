/** Central error handler - keeps every route's error responses consistent. */
function errorHandler(err, _req, res, _next) {
  console.error("[error]", err.message);
  const status = err.status || 400;
  res.status(status).json({ error: err.message || "Something went wrong." });
}

module.exports = { errorHandler };
