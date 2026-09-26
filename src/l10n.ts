export default {
  'zh-cn': {
    'kylin.name': '🐉 Kylin (Gandi)',
    'kylin.hint.about': '关于 Kylin',
    'kylin.hint.obfuscated': '源代码混淆',
    'kylin.hint.precompiled': '预编译',
    'kylin.hint.comment': '注释',
    'kylin.hint.loading': '稍安勿躁...',
    'kylin.hint.protected': '作品已被保护',
    'kylin.hint.extInterp': '第三方扩展脚本',
    'kylin.extInterp.keep': '解释执行',
    'kylin.extInterp.compile': '一并编译',
    'kylin.error.noRuntimeAsset':
      '由于修改者水平问题尚未在Gandi实现该功能，预编译无法进行。\n请关闭「预编译」，只使用「源代码混淆」',
    'kylin.error.runtimeUploadFailed':
      '运行时资源上传失败（storage.store 没有返回 ok）。请检查登录状态与网络，或关闭「预编译」。',
    'kylin.alert.restored': '混淆失败，作品已还原到混淆前的状态。',
    'kylin.button.comments': '注释',
    'kylin.button.uuid': 'UUID (高级)',
    'kylin.button.proceed': '混淆',
    'kylin.popup.comment': '请输入作品的注释。',
    'kylin.popup.uuid': '请输入作品的 v4 UUID。',
    'kylin.popup.uuid.invalid': '无效的 v4 UUID。',
    'kylin.error.nonScratch': 'Kylin 必须在 Scratch / Gandi IDE 环境中运行。',
    'kylin.error.sandbox': 'Kylin 不支持沙盒模式，请以“非沙盒”方式加载本扩展。',
    'kylin.error.noCompiler':
      '当前环境没有可用的编译器（runtime.precompile 不存在），无法使用预编译功能。',
    'kylin.error.noVM': '无法获取 Gandi 虚拟机的引用，混淆已中止。',
    'kylin.error.noEditor':
      '这是混淆后的作品，请在编辑器中加载本扩展以查看作品信息。',
    'kylin.confirm.compileFail':
      '以下脚本无法被编译，它们会保持「解释执行」（不会被删除，功能不受影响）：',
    'kylin.confirm.compileFailTail': '是否继续？',
    'kylin.confirm.irreversible': '⚠️混淆代码是不可逆的，请确保作品源码已备份⚠️',
    'kylin.confirm.danglingRefs':
      '自检发现混淆后有积木引用了不存在的东西，这些脚本很可能会失效：',
    'kylin.confirm.restoreSnapshot': '是否还原到混淆前的作品？（建议还原）',
    'kylin.alert.about':
      'Kylin 是 Scratch / TurboWarp 生态的混淆器，本版本针对 Gandi IDE (ccw.site) 做了适配。\n\n' +
      '⚠️混淆前请“保存到电脑”备份作品，混淆是不可逆的⚠️',
    'kylinRuntime.name': '🛠️ Kylin Runtime',
    'kylinRuntime.description':
      'Kylin 混淆作品的运行时。加载本作品时必须允许该扩展以非沙盒方式运行。',
    'kylinRuntime.about': '关于 Kylin',
    'kylinRuntime.compile': '(已编译)'
  },
  en: {
    'kylin.name': '🐉 Kylin (Gandi)',
    'kylin.hint.about': 'About Kylin',
    'kylin.hint.obfuscated': 'Obfuscation',
    'kylin.hint.precompiled': 'Precompilation',
    'kylin.hint.comment': 'Comment',
    'kylin.hint.loading': 'Loading...',
    'kylin.hint.protected': 'Project protected',
    'kylin.hint.extInterp': 'Third-party ext blocks',
    'kylin.extInterp.keep': 'Interpret',
    'kylin.extInterp.compile': 'Compile',
    'kylin.error.noRuntimeAsset':
      'This environment cannot carry the runtime as a Gandi "Extension" project asset, so precompilation is unavailable.\nTurn off "Precompilation" and use "Obfuscation" only.',
    'kylin.error.runtimeUploadFailed':
      'Failed to upload the runtime asset (storage.store did not return ok). Check your session/network, or turn off "Precompilation".',
    'kylin.alert.restored':
      'The project has been restored to its pre-obfuscation state.',
    'kylin.button.comments': 'Comments',
    'kylin.button.uuid': 'UUID (Advanced)',
    'kylin.button.proceed': 'Proceed',
    'kylin.popup.comment': "Please input the project's comment.",
    'kylin.popup.uuid': "Please input the project's v4 UUID.",
    'kylin.popup.uuid.invalid': 'Invalid v4 UUID.',
    'kylin.error.nonScratch':
      'Kylin must be running inside Scratch / Gandi IDE.',
    'kylin.error.sandbox':
      'Sandboxed mode is not supported. Load this extension unsandboxed.',
    'kylin.error.noCompiler':
      'No compiler available (runtime.precompile is missing), precompilation is unavailable.',
    'kylin.error.noVM': 'Unable to reach the Gandi VM, aborting.',
    'kylin.error.noEditor':
      'This project has been obfuscated. Load the extension in the editor to inspect its metadata.',
    'kylin.confirm.compileFail':
      'The following scripts cannot be compiled and will be kept interpreted (not removed):',
    'kylin.confirm.compileFailTail': 'Continue?',
    'kylin.confirm.irreversible':
      '⚠️Obfuscation is irreversible. Make sure you have backed up your project source.⚠️',
    'kylin.confirm.danglingRefs':
      'Self-check found blocks referencing things that no longer exist. Those scripts will probably break:',
    'kylin.confirm.restoreSnapshot':
      'Restore the project to its pre-obfuscation state? (recommended)',
    'kylin.alert.about':
      'Kylin is an obfuscator for the Scratch / TurboWarp ecosystem; this build targets Gandi IDE (ccw.site).\n\n' +
      'Back up your project before obfuscating — it is irreversible.',
    'kylinRuntime.name': '🛠️ Kylin Runtime',
    'kylinRuntime.description':
      'Runtime of a Kylin-obfuscated project. It must be allowed to run unsandboxed.',
    'kylinRuntime.about': 'About Kylin',
    'kylinRuntime.compile': '(Compiled)'
  },
  ja: {
    'kylin.name': '🐉 Kylin (Gandi)',
    'kylin.hint.about': 'Kylin について',
    'kylin.hint.obfuscated': '難読化',
    'kylin.hint.precompiled': '事前コンパイル',
    'kylin.hint.comment': 'コメント',
    'kylin.hint.loading': '少々お待ちください。',
    'kylin.hint.protected': '保護されたプロジェクト',
    'kylin.hint.extInterp': 'サードパーティ拡張',
    'kylin.extInterp.keep': 'インタプリタ',
    'kylin.extInterp.compile': 'コンパイル',
    'kylin.error.noRuntimeAsset':
      'この環境ではランタイムを Gandi の “Extension” アセットとして登録できないため、事前コンパイルは使えません。\n「事前コンパイル」を切り、「難読化」のみを使用してください。',
    'kylin.error.runtimeUploadFailed':
      'ランタイムアセットのアップロードに失敗しました（storage.store が ok を返しませんでした）。',
    'kylin.alert.restored': '難読化に失敗しました。作品を元の状態に戻しました。',
    'kylin.button.comments': 'コメント',
    'kylin.button.uuid': 'UUID (上級者向け)',
    'kylin.button.proceed': '難読化する',
    'kylin.popup.comment': 'プロジェクトのコメントを入力してください。',
    'kylin.popup.uuid': 'プロジェクトの v4 UUID を入力してください。',
    'kylin.popup.uuid.invalid': '無効な v4 UUID です。',
    'kylin.error.nonScratch':
      'Kylin は Scratch / Gandi IDE 上で実行する必要があります。',
    'kylin.error.sandbox':
      'サンドボックスモードは対応していません。非サンドボックスで読み込んでください。',
    'kylin.error.noCompiler':
      'コンパイラーが見つかりません（runtime.precompile がありません）。',
    'kylin.error.noVM': 'Gandi の仮想マシンを取得できませんでした。',
    'kylin.error.noEditor':
      'この作品はすでに難読化されています。メタデータを見るにはエディターで拡張を読み込んでください。',
    'kylin.confirm.compileFail':
      '以下のスクリプトはコンパイルできません。インタプリタ実行としてそのまま残します（削除されません）：',
    'kylin.confirm.compileFailTail': '続行しますか？',
    'kylin.confirm.irreversible':
      '⚠️難読化は元に戻せません。作品のソースを必ずバックアップしてください。⚠️',
    'kylin.confirm.danglingRefs':
      '自己チェックで、存在しないものを参照しているブロックが見つかりました。これらのスクリプトは動作しなくなる可能性があります：',
    'kylin.confirm.restoreSnapshot':
      '難読化前の状態に戻しますか？（推奨）',
    'kylin.alert.about':
      'Kylin は Scratch / TurboWarp 向けの難読化ツールです。このビルドは Gandi IDE (ccw.site) 向けに調整されています。\n\n難読化は元に戻せません。事前に作品を保存してください。',
    'kylinRuntime.name': '🛠️ Kylin Runtime',
    'kylinRuntime.description':
      'Kylin で難読化された作品のランタイムです。非サンドボックスでの実行が必要です。',
    'kylinRuntime.about': 'Kylin について',
    'kylinRuntime.compile': '(コンパイル済)'
  }
}
