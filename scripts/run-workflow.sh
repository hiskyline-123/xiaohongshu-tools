#!/bin/bash

# 设置脚本执行时的错误处理
set -e

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 使用 Node.js 执行工作流
/Users/skyline/.nvm/versions/node/v20.10.0/bin/node src/workflows/ocrToSplitWorkflow.run.js

# 输出执行成功的消息
echo "OCR to Split 工作流执行完成"