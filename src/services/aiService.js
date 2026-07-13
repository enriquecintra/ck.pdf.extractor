const { GoogleGenAI } = require("@google/genai");
const { config } = require("../config");

const ai = new GoogleGenAI({
  apiKey: config.geminiApiKey,
});

const itemSchema = {
  type: "object",

  properties: {
    codigo: {
      type: ["string", "null"],
    },

    descricao: {
      type: ["string", "null"],
    },

    quantidade: {
      type: ["number", "null"],
    },

    valorVenda: {
      type: ["number", "null"],
    },
  },

  required: ["codigo", "descricao", "quantidade", "valorVenda"],
};

const ordemCompraSchema = {
  type: "object",

  properties: {
    clienteDocumento: {
      type: ["string", "null"],
    },

    cliente: {
      type: ["string", "null"],
    },

    contatoNome: {
      type: ["string", "null"],
    },

    contatoTelefone: {
      type: ["string", "null"],
    },

    contatoEmail: {
      type: ["string", "null"],
    },

    dataAutorizacao: {
      type: ["string", "null"],
    },

    numeroPedidoCompra: {
      type: ["string", "null"],
    },

    placa: {
      type: ["string", "null"],
    },

    marca: {
      type: ["string", "null"],
    },

    modelo: {
      type: ["string", "null"],
    },

    renavam: {
      type: ["string", "null"],
    },

    chassi: {
      type: ["string", "null"],
    },

    cor: {
      type: ["string", "null"],
    },

    anoFabricacao: {
      type: ["integer", "null"],
    },

    anoModelo: {
      type: ["integer", "null"],
    },

    km: {
      type: ["integer", "null"],
    },

    dataEntrada: {
      type: ["string", "null"],
    },

    codigoInterno: {
      type: ["string", "null"],
    },

    clienteEntregaDocumento: {
      type: ["string", "null"],
    },

    clienteEntrega: {
      type: ["string", "null"],
    },

    enderecoEntrega: {
      type: ["string", "null"],
    },

    municipioEntrega: {
      type: ["string", "null"],
    },

    estadoEntrega: {
      type: ["string", "null"],
    },

    cepEntrega: {
      type: ["string", "null"],
    },

    clienteEntregaContatoNome: {
      type: ["string", "null"],
    },

    clienteEntregaContatoTelefone: {
      type: ["string", "null"],
    },

    clienteEntregaContatoEmail: {
      type: ["string", "null"],
    },

    observacao: {
      type: ["string", "null"],
    },

    itens: {
      type: "array",
      items: itemSchema,
    },
  },

  required: [
    "clienteDocumento",
    "cliente",
    "contatoNome",
    "contatoTelefone",
    "contatoEmail",
    "dataAutorizacao",
    "numeroPedidoCompra",
    "placa",
    "marca",
    "modelo",
    "renavam",
    "chassi",
    "cor",
    "anoFabricacao",
    "anoModelo",
    "km",
    "dataEntrada",
    "codigoInterno",
    "clienteEntregaDocumento",
    "clienteEntrega",
    "enderecoEntrega",
    "municipioEntrega",
    "estadoEntrega",
    "cepEntrega",
    "clienteEntregaContatoNome",
    "clienteEntregaContatoTelefone",
    "clienteEntregaContatoEmail",
    "observacao",
    "itens",
  ],
};

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getErrorText(error) {
  let text = "";

  try {
    text += String(error?.message || "");
  } catch {
    // Ignora falha ao converter a mensagem.
  }

  try {
    text += ` ${JSON.stringify(error || {})}`;
  } catch {
    // Ignora objetos com referências circulares.
  }

  return text.toLowerCase();
}

function shouldRetry(error) {
  const text = getErrorText(error);

  const status = Number(error?.status || error?.code || 0);

  return (
    [408, 429, 500, 502, 503, 504].includes(status) ||
    text.includes('"code":408') ||
    text.includes('"code":429') ||
    text.includes('"code":500') ||
    text.includes('"code":502') ||
    text.includes('"code":503') ||
    text.includes('"code":504') ||
    text.includes("resource_exhausted") ||
    text.includes("quota exceeded") ||
    text.includes("rate limit") ||
    text.includes("unavailable") ||
    text.includes("high demand") ||
    text.includes("service unavailable") ||
    text.includes("deadline exceeded")
  );
}

async function executeWithRetry(
  operation,
  { maxAttempts = 4, initialDelayMs = 1000, maxDelayMs = 10000 } = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts) {
        throw error;
      }

      const exponentialDelay = initialDelayMs * Math.pow(2, attempt - 1);

      const delay =
        Math.min(exponentialDelay, maxDelayMs) +
        Math.floor(Math.random() * 500);

      console.warn(
        `Falha temporária no Gemini. ` +
          `Tentativa ${attempt + 1}/${maxAttempts} em ${delay}ms.`,
      );

      await wait(delay);
    }
  }

  throw lastError;
}

function buildPrompt(pdfText) {
  const limitedText = pdfText.slice(0, 20000);

  return `
Extraia os dados da Ordem de Compra abaixo e retorne somente o JSON
compatível com o schema fornecido.

Regras:

- Use exclusivamente informações presentes no documento.
- Não invente, não complete e não calcule dados ausentes.
- Campos ausentes devem ser null.
- itens deve sempre ser um array.
- Datas devem ser normalizadas para YYYY-MM-DD.
- CNPJ e CPF devem ser retornados somente com números.
- Placas devem ser retornadas sem hífen.
- Valores monetários brasileiros devem ser convertidos para number.
- valorVenda representa o valor unitário explicitamente informado.
- Não use o valor total da linha como valor unitário.
- numeroPedidoCompra pode aparecer como Pedido SAP, Pedido de Compra,
  Purchase Order ou PO.
- codigoInterno pode aparecer como OS, Ordem de Serviço, Chamado ou
  Código da Solicitação.
- Nunca confunda fornecedor com cliente.
- Nunca copie automaticamente cliente para clienteEntrega.
- Extraia todos os itens encontrados.

DOCUMENTO:

${limitedText}
`;
}

function normalizeItem(item) {
  return {
    codigo: item?.codigo ?? null,
    descricao: item?.descricao ?? null,
    quantidade: item?.quantidade ?? null,
    valorVenda: item?.valorVenda ?? null,
  };
}

function normalizeOrder(order) {
  return {
    clienteDocumento: order?.clienteDocumento ?? null,
    cliente: order?.cliente ?? null,

    contatoNome: order?.contatoNome ?? null,
    contatoTelefone: order?.contatoTelefone ?? null,
    contatoEmail: order?.contatoEmail ?? null,

    dataAutorizacao: order?.dataAutorizacao ?? null,
    numeroPedidoCompra: order?.numeroPedidoCompra ?? null,

    placa: order?.placa ?? null,
    marca: order?.marca ?? null,
    modelo: order?.modelo ?? null,

    renavam: order?.renavam ?? null,
    chassi: order?.chassi ?? null,
    cor: order?.cor ?? null,

    anoFabricacao: order?.anoFabricacao ?? null,
    anoModelo: order?.anoModelo ?? null,
    km: order?.km ?? null,
    dataEntrada: order?.dataEntrada ?? null,

    codigoInterno: order?.codigoInterno ?? null,

    clienteEntregaDocumento: order?.clienteEntregaDocumento ?? null,

    clienteEntrega: order?.clienteEntrega ?? null,

    enderecoEntrega: order?.enderecoEntrega ?? null,

    municipioEntrega: order?.municipioEntrega ?? null,

    estadoEntrega: order?.estadoEntrega ?? null,

    cepEntrega: order?.cepEntrega ?? null,

    clienteEntregaContatoNome: order?.clienteEntregaContatoNome ?? null,

    clienteEntregaContatoTelefone: order?.clienteEntregaContatoTelefone ?? null,

    clienteEntregaContatoEmail: order?.clienteEntregaContatoEmail ?? null,

    observacao: order?.observacao ?? null,

    itens: Array.isArray(order?.itens) ? order.itens.map(normalizeItem) : [],
  };
}

function validateAIResponse(order) {
  if (!order || typeof order !== "object" || Array.isArray(order)) {
    throw new Error(
      "A IA retornou uma estrutura inválida. Era esperado um objeto JSON.",
    );
  }

  if (!Array.isArray(order.itens)) {
    throw new Error(
      'A IA retornou uma estrutura inválida. O campo "itens" deve ser um array.',
    );
  }
}

async function extractPurchaseOrderWithAI(pdfText) {
  if (!pdfText || !pdfText.trim()) {
    throw new Error("O texto do PDF está vazio.");
  }

  const response = await executeWithRetry(
    () =>
      ai.models.generateContent({
        model: config.geminiModel,

        contents: buildPrompt(pdfText),

        config: {
          responseMimeType: "application/json",
          responseJsonSchema: ordemCompraSchema,
          temperature: 0,

          thinkingConfig: {
            thinkingLevel: "minimal",
          },
        },
      }),

    {
      maxAttempts: 3,
      initialDelayMs: 700,
      maxDelayMs: 5000,
    },
  );

  if (!response?.text) {
    throw new Error("A IA retornou uma resposta vazia.");
  }

  let order;

  try {
    order = JSON.parse(response.text);
  } catch {
    console.error("Resposta inválida retornada pela IA:");
    console.error(response.text);

    throw new Error("A IA retornou um JSON inválido.");
  }

  validateAIResponse(order);

  return normalizeOrder(order);
}

module.exports = {
  extractPurchaseOrderWithAI,
};
