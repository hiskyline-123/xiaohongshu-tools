const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// 加载所有工作流
const workflowsPath = __dirname;
const workflows = fs.readdirSync(workflowsPath)
  .filter(file => file.endsWith('Workflow.js'))
  .map(file => ({
    name: file.replace('.js', ''),
    path: path.join(workflowsPath, file)
  }));

async function showWorkflowMenu() {
  const choices = workflows.map(workflow => workflow.name);
  
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedWorkflow',
      message: '请选择要执行的工作流：',
      choices
    }
  ]);

  const selectedWorkflow = workflows.find(workflow => workflow.name === answer.selectedWorkflow);
  
  try {
    const workflowModule = require(selectedWorkflow.path);
    await workflowModule.run();
  } catch (error) {
    console.error(chalk.red(`工作流执行错误: ${error.message}`));
  }
}

// 主程序入口
if (require.main === module) {
  showWorkflowMenu().catch(error => {
    console.error(chalk.red(`程序错误: ${error.message}`));
    process.exit(1);
  });
} 