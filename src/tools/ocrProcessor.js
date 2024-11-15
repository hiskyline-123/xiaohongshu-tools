const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class OcrProcessor {
  constructor() {
    this.toolName = 'ocrProcessor';
    this.supportedImageExts = ['.jpg', '.jpeg', '.png'];
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
   * 获取输入目录下的所有图片文件夹
   * @returns {string[]} 文件夹名数组
   */
  getImageFolders() {
    const inputDir = path.join(__dirname, `../input/${this.toolName}`);
    if (!fs.existsSync(inputDir)) {
      console.warn(`目录不存在: ${inputDir}`);
      return [];
    }
    
    return fs.readdirSync(inputDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  /**
   * 获取文件夹中的所有图片文件
   * @param {string} folderName - 文件夹名
   * @returns {string[]} 图片文件路径数组
   */
  getImagesInFolder(folderName) {
    const folderPath = path.join(__dirname, `../input/${this.toolName}`, folderName);
    return fs.readdirSync(folderPath)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedImageExts.includes(ext);
      })
      .map(file => path.join(folderPath, file));
  }

  /**
   * 执行OCR命令
   * @param {string} imagePath - 图片路径
   * @returns {Promise<string>} OCR结果
   */
  async performOcr(imagePath) {
    try {
      const command = `ocrit "${imagePath}" -l zh-Hans -l en-US`;
      const { stdout } = await execPromise(command);
      return stdout.trim();
    } catch (error) {
      console.error(`OCR处理失败 ${imagePath}:`, error);
      return '';
    }
  }

  /**
   * 将OCR结果写入文本文件
   * @param {string} folderName - 文件夹名
   * @param {string} content - OCR内容
   */
  writeResultToFile(folderName, content) {
    const outputPath = path.join(__dirname, `../output/${this.toolName}`, `${folderName}.txt`);
    fs.writeFileSync(outputPath, content, 'utf8');
  }

  /**
   * 处理单个文件夹
   * @param {string} folderName - 文件夹名
   * @returns {Promise<Object>} 处理结果
   */
  async processFolder(folderName) {
    console.log(`开始处理文件夹: ${folderName}`);
    const images = this.getImagesInFolder(folderName);
    
    if (images.length === 0) {
      console.warn(`文件夹 ${folderName} 中没有支持的图片文件`);
      return {
        folderName,
        imageCount: 0,
        success: false
      };
    }

    let allText = '';
    for (const imagePath of images) {
      console.log(`处理图片: ${path.basename(imagePath)}`);
      const ocrResult = await this.performOcr(imagePath);
      if (ocrResult) {
        allText += ocrResult + '\n\n';
      }
    }

    if (allText) {
      this.writeResultToFile(folderName, allText.trim());
    }

    return {
      folderName,
      imageCount: images.length,
      success: true
    };
  }

  /**
   * 运行OCR处理
   * @param {Object} options - 运行选项
   * @param {string} [options.folderName] - 可选的指定文件夹名
   * @returns {Promise<Object|Object[]>} 处理结果
   */
  async run(options = {}) {
    const { folderName } = options;

    if (folderName) {
      return await this.processFolder(folderName);
    }

    const folders = this.getImageFolders();
    console.log(`发现 ${folders.length} 个文件夹待处理:`, folders);

    const results = [];
    for (const folder of folders) {
      try {
        const result = await this.processFolder(folder);
        results.push(result);
      } catch (error) {
        console.error(`处理文件夹 ${folder} 失败:`, error);
        results.push({
          folderName: folder,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new OcrProcessor(); 