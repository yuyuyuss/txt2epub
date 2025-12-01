document.addEventListener('DOMContentLoaded', function() {
  // 元素获取
  const bookTitle = document.getElementById('bookTitle');
  const bookAuthor = document.getElementById('bookAuthor');
  const coverImg = document.getElementById('coverImg');
  const txtFile = document.getElementById('txtFile');
  const chapterPrefix1 = document.getElementById('chapterPrefix1');
  const chapterSuffix1 = document.getElementById('chapterSuffix1');
  const chapterPrefix2 = document.getElementById('chapterPrefix2');
  const chapterSuffix2 = document.getElementById('chapterSuffix2');
  const generateBtn = document.getElementById('generateBtn');
  const downloadLink = document.getElementById('downloadLink');
  const progressBar = document.getElementById('progressBar');
  const progressContainer = progressBar.parentElement;

  // 调试元素
  const toggleDebug = document.getElementById('toggleDebug');
  const debugInfo = document.getElementById('debugInfo');
  
  let debugMode = false;
  
  // 调试模式切换
  if (toggleDebug) {
    toggleDebug.addEventListener('click', function() {
      debugMode = !debugMode;
      if (debugInfo) {
        debugInfo.style.display = debugMode ? 'block' : 'none';
      }
      toggleDebug.textContent = debugMode ? '隐藏调试信息' : '显示调试信息';
      addDebugInfo('调试模式 ' + (debugMode ? '已开启' : '已关闭'));
    });
  }

  // 中文数字转阿拉伯数字（扩展版）
  const chineseToNum = {
    '〇':0, '零':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9,
    '十':10, '十一':11, '十二':12, '十三':13, '十四':14, '十五':15, '十六':16, '十七':17, '十八':18, '十九':19,
    '二十':20, '廿':20, '二十一':21, '二十二':22, '二十三':23, '二十四':24, '二十五':25, '二十六':26, '二十七':27, '二十八':28, '二十九':29,
    '三十':30, '卅':30, '三十一':31, '三十二':32, '三十三':33, '三十四':34, '三十五':35, '三十六':36, '三十七':37, '三十八':38, '三十九':39,
    '四十':40, '卌':40, '五十':50, '六十':60, '七十':70, '八十':80, '九十':90,
    '百':100, '千':1000, '万':10000,
    '壹':1, '贰':2, '叁':3, '肆':4, '伍':5, '陆':6, '柒':7, '捌':8, '玖':9, '拾':10, '佰':100, '仟':1000
  };

  // 生成EPUB核心逻辑
  generateBtn.addEventListener('click', async function() {
    try {
      clearDebugInfo();
      addDebugInfo('开始生成EPUB...');

      // 表单验证
      if (!bookTitle.value.trim()) {
        alert('请输入书名！');
        bookTitle.focus();
        return;
      }
      if (!bookAuthor.value.trim()) {
        alert('请输入作者！');
        bookAuthor.focus();
        return;
      }
      if (!txtFile.files[0]) {
        alert('请上传TXT文件！');
        txtFile.focus();
        return;
      }

      // 按钮状态+进度条
      generateBtn.disabled = true;
      generateBtn.textContent = '处理中...';
      downloadLink.style.display = 'none';
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';

      // 1. 读取TXT文件
      progressBar.style.width = '10%';
      addDebugInfo('读取TXT文件...');
      const file = txtFile.files[0];
      const textContent = await readTextFile(file);
      addDebugInfo(`文件读取完成，大小: ${textContent.length} 字符`);
      
      // 显示前200字符用于调试
      addDebugInfo(`文件开头预览: ${textContent.substring(0, 200)}...`);

      // 2. 读取封面图
      progressBar.style.width = '20%';
      let coverDataUrl = null;
      if (coverImg.files[0]) {
        addDebugInfo('读取封面图片...');
        coverDataUrl = await readFileAsDataUrl(coverImg.files[0]);
      }

      // 3. 智能拆分章节（完整保留章节名）
      progressBar.style.width = '40%';
      addDebugInfo('开始拆分章节...');
      
      // 尝试多种方法拆分章节
      let chapters = splitChaptersByExactMatch(textContent);

      // 如果第一种方法没找到章节，尝试第二种方法
      if (chapters.length <= 1 && chapters[0].title === '全文') {
        addDebugInfo('第一种方法未找到章节，尝试第二种方法...');
        const positions = findChaptersByLines(textContent);
        
        if (positions.length > 0) {
          chapters = [];
          
          // 处理第一个章节之前的内容
          const firstChapter = positions[0];
          if (firstChapter.originalIndex > 0) {
            const introContent = textContent.substring(0, firstChapter.originalIndex).trim();
            if (introContent && introContent.length > 50) {
              chapters.push({
                title: extractIntroTitle(introContent),
                content: introContent,
                order: 0
              });
              addDebugInfo(`添加简介章节: "${extractIntroTitle(introContent)}"`);
            }
          }
          
          // 分割章节
          for (let i = 0; i < positions.length; i++) {
            const current = positions[i];
            const next = positions[i + 1];
            
            const contentStart = current.originalIndex + current.title.length;
            const contentEnd = next ? next.originalIndex : textContent.length;
            
            let chapterContent = textContent.substring(contentStart, contentEnd).trim();
            chapterContent = cleanChapterStart(chapterContent);
            
            if (chapterContent) {
              chapters.push({
                title: current.title,
                content: chapterContent,
                order: i + 1
              });
            }
          }
        }
      }

      addDebugInfo(`找到 ${chapters.length} 个章节`);
      
      // 显示前5个章节标题
      chapters.slice(0, 5).forEach((chap, i) => {
        addDebugInfo(`章节${i+1}: "${chap.title}" (${chap.content.length} 字符)`);
      });

      // 4. 生成EPUB
      progressBar.style.width = '70%';
      addDebugInfo('开始生成EPUB文件...');
      const epubBlob = await createEpub({
        title: bookTitle.value.trim(),
        author: bookAuthor.value.trim(),
        cover: coverDataUrl,
        chapters: chapters
      });

      // 5. 创建下载链接
      progressBar.style.width = '90%';
      const url = URL.createObjectURL(epubBlob);
      downloadLink.href = url;
      downloadLink.download = `${bookTitle.value.trim()}_${bookAuthor.value.trim()}.epub`;
      downloadLink.style.display = 'block';
      
      progressBar.style.width = '100%';

      // 恢复状态
      generateBtn.disabled = false;
      generateBtn.textContent = '生成EPUB';
      
      addDebugInfo(`✅ 生成成功！共 ${chapters.length} 个章节，文件大小: ${formatFileSize(epubBlob.size)}`);
      
      alert(`✅ 生成成功！\n共拆分 ${chapters.length} 个章节\n文件大小: ${formatFileSize(epubBlob.size)}\n请点击下载按钮保存文件。`);

    } catch (error) {
      console.error('生成失败:', error);
      generateBtn.disabled = false;
      generateBtn.textContent = '生成EPUB';
      progressContainer.style.display = 'none';
      addDebugInfo(`❌ 生成失败: ${error.message}`);
      alert('❌ 生成失败：' + error.message);
    }
  });

  // ---------------------- 调试函数 ----------------------
  
  /**
   * 添加调试信息
   */
  function addDebugInfo(message) {
    if (debugMode && debugInfo) {
      const time = new Date().toLocaleTimeString();
      debugInfo.innerHTML += `[${time}] ${message}<br>`;
      debugInfo.scrollTop = debugInfo.scrollHeight;
    }
    console.log(message);
  }
  
  /**
   * 清空调试信息
   */
  function clearDebugInfo() {
    if (debugInfo) {
      debugInfo.innerHTML = '';
    }
  }

  // ---------------------- 工具函数 ----------------------
  
  /**
   * 读取文本文件（智能编码检测）
   */
  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        let text = e.target.result;
        
        // 检查是否有乱码
        if (hasGarbledText(text)) {
          addDebugInfo('检测到可能的乱码，尝试GBK编码...');
          const reader2 = new FileReader();
          reader2.onload = function(e2) {
            const buffer = e2.target.result;
            try {
              // 尝试GBK编码
              const decoder = new TextDecoder('gbk');
              const decoded = decoder.decode(new Uint8Array(buffer));
              if (!hasGarbledText(decoded)) {
                addDebugInfo('GBK编码解码成功');
                resolve(decoded);
                return;
              }
            } catch (err) {
              addDebugInfo('GBK解码失败，使用原始文本');
            }
            resolve(text); // 使用原始文本
          };
          reader2.readAsArrayBuffer(file.slice(0, Math.min(file.size, 1024 * 1024)));
        } else {
          resolve(text);
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'utf-8');
    });
  }
  
  /**
   * 检查文本是否有乱码
   */
  function hasGarbledText(text) {
    if (!text || text.length < 100) return false;
    
    const sample = text.substring(0, Math.min(text.length, 1000));
    // 检查是否有大量无法显示的字符
    const garbledPattern = /�{3,}|[\uFFFD]{3,}/g;
    const matches = sample.match(garbledPattern);
    
    if (matches && matches.length > 0) {
      addDebugInfo(`检测到乱码字符: ${matches.length} 处`);
      return true;
    }
    
    return false;
  }
  
  /**
   * 读取文件为DataURL
   */
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * 备用的章节拆分方法 - 使用更精确的匹配
   */
  function splitChaptersByExactMatch(text) {
    const chapters = [];
    
    // 匹配章节标题的正则表达式（更精确）
    const chapterRegex = /(\n|^)(第[一二三四五六七八九十百千万零〇壹贰叁肆伍陆柒捌玖拾佰仟\d]+章[^\n]*)/g;
    
    const matches = [];
    let match;
    
    while ((match = chapterRegex.exec(text)) !== null) {
      const title = match[2].trim();
      const index = match.index + match[1].length; // 排除匹配的换行符
      
      // 检查是否是有效的章节标题（不是正文中的文字）
      if (isValidChapterTitle(text, index, title)) {
        matches.push({
          index: index,
          title: title,
          length: title.length
        });
      }
    }
    
    // 如果没有匹配到章节，尝试其他格式
    if (matches.length === 0) {
      addDebugInfo('未找到标准章节格式，尝试其他格式...');
      // 尝试匹配其他格式
      const altRegex = /(\n|^)((?:前言|简介|序言|楔子|引子|后记|尾声|番外[^\n]*|[一二三四五六七八九十百千万\d]+、[^\n]*))/g;
      
      while ((match = altRegex.exec(text)) !== null) {
        const title = match[2].trim();
        const index = match.index + match[1].length;
        
        if (isValidChapterTitle(text, index, title)) {
          matches.push({
            index: index,
            title: title,
            length: title.length
          });
        }
      }
    }
    
    // 处理匹配到的章节
    if (matches.length > 0) {
      addDebugInfo(`通过正则匹配找到 ${matches.length} 个章节`);
      // 排序
      matches.sort((a, b) => a.index - b.index);
      
      // 处理第一个章节之前的内容
      const firstMatch = matches[0];
      if (firstMatch.index > 0) {
        const introContent = text.substring(0, firstMatch.index).trim();
        if (introContent && introContent.length > 50) {
          chapters.push({
            title: extractIntroTitle(introContent),
            content: introContent,
            order: 0
          });
        }
      }
      
      // 分割章节内容
      for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const next = matches[i + 1];
        
        const contentStart = current.index + current.length;
        const contentEnd = next ? next.index : text.length;
        
        let chapterContent = text.substring(contentStart, contentEnd).trim();
        
        // 清理章节开头可能的多余换行
        chapterContent = cleanChapterStart(chapterContent);
        
        if (chapterContent) {
          chapters.push({
            title: current.title,
            content: chapterContent,
            order: i + 1
          });
        }
      }
    } else {
      // 没有找到章节，整个文件作为一章
      addDebugInfo('未找到任何章节，整个文件作为一章');
      chapters.push({
        title: '全文',
        content: text,
        order: 0
      });
    }
    
    return chapters;
  }

  /**
   * 增强的章节识别方法 - 尝试逐行分析
   */
  function findChaptersByLines(text) {
    const lines = text.split('\n');
    const chapterPositions = [];
    let currentIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // 跳过空行
      
      // 找到这一行在原文中的位置
      const lineIndex = text.indexOf(line, currentIndex);
      if (lineIndex === -1) continue;
      
      currentIndex = lineIndex;
      
      // 检查是否是章节标题行
      const isChapterLine = isChapterTitle(line);
      
      if (isChapterLine) {
        chapterPositions.push({
          originalIndex: currentIndex,
          title: line,
          length: line.length,
          type: getChapterType(line)
        });
      }
      
      currentIndex += line.length;
    }
    
    return chapterPositions;
  }

  /**
   * 判断一行是否是章节标题
   */
  function isChapterTitle(line) {
    // 常见章节标题模式
    const chapterPatterns = [
      /^第[一二三四五六七八九十百千万零〇壹贰叁肆伍陆柒捌玖拾佰仟]+章/,
      /^第\d+章/,
      /^第[0-9]+章/,
      /^番外[一二三四五六七八九十百千万零〇\d]/,
      /^前言/,
      /^简介/,
      /^序言/,
      /^楔子/,
      /^引子/,
      /^后记/,
      /^尾声/,
      /^[一二三四五六七八九十百千万]+、/,
      /^\d+、/,
      /^第[一二三四五六七八九十百千万零〇\d]+[章节]/,
    ];
    
    // 检查是否是空行或过长的行（可能是正文）
    if (!line || line.length > 100) return false;
    
    // 检查是否有章节特征
    for (const pattern of chapterPatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }
    
    // 额外的检查：如果是单独一行且包含特定关键词
    const keywords = ['章', '番外', '前言', '简介', '序', '楔子', '引子'];
    const hasKeyword = keywords.some(keyword => line.includes(keyword));
    const isShortLine = line.length < 50;
    
    return hasKeyword && isShortLine;
  }

  /**
   * 获取章节类型
   */
  function getChapterType(title) {
    if (title.includes('前言') || title.includes('简介') || 
        title.includes('序言') || title.includes('楔子') || 
        title.includes('引子') || title.includes('后记') || 
        title.includes('尾声')) {
      return 'intro';
    }
    if (title.includes('番外')) {
      return 'extra';
    }
    return 'main';
  }

  /**
   * 从内容中提取简介标题
   */
  function extractIntroTitle(text) {
    const lines = text.split('\n');
    
    // 查找第一行非空行
    for (let line of lines) {
      line = line.trim();
      if (line) {
        // 检查是否是常见的简介标题
        const introTitles = ['简介', '前言', '序言', '楔子', '引子', '作品简介', '内容简介'];
        for (const title of introTitles) {
          if (line.includes(title) && line.length < 100) {
            return line;
          }
        }
        
        // 如果不是常见标题，返回第一行（截断到50字符）
        return line.length > 50 ? line.substring(0, 50) + '...' : line;
      }
    }
    
    return '简介';
  }

  /**
   * 检查是否是有效的章节标题
   */
  function isValidChapterTitle(fullText, index, title) {
    // 检查标题长度是否合理
    if (title.length > 100 || title.length < 2) return false;
    
    // 检查标题后是否主要是文本内容（而不是另一个标题）
    const afterTitle = fullText.substring(index + title.length, index + title.length + 100);
    const textRatio = (afterTitle.match(/[\u4e00-\u9fff]/g) || []).length / Math.max(afterTitle.length, 1);
    
    return textRatio > 0.3; // 至少30%是中文字符
  }

  /**
   * 清理章节开头
   */
  function cleanChapterStart(text) {
    // 移除开头多余的换行和空白
    return text.replace(/^[\r\n\s]+/, '');
  }

  /**
   * 正则转义
   */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 格式化文件大小
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * 创建EPUB文件
   */
  async function createEpub({ title, author, cover, chapters }) {
    return new Promise((resolve, reject) => {
      try {
        addDebugInfo('开始创建EPUB结构...');
        
        // 生成UUID
        const uuid = generateUUID();
        
        // 1. OPF文件（内容清单）
        const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\..+/, '')}Z</meta>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    ${cover ? '<item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>' : ''}
  </manifest>
  <spine toc="ncx">
    <itemref idref="content"/>
  </spine>
</package>`;
        
        // 2. NCX目录文件
        const ncxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <docAuthor>
    <text>${escapeXml(author)}</text>
  </docAuthor>
  <navMap>
    ${chapters.map((chapter, index) => `
    <navPoint id="navpoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="content.xhtml#chapter-${index + 1}"/>
    </navPoint>
    `).join('')}
  </navMap>
</ncx>`;
        
        // 3. 内容文件（XHTML） - 优化章节显示
        const chapterHtml = chapters.map((chapter, index) => `
  <div id="chapter-${index + 1}" class="chapter">
    <h2>${escapeHtml(chapter.title)}</h2>
    <div class="content">
      ${formatTextForHtml(chapter.content)}
    </div>
  </div>`).join('');
        
        const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <style type="text/css">
    body { 
      font-family: "SimSun", "宋体", serif; 
      margin: 5%; 
      line-height: 1.8; 
      font-size: 1em;
      text-align: justify;
    }
    h1 { 
      text-align: center; 
      margin: 2em 0 1em 0; 
      font-size: 1.8em;
      font-weight: bold;
      border-bottom: 2px solid #333;
      padding-bottom: 0.5em;
    }
    h2 { 
      text-align: center; 
      margin: 2em 0 1em 0; 
      font-size: 1.4em;
      font-weight: bold;
      color: #333;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.3em;
    }
    .content {
      margin: 1em 0;
    }
    .content p {
      text-indent: 2em; 
      margin: 0.8em 0;
      line-height: 1.8;
    }
    .cover { 
      text-align: center; 
      margin: 3em 0; 
    }
    .cover img {
      max-width: 60%;
      height: auto;
      margin: 0 auto;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .chapter {
      page-break-before: always;
      margin-top: 2em;
    }
    .chapter:first-child {
      page-break-before: auto;
    }
    /* 简介章节特殊样式 */
    .chapter.intro h2 {
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div id="cover" class="cover">
    <h1>${escapeHtml(title)}</h1>
    <h2>${escapeHtml(author)}</h2>
    ${cover ? '<img src="cover.jpg" alt="封面" />' : ''}
  </div>
  ${chapterHtml}
</body>
</html>`;
        
        // 4. 必需的文件
        const files = [
          { name: 'mimetype', content: 'application/epub+zip' },
          { 
            name: 'META-INF/container.xml', 
            content: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>` 
          },
          { name: 'content.opf', content: opfContent },
          { name: 'toc.ncx', content: ncxContent },
          { name: 'content.xhtml', content: xhtmlContent }
        ];
        
        // 5. 添加封面图片（如果存在）
        if (cover) {
          const base64Data = cover.split(',')[1];
          const binaryData = atob(base64Data);
          const arrayBuffer = new ArrayBuffer(binaryData.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i);
          }
          files.push({ 
            name: 'cover.jpg', 
            content: arrayBuffer 
          });
        }
        
        addDebugInfo('创建ZIP压缩包...');
        
        // 6. 创建ZIP/EPUB文件
        if (typeof JSZip !== 'undefined') {
          const zip = new JSZip();
          
          // mimetype必须是第一个文件且不压缩
          zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
          
          // 添加其他文件
          for (const file of files) {
            if (file.name !== 'mimetype') {
              zip.file(file.name, file.content);
            }
          }
          
          // 生成EPUB文件
          zip.generateAsync({ 
            type: 'blob',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE'
          }).then(blob => {
            addDebugInfo('EPUB文件生成完成');
            resolve(blob);
          }).catch(error => {
            reject(new Error('ZIP压缩失败: ' + error.message));
          });
          
        } else {
          reject(new Error('JSZip库未加载'));
        }
        
      } catch (error) {
        reject(new Error('创建EPUB失败: ' + error.message));
      }
    });
  }
  
  /**
   * 生成UUID
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * 转义XML特殊字符
   */
  function escapeXml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  /**
   * 转义HTML特殊字符
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * 格式化文本为HTML
   */
  function formatTextForHtml(text) {
    if (!text) return '';
    
    // 先转义特殊字符
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r\n/g, '\n') // 统一换行符
      .replace(/\r/g, '\n');
    
    // 处理段落：两个以上换行符作为段落分隔
    html = html.replace(/\n{3,}/g, '</p><p>');
    
    // 处理单个换行：如果前面不是段落结束，则作为<br>
    html = html.replace(/\n/g, (match, offset, str) => {
      // 检查前面是否有段落结束标签
      const before = str.substring(0, offset);
      if (before.endsWith('</p>') || before.endsWith('<br/>')) {
        return '';
      }
      return '<br/>';
    });
    
    // 包裹在段落标签中
    if (!html.startsWith('<p>')) {
      html = '<p>' + html;
    }
    if (!html.endsWith('</p>')) {
      html = html + '</p>';
    }
    
    return html;
  }
});