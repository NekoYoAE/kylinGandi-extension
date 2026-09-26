import InvisibleUUID from './invisibleUUID'
import uid from './random'
import { randomUUID } from './random'

export default class Obfuscator {
  static obfuscateProccode(str: string): string {
    let state = 0
    let final = ''
    for (const c of str) {
      if (c === '%') {
        if (state === 1) state = 0
        else state = 1
      } else if (state === 1) {
        final += `%${c} `
        state = 0
      }
    }
    return InvisibleUUID.random() + final + '%'
  }

  static fetchMeta(targets: VM.Target[]) {
    const result: {
      isKylin: boolean
      isCompiled: boolean
      isObfuscated: boolean
      uuid: string
      comment: string | null
    } = {
      isKylin: false,
      isCompiled: false,
      isObfuscated: false,
      uuid: '',
      comment: null
    }
    for (const target of targets) {
      if (target.isStage) {
        for (const block of Object.values(target.blocks._blocks)) {
          if (
            block.opcode === 'procedures_call' &&
            (block.mutation as any)?.isKylin === 'true'
          ) {
            result.isKylin = true
            result.isObfuscated =
              (block.mutation as any)?.isObfuscated === 'true'
            result.isCompiled = (block.mutation as any)?.isCompiled === 'true'
            try {
              result.uuid = InvisibleUUID.decrypt((block.mutation as any).uuid)
            } catch (e) {
              result.uuid = ''
            }
            if ((block.mutation as any).comment) {
              result.comment = (block.mutation as any).comment
            }
            break
          }
        }
        break
      }
    }
    return result
  }

  static addMeta(
    runtime: VM.Runtime,
    {
      uuid: projectUUID,
      comment,
      isCompiled,
      isObfuscated
    }: {
      uuid?: string
      comment?: string
      isCompiled: boolean
      isObfuscated: boolean
    }
  ) {
    const sprites = new Set(runtime.targets.map(v => v.sprite))
    projectUUID = projectUUID ?? randomUUID()
    for (const sprite of sprites) {
      // 添加水印 / uuid
      if (sprite.clones[0].isStage) {
        const id = uid()
        ;(sprite.blocks as any)._blocks[id] = {
          id,
          opcode: 'procedures_call',
          inputs: {},
          fields: {},
          next: null,
          topLevel: true,
          parent: null,
          shadow: true,
          mutation: {
            tagName: 'mutation',
            isKylin: 'true',
            isCompiled: `${isCompiled}`,
            isObfuscated: `${isObfuscated}`,
            uuid: InvisibleUUID.encrypt(projectUUID),
            ...(comment ? { comment: String(comment) } : {}),
            children: [],
            proccode: '',
            argumentids: '[]',
            warp: 'true'
          } as any
        }
        sprite.blocks.resetCache()
        break
      }
    }
    return { uuid: projectUUID, comment }
  }

  static isAddonBlock(runtime: any, proccode: string): boolean {
    if (!proccode) return false
    const probes: any[] = [runtime]
    try {
      const vm = runtime && runtime.extensionManager && runtime.extensionManager.vm
      if (vm) probes.push(vm)
      if (vm && vm.runtime) probes.push(vm.runtime)
    } catch (e) {
    }
    for (const probe of probes) {
      if (!probe) continue
      for (const table of [probe.addonBlocks, probe.runtime && probe.runtime.addonBlocks]) {
        if (!table || typeof table !== 'object') continue
        try {
          if (Object.prototype.hasOwnProperty.call(table, proccode)) return true
        } catch (e) {
        }
      }
      if (typeof probe.getAddonBlock !== 'function') continue
      try {
        if (probe.getAddonBlock(proccode)) return true
      } catch (e) {
      }
    }
    return false
  }

  static obfuscate(runtime: VM.Runtime) {
    // name -> obfuscatedVarName
    const obfuscatedVariableName: Record<string, string> = {}
    const obfuscatedSignatureName: Record<string, string> = {}
    const sprites = new Set(runtime.targets.map(v => v.sprite))

    const definitionsBySprite: Record<string, Set<string>> = {}
    let stageSpriteName = ''
    for (const sprite of sprites) {
      const set = new Set<string>()
      for (const block of Object.values(sprite.blocks._blocks)) {
        if (block.opcode === 'procedures_prototype' && block.mutation) {
          set.add(String(block.mutation.proccode))
        }
      }
      definitionsBySprite[sprite.name] = set
      if (sprite.clones[0] && sprite.clones[0].isStage) stageSpriteName = sprite.name
    }
    const resolveProcedureOwner = (spriteName: string, proccode: string) => {
      if (definitionsBySprite[spriteName]?.has(proccode)) return spriteName
      if (
        stageSpriteName &&
        definitionsBySprite[stageSpriteName]?.has(proccode)
      ) {
        return stageSpriteName
      }
      for (const name in definitionsBySprite) {
        if (definitionsBySprite[name].has(proccode)) return name
      }
      return spriteName
    }
    const obfuscateSignature = (owner: string, proccode: string) => {
      if (!proccode) return proccode
      if (Obfuscator.isAddonBlock(runtime, proccode)) return proccode
      const key = `${owner}\u0000${proccode}`
      if (!obfuscatedSignatureName[key]) {
        obfuscatedSignatureName[key] = Obfuscator.obfuscateProccode(proccode)
      }
      return obfuscatedSignatureName[key]
    }

    for (const sprite of sprites) {
      const spriteName = sprite.name
      const obfuscatedArgumentName: Record<string, string> = {}

      for (const block of Object.values(sprite.blocks._blocks)) {
        if (
          block.opcode === 'data_showvariable' ||
          block.opcode === 'data_showlist' ||
          block.opcode === 'data_hidevariable' ||
          block.opcode === 'data_hidelist'
        ) {
          const field = block.fields.VARIABLE ?? block.fields.LIST
          if (field) obfuscatedVariableName[field.value] = field.value
        }
      }

      // 混淆变量 / 列表名
      const originalVariables = sprite.clones[0].variables ?? {}
      for (const variable of Object.values(originalVariables)) {
        if (!(variable.name in obfuscatedVariableName)) {
          if (variable.isCloud || variable.type === 'broadcast_msg') {
            obfuscatedVariableName[variable.name] = variable.name
          } else {
            obfuscatedVariableName[variable.name] = InvisibleUUID.random()
          }
        }
        variable.name = obfuscatedVariableName[variable.name]
      }

      // 混淆代码
      for (const [blockId, block] of Object.entries(sprite.blocks._blocks)) {
        if (!sprite.blocks.getBlock(blockId)) continue
        if (
          !block.parent &&
          !runtime.getIsHat(block.opcode) &&
          block.opcode !== 'procedures_definition'
        ) {
          ;(sprite.blocks as any).deleteBlock(block.id)
        } else {
          // 混淆积木位置
          delete (block as any).x
          delete (block as any).y

          block.shadow = true
          block.topLevel = true
          if (block.fields?.VARIABLE) {
            block.fields.VARIABLE.value =
              obfuscatedVariableName[block.fields.VARIABLE.value]
          }
          if (block.fields?.LIST) {
            block.fields.LIST.value =
              obfuscatedVariableName[block.fields.LIST.value]
          }
          if (
            (block.opcode === 'procedures_call' ||
              block.opcode === 'procedures_call_with_return') &&
            block.mutation
          ) {
            const originalCall = block.mutation.proccode
            if (typeof originalCall === 'string' && originalCall) {
              block.mutation.proccode = obfuscateSignature(
                resolveProcedureOwner(spriteName, originalCall),
                originalCall
              )
            }
          } else if (block.opcode === 'procedures_prototype' && block.mutation) {
            ;(block.mutation as any).argumentnames = JSON.stringify(
              JSON.parse((block.mutation as any).argumentnames).map(
                (original: string) => {
                  if (!(original in obfuscatedArgumentName)) {
                    obfuscatedArgumentName[original] = InvisibleUUID.random()
                  }
                  return obfuscatedArgumentName[original]
                }
              )
            )
            const originalProto = block.mutation.proccode
            if (typeof originalProto === 'string' && originalProto) {
              block.mutation.proccode = obfuscateSignature(spriteName, originalProto)
            }
          } else if (
            block.opcode === 'argument_reporter_string_number' ||
            block.opcode === 'argument_reporter_boolean'
          ) {
            if (
              !['is TurboWarp?', 'is compiled?'].includes(
                block.fields.VALUE.value
              )
            ) {
              if (!(block.fields.VALUE.value in obfuscatedArgumentName)) {
                obfuscatedArgumentName[block.fields.VALUE.value] =
                  InvisibleUUID.random()
              }
              block.fields.VALUE.value =
                obfuscatedArgumentName[block.fields.VALUE.value]
            }
          } else if (block.opcode === 'sensing_of' && block.fields.PROPERTY) {
            if (block.fields.PROPERTY.value in obfuscatedVariableName) {
              block.fields.PROPERTY.value =
                obfuscatedVariableName[block.fields.PROPERTY.value]
            }
          }
        }
      }

      const comments = sprite.clones[0].comments ?? {}
      for (const [id, value] of Object.entries(comments) as any) {
        if (
          sprite.clones[0].isStage &&
          typeof value.text === 'string' &&
          value.text.endsWith('// _twconfig_')
        ) {
          continue
        }
        delete comments[id]
      }
      sprite.blocks.resetCache()
    }

    const renameMonitors = (name: any) => {
      if (typeof name !== 'string') return name
      return obfuscatedVariableName[name] ?? name
    }
    try {
      const monitorBlocks = (runtime as any).monitorBlocks
      if (monitorBlocks && monitorBlocks._blocks) {
        for (const block of Object.values(monitorBlocks._blocks) as any[]) {
          const fields = block && block.fields
          if (!fields) continue
          if (fields.VARIABLE) fields.VARIABLE.value = renameMonitors(fields.VARIABLE.value)
          if (fields.LIST) fields.LIST.value = renameMonitors(fields.LIST.value)
        }
        if (typeof monitorBlocks.resetCache === 'function') {
          monitorBlocks.resetCache()
        }
      }
      const monitorState = (runtime as any).getMonitorState
        ? (runtime as any).getMonitorState()
        : null
      if (monitorState && typeof monitorState.forEach === 'function') {
        monitorState.forEach((state: any) => {
          const params = state && state.params
          if (!params) return
          if (typeof params.VARIABLE === 'string') {
            params.VARIABLE = renameMonitors(params.VARIABLE)
          }
          if (typeof params.LIST === 'string') {
            params.LIST = renameMonitors(params.LIST)
          }
        })
      }
    } catch (e) {
      console.warn('Kylin: 监视器改名失败', e)
    }
  }
}
