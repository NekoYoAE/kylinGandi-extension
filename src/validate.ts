
import Obfuscator from './obfuscator'

export interface ValidationIssue {
  sprite: string
  blockId: string
  opcode: string
  message: string
}

export interface ValidationResult {
  targetCount: number
  scriptCount: number
  blockCount: number
  issues: ValidationIssue[]
}

const VARIABLE_FIELDS = ['VARIABLE', 'LIST', 'BROADCAST_OPTION']
const COSTUME_FIELDS = ['COSTUME', 'BACKDROP']
const SOUND_FIELDS = ['SOUND_MENU', 'SOUND']

const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(v => String(v))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(v => String(v)) : []
    } catch (e) {
      return []
    }
  }
  return []
}

export function validateProject(runtime: any): ValidationResult {
  const result: ValidationResult = {
    targetCount: 0,
    scriptCount: 0,
    blockCount: 0,
    issues: []
  }

  const targets: any[] = (runtime && runtime.targets) || []
  const stage = targets.find(t => t && t.isStage)
  const originals = targets.filter(t => t && t.isOriginal)

  result.targetCount = originals.length

  for (const target of originals) {
    const blocks = target.blocks
    if (!blocks || !blocks._blocks) continue
    const all: Record<string, any> = blocks._blocks
    const spriteName =
      (typeof target.getName === 'function' && target.getName()) ||
      target.name ||
      'unknown'

    const lookupVariable = (id: string) => {
      const own = target.variables && target.variables[id]
      if (own) return own
      const global = stage && stage.variables && stage.variables[id]
      if (global) return global
      const ownBroadcast = target.broadcasts && target.broadcasts[id]
      if (ownBroadcast) return ownBroadcast
      const globalBroadcast = stage && stage.broadcasts && stage.broadcasts[id]
      return globalBroadcast || null
    }

    for (const [blockId, block] of Object.entries(all)) {
      if (!block) continue
      result.blockCount++
      if (typeof runtime.getIsHat === 'function' && runtime.getIsHat(block.opcode)) {
        result.scriptCount++
      }
      const fields: Record<string, any> = block.fields || {}
      const issue = (message: string) =>
        result.issues.push({ sprite: spriteName, blockId, opcode: block.opcode, message })

      const isNativeVarOpcode =
        block.opcode.startsWith('data_') ||
        block.opcode.startsWith('event_broadcast') ||
        block.opcode === 'event_whenbroadcastreceived'
      for (const key of isNativeVarOpcode ? VARIABLE_FIELDS : []) {
        const field = fields[key]
        if (!field || !field.id) continue
        const variable = lookupVariable(field.id)
        if (!variable) {
          issue(`${key} 引用的变量不存在（id=${field.id}）`)
          continue
        }
        if (field.value !== variable.name) {
          issue(
            `${key} 的名字与变量对不上：积木里是 ${JSON.stringify(
              field.value
            )}，变量实际叫 ${JSON.stringify(variable.name)}`
          )
        }
      }

      for (const key of COSTUME_FIELDS) {
        const field = fields[key]
        if (!field || !field.id) continue
        const list =
          typeof target.getCostumes === 'function' ? target.getCostumes() : []
        if (list.length > 0 && !list.some((c: any) => c.id === field.id)) {
          issue(`${key} 引用的造型不存在（id=${field.id}）`)
        }
      }
      for (const key of SOUND_FIELDS) {
        const field = fields[key]
        if (!field || !field.id) continue
        const list = typeof target.getSounds === 'function' ? target.getSounds() : []
        if (list.length > 0 && !list.some((s: any) => s.id === field.id)) {
          issue(`${key} 引用的声音不存在（id=${field.id}）`)
        }
      }

      if (
        block.opcode === 'procedures_call' ||
        block.opcode === 'procedures_call_with_return'
      ) {
        const proccode = block.mutation && block.mutation.proccode
        if (typeof proccode === 'string' && proccode.length > 0) {
          let found = false
          try {
            found = !!blocks.getProcedureDefinition(proccode)
          } catch (e) {
          }
          if (!found) {
            try {
              const global =
                typeof blocks.getGlobalProcedureAndTarget === 'function'
                  ? blocks.getGlobalProcedureAndTarget(proccode)
                  : null
              found = !!(global && global[0])
            } catch (e) {
            }
          }
          if (!found) {
            found = Obfuscator.isAddonBlock(runtime, proccode)
          }
          if (!found) {
            issue(`调用的自制积木「${proccode}」找不到定义（改名不一致）`)
          }
        }
      }

      if (
        block.opcode === 'argument_reporter_string_number' ||
        block.opcode === 'argument_reporter_boolean'
      ) {
        const value = fields.VALUE && fields.VALUE.value
        if (typeof value !== 'string') continue
        let cursor: any = block
        let guard = 0
        let names: string[] | null = null
        while (cursor && guard++ < 64) {
          if (cursor.opcode === 'procedures_prototype' && cursor.mutation) {
            names = asArray(cursor.mutation.argumentnames)
            break
          }
          cursor = cursor.parent ? all[cursor.parent] : null
        }
        if (names && names.length > 0 && !names.includes(value)) {
          issue(`参数积木「${value}」不在所在自制积木的参数表里（改名不一致）`)
        }
      }
    }
  }

  return result
}

export function formatValidation(result: ValidationResult): string[] {
  const lines: string[] = [
    `🔎 Kylin 自检：${result.targetCount} 个角色 / ${result.scriptCount} 个脚本 / ${result.blockCount} 个积木`
  ]
  if (result.issues.length === 0) {
    lines.push('🔎 Kylin 自检通过：没有发现悬空引用')
    return lines
  }
  lines.push(`🔎 Kylin 自检发现 ${result.issues.length} 处悬空引用：`)
  for (const issue of result.issues.slice(0, 40)) {
    lines.push(
      `   · [${issue.sprite}] ${issue.opcode}(${issue.blockId}): ${issue.message}`
    )
  }
  if (result.issues.length > 40) {
    lines.push(`   … 还有 ${result.issues.length - 40} 处，见控制台`)
  }
  return lines
}
