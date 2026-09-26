import { minify } from 'terser'
import l10n from './l10n'
import { kylinRuntime } from './runtime'

export const EXTENSION_ID = 'KylinGandi'
export const RUNTIME_ID = 'kylinRuntime'

export type Translator = ((message: Message) => string) & {
  setup?: (translations: Record<string, Record<string, string>>) => void
}

function fallbackTranslate(message: Message): string {
  return typeof message === 'string' ? message : message.default
}

export function makeTranslator(Scratch: any, runtime: any): Translator {
  const scratchTranslate =
    Scratch && typeof Scratch.translate === 'function' ? Scratch.translate : null

  if (scratchTranslate && typeof scratchTranslate.setup === 'function') {
    try {
      scratchTranslate.setup(l10n)
    } catch (e) {
      console.warn('Kylin: setup translations failed', e)
    }
    const t = ((message: Message) => {
      try {
        return scratchTranslate(message)
      } catch (e) {
        return fallbackTranslate(message)
      }
    }) as Translator
    t.setup = scratchTranslate.setup.bind(scratchTranslate)
    return t
  }

  const formatMessage =
    runtime && typeof runtime.getFormatMessage === 'function'
      ? runtime.getFormatMessage(l10n)
      : null

  if (typeof formatMessage === 'function') {
    const t = ((message: Message) => {
      if (typeof message === 'string') return message
      try {
        return formatMessage(message)
      } catch (e) {
        return fallbackTranslate(message)
      }
    }) as Translator
    if (typeof formatMessage.setup === 'function') {
      t.setup = formatMessage.setup.bind(formatMessage)
    }
    return t
  }

  return fallbackTranslate as Translator
}

export function resolveVM(runtime: any): any {
  const candidates: any[] = []
  const push = (v: any) => {
    if (v && candidates.indexOf(v) < 0) candidates.push(v)
  }

  try {
    push(runtime && runtime.extensionManager && runtime.extensionManager.vm)
  } catch (e) {
  }
  try {
    const scratch: any = (globalThis as any).Scratch
    push(scratch && scratch.vm)
  } catch (e) {
  }
  try {
    const api = runtime && runtime.ccwAPI
    if (api && typeof api.getOpenVM === 'function') push(api.getOpenVM())
  } catch (e) {
  }

  for (const c of candidates) {
    if (c && typeof c.saveProjectSb3 === 'function' && typeof c.loadProject === 'function') {
      return c
    }
  }
  for (const c of candidates) {
    if (c && typeof c.loadProject === 'function') return c
  }
  return null
}

export function idle(): Promise<void> {
  return new Promise<void>(resolve => {
    const g: any = globalThis as any
    if (typeof g.requestIdleCallback === 'function') {
      g.requestIdleCallback(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}

export function loadedExtensionsMap(
  extensionManager: any
): Map<string, string> | null {
  const raw = extensionManager && extensionManager._loadedExtensions
  const map = raw && raw.value instanceof Map ? raw.value : raw
  return map && typeof map.keys === 'function' ? map : null
}

export async function refreshPalette(
  runtime: any,
  extensionIds: string[] = [EXTENSION_ID, RUNTIME_ID]
): Promise<void> {
  const em = runtime && runtime.extensionManager
  if (!em || typeof em.refreshBlocks !== 'function') return
  const loaded = loadedExtensionsMap(em)
  const serviceNames: string[] = []
  for (const id of extensionIds) {
    const name = loaded && typeof loaded.get === 'function' ? loaded.get(id) : null
    if (typeof name === 'string' && name) serviceNames.push(name)
  }
  if (serviceNames.length === 0) {
    console.warn(
      'Kylin: 找不到自己的扩展服务名，跳过面板刷新（避免误刷其它扩展）。按钮文字可能不是最新的。'
    )
    return
  }
  try {
    await Promise.all(serviceNames.map(name => em.refreshBlocks(name)))
  } catch (e) {
    console.warn('Kylin: refreshBlocks failed', e)
  }
}

export function button(text: string, method: string, handler: () => void) {
  return {
    blockType: 'button',
    text,
    func: method,
    onClick: handler
  }
}

export function label(text: string) {
  return {
    blockType: 'label',
    text
  }
}

export const separator = '---'

export async function buildRuntimeSource(
  sourceMap: string[],
  version: string
): Promise<string> {
  const banner =
    '// Kylin Runtime —— 本作品已被 Kylin 混淆，需要允许该扩展以非沙盒方式运行。\n'
  const expression = `(${kylinRuntime.toString()})(Scratch, ${JSON.stringify(
    version
  )}, ${JSON.stringify(sourceMap)})`
  const raw = banner + expression
  try {
    const result = await minify(raw, { compress: true })
    return result.code ?? raw
  } catch (e) {
    console.warn('Kylin: 压缩运行时代码失败，改用未压缩版本。', e)
    return raw
  }
}

interface RuntimeShim {
  scratch: any
  getInstance: () => any
}

export function createRuntimeShim(
  vm: any,
  runtime: any,
  translate: Translator
): RuntimeShim {
  let instance: any = null
  const translateShim: any = (message: Message) => translate(message)
  translateShim.setup = () => {}
  const scratch = {
    extensions: {
      unsandboxed: true,
      register: (extension: any) => {
        instance = extension
      }
    },
    vm,
    runtime,
    renderer: runtime ? runtime.renderer : null,
    translate: translateShim
  }
  return {
    scratch,
    getInstance: () => instance
  }
}

const EXTENSION_ASSET_NAME = 'Extension'

const KYLIN_ASSET_ID = 'kylin_runtime_extension'

function findForeignExtensionAsset(gandi: any): any | null {
  if (!gandi || typeof gandi.getExtensionAssets !== 'function') return null
  const assets = gandi.getExtensionAssets() || []
  for (const asset of assets) {
    if (asset && asset.id !== KYLIN_ASSET_ID) return asset
  }
  return null
}

export interface RuntimeAssetSupport {
  ok: boolean
  reason?: string
}

export function checkRuntimeAssetSupport(runtime: any): RuntimeAssetSupport {
  if (!runtime) return { ok: false, reason: 'runtime 不可用' }
  const extensionManager = runtime.extensionManager
  if (!extensionManager || typeof extensionManager.addCustomExtensionInfo !== 'function') {
    return { ok: false, reason: '找不到 Gandi 的 extensionManager' }
  }
  const storage = runtime.storage
  if (!storage || typeof storage.createAsset !== 'function') {
    return { ok: false, reason: 'runtime.storage.createAsset 不可用' }
  }
  if (typeof storage.store !== 'function') {
    return { ok: false, reason: 'runtime.storage.store 不可用（无法上传资源）' }
  }
  if (!storage.AssetType || !storage.AssetType.Extension) {
    return { ok: false, reason: '当前 storage 不支持 AssetType.Extension' }
  }
  if (typeof storage.projectAssetCDNHost !== 'string' || !storage.projectAssetCDNHost) {
    return { ok: false, reason: 'storage.projectAssetCDNHost 不可用' }
  }
  const gandi = runtime.gandi
  if (!gandi || typeof gandi.addAsset !== 'function' || typeof gandi.addWildExtension !== 'function') {
    return { ok: false, reason: 'runtime.gandi 不可用' }
  }
  if (findForeignExtensionAsset(gandi)) {
    return {
      ok: false,
      reason:
        '作品里已经有名为 “Extension” 的资源了（Gandi 一个作品只能有一个），Kylin 不会去动它'
    }
  }
  return { ok: true }
}

export async function createGandiExtensionAsset(
  runtime: any,
  code: string
): Promise<{ url: string; md5: string; entry: any } | null> {
  const storage = runtime && runtime.storage
  const gandi = runtime && runtime.gandi
  if (!storage || !gandi || typeof gandi.addAsset !== 'function') return null
  if (typeof storage.createAsset !== 'function') return null

  const type = storage.AssetType && storage.AssetType.Extension
  if (!type || !type.runtimeFormat) return null

  if (findForeignExtensionAsset(gandi)) {
    console.warn('Kylin: 作品里已经有别的 “Extension” 资源了，不去动它。')
    return null
  }

  const dataFormat = type.runtimeFormat
  const bytes = new TextEncoder().encode(code)
  const asset = storage.createAsset(type, dataFormat, bytes, null, true)
  if (!asset || !asset.assetId) return null
  const md5 = `${asset.assetId}.${dataFormat}`

  const uploadResult = await storage.store(type, dataFormat, bytes, asset.assetId)
  if (!uploadResult || uploadResult.status !== 'ok') {
    console.warn('Kylin: 运行时资源上传失败', uploadResult)
    return null
  }
  const host = storage.projectAssetCDNHost
  if (typeof host !== 'string' || !host) return null

  try {
    const stale =
      typeof gandi.getExtensionAssets === 'function'
        ? gandi.getExtensionAssets().filter((a: any) => a && a.id === KYLIN_ASSET_ID)
        : []
    for (const old of stale) {
      if (typeof runtime.deleteGandiAssetById === 'function') {
        runtime.deleteGandiAssetById(old.id)
      }
    }
  } catch (e) {
    console.warn('Kylin: 清理旧的运行时资源失败', e)
  }

  const entry = {
    name: EXTENSION_ASSET_NAME,
    dataFormat,
    asset,
    assetType: type,
    id: KYLIN_ASSET_ID,
    assetId: asset.assetId,
    md5
  }
  gandi.addAsset(entry)

  return { url: `${host}/${md5}`, md5, entry }
}

export interface InstallRuntimeOptions {
  runtime: any
  vm: any
  sourceMap: string[]
  version: string
  url: string
  translate: Translator
}

export interface InstallRuntimeResult {
  url: string
}

export async function installRuntime(
  options: InstallRuntimeOptions
): Promise<InstallRuntimeResult | null> {
  const { runtime, vm, sourceMap, version, url, translate } = options
  if (!runtime || !vm) return null

  const shim = createRuntimeShim(vm, runtime, translate)
  await kylinRuntime(shim.scratch, version, sourceMap)
  const instance = shim.getInstance()

  const extensionManager: any = runtime.extensionManager
  if (!extensionManager) {
    console.warn('Kylin: 找不到 extensionManager，运行时不会被内嵌进作品。')
    return { url }
  }

  try {
    extensionManager.addCustomExtensionInfo(
      {
        info: {
          name: '🛠️ Kylin Runtime',
          description:
            'Kylin 混淆作品的运行时。打开本作品时必须允许该扩展以非沙盒方式运行。',
          extensionId: RUNTIME_ID,
          featured: false,
          disabled: false,
          collaboratorList: [
            {
              collaborator: 'FurryR',
              collaboratorURL: 'https://github.com/FurryR'
            }
          ]
        },
        l10n: {
          'zh-cn': {
            'kylinRuntime.name': '🛠️ Kylin Runtime',
            'kylinRuntime.description':
              'Kylin 混淆作品的运行时。打开本作品时必须允许该扩展以非沙盒方式运行。'
          },
          en: {
            'kylinRuntime.name': '🛠️ Kylin Runtime',
            'kylinRuntime.description':
              'Runtime of a Kylin-obfuscated project. It must be allowed to run unsandboxed.'
          }
        },
        Extension: instance ? instance.constructor : undefined
      },
      url
    )
  } catch (e) {
    console.warn(
      'Kylin: 登记运行时扩展 URL 失败，保存出来的作品可能无法自动加载运行时。',
      e
    )
  }

  try {
    if (runtime.gandi && typeof runtime.gandi.addWildExtension === 'function') {
      runtime.gandi.addWildExtension({ id: RUNTIME_ID, url })
    }
  } catch (e) {
  }

  let loaded = false
  try {
    loaded =
      typeof extensionManager.isExtensionLoaded === 'function' &&
      extensionManager.isExtensionLoaded(RUNTIME_ID)
  } catch (e) {
  }
  if (!loaded && instance) {
    try {
      extensionManager.registerExtension(RUNTIME_ID, instance)
    } catch (e) {
      console.warn('Kylin: 注册运行时扩展失败', e)
    }
  }


  return { url }
}
