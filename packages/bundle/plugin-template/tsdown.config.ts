// 本包的 tsdown 构建配置。
//
// 为什么用 clientBundle(...) 而不是自己写 host/client 两套配置？
//   仓库根 tsdown.config.ts 用 workspace: [...] 一次性构建所有包，但「双面孔包」
//   （既有 Node host 半边 src/index.ts，又有浏览器 client 半边 src/client/index.ts）
//   需要在同一个包里同时产出 lib/index.js（Node）和 lib/client.js（浏览器）。
//   clientBundle 这个预设（packages/client/tsdown.client.ts）已经把两件事都办了：
//     1) Node 半边：从 tsc 产物 lib/types/index.js 打出 lib/index.js（host loader 导入）；
//     2) 浏览器半边：把 src/client/index.ts 打成闭包工厂 lib/client.js，
//        通过 window.__ModuleLoader__.load(...) 注册给 Web 插件加载器。
//   并按环境变量 DSH_BUILD_FACE=host|client 自动决定本次出哪半边，
//   与仓库 build:lib:host / build:lib:client 两个脚本天然对齐。
//
// 第一个参数 id 必须等于本包 package.json 的 name；第二个参数是 Node 半边入口
// （tsc 把 src/index.ts 编译到 lib/types/index.js）。
import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle('@deepseek-ai/dsh-plugin-template', ['lib/types/index.js'])
