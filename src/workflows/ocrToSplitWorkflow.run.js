const OcrToSplitWorkflow = require('./ocrToSplitWorkflow');

// 立即执行工作流
async function main() {
  try {
    await OcrToSplitWorkflow.run();
  } catch (error) {
    console.error('工作流执行出错:', error);
    process.exit(1);
  }
}

// 启动工作流
main();