const fs = require('fs');
const path = require('path');
const config = require('../config/topicAnalyzer.json');

class TopicAnalyzer {
  constructor() {
    // 工具标识符
    this.toolName = 'topicAnalyzer';
    // 初始化目录
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
   * @param {boolean} isMerged - 是否为合并分析模式
   * @returns {string} 输出文件名
   */
  generateOutputFilename(inputFilename, isMerged = false) {
    if (isMerged) {
      // 合并模式下使用当前时间戳作为文件名
      const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
      return `${timestamp}_merged_result.json`;
    }
    // 单文件模式保持原有逻辑
    return inputFilename.replace(/\.txt$/, '_result.json');
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
   * 合并分析多个文件
   * @param {string[]} filenames - 要分析的文件名数组
   * @returns {Object} 合并分析结果
   */
  async runMerged(filenames) {
    if (!Array.isArray(filenames) || filenames.length === 0) {
      throw new Error('filenames 参数必须是非空数组');
    }

    console.log(`开始合并分析 ${filenames.length} 个文件:`, filenames);

    // 合并所有文件内容
    let mergedContent = '';
    for (const file of filenames) {
      if (!this.validateFilename(file)) {
        console.warn(`文件名 ${file} 不符合命名规范，但仍继续处理`);
      }
      try {
        const content = this.readTopicsFromFile(file);
        mergedContent += content + '\n';
      } catch (error) {
        console.error(`读取文件 ${file} 失败:`, error);
      }
    }

    // 分析合并后的内容
    const result = this.analyzeTopics(mergedContent);

    // 生成合并模式的输出文件名
    const outputFilename = this.generateOutputFilename('', true);
    await this.writeResultToFile(result, outputFilename);

    return {
      inputFiles: filenames,
      outputFile: outputFilename,
      result,
      isMerged: true
    };
  }

  /**
   * 运行话题分析
   * @param {Object} options - 运行参数
   * @param {string|string[]|undefined} options.filename - 可选的指定文件名或文件名数组
   * @param {boolean} options.merge - 是否合并分析
   * @returns {Object|Object[]} 分析结果或结果数组
   */
  async run(options = {}) {
    const { filename, merge = false } = options;
    
    // 如果指定了合并分析模式
    if (merge) {
      const filesToAnalyze = Array.isArray(filename) ? filename : this.getInputFiles();
      return this.runMerged(filesToAnalyze);
    }

    // 如果没有指定文件名，则处理目录下所有文件
    if (!filename) {
      const allFiles = this.getInputFiles();
      console.log(`发现 ${allFiles.length} 个文件待处理:`, allFiles);
      
      const results = [];
      for (const file of allFiles) {
        try {
          const result = this.analyzeTopicsFromFile(file);
          const outputFilename = this.generateOutputFilename(file);
          await this.writeResultToFile(result, outputFilename);
          results.push({
            inputFile: file,
            outputFile: outputFilename,
            result
          });
        } catch (error) {
          console.error(`处理文件 ${file} 失败:`, error);
        }
      }
      return results;
    }
    
    // 处理单个指定文件的情况
    if (typeof filename === 'string') {
      if (!this.validateFilename(filename)) {
        console.warn(`文件名 ${filename} 不符合命名规范，但仍继续处理`);
      }
      const result = this.analyzeTopicsFromFile(filename);
      const outputFilename = this.generateOutputFilename(filename);
      await this.writeResultToFile(result, outputFilename);
      return {
        inputFile: filename,
        outputFile: outputFilename,
        result
      };
    }
    
    // 处理多个指定文件的情况
    if (Array.isArray(filename)) {
      const results = [];
      for (const file of filename) {
        if (!this.validateFilename(file)) {
          console.warn(`文件名 ${file} 不符合命名规范，但仍继续处理`);
        }
        try {
          const result = this.analyzeTopicsFromFile(file);
          const outputFilename = this.generateOutputFilename(file);
          await this.writeResultToFile(result, outputFilename);
          results.push({
            inputFile: file,
            outputFile: outputFilename,
            result
          });
        } catch (error) {
          console.error(`处理文件 ${file} 失败:`, error);
        }
      }
      return results;
    }

    throw new Error('filename 参数必须是字符串、字符串数组或不传');
  }

  /**
   * 从文件中读取话题数据
   * @param {string} filename - 输入文件名
   * @returns {string} 文件内容
   */
  readTopicsFromFile(filename) {
    try {
      const filePath = this.getInputPath(filename);
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('读取话题数据文件失败:', error);
      return '';
    }
  }

  /**
   * 将分析结果写入文件
   * @param {Object} result - 分析结果
   * @param {string} filename - 输出文件名
   */
  async writeResultToFile(result, filename) {
    try {
      const outputPath = this.getOutputPath(filename);
      fs.writeFileSync(
        outputPath,
        JSON.stringify(result, null, 2),
        'utf8'
      );
      console.log(`分析结果已保存到: ${outputPath}`);
    } catch (error) {
      console.error('保存分析结果失败:', error);
    }
  }

  /**
   * 从字符串中提取话题并分析
   * @param {string} content - 包含话题的字符串内容
   * @returns {Object} 返回话题分析结果
   */
  analyzeTopics(content) {
    try {
      // 1. 改进数据预处理
      const lines = content.split('\n').filter(line => line.trim());
      const allTopics = [];
      
      // 2. 优化 JSON 解析逻辑
      for (const line of lines) {
        try {
          const topics = JSON.parse(line);
          if (Array.isArray(topics)) {
            allTopics.push(...topics);
          } else if (typeof topics === 'string') {
            allTopics.push(topics);
          }
        } catch (e) {
          console.warn('Invalid JSON line:', line);
        }
      }

      const topicStats = {};
      
      // 3. 改进话题统计逻辑
      allTopics.forEach(topic => {
        const cleanTopic = String(topic).trim();
        if (this.isValidTopic(cleanTopic)) {
          topicStats[cleanTopic] = (topicStats[cleanTopic] || 0) + 1;
        }
      });

      const sortedTopics = Object.entries(topicStats)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [topic, count]) => {
          acc[topic] = count;
          return acc;
        }, {});

      // 修改：收集所有只出现一次的话题
      const uniqueTopicsList = Object.entries(topicStats)
        .filter(([, count]) => count === 1)
        .map(([topic]) => topic);

      console.log(`处理前总话题数: ${allTopics.length}`);
      console.log(`有效话题数: ${Object.values(topicStats).reduce((sum, count) => sum + count, 0)}`);
      console.log(`只出现一次的话题数: ${uniqueTopicsList.length}`);

      return {
        totalTopics: allTopics.length,
        uniqueTopics: Object.keys(topicStats).length,
        topicFrequency: sortedTopics,
        uniqueTopicsList
      };
    } catch (error) {
      console.error('话题分析失败:', error);
      return {
        totalTopics: 0,
        uniqueTopics: 0,
        topicFrequency: {},
        uniqueTopicsList: []
      };
    }
  }

  /**
   * 检查话题是否有效
   * @param {string} topic - 话题字符串
   * @returns {boolean} 是否为有效话题
   */
  isValidTopic(topic) {
    if (!topic || typeof topic !== 'string' || !topic.startsWith('#')) {
      return false;
    }

    const topicText = topic.slice(1);
    if (topicText.length < config.minTopicLength) {
      return false;
    }

    if (config.blacklist.includes(topic)) {
      return false;
    }

    if (config.whitelist.length > 0 && !config.whitelist.includes(topic)) {
      return false;
    }

    return true;
  }

  /**
   * 分析指定文件中的话题
   * @param {string} filename - 输入文件名
   * @returns {Object} 话题分析结果
   */
  analyzeTopicsFromFile(filename) {
    const content = this.readTopicsFromFile(filename);
    return this.analyzeTopics(content);
  }
}

module.exports = new TopicAnalyzer(); 