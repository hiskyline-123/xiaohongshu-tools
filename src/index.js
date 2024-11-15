require('dotenv').config();
const { program } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

// 加载工具函数
const toolsPath = path.join(__dirname, 'tools');
const tools = fs.readdirSync(toolsPath)
  .filter(file => file.endsWith('.js'))
  .map(file => ({
    name: file.replace('.js', ''),
    path: path.join(toolsPath, file)
  }));

async function showToolMenu() {
  const choices = tools.map(tool => tool.name);
  
  const toolAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTool',
      message: '请选择要执行的工具：',
      choices
    }
  ]);

  const selectedTool = tools.find(tool => tool.name === toolAnswer.selectedTool);
  
  try {
    const toolModule = require(selectedTool.path);
    
    // 针对 topicAnalyzer 工具增加模式选择
    if (selectedTool.name === 'topicAnalyzer') {
      const modeAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'mode',
          message: '请选择分析模式：',
          choices: [
            { name: '单文件分析', value: 'single' },
            { name: '多文件分别分析', value: 'multiple' },
            { name: '多文件合并分析', value: 'merged' }
          ]
        }
      ]);

      // 根据不同模式执行不同的分析
      switch (modeAnswer.mode) {
        case 'single':
          const files = fs.readdirSync(path.join(__dirname, 'input/topicAnalyzer'))
            .filter(file => file.endsWith('.txt'));
          const fileAnswer = await inquirer.prompt([
            {
              type: 'list',
              name: 'filename',
              message: '请选择要分析的文件：',
              choices: files
            }
          ]);
          await toolModule.run({ filename: fileAnswer.filename });
          break;
          
        case 'multiple':
          await toolModule.run({}); // 分析所有文件
          break;
          
        case 'merged':
          await toolModule.run({ merge: true }); // 合并分析所有文件
          break;
      }
    } else {
      await toolModule.run();
    }
  } catch (error) {
    console.error(chalk.red(`运行错误: ${error.message}`));
  }
}

// 主程序入口
if (require.main === module) {
  showToolMenu().catch(error => {
    console.error(chalk.red(`程序错误: ${error.message}`));
    process.exit(1);
  });
} 