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
  const limitedText = pdfText.slice(0, 50000);

  return `
Você é um sistema especializado em extrair dados de Ordens de Compra
automotivas.

Analise documentos com diferentes layouts e nomenclaturas e retorne
somente o JSON compatível com o schema fornecido.

==================================================
REGRAS GERAIS
==================================================

- Analise exclusivamente o conteúdo do documento.
- Não utilize conhecimento externo.
- Não invente dados.
- Não complete dados ausentes.
- Não calcule valores ausentes.
- Não corrija documentos, nomes, placas ou códigos.
- Quando um campo não existir claramente, retorne null.
- O campo itens deve sempre ser um array.
- Não retorne campos adicionais além dos existentes no schema.

==================================================
CLIENTE
==================================================

cliente representa a empresa compradora, contratante ou empresa para
a qual a nota fiscal deve ser emitida.

Pode aparecer como:

- Cliente
- Comprador
- Contratante
- Empresa Compradora
- Razão Social para emissão da Nota Fiscal
- Cliente para faturamento
- Destinatário

clienteDocumento deve conter o CNPJ ou CPF da empresa cliente.

Retorne o documento preferencialmente somente com números, sem pontos,
barras, traços ou espaços.

Nunca utilize o fornecedor como cliente.

==================================================
CONTATO
==================================================

Extraia quando disponíveis:

- contatoNome
- contatoTelefone
- contatoEmail

Esses dados devem representar o contato geral do pedido ou da empresa
compradora.

==================================================
PEDIDO
==================================================

numeroPedidoCompra pode aparecer como:

- Pedido SAP
- Pedido de Compra
- Número do Pedido de Compra
- Nº Pedido
- Purchase Order
- PO

codigoInterno pode aparecer como:

- Ordem de Serviço
- Número da OS
- Nº OS
- Chamado
- Código da solicitação
- Referência interna
- Código interno

Não confunda numeroPedidoCompra com codigoInterno.

==================================================
DATAS
==================================================

Normalize datas para o formato YYYY-MM-DD.

dataAutorizacao representa a data de emissão, criação ou autorização
da Ordem de Compra.

dataEntrada representa a entrada do veículo ou abertura do atendimento,
somente quando isso estiver explicitamente indicado.

Não confunda dataAutorizacao com dataEntrada.

==================================================
VEÍCULO
==================================================

Extraia:

- placa
- marca
- modelo
- renavam
- chassi
- cor
- anoFabricacao
- anoModelo
- km

Interprete semanticamente:

- Fabricante como marca.
- Veículo como modelo.
- Odômetro, quilometragem ou KM atual como km.
- Identificação como placa somente quando possuir formato compatível.

Remova espaços e separadores desnecessários da placa.

Exemplo:

TEG-3F43

deve resultar em:

TEG3F43

Converta quilometragens para número inteiro.

Exemplo:

10.551 KM

deve resultar em:

10551

Quando o documento informar:

Fabricação/Modelo: 2024/2025

retorne:

anoFabricacao: 2024
anoModelo: 2025

Quando houver somente um campo Modelo/Ano com um único ano, esse valor
deve ser tratado como anoModelo.

Nunca copie automaticamente o mesmo ano para anoFabricacao e anoModelo.

==================================================
ENTREGA
==================================================

Extraia somente quando claramente informados:

- clienteEntregaDocumento
- clienteEntrega
- enderecoEntrega
- municipioEntrega
- estadoEntrega
- cepEntrega
- clienteEntregaContatoNome
- clienteEntregaContatoTelefone
- clienteEntregaContatoEmail

Não copie automaticamente cliente para clienteEntrega.

Não copie automaticamente clienteDocumento para
clienteEntregaDocumento.

O documento de entrega também deve ser retornado preferencialmente
somente com números.

==================================================
OBSERVAÇÃO
==================================================

observacao deve conter somente uma observação geral relevante da Ordem
de Compra.

Não coloque em observacao informações que já possuem um campo próprio.

==================================================
ITENS
==================================================

Extraia todos os produtos, peças ou serviços existentes no documento.

Cada item deve possuir somente:

- codigo
- descricao
- quantidade
- valorVenda

codigo representa o código, referência, SKU ou identificador explícito
do item.

descricao representa o nome ou descrição da peça, produto ou serviço.

quantidade deve ser o valor explicitamente informado no documento.

valorVenda deve representar o preço unitário do item informado na
Ordem de Compra.

Converta valores monetários brasileiros para number.

Exemplos:

R$ 16.900,00 -> 16900
R$ 1.250,50 -> 1250.50

Não utilize o valor total da linha como valorVenda quando o documento
possuir quantidade maior que 1 e não informar claramente o valor
unitário.

Não calcule valorVenda dividindo o valor total pela quantidade.

Não calcule valor total.

==================================================
FORMATO DE SAÍDA
==================================================

Retorne apenas o JSON compatível com o schema.

Todos os campos definidos no schema devem existir.

Campos não encontrados devem ser null.

itens deve sempre ser um array.

DOCUMENTO PARA ANÁLISE:

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
        },
      }),

    {
      maxAttempts: 4,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
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
