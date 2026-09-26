export async function kylinRuntime(
  Scratch: any,
  version: string,
  sourceMap: string[]
): Promise<void> {
  if (!Scratch || (Scratch.extensions && Scratch.extensions.unsandboxed === false)) {
    throw new Error('Kylin Runtime 需要以非沙盒方式运行。')
  }

  const vm = Scratch.vm
  const runtime = vm && vm.runtime
  if (!runtime) {
    throw new Error('Kylin Runtime: 无法获取 runtime。')
  }
  if (typeof runtime.precompile !== 'function') {
    throw new Error('Kylin Runtime: 当前环境没有可用的编译器。')
  }

  runtime._kylinSourceMap = sourceMap

  const hasKylinBlocks = () => {
    const targets = runtime.targets || []
    for (let i = 0; i < targets.length; i++) {
      const blocks = targets[i] && targets[i].blocks && targets[i].blocks._blocks
      if (!blocks) continue
      for (const id in blocks) {
        if (blocks[id] && blocks[id].opcode === 'kylinRuntime_compile') {
          return true
        }
      }
    }
    return false
  }

  if (!runtime._kylinPatched) {
    runtime._kylinPatched = true

    const _setCompilerOptions = runtime.setCompilerOptions
    runtime.setCompilerOptions = function (options: any) {
      const next = Object.assign({}, options, { warpTimer: false })
      if (hasKylinBlocks()) {
        next.enabled = true
      }
      return _setCompilerOptions.call(this, next)
    }

    const { JSGenerator, IRGenerator } = vm.exports.i_will_not_ask_for_help_when_these_break()

    const originalDescendStack = JSGenerator.prototype.descendStack
    const originalCreateScriptFactory = JSGenerator.prototype.createScriptFactory
    const originalGenerate = IRGenerator.prototype.generate

    const isKylinEntry = (entry: any) => !!(entry && entry.blocks)

    const isKylinTopBlock = (blocks: any, topBlockId: any) => {
      if (!blocks || !topBlockId) return false
      const top = blocks.getBlock(topBlockId)
      const nextId = top && top.next
      const next = nextId ? blocks.getBlock(nextId) : null
      return !!next && next.opcode === 'kylinRuntime_compile'
    }

    JSGenerator.prototype.descendStack = function (stack: any, frame: any) {
      if (isKylinEntry(this.script)) return
      return originalDescendStack.call(this, stack, frame)
    }

    IRGenerator.prototype.generate = function () {
      const thread = this.thread || {}
      const blocks = this.blocks
      const topBlockId = thread.topBlock

      if (!isKylinTopBlock(blocks, topBlockId)) {
        return originalGenerate.call(this)
      }

      const registered: any = {}
      const register = (proccode: string, definitionId: string, definitionBlocks: any) => {
        if (!proccode || registered[proccode]) return
        registered[proccode] = true
        const info = {
          topBlockId: definitionId,
          isWarp: false,
          isProcedure: true,
          warpTimer: false,
          blocks: definitionBlocks
        }
        this.procedures['W' + proccode] = info
        this.procedures['Z' + proccode] = info
      }

      const registerAllIn = (container: any) => {
        if (!container || !container._blocks) return
        for (const id in container._blocks) {
          const block = container._blocks[id]
          if (!block || block.opcode !== 'procedures_prototype' || !block.mutation) {
            continue
          }
          const definition = container.getBlock(block.parent)
          if (!definition) continue
          const bodyId = definition.next
          const body = bodyId ? container.getBlock(bodyId) : null
          if (!body || body.opcode !== 'kylinRuntime_compile') continue
          register('' + block.mutation.proccode, block.parent, container)
        }
      }

      registerAllIn(blocks)

      try {
        const stage =
          typeof runtime.getTargetForStage === 'function'
            ? runtime.getTargetForStage()
            : null
        if (stage && stage.blocks && stage.blocks !== blocks) {
          registerAllIn(stage.blocks)
        }
      } catch (e) {
        console.warn('Kylin Runtime: 登记全局自制积木失败', e)
      }

      return {
        entry: {
          topBlockId: topBlockId,
          isWarp: false,
          isProcedure: false,
          warpTimer: false,
          blocks: blocks
        },
        procedures: this.procedures
      }
    }

    JSGenerator.prototype.createScriptFactory = function () {
      const entry = this.script
      if (!isKylinEntry(entry)) {
        return originalCreateScriptFactory.call(this)
      }
      const blocks = entry.blocks
      const topBlock = blocks.getBlock(entry.topBlockId)
      const nextId = topBlock && topBlock.next
      const next = nextId ? blocks.getBlock(nextId) : null
      if (!next) {
        return '(function(){return function*(){retire();return;};})'
      }
      if (next.opcode === 'kylinRuntime_compile') {
        const table = runtime._kylinSourceMap || sourceMap
        const index = parseInt('' + next.fields.code.value, 10)
        const code = table[index]
        if (typeof code !== 'string') {
          throw new Error('Kylin Runtime: 缺少已编译的脚本 ' + index)
        }
        return '(' + code + ')'
      }
      throw new Error('Kylin Runtime: 预期之外的脚本结构')
    }

    try {
      runtime.on('PROJECT_LOADED', function () {
        if (hasKylinBlocks()) runtime.setCompilerOptions({ enabled: true })
      })
      runtime.on('targetsUpdate', function () {
        if (!runtime.compilerOptions.enabled && hasKylinBlocks()) {
          runtime.setCompilerOptions({ enabled: true })
        }
      })
    } catch (e) {
    }
  }

  try {
    if (typeof runtime.resetAllCaches === 'function') runtime.resetAllCaches()
  } catch (e) {
  }

  const translate: any =
    Scratch.translate ||
    function (message: any) {
      return typeof message === 'string' ? message : (message && message.default) || ''
    }

  if (typeof translate.setup === 'function') {
    try {
      translate.setup({
        'zh-cn': {
          'kylinRuntime.name': '🛠️ Kylin Runtime',
          'kylinRuntime.about': '关于 Kylin',
          'kylinRuntime.compile': '(已编译)'
        },
        ja: {
          'kylinRuntime.name': '🛠️ Kylin Runtime',
          'kylinRuntime.about': 'Kylin について',
          'kylinRuntime.compile': '(コンパイル済)'
        }
      })
    } catch (e) {
    }
  }

  console.groupCollapsed('🛠️ Kylin Runtime v' + version)
  console.log('Kylin is based on the TurboWarp compiler (Gandi build).')
  console.log('Kylin is distributed under the AGPL-3.0 license.')
  console.log('Copyright (c) 2024 FurryR, inspired by VeroFess')
  console.groupEnd()

  runtime.precompile()
  console.log('🔧 Precompiled code cache')

  class KylinRuntime {
    getInfo() {
      return {
        id: 'kylinRuntime',
        name: translate({
          id: 'kylinRuntime.name',
          default: '🛠️ Kylin Runtime v' + version,
          description: 'Kylin Runtime'
        }),
        color1: '#00ffda',
        color2: '#00b39a',
        blocks: [
          {
            blockType: 'button',
            text:
              '🔍 ' +
              translate({
                id: 'kylinRuntime.about',
                default: 'About Kylin',
                description: 'About'
              }),
            func: 'about',
            onClick: () => this.about()
          },
          {
            blockType: 'command',
            opcode: 'compile',
            text: translate({
              id: 'kylinRuntime.compile',
              default: '(Compiled)',
              description: 'Precompile'
            }),
            hideFromPalette: true
          }
        ]
      }
    }

    about() {
      const link = document.createElement('a')
      link.href = 'https://github.com/FurryR/kylin-extension'
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.click()
    }

    compile() {
      throw new Error('This block should never be executed.')
    }
  }

  Scratch.extensions.register(new KylinRuntime())
}
