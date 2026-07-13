const crypto = require('crypto')
const { config } = require('../config')

function safeEqual(valueA, valueB) {
  const a = Buffer.from(String(valueA || ''))
  const b = Buffer.from(String(valueB || ''))

  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function requireApiKey(req, res, next) {
  const informedKey = req.header('x-api-key')

  if (!informedKey || !safeEqual(informedKey, config.apiKey)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Chave de acesso inválida.'
      }
    })
  }

  next()
}

module.exports = { requireApiKey }
