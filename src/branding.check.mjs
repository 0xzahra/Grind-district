import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const logo = readFileSync('public/brand/logo-black.jpg')
const shrimp = readFileSync('public/brand/shrimp.png')
assert(logo[0] === 255 && logo[1] === 216, 'existing supplied boot logo restored as JPEG')
assert(shrimp.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'existing supplied mascot restored as PNG')
console.log('original branding checks passed')
