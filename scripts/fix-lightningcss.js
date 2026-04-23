// Turbopack on Windows can't resolve the dynamic `require('lightningcss-<platform>')`
// that lightningcss/node/index.js uses to load its native binary. When that fails,
// the loader falls back to `require('../lightningcss.<platform>.node')` — but that
// file doesn't exist unless we copy it into the lightningcss package root.
//
// This script detects the host platform and copies the matching native binary from
// the sibling `lightningcss-<platform>-<arch>[-abi]` package into the lightningcss
// package directory, both at root and under @tailwindcss/node's nested lightningcss.
//
// Runs as part of `postinstall` so the patch survives `npm install`.

const fs = require('fs')
const path = require('path')

function getPlatformParts() {
  const parts = [process.platform, process.arch]
  if (process.platform === 'linux') {
    try {
      const { MUSL, familySync } = require('detect-libc')
      const family = familySync()
      if (family === MUSL) parts.push('musl')
      else if (process.arch === 'arm') parts.push('gnueabihf')
      else parts.push('gnu')
    } catch {
      parts.push('gnu')
    }
  } else if (process.platform === 'win32') {
    parts.push('msvc')
  }
  return parts
}

function findLightningcssDirs(root) {
  const results = []
  function walk(dir, depth) {
    if (depth > 6) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = path.join(dir, entry.name)
      if (entry.name === 'lightningcss') {
        results.push(full)
      } else if (entry.name === 'node_modules' || entry.name.startsWith('@')) {
        walk(full, depth + 1)
      }
    }
  }
  walk(root, 0)
  return results
}

const parts = getPlatformParts()
const suffix = parts.join('-')
const binaryName = `lightningcss.${suffix}.node`
const nativePkgName = `lightningcss-${suffix}`

const nodeModulesRoot = path.resolve(__dirname, '..', 'node_modules')
if (!fs.existsSync(nodeModulesRoot)) {
  process.exit(0)
}

const lightningcssDirs = findLightningcssDirs(nodeModulesRoot)
let patched = 0

for (const dir of lightningcssDirs) {
  const target = path.join(dir, binaryName)
  if (fs.existsSync(target)) continue

  const siblingParent = path.dirname(dir)
  const nativePkgDir = path.join(siblingParent, nativePkgName)
  const source = path.join(nativePkgDir, binaryName)

  if (!fs.existsSync(source)) continue

  try {
    fs.copyFileSync(source, target)
    patched++
    console.log(`[fix-lightningcss] Copied ${binaryName} → ${path.relative(process.cwd(), target)}`)
  } catch (err) {
    console.warn(`[fix-lightningcss] Failed to copy to ${target}:`, err.message)
  }
}

if (patched === 0) {
  console.log(`[fix-lightningcss] No patching needed (platform: ${suffix})`)
}
