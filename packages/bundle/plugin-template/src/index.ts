/**
 * ─────────────────────────────────────────────────────────────────────────
 *  最小垂直插件模板 · host 半边（跑在 Node：CLI / headless / Web 服务端）
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 这是一份「照着抄就能用」的模板。一个 host 插件就是一个 cordis 插件，
 * 必须导出四样东西：name / inject / Config(schemastery schema) / apply(ctx, config)。
 *
 * 本模板演示了三件最常用的事：
 *   1. 用 defineTool + ValueSchemaSpec DSL 注册一个模型可调用工具 template_hello；
 *   2. 用 ctx.systemPrompt.section(...) 注入一段领域 persona 系统提示词；
 *   3. 说明权限集成（permission-rules）该怎么配——本包自己不做权限绕过。
 *
 * 复制本包后，把里面的「template / 模板」全部换成你的领域名即可。
 *
 * @module @deepseek-ai/dsh-plugin-template
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// 注意：这里只「导入类型」的服务（dsh-tools / dsh-system-prompt）不需要运行时 import，
// 它们在 cordis 里是按名注入的服务；真正用到的运行时值只有 defineTool。
import { defineTool } from '@deepseek-ai/dsh-tools'

/**
 * cordis 插件名。loader 启动 / 诊断时用，与 cordis.patch.yml 里的 id 对应。
 * 重命名包时一起改。
 */
export const name = 'plugin-template'

/**
 * 声明本插件依赖哪些 cordis 服务。
 *
 * 规则：apply() 里凡用到 ctx.xxx，这里就必须列上对应的服务名字符串；
 * 漏声明 → loader 启动时报「缺服务」。这里我们用到了：
 *   - 'tools'        ：工具注册表（ctx.tools.register）
 *   - 'systemPrompt' ：系统提示词注册表（ctx.systemPrompt.section）
 *
 * 注意：这里写的是「cordis 服务名」，不是 npm 包名。
 */
export const inject: readonly string[] = ['tools', 'systemPrompt']

/**
 * 插件配置形状（TypeScript 接口）。
 *
 * 约定：敏感配置（API key）只放「环境变量名」，绝不把明文密钥写进配置文件。
 * 这里演示一个无害的配置项：问候语前缀。
 */
export interface Config {
  /** 问候语前缀，默认「你好」。 */
  greetingPrefix?: string
}

/**
 * schemastery 校验器：把上面的 TS 接口声明成运行时可校验的 schema。
 * `z<Config>` 这个写法让「类型」和「schema」保持同源，改一边另一边编译就报错。
 * .default(...) 给出默认值，配置文件里就可以整段省略。
 */
export const Config: z<Config> = z.object({
  greetingPrefix: z.string().default('你好'),
})

/**
 * 领域 persona：挂载时注入到系统提示词。
 *
 * 写法约定（参考 finance / ecommerce）：
 *   1) 列明「哪些数据必须用本领域工具取，不得编造」；
 *   2) 带 mock 标记的数据要提示「示例数据，不可用于真实决策」；
 *   3) 明确「本领域问题优先用专业工具；非本领域问题照常走通用能力」。
 * 这里是模板，只写最小示范。
 */
const TEMPLATE_PERSONA = `你是「模板插件」演示助手。在通用能力之上叠加了一个示例工具 template_hello。
收到问候类请求时优先调用 template_hello；其余问题照常使用通用能力，不因本插件存在而改变通用行为。`

/**
 * 插件主入口：被 cordis loader 在启动时调用一次。
 * @param ctx    cordis 上下文，按 inject 声明拿到 tools / systemPrompt 等服务。
 * @param config 已经过 schemastery 校验、填好默认值的配置。
 */
export function apply(ctx: Context, config: Config): void {
  // ── 第 1 步：注入领域 persona 到系统提示词 ──────────────────────────────
  // section({ name, order, text })：
  //   - name  ：唯一 section 名，重复注册会报错；
  //   - order ：数值越小越靠前；领域 persona 惯例用 -900 放到靠前位置；
  //   - text  ：函数返回最新文案（每次组装提示词时调用，可读到最新配置）。
  ctx.systemPrompt.section({
    name: 'template-persona',
    order: -900,
    text: () => TEMPLATE_PERSONA,
  })

  // ── 第 2 步：注册示例工具 template_hello ───────────────────────────────
  // defineTool({...}) 描述一个「模型可调用工具」；ctx.tools.register 把它交给工具注册表。
  //
  // ValueSchemaSpec DSL 要点：
  //   - parameters：入参 schema，每个字段写 type / required / description；
  //   - output.schema：返回值 schema（用于模型理解返回结构）；
  //   - output.render：把结构化返回值渲染成模型和用户都能读的文本块；
  //   - execute：真正的执行逻辑，失败时 throw 带中文、可行动的错误。
  ctx.tools.register(defineTool({
    name: 'template_hello',
    description: '【模板示例】向指定名字的人打一声招呼。输入 name，返回一句问候语。这是插件模板自带的演示工具，复制后请替换成你自己的领域工具。',
    // 入参：只有一个必填字符串 name。
    parameters: {
      name: { type: 'string', required: true, description: '要问候的对象名字，例如「世界」「小明」' },
    },
    output: {
      // 返回值是一个对象：greeting（问候语）+ prefix（实际用的前缀，便于核对配置）。
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          greeting: { type: 'string', required: true },
          prefix: { type: 'string', required: true },
        },
      },
      // render：把结构化结果渲染成一段文本。模型与用户都看这段。
      // _args 是入参（这里用不到，下划线表示省略），value 是 execute 的返回值。
      render: (_args, value) => [{
        type: 'text',
        text: `${value.greeting}（前缀配置：${value.prefix}）`,
      }],
    },
    execute(args: { name: string }) {
      // 真实插件里这里才是取数 / 计算逻辑；模板只做一件最小的事：拼问候语。
      const prefix = config.greetingPrefix ?? '你好'
      return Promise.resolve({ greeting: `${prefix}，${args.name}！`, prefix })
    },
  }))

  // ── 第 3 步（演示）：权限集成说明 ──────────────────────────────────────
  // 本插件不做任何权限绕过。只读工具由官方权限体系兜底；如果你新增了
  // 「写操作」工具（例如 template_delete / template_publish），用官方权限预设
  // （permission-presets）在 profile 里配置 presets（sandbox 模式 × 审批策略
  // 组合），用户通过 /permission 命令在 UI 选择。详见 packages/interaction/permission-presets。
}
