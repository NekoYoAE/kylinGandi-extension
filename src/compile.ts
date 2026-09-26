import uid from './random'
import Obfuscator from './obfuscator'
import { minify } from 'terser'

export interface CompileFailure {
  topBlockId: string
  targetId: string
  spriteName: string
  message: string
}

export interface PreflightResult {
  total: number
  failed: CompileFailure[]
}

export const COMPILE_BLOCK_OPCODE = 'kylinRuntime_compile'

const CORE_BLOCK_PREFIXES = new Set([
  'control',
  'event',
  'looks',
  'motion',
  'operator',
  'sound',
  'sensing',
  'data',
  'procedures',
  'argument',
  'gandi_variable',
  'gandi_assets',
  'gandi_python',
  'gandi_spine'
])

export interface CompileOptions {
  skipExtensionScripts?: boolean
}

export interface CompileResult {
  sourceMap: string[]
  interpreted: string[]
}

type Cacheable = VM.Blocks & {
  _cache: {
    compiledScripts: Record<
      string,
      {
        success: boolean
        value: {
          startingFunction: () => void
        }
      }
    >
    compiledProcedures: Record<
      string,
      {
        topBlockId: string
        cachedCompileResult: () => void
      }
    >
  }
}

function spritesOf(runtime: VM.Runtime): VM.Sprite[] {
  return Array.from(new Set(runtime.targets.map(v => v.sprite)))
}

function ensureCompiler(runtime: VM.Runtime) {
  runtime.setCompilerOptions?.({ enabled: true, warpTimer: false })
}

export function preflight(runtime: VM.Runtime): PreflightResult {
  if (typeof runtime.precompile !== 'function') {
    return { total: 0, failed: [] }
  }
  ensureCompiler(runtime)
  runtime.precompile()

  const failed: CompileFailure[] = []
  let total = 0
  for (const sprite of spritesOf(runtime)) {
    const cache = (sprite.blocks as unknown as Cacheable)._cache
    if (!cache || !cache.compiledScripts) continue
    const first = sprite.clones[0]
    for (const [topBlockId, result] of Object.entries(cache.compiledScripts)) {
      total++
      if (!result || result.success) continue
      const value: any = result.value
      failed.push({
        topBlockId,
        targetId: (first && first.id) || '',
        spriteName: first && first.isStage ? 'Stage' : sprite.name || 'Sprite',
        message: String((value && value.message) || value || 'Compile failed')
      })
    }
  }
  return { total, failed }
}

async function obfuscateCode(code: string): Promise<string> {
  try {
    const result = await minify(code, {
      compress: true
    })
    return result.code ?? code
  } catch (e) {
    console.warn('⚠️ Failed to minify a compiled script, using the raw code.', e)
    return code
  }
}

function copyProcedurePrototype(
  definition: VM.Block,
  source: VM.Blocks,
  target: Record<string, VM.Block>
) {
  const input: any = definition.inputs && definition.inputs.custom_block
  const prototypeId: string | undefined = input && input.block
  if (!prototypeId) return
  if (!target[prototypeId]) {
    const original = source.getBlock(prototypeId)
    if (!original) return
    target[prototypeId] = structuredClone(original)
  }
  const prototype = target[prototypeId]
  for (const parameter of Object.values(prototype.inputs || {}) as any[]) {
    const shadowId = parameter && parameter.block
    if (!shadowId || target[shadowId]) continue
    const shadow = source.getBlock(shadowId)
    if (shadow) target[shadowId] = structuredClone(shadow)
  }
}

interface StructureProblem {
  sprite: string
  detail: string
}

interface ScriptInfo {
  topBlockId: string
  sprite: VM.Sprite
  thirdParty: boolean
  calls: string[]
  blockIds: string[]
  extensionIds: string[]
}

function walkScript(blocks: VM.Blocks, topBlockId: string): {
  blockIds: string[]
  calls: string[]
  opcodes: string[]
} {
  const seen = new Set<string>()
  const calls: string[] = []
  const opcodes: string[] = []
  const stack: string[] = [topBlockId]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (!id || seen.has(id)) continue
    const block = blocks.getBlock(id)
    if (!block) continue
    seen.add(id)
    opcodes.push(block.opcode)
    if (
      (block.opcode === 'procedures_call' ||
        block.opcode === 'procedures_call_with_return') &&
      block.mutation &&
      block.mutation.proccode
    ) {
      calls.push(String(block.mutation.proccode))
    }
    if (typeof block.next === 'string' && block.next) stack.push(block.next)
    const inputs: any = block.inputs || {}
    for (const key of Object.keys(inputs)) {
      const input = inputs[key]
      if (!input) continue
      if (typeof input.block === 'string' && input.block) stack.push(input.block)
      if (typeof input.shadow === 'string' && input.shadow) stack.push(input.shadow)
    }
  }
  return { blockIds: Array.from(seen), calls, opcodes }
}

function verifyBlocks(
  spriteName: string,
  blocks: Record<string, VM.Block>,
  problems: StructureProblem[]
) {
  const missing = (id: string) => !blocks[id]
  for (const id of Object.keys(blocks)) {
    const block = blocks[id]
    if (!block) {
      problems.push({ sprite: spriteName, detail: `积木 ${id} 是空值` })
      continue
    }
    if (typeof block.next === 'string' && missing(block.next)) {
      problems.push({
        sprite: spriteName,
        detail: `${id}(${block.opcode}) 的 next 指向不存在的 ${block.next}`
      })
    }
    const inputs: any = block.inputs || {}
    for (const key of Object.keys(inputs)) {
      const input = inputs[key]
      if (!input) continue
      if (typeof input.block === 'string' && missing(input.block)) {
        problems.push({
          sprite: spriteName,
          detail: `${id}(${block.opcode}) 的输入 ${key} 指向不存在的 ${input.block}`
        })
      }
      if (typeof input.shadow === 'string' && missing(input.shadow)) {
        problems.push({
          sprite: spriteName,
          detail: `${id}(${block.opcode}) 的输入 ${key} 影子积木 ${input.shadow} 不存在`
        })
      }
    }
  }
}

export async function compile(
  runtime: VM.Runtime,
  options: CompileOptions = {}
): Promise<CompileResult> {
  const compiledCode: string[] = []
  const nextCompiledCode = (code: string) => compiledCode.push(code) - 1

  const yOffset = 150
  const xOffset = 250
  const problems: StructureProblem[] = []
  const stageSprite = runtime.getTargetForStage().sprite
  const extensionManager: any = (runtime as any).extensionManager
  const loadedExtensions: Map<string, string> | undefined =
    extensionManager?._loadedExtensions
  const sprites = spritesOf(runtime)
  const skipExtensionScripts = options.skipExtensionScripts !== false

  const isBuiltinExtension = (id: string) => {
    if (!extensionManager || typeof extensionManager.isBuiltinExtension !== 'function') {
      return false
    }
    try {
      return !!extensionManager.isBuiltinExtension(id)
    } catch (e) {
      return false
    }
  }

  const isKylinExtension = (id: string) =>
    id === 'kylin' || id === 'kylinRuntime' || id.startsWith('kylinRuntime')

  const extensionIdOf = (opcode: string) => {
    const index = opcode.indexOf('_')
    return index > 0 ? opcode.substring(0, index) : ''
  }

  const extensionOpcodeOwner = new Map<string, string>()
  try {
    const blockInfoList: any = (runtime as any)._blockInfo
    if (blockInfoList && typeof blockInfoList.forEach === 'function') {
      blockInfoList.forEach((entry: any) => {
        if (!entry) return
        const info = entry.info || entry
        const extId = entry.extensionId || (info && info.extensionId)
        if (info && typeof info.opcode === 'string' && typeof extId === 'string') {
          extensionOpcodeOwner.set(info.opcode, extId)
        }
      })
    }
  } catch (e) {
    console.warn('Kylin: 读取扩展积木表失败，退回按 opcode 前缀判断', e)
  }

  const loadedExtensionIds = new Set<string>()
  if (loadedExtensions && typeof loadedExtensions.keys === 'function') {
    for (const id of loadedExtensions.keys()) loadedExtensionIds.add(id)
  }
  for (const id of extensionOpcodeOwner.values()) loadedExtensionIds.add(id)

  const isExtensionOpcode = (opcode: string) => {
    if (opcode === COMPILE_BLOCK_OPCODE) return false
    if (CORE_BLOCK_PREFIXES.has(extensionIdOf(opcode))) return false
    const owner = extensionOpcodeOwner.get(opcode)
    if (owner) return !isKylinExtension(owner)
    const id = extensionIdOf(opcode)
    if (!id || isKylinExtension(id)) return false
    return loadedExtensionIds.has(id)
  }

  const scriptInfos = new Map<string, ScriptInfo>()
  const collectScript = (sprite: VM.Sprite, topBlockId: string) => {
    const { blockIds, calls, opcodes } = walkScript(sprite.blocks, topBlockId)
    const extensionIds = new Set<string>()
    let thirdParty = false
    for (const opcode of opcodes) {
      if (!isExtensionOpcode(opcode)) continue
      const owner = extensionOpcodeOwner.get(opcode) || extensionIdOf(opcode)
      if (owner && isBuiltinExtension(owner)) continue
      thirdParty = true
      if (owner) extensionIds.add(owner)
    }
    for (const proccode of calls) {
      if (!Obfuscator.isAddonBlock(runtime, proccode)) continue
      thirdParty = true
      extensionIds.add(`addon:${proccode}`)
    }
    scriptInfos.set(topBlockId, {
      topBlockId,
      sprite,
      thirdParty,
      calls,
      blockIds,
      extensionIds: Array.from(extensionIds)
    })
  }

  const definitionKeys: Record<string, Record<string, string>> = {}
  for (const sprite of sprites) {
    const table: Record<string, string> = {}
    for (const block of Object.values(sprite.blocks._blocks)) {
      if (block.opcode === 'procedures_prototype' && block.mutation) {
        const proccode = String(block.mutation.proccode)
        if (!(proccode in table)) table[proccode] = block.parent as string
      }
    }
    definitionKeys[sprite.name] = table
  }
  const resolveDefinition = (spriteName: string, proccode: string) => {
    const own = definitionKeys[spriteName]
    if (own && proccode in own) return own[proccode]
    for (const name of Object.keys(definitionKeys)) {
      const table = definitionKeys[name]
      if (proccode in table) return table[proccode]
    }
    return null
  }

  const interpreted = new Set<string>()

  const computeInterpretedScripts = () => {
    for (const sprite of sprites) {
      const cache = (sprite.blocks as unknown as Cacheable)._cache
      for (const [hatId, result] of Object.entries(cache.compiledScripts || {})) {
        if (!result) continue
        collectScript(sprite, hatId)
        if (!result.success) {
          interpreted.add(hatId)
        }
      }
    }

    const parent = new Map<string, string>()
    const find = (id: string): string => {
      let root = id
      while (parent.get(root) && parent.get(root) !== root) {
        root = parent.get(root) as string
      }
      let cursor = id
      while (cursor !== root) {
        const next = parent.get(cursor) as string
        parent.set(cursor, root)
        cursor = next
      }
      return root
    }
    const union = (a: string, b: string) => {
      if (!scriptInfos.has(a) || !scriptInfos.has(b)) return
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent.set(ra, rb)
    }
    for (const info of scriptInfos.values()) {
      if (!parent.has(info.topBlockId)) parent.set(info.topBlockId, info.topBlockId)
      for (const proccode of info.calls) {
        const target = resolveDefinition(info.sprite.name, proccode)
        if (target) union(info.topBlockId, target)
      }
    }
    const dirtyRoots = new Set<string>()
    for (const info of scriptInfos.values()) {
      if (info.thirdParty || interpreted.has(info.topBlockId)) {
        dirtyRoots.add(find(info.topBlockId))
      }
    }
    if (skipExtensionScripts && dirtyRoots.size > 0) {
      for (const info of scriptInfos.values()) {
        if (dirtyRoots.has(find(info.topBlockId))) interpreted.add(info.topBlockId)
      }
    }
  }

  const extensionBlocks: Record<string, VM.Block> = {}
  if (loadedExtensionIds.size > 0) {
    for (const extension of loadedExtensionIds) {
      if (isKylinExtension(extension)) continue
      if (isBuiltinExtension(extension)) continue
      let opcode: string | null = null
      for (const sprite of sprites) {
        for (const block of Object.values(sprite.blocks._blocks)) {
          if (
            block.opcode === COMPILE_BLOCK_OPCODE ||
            block.opcode.startsWith('kylinRuntime_')
          ) {
            continue
          }
          const owner =
            extensionOpcodeOwner.get(block.opcode) || extensionIdOf(block.opcode)
          if (owner === extension) {
            opcode = block.opcode
            break
          }
        }
        if (opcode !== null) break
      }
      if (opcode !== null) {
        console.log(`🔒 Adding extension '${extension}' as dependency`)
        const id = uid()
        extensionBlocks[id] = {
          id,
          opcode,
          next: null,
          parent: null,
          inputs: {},
          fields: {},
          mutation: null,
          shadow: true,
          topLevel: true
        }
      } else {
        console.log(
          `❌ Failed to add extension '${extension}' as dependency: skipping`
        )
      }
    }
  }

  ensureCompiler(runtime)
  console.log('🤖 Compiling the project')
  runtime.precompile?.()

  computeInterpretedScripts()

  console.groupCollapsed('🛠️ Rebuilding the project with compiled code')

  let spriteNumber = 0
  for (const sprite of sprites) {
    console.groupCollapsed(`👾 Working in sprite ${++spriteNumber}`)
    let hasBlock = false
    let yIndex = 0
    let xIndex = 0
    const newBlocks: Record<string, VM.Block> = {}
    const cache = (sprite.blocks as unknown as Cacheable)._cache

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

    for (const [hatId, compiledResult] of Object.entries(
      cache.compiledScripts || {}
    )) {
      if (!compiledResult) continue
      if (!compiledResult.success || interpreted.has(hatId)) {
        const info = scriptInfos.get(hatId)
        const ids = info ? info.blockIds : walkScript(sprite.blocks, hatId).blockIds
        for (const id of ids) {
          if (newBlocks[id]) continue
          const original = sprite.blocks.getBlock(id)
          if (original) newBlocks[id] = structuredClone(original)
        }
        continue
      }
      {
        // 拷贝 hat
        const hat = (newBlocks[hatId] = structuredClone(
          sprite.blocks.getBlock(hatId)!
        ))
        if ((hat as any).x !== undefined && (hat as any).y !== undefined) {
          if (yIndex > 5) {
            yIndex = 0
            xIndex++
          }
          ;(hat as any).x = xIndex * xOffset
          ;(hat as any).y = yIndex * yOffset
          yIndex++
        }
        if (hat.next) {
          hasBlock = true
          newBlocks[hat.next] = {
            id: hat.next,
            opcode: COMPILE_BLOCK_OPCODE,
            next: null,
            parent: hatId,
            inputs: {},
            mutation: null,
            fields: {
              code: {
                id: null,
                name: 'code',
                value: String(
                  nextCompiledCode(
                    await obfuscateCode(
                      compiledResult.value.startingFunction.toString()
                    )
                  )
                )
              }
            } as any,
            shadow: hat.shadow,
            topLevel: false
          }
          console.log(`🖋️ Rebuilding hat ${hatId}`)
        }
      }
    }

    for (const block of Object.values(sprite.blocks._blocks)) {
      if (!block || block.opcode !== 'procedures_definition') continue
      if (!newBlocks[block.id]) newBlocks[block.id] = structuredClone(block)
      copyProcedurePrototype(block, sprite.blocks, newBlocks)
    }

    for (const procedureInfo of Object.values(
      cache.compiledProcedures || {}
    )) {
      if (!procedureInfo || !procedureInfo.cachedCompileResult) continue
      if (interpreted.has(procedureInfo.topBlockId)) continue
      const originalDefinition = sprite.blocks.getBlock(
        procedureInfo.topBlockId
      )
      if (!originalDefinition) continue
      const definition = (newBlocks[procedureInfo.topBlockId] =
        structuredClone(originalDefinition))
      if (
        (definition as any).x !== undefined &&
        (definition as any).y !== undefined
      ) {
        if (yIndex > 5) {
          yIndex = 0
          xIndex++
        }
        ;(definition as any).x = xIndex * xOffset
        ;(definition as any).y = yIndex * yOffset
        yIndex++
      }
      copyProcedurePrototype(definition, sprite.blocks, newBlocks)
      if (definition.next) {
        hasBlock = true
        console.log(`🖋️ Rebuilding procedure ${procedureInfo.topBlockId}`)
        newBlocks[definition.next] = {
          id: definition.next,
          opcode: COMPILE_BLOCK_OPCODE,
          next: null,
          parent: procedureInfo.topBlockId,
          inputs: {},
          mutation: null,
          fields: {
            code: {
              id: null,
              name: 'code',
              value: String(
                nextCompiledCode(
                  await obfuscateCode(
                    procedureInfo.cachedCompileResult.toString()
                  )
                )
              )
            }
          } as any,
          shadow: definition.shadow,
          topLevel: false
        }
      }
    }

    for (const block of Object.values(sprite.blocks._blocks)) {
      if (!block || block.parent) continue
      if (!runtime.getIsHat(block.opcode)) continue
      if (!newBlocks[block.id]) {
        problems.push({
          sprite: sprite.name || 'Sprite',
          detail: `脚本 ${block.id}(${block.opcode}) 没有被编译，也没有被保留`
        })
      }
    }

    verifyBlocks(sprite.name || 'Sprite', newBlocks, problems)

    ;(sprite.blocks as any)._blocks = newBlocks
    ;(sprite.blocks as any)._scripts = Object.keys(newBlocks).filter(
      id => newBlocks[id] && !newBlocks[id].parent
    )
    sprite.blocks.resetCache()
    if (!hasBlock) console.log('ℹ️ Nothing to do in this sprite')
    console.groupEnd()
  }

  Object.assign((stageSprite.blocks as any)._blocks, extensionBlocks)
  ;(stageSprite.blocks as any)._scripts = Object.keys(
    (stageSprite.blocks as any)._blocks
  ).filter(id => (stageSprite.blocks as any)._blocks[id] && !(stageSprite.blocks as any)._blocks[id].parent)
  stageSprite.blocks.resetCache()
  console.groupEnd()

  if (problems.length > 0) {
    console.error('❌ Kylin: 重建后的积木结构不完整', problems)
    const preview = problems
      .slice(0, 10)
      .map(p => `· ${p.sprite}: ${p.detail}`)
      .join('\n')
    throw new Error(
      `重建后的积木结构不完整（${problems.length} 处），已中止以免作品被改坏：\n${preview}`
    )
  }

  return { sourceMap: compiledCode, interpreted: Array.from(interpreted) }
}
