
declare namespace VM {
  interface Block {
    id: string
    opcode: string
    next: string | null
    parent: string | null
    inputs: Record<string, any>
    fields: Record<string, any>
    mutation: any
    shadow: boolean
    topLevel: boolean
    x?: number
    y?: number
    [key: string]: any
  }

  interface Blocks {
    _blocks: Record<string, Block>
    _cache: {
      compiledScripts: Record<string, { success: boolean; value: any }>
      compiledProcedures: Record<string, any>
      [key: string]: any
    }
    getBlock(id: string): Block | undefined
    deleteBlock(id: string): void
    resetCache(recursive?: boolean): void
    getScripts(): string[]
    [key: string]: any
  }

  interface Variable {
    id: string
    name: string
    value: any
    isCloud?: boolean
    type?: string
    [key: string]: any
  }

  interface Comment {
    id: string
    text: string
    [key: string]: any
  }

  interface Target {
    id: string
    isStage: boolean
    isOriginal: boolean
    sprite: Sprite
    blocks: Blocks
    variables: Record<string, Variable>
    comments: Record<string, Comment>
    getName(): string
    [key: string]: any
  }

  interface Sprite {
    name: string
    blocks: Blocks
    clones: Target[]
    [key: string]: any
  }

  interface CompilerOptions {
    enabled: boolean
    warpTimer: boolean
    [key: string]: any
  }

  interface Runtime {
    targets: Target[]
    compilerOptions: CompilerOptions
    extensionManager: any
    gandi?: any
    ccwAPI?: any
    _step: () => void
    _primitives: Record<string, any>
    compilerRegisterExtension?: (id: string, extension: any) => void
    precompile?: () => void
    resetAllCaches?: () => void
    setCompilerOptions?: (options: Partial<CompilerOptions>) => void
    getTargetForStage(): Target
    getIsHat(opcode: string): boolean
    on(event: string, handler: (...args: any[]) => void): void
    off(event: string, handler: (...args: any[]) => void): void
    [key: string]: any
  }

  interface VirtualMachine {
    runtime: Runtime
    exports: any
    extensionManager: any
    saveProjectSb3(type?: string): Promise<Blob>
    loadProject(input: ArrayBuffer | string | object): Promise<void>
    [key: string]: any
  }
}

interface MessageObject {
  id?: string
  default: string
  description?: string
}

type Message = string | MessageObject
