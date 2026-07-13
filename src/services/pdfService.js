const { PDFParse } = require('pdf-parse')

async function extractTextFromPdf(buffer) {
  let parser

  try {
    parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text?.trim()

    if (!text) {
      const error = new Error('Nenhum texto foi encontrado no PDF.')
      error.code = 'PDF_WITHOUT_TEXT'
      throw error
    }

    return text
  } finally {
    if (parser) {
      await parser.destroy().catch(error => {
        console.error('Falha ao liberar o parser do PDF:', error)
      })
    }
  }
}

module.exports = { extractTextFromPdf }
