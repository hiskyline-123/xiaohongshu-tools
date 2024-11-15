const fs = require('fs');
const path = require('path');
const config = require('../config/textSplitter.json');

class TextSplitter {
  constructor() {
    this.toolName = 'textSplitter';
    this.initDirectories();
  }

  /**
   * 初始化工具所需的目录结构
   */
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

  /**
   * 验证文件名格式
   * @param {string} filename - 输入文件名
   * @returns {boolean} 是否合法
   */
  validateFilename(filename) {
    // 文件名格式: YYYYMMDD_[自定义标识].txt
    const filenamePattern = /^\d{8}_[\w-]+\.txt$/;
    return filenamePattern.test(filename);
  }

  /**
   * 生成输出文件名
   * @param {string} inputFilename - 输入文件名
   * @returns {string} 输出文件名
   */
  generateOutputFilename(inputFilename) {
    return inputFilename.replace(/\.txt$/, '.csv');
  }

  /**
   * 获取输入文件完整路径
   * @param {string} filename - 文件名
   * @returns {string} 完整路径
   */
  getInputPath(filename) {
    return path.join(__dirname, `../input/${this.toolName}`, filename);
  }

  /**
   * 获取输出文件完整路径
   * @param {string} filename - 文件名
   * @returns {string} 完整路径
   */
  getOutputPath(filename) {
    return path.join(__dirname, `../output/${this.toolName}`, filename);
  }

  /**
   * 从文件中读取文本内容
   * @param {string} filename - 输入文件名
   * @returns {string} 文件内容
   */
  readTextFromFile(filename) {
    try {
      const filePath = this.getInputPath(filename);
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('读取文本文件失败:', error);
      return '';
    }
  }

  /**
   * 从文本内容中解析标题并返回处理后的内容
   * @param {string} content - 文本内容
   * @returns {Object} 包含标题和处理后内容的对象
   */
  extractTitleAndContent(content) {
    const { pattern, defaultTitle } = config.titleConfig;
    const lines = content.split('\n');
    let title = defaultTitle;
    let processedContent = content;

    // 查找标题行
    const titleLineIndex = lines.findIndex(line => line.match(new RegExp(pattern, 'm')));
    if (titleLineIndex !== -1) {
      const match = lines[titleLineIndex].match(new RegExp(pattern, 'm'));
      if (match && match[1]) {
        title = match[1].trim();
        // 移除标题行并重新组合内容
        lines.splice(titleLineIndex, 1);
        processedContent = lines.join('\n').trim();
      }
    }
    
    return { title, content: processedContent };
  }

  /**
   * 将分割结果写入CSV文件
   * @param {Array} pages - 分页结果数组
   * @param {string} filename - 输出文件名
   * @param {string} title - 文章标题
   */
  async writeResultToCSV(pages, filename, title) {
    try {
      const outputPath = this.getOutputPath(filename);
      const csvContent = [
        config.csvHeaders.join(','), // 写入表头
        ...pages.map((content, index) => 
          `${index + 1},"${title.replace(/"/g, '""')}","${content.replace(/"/g, '""')}"` // 处理内容中的双引号
        )
      ].join('\n');

      fs.writeFileSync(outputPath, csvContent, 'utf8');
      console.log(`分割结果已保存到: ${outputPath}`);
    } catch (error) {
      console.error('保存分割结果失败:', error);
    }
  }

  /**
   * 分割文本内容
   * @param {string} content - 要分割的文本内容
   * @param {Object} options - 分割选项
   * @param {number} options.pageLength - 每页字符长度
   * @param {number} options.firstPageLength - 第一页字符长度
   * @returns {Array} 分页后的文本数组
   */
  splitText(content, options = {}) {
    const pageLength = options.pageLength || config.defaultPageLength;
    const firstPageLength = options.firstPageLength || config.defaultFirstPageLength;
    const minPageLength = Math.floor(pageLength * 0.7); // 设置最小页面长度为目标长度的70%
    
    const pages = [];
    let remainingText = content;
    
    // 分割文本的辅助函数
    const findBestSplitPosition = (text, targetLength) => {
      // 如果文本长度小于最小长度，直接返回文本长度
      if (text.length <= minPageLength) {
        return text.length;
      }
      
      // 在目标长度范围内寻找最分割点
      const searchEndPos = Math.min(text.length, targetLength + 50); // 向后多看50个字符
      const searchText = text.slice(0, searchEndPos);
      
      // 按优先级寻找分割点
      const sentenceEnds = searchText.match(/[。！？]/g); // 句子结束符
      const commas = searchText.match(/[，；、]/g);       // 次级分隔符
      
      if (sentenceEnds && sentenceEnds.length > 0) {
        // 找最后一个句号在目标长度范围内的位置
        const lastPos = searchText.lastIndexOf(sentenceEnds[sentenceEnds.length - 1]);
        if (lastPos >= minPageLength) {
          return lastPos + 1;
        }
      }
      
      if (commas && commas.length > 0) {
        // 找最后一个逗号在目标长度范围内的位置
        const lastPos = searchText.lastIndexOf(commas[commas.length - 1]);
        if (lastPos >= minPageLength) {
          return lastPos + 1;
        }
      }
      
      // 如果没找到合适的分割点，就在目标长度处直接分割
      return targetLength;
    };
    
    // 处理第一页
    if (remainingText.length > firstPageLength) {
      const splitIndex = findBestSplitPosition(remainingText, firstPageLength);
      pages.push(remainingText.slice(0, splitIndex).trim());
      remainingText = remainingText.slice(splitIndex);
    } else {
      pages.push(remainingText.trim());
      return pages;
    }
    
    // 处理剩余页面
    while (remainingText.length > 0) {
      if (remainingText.length <= pageLength) {
        pages.push(remainingText.trim());
        break;
      }
      
      const splitIndex = findBestSplitPosition(remainingText, pageLength);
      pages.push(remainingText.slice(0, splitIndex).trim());
      remainingText = remainingText.slice(splitIndex);
    }
    
    return pages;
  }

  /**
   * 获取工具输入目录下的所有文件
   * @returns {string[]} 文件名数组
   */
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

  /**
   * 运行文本分割
   * @param {Object} options - 运行选项
   * @param {string|undefined} options.filename - 可选的指定文件名
   * @param {number} options.pageLength - 每页字符长度
   * @param {number} options.firstPageLength - 第一页字符长度
   * @returns {Object|Object[]} 处理结果或结果数组
   */
  async run(options = {}) {
    const { filename } = options;
    
    if (!filename) {
      const allFiles = this.getInputFiles();
      console.log(`发现 ${allFiles.length} 个文件待处理:`, allFiles);
      
      const results = [];
      for (const file of allFiles) {
        try {
          if (!this.validateFilename(file)) {
            console.warn(`文件名 ${file} 不符合命名规范，但仍继续处理`);
          }
          
          const rawContent = this.readTextFromFile(file);
          if (!rawContent) {
            console.warn(`文件 ${file} 内容为空，跳过处理`);
            continue;
          }

          const { title, content } = this.extractTitleAndContent(rawContent);
          const pages = this.splitText(content, options);
          const outputFilename = this.generateOutputFilename(file);
          await this.writeResultToCSV(pages, outputFilename, title);
          
          results.push({
            inputFile: file,
            outputFile: outputFilename,
            title,
            pageCount: pages.length
          });
        } catch (error) {
          console.error(`处理文件 ${file} 失败:`, error);
        }
      }
      return results;
    }
    
    if (!this.validateFilename(filename)) {
      console.warn(`文件名 ${filename} 不符合命名规范，但仍继续处理`);
    }

    const rawContent = this.readTextFromFile(filename);
    if (!rawContent) {
      throw new Error('文件内容为空');
    }

    const { title, content } = this.extractTitleAndContent(rawContent);
    const pages = this.splitText(content, options);
    const outputFilename = this.generateOutputFilename(filename);
    await this.writeResultToCSV(pages, outputFilename, title);

    return {
      inputFile: filename,
      outputFile: outputFilename,
      title,
      pageCount: pages.length
    };
  }
}

module.exports = new TextSplitter();