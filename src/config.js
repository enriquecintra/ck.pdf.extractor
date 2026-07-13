require('dotenv').config()

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  maxPdfSizeMb: numberFromEnv('MAX_PDF_SIZE_MB', 10),
  cacheTtlMinutes: numberFromEnv('CACHE_TTL_MINUTES', 30),
  cacheMaxEntries: numberFromEnv('CACHE_MAX_ENTRIES', 100)
}

function validateConfig() {
  const missing = []

  if (!config.geminiApiKey) missing.push('GEMINI_API_KEY')
  if (!config.apiKey) missing.push('API_KEY')

  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`)
  }
}

module.exports = { config, validateConfig }
