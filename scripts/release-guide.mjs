#!/usr/bin/env node
// 发布引导脚本（不真正发布）：打印发布前必须完成的步骤，指向 docs/release.md。
// 用法：pnpm run release
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const releaseDoc = join(repoRoot, 'docs', 'release.md');

const steps = [
  '1. 确认工作区干净：git status 无未提交变更。',
  '2. 全量构建四步全绿：tsc -b tsconfig.host.json && pnpm run build:lib:host && pnpm run build:lib:client && pnpm run build:web',
  '3. 同步版本号：所有待发布 workspace 包的 version 统一为本次发布版（当前根版本 0.1.7）。',
  '4. 核对根 package.json：repository / homepage / bugs / engines / license 字段完整。',
  '5. 核对关键包 files/exports：lib 产物、类型声明、cordis.patch.yml 等被 files 字段收录。',
  '6. 阅读发布指南：docs/release.md',
  '7. 确认真要发布后，在仓库根执行：pnpm -r publish --access public',
  '   （workspace:* 协议会在 publish 时自动改写为具体版本号；私有包会被自动跳过）',
  '8. 发布完成后打 tag：git tag v0.1.7 && git push origin v0.1.7（本脚本不替你执行推送）。',
];

console.log('');
console.log('OmniAgent 发布引导（dry-run，本脚本不会发布任何东西）');
console.log('='.repeat(56));
for (const s of steps) console.log(s);
console.log('');
console.log(`详细发布指南见：${releaseDoc}`);
console.log('');
