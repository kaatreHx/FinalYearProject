const fs = require("fs");
const path = require("path");
const multer = require("multer");
const config = require("../config");

const kycDir = path.join(config.uploadDir, "kyc");
const docDir = path.join(config.uploadDir, "documents");
const imgDir = path.join(config.uploadDir, "properties");
const ownershipDir = path.join(config.uploadDir, "ownership");
fs.mkdirSync(kycDir, { recursive: true });
fs.mkdirSync(docDir, { recursive: true });
fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(ownershipDir, { recursive: true });

function diskStorage(dir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, name);
    },
  });
}

const MAX = 10 * 1024 * 1024; // 10 MB

const kycUpload = multer({ storage: diskStorage(kycDir), limits: { fileSize: MAX } });
const docUpload = multer({ storage: diskStorage(docDir), limits: { fileSize: MAX } });

/** Only allow image files for property photos. */
function imageFilter(_req, file, cb) {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files (jpg, png, webp…) are allowed."));
}

/** Allow images and PDFs for ownership documents. */
function documentFilter(_req, file, cb) {
  if (/^(image\/|application\/pdf)/.test(file.mimetype)) cb(null, true);
  else cb(new Error("Only images and PDF files are allowed."));
}

const imgUpload = multer({
  storage: diskStorage(imgDir),
  limits: { fileSize: MAX, files: 6 },
  fileFilter: imageFilter,
});

const ownershipUpload = multer({
  storage: diskStorage(ownershipDir),
  limits: { fileSize: MAX, files: 5 },
  fileFilter: documentFilter,
});

/**
 * Registration upload: property photos (`images`) and ownership documents
 * (`documents`) arrive together in one multipart request. Each field is stored
 * in its own folder and validated with its own file-type filter.
 */
const registerUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) =>
      cb(null, file.fieldname === "documents" ? ownershipDir : imgDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: MAX, files: 11 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "documents") return documentFilter(req, file, cb);
    return imageFilter(req, file, cb);
  },
}).fields([
  { name: "images", maxCount: 6 },
  { name: "documents", maxCount: 5 },
]);

module.exports = {
  kycUpload,
  docUpload,
  imgUpload,
  ownershipUpload,
  registerUpload,
  kycDir,
  docDir,
  imgDir,
  ownershipDir,
};
