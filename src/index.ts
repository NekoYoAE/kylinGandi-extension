import { version } from '../package.json'
import Obfuscator from './obfuscator'
import InvisibleUUID from './invisibleUUID'
import { compile, preflight, type PreflightResult } from './compile'
import { formatValidation, validateProject } from './validate'
import {
  EXTENSION_ID,
  buildRuntimeSource,
  button,
  checkRuntimeAssetSupport,
  createGandiExtensionAsset,
  idle,
  installRuntime,
  label,
  makeTranslator,
  refreshPalette,
  resolveVM,
  separator
} from './gandi'

;(async function (Scratch: any) {
  const UPSTREAM = 'https://github.com/FurryR/kylin-extension'

  if (
    !Scratch ||
    !Scratch.extensions ||
    typeof Scratch.extensions.register !== 'function'
  ) {
    throw new Error('Kylin must be running inside Scratch / Gandi IDE.')
  }

  const runtime: any = Scratch.runtime || (Scratch.vm && Scratch.vm.runtime)
  if (!runtime) {
    throw new Error('Kylin: runtime not found.')
  }

  const t = makeTranslator(Scratch, runtime)
  const tr = (key: string, fallback: string) =>
    t({ id: key, default: fallback, description: fallback })

  if (Scratch.extensions.unsandboxed === false) {
    alert(tr('kylin.error.sandbox', 'Sandboxed mode is not supported.'))
    throw new Error('Sandboxed mode is not supported')
  }

  console.groupCollapsed(`🛠️ Kylin (Gandi) v${version}`)
  console.log('Kylin is based on the TurboWarp compiler.')
  console.log('This build is adapted for Gandi IDE (ccw.site).')
  console.log('Kylin is distributed under the AGPL-3.0 license.')
  console.log('Copyright (c) 2024 FurryR, inspired by VeroFess')
  console.groupEnd()

  class KylinScratch {
    private enableCompile = true
    private enableObfuscate = true
    private skipExtensionScripts = true
    private compiling = false
    private inputComment?: string
    private inputUUID?: string
    private meta: {
      isKylin: boolean
      isObfuscated: boolean
      isCompiled: boolean
      uuid: string | null
      comment: string | null
    } = {
      isKylin: false,
      isObfuscated: false,
      isCompiled: false,
      uuid: null,
      comment: null
    }

    constructor() {
      const update = (isWorkspaceUpdate: boolean) => {
        try {
          this.meta = Obfuscator.fetchMeta(runtime.targets)
        } catch (e) {
          console.warn('Kylin: failed to read project metadata', e)
        }
        if (isWorkspaceUpdate) refreshPalette(runtime)
      }
      try {
        runtime.on('workspaceUpdate', () => update(true))
        runtime.on('PROJECT_LOADED', () => update(true))
      } catch (e) {
      }
      update(false)
    }

    getInfo() {
      const aboutButton = button(
        `🔍 ${tr('kylin.hint.about', 'About Kylin')}`,
        'about',
        () => this.about()
      )

      if (this.meta.isKylin && !this.compiling) {
        const blocks: any[] = [
          aboutButton,
          separator,
          label(
            `${this.meta.isObfuscated ? '✅' : '❌'} ${tr(
              'kylin.hint.obfuscated',
              'Obfuscation'
            )}`
          ),
          label(
            `${this.meta.isCompiled ? '✅' : '❌'} ${tr(
              'kylin.hint.precompiled',
              'Precompilation'
            )}`
          )
        ]
        if (this.meta.comment) {
          blocks.push(
            label(
              `📄 ${tr('kylin.hint.comment', 'Comment')}: ${this.meta.comment}`
            )
          )
        }
        blocks.push(label(`🔑 UUID: ${this.meta.uuid}`))
        return {
          id: EXTENSION_ID,
          name: tr('kylin.name', `🐉 Kylin (Gandi) v${version}`),
          color1: '#00ffda',
          color2: '#00b39a',
          blocks
        }
      }

      if (this.compiling) {
        return {
          id: EXTENSION_ID,
          name: tr('kylin.name', `🐉 Kylin (Gandi) v${version}`),
          color1: '#00ffda',
          color2: '#00b39a',
          blocks: [
            aboutButton,
            separator,
            label(`🐺 ${tr('kylin.hint.loading', 'Loading...')}`)
          ]
        }
      }

      return {
        id: EXTENSION_ID,
        name: tr('kylin.name', `🐉 Kylin (Gandi) v${version}`),
        color1: '#00ffda',
        color2: '#00b39a',
        blocks: [
          aboutButton,
          separator,
          button(
            `${this.enableObfuscate ? '✅' : '❌'} ${tr(
              'kylin.hint.obfuscated',
              'Obfuscation'
            )}`,
            'switchObfuscate',
            () => this.switchObfuscate()
          ),
          button(
            `${this.enableCompile ? '✅' : '❌'} ${tr(
              'kylin.hint.precompiled',
              'Precompilation'
            )}`,
            'switchPrecompile',
            () => this.switchPrecompile()
          ),
          button(
            `🧩 ${tr('kylin.hint.extInterp', 'Third-party ext blocks')}: ${tr(
              this.skipExtensionScripts
                ? 'kylin.extInterp.keep'
                : 'kylin.extInterp.compile',
              this.skipExtensionScripts ? 'Interpret' : 'Compile'
            )}`,
            'switchExtensionScripts',
            () => this.switchExtensionScripts()
          ),
          separator,
          button(
            `📄 ${tr('kylin.button.comments', 'Comments')}`,
            'comment',
            () => this.comment()
          ),
          button(
            `🔑 ${tr('kylin.button.uuid', 'UUID (Advanced)')}`,
            'uuid',
            () => this.uuid()
          ),
          separator,
          button(
            `🤖 ${tr('kylin.button.proceed', 'Proceed')}`,
            'start',
            () => void this.start()
          )
        ]
      }
    }

    about() {
      alert(
        tr(
          'kylin.alert.about',
          'Kylin is an obfuscator for the Scratch ecosystem; this build targets Gandi IDE.'
        ) + `\n\n${UPSTREAM}`
      )
    }

    switchObfuscate() {
      if (this.compiling) return
      this.enableObfuscate = !this.enableObfuscate
      refreshPalette(runtime)
    }

    switchPrecompile() {
      if (this.compiling) return
      this.enableCompile = !this.enableCompile
      refreshPalette(runtime)
    }

    switchExtensionScripts() {
      if (this.compiling) return
      this.skipExtensionScripts = !this.skipExtensionScripts
      refreshPalette(runtime)
    }

    comment() {
      this.inputComment =
        window.prompt(
          tr('kylin.popup.comment', "Please input the project's comment."),
          this.inputComment ?? ''
        ) ?? undefined
    }

    uuid() {
      const uuid = window.prompt(
        tr('kylin.popup.uuid', "Please input the project's v4 UUID."),
        this.inputUUID ?? ''
      )
      if (!uuid) return
      if (
        uuid.length !== 36 ||
        !Array.from(uuid.toLowerCase())
          .filter(x => x !== '-')
          .every(x => InvisibleUUID.hex.includes(x))
      ) {
        alert(tr('kylin.popup.uuid.invalid', 'Invalid v4 UUID.'))
        return
      }
      this.inputUUID = uuid.toLowerCase()
    }

    async start() {
      if (this.compiling) return
      // 不可逆操作，先让用户确认一次
      if (
        !window.confirm(
          tr(
            'kylin.confirm.irreversible',
            '⚠️混淆代码是不可逆的，请确保作品源码已备份⚠️'
          )
        )
      ) {
        return
      }
      this.compiling = true
      await refreshPalette(runtime)
      await idle()

      const vm = resolveVM(runtime)
      if (!vm) {
        alert(tr('kylin.error.noVM', 'Unable to reach the Gandi VM, aborting.'))
        this.compiling = false
        await refreshPalette(runtime)
        return
      }

      if (this.enableCompile && typeof runtime.precompile !== 'function') {
        alert(
          tr(
            'kylin.error.noCompiler',
            'No compiler available (runtime.precompile is missing).'
          )
        )
        this.compiling = false
        await refreshPalette(runtime)
        return
      }

      if (this.enableCompile) {
        const support = checkRuntimeAssetSupport(runtime)
        if (!support.ok) {
          alert(
            `${tr(
              'kylin.error.noRuntimeAsset',
              'This environment cannot carry the runtime as a Gandi project asset. Turn off "Precompilation" and use "Obfuscation" only.'
            )}\n\n${support.reason || ''}`
          )
          this.compiling = false
          await refreshPalette(runtime)
          return
        }
      }

      if (this.enableCompile) {
        let report: PreflightResult = { total: 0, failed: [] }
        try {
          report = preflight(runtime)
        } catch (e) {
          console.warn('Kylin: preflight failed', e)
        }
        if (report.failed.length > 0) {
          const lines = report.failed
            .slice(0, 8)
            .map(f => `· ${f.spriteName}: ${f.message}`)
            .join('\n')
          const more =
            report.failed.length > 8
              ? `\n… +${report.failed.length - 8}`
              : ''
          const ok = window.confirm(
            `${tr(
              'kylin.confirm.compileFail',
              'The following scripts cannot be compiled and will be kept interpreted (not removed):'
            )}\n\n${lines}${more}\n\n${tr(
              'kylin.confirm.compileFailTail',
              'Continue?'
            )}`
          )
          if (!ok) {
            this.compiling = false
            await refreshPalette(runtime)
            return
          }
        }
      }

      let snapshot: ArrayBuffer | null = null
      try {
        const original = await vm.saveProjectSb3()
        snapshot = await original.arrayBuffer()
      } catch (e) {
        console.warn('Kylin: 无法创建还原快照，出错时将无法自动还原作品。', e)
      }

      const _step = runtime._step
      runtime._step = function () {}

      const baselineIssues = new Set<string>()
      try {
        for (const issue of validateProject(runtime).issues) {
          baselineIssues.add(`${issue.sprite}|${issue.blockId}`)
        }
      } catch (e) {
        console.warn('Kylin: 基线自检失败', e)
      }

      let addedAsset: any = null
      try {
        if (this.enableObfuscate) Obfuscator.obfuscate(runtime)

        let sourceMap: string[] = []
        if (this.enableCompile) {
          const result = await compile(runtime, {
            skipExtensionScripts: this.skipExtensionScripts
          })
          sourceMap = result.sourceMap
        }

        let runtimeURL: string | null = null
        if (this.enableCompile) {
          console.log('🔽 Injecting Kylin Runtime')
          const source = await buildRuntimeSource(sourceMap, version)
          const asset = await createGandiExtensionAsset(runtime, source)
          if (!asset) {
            throw new Error(
              tr(
                'kylin.error.runtimeUploadFailed',
                'Failed to upload the runtime as a Gandi project asset.'
              )
            )
          }
          addedAsset = asset.entry
          runtimeURL = asset.url
        }

        Obfuscator.addMeta(runtime, {
          isObfuscated: this.enableObfuscate,
          isCompiled: this.enableCompile,
          comment: this.inputComment,
          uuid: this.inputUUID
        })

        if (runtimeURL) {
          await installRuntime({
            runtime,
            vm,
            sourceMap,
            version,
            url: runtimeURL,
            translate: t
          })
        }

        try {
          const validation = validateProject(runtime)
          const issues = validation.issues.filter(
            i => !baselineIssues.has(`${i.sprite}|${i.blockId}`)
          )
          const lines = formatValidation({ ...validation, issues })
          if (issues.length > 0) {
            for (const line of lines) console.warn(line)
            const restore = window.confirm(
              `${tr(
                'kylin.confirm.danglingRefs',
                'Self-check found dangling references. Some scripts may stop working.'
              )}\n\n${lines.slice(1, 9).join('\n')}\n\n${tr(
                'kylin.confirm.restoreSnapshot',
                'Restore the project to its pre-obfuscation state?'
              )}`
            )
            if (restore && snapshot) {
              await vm.loadProject(snapshot)
              alert(
                tr(
                  'kylin.alert.restored',
                  'The project has been restored to its pre-obfuscation state.'
                )
              )
              return
            }
          }
        } catch (e) {
          console.warn('Kylin: 自检失败', e)
        }

        console.log('📂 Repacking the project.')
        const blob = await vm.saveProjectSb3()
        const buffer = await blob.arrayBuffer()

        this.compiling = false
        await vm.loadProject(buffer)
        if (this.enableCompile) {
          runtime.setCompilerOptions({ enabled: true, warpTimer: false })
        }
      } catch (e: any) {
        console.error('Kylin: obfuscation failed', e)
        let restored = false
        try {
          if (addedAsset && typeof vm.deleteGandiAssetById === 'function') {
            vm.deleteGandiAssetById(addedAsset.id)
            addedAsset = null
          }
        } catch (e2) {
        }
        if (snapshot) {
          try {
            await vm.loadProject(snapshot)
            restored = true
          } catch (e2) {
            console.error('Kylin: 还原作品失败', e2)
          }
        }
        alert(
          `Kylin: ${(e && e.message) || e}` +
            (restored
              ? `\n\n${tr(
                  'kylin.alert.restored',
                  'The project has been restored to its pre-obfuscation state.'
                )}`
              : '')
        )
      } finally {
        runtime._step = _step
        this.compiling = false
        try {
          this.meta = Obfuscator.fetchMeta(runtime.targets)
        } catch (e) {
        }
        await refreshPalette(runtime)
      }
    }
  }

  Scratch.extensions.register(new KylinScratch())
  ;(globalThis as any).Kylin = { version, validateProject, formatValidation }
})((globalThis as any).Scratch)
