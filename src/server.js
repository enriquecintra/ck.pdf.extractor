const crypto = require("crypto");
const express = require("express");
const multer = require("multer");

const { config, validateConfig } = require("./config");
const { requireApiKey } = require("./middlewares/apiKey");
const { extractTextFromPdf } = require("./services/pdfService");
const { extractPurchaseOrderWithAI } = require("./services/aiService");
const { MemoryCache } = require("./utils/cache");

validateConfig();

const app = express();

const cache = new MemoryCache({
  ttlMs: config.cacheTtlMinutes * 60 * 1000,
  maxEntries: config.cacheMaxEntries,
});

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: config.maxPdfSizeMb * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      const error = new Error("O arquivo precisa ser um PDF.");

      error.code = "INVALID_FILE_TYPE";

      return callback(error);
    }

    callback(null, true);
  },
});

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "1mb",
  }),
);

function getErrorText(error) {
  let text = "";

  try {
    text += String(error?.message || "");
  } catch {
    // Ignora erros de conversão.
  }

  try {
    text += ` ${JSON.stringify(error || {})}`;
  } catch {
    // Alguns objetos de erro podem conter referências circulares.
  }

  return text.toLowerCase();
}

function isRateLimitError(error) {
  const errorText = getErrorText(error);

  return (
    error?.status === 429 ||
    error?.code === 429 ||
    errorText.includes('"code":429') ||
    errorText.includes("resource_exhausted") ||
    errorText.includes("quota exceeded") ||
    errorText.includes("rate limit")
  );
}

function isServiceUnavailableError(error) {
  const errorText = getErrorText(error);

  return (
    error?.status === 503 ||
    error?.code === 503 ||
    errorText.includes('"code":503') ||
    errorText.includes("unavailable") ||
    errorText.includes("high demand") ||
    errorText.includes("service unavailable")
  );
}

function isModelNotFoundError(error) {
  const errorText = getErrorText(error);

  return (
    error?.status === 404 ||
    error?.code === 404 ||
    errorText.includes('"code":404') ||
    (errorText.includes("model") &&
      (errorText.includes("not found") ||
        errorText.includes("no longer available")))
  );
}

app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "ck-pdf-extractor",
    model: config.geminiModel,
    timestamp: new Date().toISOString(),
  });
});

app.post(
  "/api/pdf/extract",
  requireApiKey,
  upload.single("arquivo"),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: "FILE_REQUIRED",
          message: 'Nenhum arquivo foi enviado no campo "arquivo".',
        },
      });
    }

    const hash = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    const cached = cache.get(hash);

    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached.data,
        metadata: {
          fileName: req.file.originalname,
          extractedCharacters: cached.extractedCharacters,
          cache: true,
        },
      });
    }

    try {
      const result = await cache.once(hash, async () => {
        const text = await extractTextFromPdf(req.file.buffer);

        const data = await extractPurchaseOrderWithAI(text);

        const value = {
          data,
          extractedCharacters: text.length,
        };

        cache.set(hash, value);

        return value;
      });

      return res.status(200).json({
        success: true,
        data: result.data,
        metadata: {
          fileName: req.file.originalname,
          extractedCharacters: result.extractedCharacters,
          cache: false,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

app.use((error, req, res, next) => {
  console.error("Erro ao processar requisição:");
  console.error(error);

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `O PDF excede o limite máximo de ${config.maxPdfSizeMb} MB.`,
      },
    });
  }

  if (error?.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_FILE_TYPE",
        message: error.message,
      },
    });
  }

  if (error?.code === "PDF_WITHOUT_TEXT") {
    return res.status(422).json({
      success: false,
      error: {
        code: "PDF_WITHOUT_TEXT",
        message: error.message,
      },
    });
  }

  if (isRateLimitError(error)) {
    return res.status(429).json({
      success: false,
      error: {
        code: "AI_RATE_LIMIT",
        message:
          "O limite temporário da IA foi atingido. Tente novamente em alguns instantes.",
      },
    });
  }

  if (isServiceUnavailableError(error)) {
    return res.status(503).json({
      success: false,
      error: {
        code: "AI_UNAVAILABLE",
        message:
          "O serviço de IA está temporariamente sobrecarregado. Tente novamente em alguns instantes.",
      },
    });
  }

  if (isModelNotFoundError(error)) {
    return res.status(502).json({
      success: false,
      error: {
        code: "AI_MODEL_UNAVAILABLE",
        message:
          `O modelo "${config.geminiModel}" não está disponível para esta conta. ` +
          "Altere a variável GEMINI_MODEL.",
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "PROCESSING_ERROR",
      message: "Não foi possível processar a Ordem de Compra.",
    },
  });
});

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "Rota não encontrada.",
    },
  });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`ck-pdf-extractor executando na porta ${config.port}`);
  console.log(`Modelo Gemini: ${config.geminiModel}`);
});
