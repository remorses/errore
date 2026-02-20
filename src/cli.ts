#!/usr/bin/env node
/**
 * Errore CLI.
 * Provides the `skill` command to output SKILL.md contents for LLM context.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const command = process.argv[2]

if (command === 'skill') {
  const skillPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'SKILL.md',
  )
  const content = fs.readFileSync(skillPath, 'utf-8')
  process.stdout.write(content)
} else {
  console.log('Usage: errore <command>')
  console.log('')
  console.log('Commands:')
  console.log('  skill    Output SKILL.md contents')
}
