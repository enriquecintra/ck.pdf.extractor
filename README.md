# CK PDF Extractor

API Node.js que recebe uma Ordem de Compra em PDF, extrai o texto em memória, interpreta os dados com Google Gemini e retorna JSON estruturado.

## Requisitos

- Node.js 20+
- Chave da API Google Gemini

## Instalação

```bash
npm install
cp .env.example .env
npm start
```

Preencha no `.env`:

```env
GEMINI_API_KEY=sua_chave
API_KEY=sua_chave_privada
```

## Endpoints

### Health check

```http
GET /health
```

### Extrair Ordem de Compra

```http
POST /api/pdf/extract
x-api-key: SUA_API_KEY
Content-Type: multipart/form-data
```

Envie o PDF no campo `arquivo`.

Exemplo:

```bash
curl --request POST \
  --url http://localhost:3000/api/pdf/extract \
  --header "x-api-key: SUA_API_KEY" \
  --form "arquivo=@pedido.pdf"
```

Resposta:

```json
{
  "success": true,
  "data": {
    "clienteDocumento": null,
    "cliente": null,
    "numeroPedidoCompra": null,
    "placa": null,
    "itens": []
  },
  "metadata": {
    "fileName": "pedido.pdf",
    "extractedCharacters": 1234,
    "cache": false
  }
}
```

## Deploy no Render

O projeto inclui `render.yaml`.

1. Envie o projeto para um repositório GitHub.
2. No Render, escolha **New > Blueprint** e selecione o repositório.
3. Configure os secrets `GEMINI_API_KEY` e `API_KEY`.
4. Faça o deploy.

Também é possível criar um Web Service manualmente:

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/health`

## Observações

- PDFs são processados apenas em memória e não são salvos.
- Limite padrão: 10 MB.
- Cache em memória: 30 minutos e até 100 documentos.
- PDFs escaneados sem camada de texto exigirão OCR e retornarão `PDF_WITHOUT_TEXT`.
