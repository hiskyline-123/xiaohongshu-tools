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
  readTextFromFile(filename, customInputPath = null) {
    try {
      const filePath = customInputPath || path.join(__dirname, `../input/${this.toolName}`, filename);
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
    // 保留原始行，包括空行
    const allLines = content.split('\n');
    // 只在查找标题时过滤空行
    const nonEmptyLines = allLines.filter(line => line.trim());
    
    if (nonEmptyLines.length === 0) {
      return { title: defaultTitle, content: '' };
    }

    let title = defaultTitle;
    let titleLineIndex = -1;

    // 先尝试查找 # 格式的标题
    titleLineIndex = allLines.findIndex(line => line.match(new RegExp(pattern, 'm')));
    if (titleLineIndex !== -1) {
      const match = allLines[titleLineIndex].match(new RegExp(pattern, 'm'));
      if (match && match[1]) {
        title = match[1].trim();
      }
    } else {
      // 如果没找到 # 格式的标题，使用第一个非空行作为标题
      titleLineIndex = allLines.findIndex(line => line.trim());
      title = allLines[titleLineIndex].trim();
    }

    // 移除标题行但保留空行
    allLines.splice(titleLineIndex, 1);
    const processedContent = allLines.join('\n').trim();
    
    return { title, content: processedContent };
  }

  /**
   * 将分割结果写入CSV文件
   * @param {Array} pages - 分页结果数组
   * @param {string} filename - 输出文件名
   * @param {string} title - 文章标题
   */
  writeResultToCSV(pages, filename, title, customOutputPath = null) {
    try {
      const outputPath = customOutputPath || this.getOutputPath(filename);
      const csvContent = [
        config.csvHeaders.join(','),
        ...pages.map((content, index) => 
          `${index + 1},"${title.replace(/"/g, '""')}","${content.replace(/"/g, '""')}"`
        )
      ].join('\n');

      fs.writeFileSync(outputPath, csvContent, 'utf8');
      console.log(`分割结果已保存到: ${outputPath}`);
      return path.basename(outputPath);
    } catch (error) {
      console.error('保存分割结果失败:', error);
      throw error;
    }
  }

  /**
   * 分割文本内容
   * @param {string} content - 要分割的文本内容
   * @returns {Array} 分页后的文本数组
   */
  splitText(content) {
    const MAX_CHARS_PER_LINE = config.textSplitConfig.maxCharsPerLine;
    const FIRST_PAGE_MAX_LINES = config.textSplitConfig.firstPageMaxLines;
    const NORMAL_PAGE_MAX_LINES = config.textSplitConfig.normalPageMaxLines;
    
    const pages = [];
    let remainingText = content;

    // 计算单个句子占用的行数
    const calculateSentenceLines = (sentence) => {
      if (sentence.trim() === '') return 1;
      return Math.ceil(sentence.length / MAX_CHARS_PER_LINE);
    };

    // 将文本按句子分割（以。！？为分隔符）
    const splitIntoSentences = (text) => {
      return text.match(/[^。！？]+[。！？]|[^。！？]+$/g) || [];
    };

    // 在不超过最大行数的情况下，找到最佳的分割点
    const findBestSplit = (sentences, maxLines) => {
      let currentLines = 0;
      let currentContent = [];
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceLines = calculateSentenceLines(sentence);
        
        if (currentLines + sentenceLines > maxLines) {
          return currentContent.join('');
        }
        
        currentLines += sentenceLines;
        currentContent.push(sentence);
      }
      
      return currentContent.join('');
    };

    // 处理第一页
    const firstPageSentences = splitIntoSentences(remainingText);
    const firstPageContent = findBestSplit(firstPageSentences, FIRST_PAGE_MAX_LINES);
    pages.push(firstPageContent.trim());
    remainingText = remainingText.slice(firstPageContent.length);

    // 处理后续页面
    while (remainingText.trim().length > 0) {
      const sentences = splitIntoSentences(remainingText);
      const pageContent = findBestSplit(sentences, NORMAL_PAGE_MAX_LINES);
      if (!pageContent) break;
      
      pages.push(pageContent.trim());
      remainingText = remainingText.slice(pageContent.length);
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
    const { filename, inputPath, outputPath } = options;

    try {
      const rawContent = this.readTextFromFile(filename, inputPath);
      if (!rawContent) {
        throw new Error('文件内容为空');
      }

      const { title, content } = this.extractTitleAndContent(rawContent);
      const pages = this.splitText(content);
      const outputFilename = this.generateOutputFilename(filename);
      const finalOutputFile = await this.writeResultToCSV(pages, outputFilename, title, outputPath);

      return {
        inputFile: filename,
        outputFile: finalOutputFile,
        title,
        pageCount: pages.length
      };
    } catch (error) {
      console.error('处理文件失败:', error);
      throw error;
    }
  }
}

module.exports = new TextSplitter();