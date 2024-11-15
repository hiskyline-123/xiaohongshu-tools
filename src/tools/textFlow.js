const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const config = require('../config/textFlow.json');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const cliProgress = require('cli-progress');
const colors = require('colors');

class TextFlow {
  constructor() {
    this.toolName = 'textFlow';
    this.prompts = config.prompts;
    this.initDirectories();
    this.multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: colors.cyan('{bar}') + ' | {percentage}% | {value}/{total} | {status}'
    }, cliProgress.Presets.shades_classic);
  }

  initDirectories() {
    const dirs = [
      path.join(__dirname, `../input/${this.toolName}`),
      path.join(__dirname, `../output/${this.toolName}`)
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getInputFiles() {
    try {
      const inputDir = path.join(__dirname, `../input/${this.toolName}`);
      const files = fs.readdirSync(inputDir);
      return files.filter(file => file.endsWith('.txt'));
    } catch (error) {
      console.error('读取输入目录失败:', error);
      return [];
    }
  }

  readTextFromFile(filename) {
    try {
      const filePath = path.join(__dirname, `../input/${this.toolName}`, filename);
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('读取文本文件失败:', error);
      return '';
    }
  }

  writeResultToFile(content, inputFilename) {
    try {
      const outputFilename = inputFilename.replace('.txt', '_processed.txt');
      const outputPath = path.join(__dirname, `../output/${this.toolName}`, outputFilename);
      fs.writeFileSync(outputPath, content, 'utf8');
      console.log(`处理结果已保存到: ${outputPath}`);
      return outputFilename;
    } catch (error) {
      console.error('保存处理结果失败:', error);
      throw error;
    }
  }

  async processText(text, prompt = '') {
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": config.siteUrl,
          "X-Title": config.siteName,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": config.model,
          "messages": [
            ...(prompt ? [{
              "role": "system",
              "content": prompt
            }] : []),
            {
              "role": "user",
              "content": text
            }
          ]
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`API Error: ${result.error?.message || 'Unknown error'}`);
      }

      return result.choices[0].message.content;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async processWithPrompts(text, variables = {}) {
    let processedContent = text;
    
    const progressBar = this.multibar.create(this.prompts.length, 0, { status: '准备处理...' });
    
    for (let i = 0; i < this.prompts.length; i++) {
      const prompt = this.prompts[i];
      let processedPrompt = prompt;
      Object.entries(variables).forEach(([key, value]) => {
        processedPrompt = processedPrompt.replace(`{${key}}`, value);
      });
      
      const promptPreview = processedPrompt.length > 50 
        ? processedPrompt.substring(0, 50) + '...' 
        : processedPrompt;
      progressBar.update(i, { 
        status: colors.cyan(`[${i + 1}/${this.prompts.length}] `) + 
               colors.yellow(`正在处理: ${promptPreview}`) 
      });
      
      processedContent = await this.processText(processedContent, processedPrompt);
    }
    
    progressBar.update(this.prompts.length, { status: colors.green('✨ 所有提示处理完成!') });
    progressBar.stop();
    
    return processedContent;
  }

  async run(options = {}) {
    const { filename, variables } = options;
    const results = [];

    try {
      const files = filename ? [filename] : this.getInputFiles();
      console.log(colors.yellow(`\n发现 ${files.length} 个文件待处理:`));
      console.log(colors.gray(files.join('\n')));

      const totalBar = this.multibar.create(files.length, 0, { status: '开始处理文件...' });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        totalBar.update(i, { status: `处理文件: ${file}` });

        const content = this.readTextFromFile(file);
        if (!content) {
          console.warn(colors.yellow(`\n警告: 文件 ${file} 内容为空，跳过处理`));
          continue;
        }

        const processedContent = await this.processWithPrompts(content, variables);
        const outputFile = this.writeResultToFile(processedContent, file);
        results.push({
          inputFile: file,
          outputFile,
          success: true
        });
      }

      totalBar.update(files.length, { status: '所有文件处理完成!' });
      this.multibar.stop();
      console.log(colors.green('\n✨ 处理完成!'));

      return results;
    } catch (error) {
      this.multibar.stop();
      console.error(colors.red('\n处理失败:'), error);
      throw error;
    }
  }
}

module.exports = new TextFlow();