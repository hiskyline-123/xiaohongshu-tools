const { readFileSync } = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const chalk = require('chalk');
const ncp = require('copy-paste');

// 导入工具模块
const ocrProcessor = require('../tools/ocrProcessor');
const textFlow = require('../tools/textFlow');
const textSplitter = require('../tools/textSplitter');

// 导入工作流配置和工具配置
const workflowConfig = require('../config/workflows/ocrToSplit.json');
const textFlowConfig = require('../config/textFlow.json');
const textSplitterConfig = require('../config/textSplitter.json');

class OcrToSplitWorkflow {
  constructor() {
    this.workflowName = 'ocrToSplit';
    // 合并配置
    this.textFlowConfig = { ...textFlowConfig, ...workflowConfig.textFlow };
    this.textSplitterConfig = { ...textSplitterConfig, ...workflowConfig.textSplitter };
  }

  /**
   * 复制文件内容到剪贴板
   * @param {string} filePath - 文件路径
   */
  async copyToClipboard(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      ncp.copy(content, () => {
        console.log(chalk.green(`已复制文件内容到剪贴板: ${filePath}`));
      });
    } catch (error) {
      console.warn(chalk.yellow(`无法复制文件内容到剪贴板 ${filePath}: ${error.message}`));
    }
  }

  /**
   * 执行工作流
   */
  async run() {
    try {
      console.log(chalk.cyan('开始执行 OCR 转换和分割工作流...'));

      // 1. 执行OCR处理
      console.log(chalk.blue('\n1. 执行OCR处理...'));
      const ocrResults = await ocrProcessor.run();
      
      if (!ocrResults || ocrResults.length === 0) {
        throw new Error('OCR处理未产生有效结果');
      }

      // 并行处理每个OCR结果
      const processPromises = ocrResults.map(async (ocrResult) => {
        if (!ocrResult.success) {
          console.warn(chalk.yellow(`跳过失败的OCR结果: ${ocrResult.folderName}`));
          return null;
        }

        try {
          const ocrOutputPath = path.join(__dirname, '../output/ocrProcessor', `${ocrResult.folderName}.txt`);
          const textFlowOutputPath = path.join(__dirname, '../output/textFlow', `${ocrResult.folderName}_processed.txt`);
          const textSplitterOutputPath = path.join(__dirname, '../output/textSplitter', `${ocrResult.folderName}.csv`);

          // 2. 执行文本优化
          console.log(chalk.blue(`\n2. 优化文本: ${ocrResult.folderName}`));
          const textFlowResult = await textFlow.run({
            filename: `${ocrResult.folderName}.txt`,
            inputPath: ocrOutputPath,
            outputPath: textFlowOutputPath,
            config: this.textFlowConfig // 传入合并后的配置
          });

          if (!textFlowResult || !textFlowResult.success) {
            throw new Error(`文本优化失败: ${ocrResult.folderName}`);
          }

          // 3. 执行文本分割
          console.log(chalk.blue(`\n3. 分割文本: ${ocrResult.folderName}`));
          const splitResult = await textSplitter.run({
            filename: `${ocrResult.folderName}_processed.txt`,
            inputPath: textFlowOutputPath,
            outputPath: textSplitterOutputPath,
            ...this.textSplitterConfig // 传入合并后的配置
          });

          return splitResult;
        } catch (error) {
          console.error(chalk.red(`处理 ${ocrResult.folderName} 失败:`, error.message));
          return null;
        }
      });

      // 等待所有处理完成
      const results = await Promise.all(processPromises);
      const validResults = results.filter(result => result !== null);

      if (validResults.length === 0) {
        throw new Error('没有成功处理的结果');
      }

      // 打印执行结果
      console.log(chalk.green('\n✨ 工作流执行完成!'));
      console.log(chalk.cyan('\n处理结果:'));
      validResults.forEach(result => {
        console.log(chalk.gray(`- ${result.outputFile} (${result.pageCount} 页)`));
        // 复制结果文件到剪贴板
        this.copyToClipboard(path.join(__dirname, `../output/textSplitter/${result.outputFile}`));
      });

      // 添加成功退出
      process.exit(0);

    } catch (error) {
      console.error(chalk.red('\n工作流执行失败:'), error);
      // 添加失败退出
      process.exit(1);
    }
  }
}

module.exports = new OcrToSplitWorkflow(); 