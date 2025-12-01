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
  const toggleDebug = document.getElementById('toggleDebug');
  const debugInfo = document.getElementById('debugInfo');
  
  let debugMode = false;
  
  // 调试模式切换
  toggleDebug.addEventListener('click', function() {
    debugMode = !debugMode;
    debugInfo.style.display = debugMode ? 'block' : 'none';
    toggleDebug.textContent = debugMode ? '隐藏调试信息' : '显示调试信息';
  });
  
  // 添加调试信息
  function addDebugInfo(message) {
    if (debugMode) {
      const time = new Date().toLocaleTimeString();
      debugInfo.innerHTML += `[${time}] ${message}<br>`;
      debugInfo.scrollTop = debugInfo.scrollHeight;
    }
    console.log(message);
  }
  
  // 清空调试信息
  function clearDebugInfo() {
    debugInfo.innerHTML = '';
  }

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
      addDebugInfo('读取TXT文件...');
      const file = txtFile.files[0];
      const textContent = await readTextFile(file);
      addDebugInfo(`文件读取完成，大小: ${textContent.length} 字符`);
      
      progressBar.style.width = '20%';

      // 2. 读取封面图
      let coverDataUrl = null;
      if (coverImg.files[0]) {
        addDebugInfo('读取封面图片...');
        coverDataUrl = await readFileAsDataUrl(coverImg.files[0]);
      }
      progressBar.style.width = '30%';

      // 3. 拆分章节
      addDebugInfo('拆分章节...');
      const chapters = splitChapters(textContent);
      addDebugInfo(`找到 ${chapters.length} 个章节`);
      
      if (chapters.length === 0) {
        // 如果没有章节，创建单章
        chapters.push({
          title: '全文',
          content: textContent
        });
        addDebugInfo('未检测到章节，创建单章');
      }
      
      // 显示前几个章节标题
      if (chapters.length > 0) {
        chapters.slice(0, 3).forEach((chap, i) => {
          addDebugInfo(`章节${i+1}: ${chap.title.substring(0, 50)}...`);
        });
      }
      
      progressBar.style.width = '60%';

      // 4. 生成EPUB
      addDebugInfo('生成EPUB文件...');
      const epubBlob = await createEpub({
        title: bookTitle.value.trim(),
        author: bookAuthor.value.trim(),
        cover: coverDataUrl,
        chapters: chapters
      });
      progressBar.style.width = '90%';

      // 5. 创建下载链接
      const url = URL.createObjectURL(epubBlob);
      downloadLink.href = url;
      downloadLink.download = `${bookTitle.value.trim()}_${bookAuthor.value.trim()}.epub`;
      downloadLink.style.display = 'block';
      
      progressBar.style.width = '100%';

      // 恢复状态
      generateBtn.disabled = false;
      generateBtn.textContent = '生成EPUB';
      addDebugInfo(`✅ 生成成功！共 ${chapters.length} 个章节，文件大小: ${formatFileSize(epubBlob.size)}`);
      
      // 显示成功消息
      setTimeout(() => {
        alert(`✅ 生成成功！\n共拆分 ${chapters.length} 个章节\n文件大小: ${formatFileSize(epubBlob.size)}\n请点击下载按钮保存文件。`);
      }, 300);

    } catch (error) {
      console.error('生成失败:', error);
      generateBtn.disabled = false;
      generateBtn.textContent = '生成EPUB';
      progressContainer.style.display = 'none';
      addDebugInfo(`❌ 生成失败: ${error.message}`);
      alert('❌ 生成失败：' + error.message);
    }
  });

  // ---------------------- 工具函数 ----------------------
  
  /**
   * 读取文本文件（处理编码问题）
   */
  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // 先尝试UTF-8
      reader.onload = function(e) {
        const text = e.target.result;
        
        // 检查是否有常见乱码字符
        if (hasGarbledText(text)) {
          addDebugInfo('检测到乱码，尝试GB18030编码...');
          
          // 重新以ArrayBuffer方式读取，尝试不同编码
          const reader2 = new FileReader();
          reader2.onload = function(e2) {
            const buffer = e2.target.result;
            // 尝试常见中文编码
            const encodings = ['gb18030', 'gbk', 'gb2312', 'big5', 'utf-8'];
            
            for (const encoding of encodings) {
              try {
                const decoder = new TextDecoder(encoding);
                const decoded = decoder.decode(new Uint8Array(buffer));
                
                // 检查解码结果是否合理
                if (!hasGarbledText(decoded)) {
                  addDebugInfo(`使用 ${encoding} 编码成功`);
                  resolve(decoded);
                  return;
                }
              } catch (e) {
                // 尝试下一个编码
                continue;
              }
            }
            
            // 所有编码都失败，返回原始文本
            addDebugInfo('无法确定编码，使用原始文本');
            resolve(text);
          };
          
          reader2.onerror = () => reject(new Error('文件读取失败'));
          reader2.readAsArrayBuffer(file.slice(0, Math.min(file.size, 1024 * 1024))); // 只读前1MB尝试解码
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
    
    // 检查样本
    const sample = text.substring(0, Math.min(text.length, 1000));
    
    // 常见乱码模式
    const garbledPatterns = [
      /�{3,}/g, // 连续多个问号
      /[\uFFFD]/g, // Unicode替换字符
      /[^\u0000-\u007F\u4E00-\u9FFF，。！？《》【】、；：'"（）\s\n\r]/g // 非中英文常见字符
    ];
    
    for (const pattern of garbledPatterns) {
      const matches = sample.match(pattern);
      if (matches && matches.length > sample.length * 0.1) { // 超过10%的字符是乱码
        return true;
      }
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
   * 拆分章节（智能检测）
   */
  function splitChapters(text) {
    const chapters = [];
    
    // 获取用户设置的前缀后缀
    const prefix1 = chapterPrefix1.value.trim();
    const suffix1 = chapterSuffix1.value.trim();
    const prefix2 = chapterPrefix2.value.trim();
    const suffix2 = chapterSuffix2.value.trim();
    
    // 构建正则表达式
    const patterns = [];
    
    // 用户自定义模式
    if (prefix1) {
      patterns.push(new RegExp(`${escapeRegExp(prefix1)}[一二三四五六七八九十百千万零〇壹贰叁肆伍陆柒捌玖拾佰仟0-9]+${escapeRegExp(suffix1)}`, 'g'));
      patterns.push(new RegExp(`${escapeRegExp(prefix1)}\\d+${escapeRegExp(suffix1)}`, 'g'));
    }
    
    if (prefix2) {
      patterns.push(new RegExp(`${escapeRegExp(prefix2)}[一二三四五六七八九十百千万零〇壹贰叁肆伍陆柒捌玖拾佰仟0-9]+${escapeRegExp(suffix2)}`, 'g'));
      patterns.push(new RegExp(`${escapeRegExp(prefix2)}\\d+${escapeRegExp(suffix2)}`, 'g'));
    }
    
    // 常见章节模式（备用）
    const commonPatterns = [
      /第[一二三四五六七八九十百千万零〇壹贰叁肆伍陆柒捌玖拾佰仟]+章/g,
      /第\d+章/g,
      /第[0-9]+章/g,
      /第\s*[一二三四五六七八九十]+\s*章/g,
      /第\s*\d+\s*章/g,
      /^第.+章$/gm,
      /^[一二三四五六七八九十]+、/gm,
      /^\d+、/gm,
      /^CHAPTER\s+\d+/gmi,
      /^Section\s+\d+/gmi
    ];
    
    // 合并所有模式
    const allPatterns = [...patterns, ...commonPatterns];
    
    // 查找所有匹配位置
    const chapterPositions = [];
    
    for (const pattern of allPatterns) {
      let match;
      pattern.lastIndex = 0; // 重置正则索引
      
      while ((match = pattern.exec(text)) !== null) {
        // 避免重复添加
        const isDuplicate = chapterPositions.some(pos => 
          Math.abs(pos.index - match.index) < 10
        );
        
        if (!isDuplicate) {
          chapterPositions.push({
            index: match.index,
            title: match[0].trim(),
            length: match[0].length
          });
        }
        
        // 避免无限循环
        if (pattern.lastIndex === match.index) {
          pattern.lastIndex++;
        }
      }
    }
    
    // 按位置排序
    chapterPositions.sort((a, b) => a.index - b.index);
    
    addDebugInfo(`找到 ${chapterPositions.length} 个章节位置`);
    
    // 如果找到章节，分割内容
    if (chapterPositions.length > 0) {
      for (let i = 0; i < chapterPositions.length; i++) {
        const current = chapterPositions[i];
        const next = chapterPositions[i + 1];
        
        const start = current.index + current.length;
        const end = next ? next.index : text.length;
        
        let chapterContent = text.substring(start, end).trim();
        
        // 清理开头多余的空行
        chapterContent = chapterContent.replace(/^[\r\n\s]+/, '');
        
        if (chapterContent) {
          chapters.push({
            title: current.title,
            content: chapterContent
          });
        }
      }
    }
    
    return chapters;
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
        
        // 3. 内容文件（XHTML）
        const chapterHtml = chapters.map((chapter, index) => `
  <div id="chapter-${index + 1}" class="chapter">
    <h2>${escapeHtml(chapter.title)}</h2>
    <p>${formatTextForHtml(chapter.content)}</p>
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
      font-size: 1.1em;
    }
    h1 { 
      text-align: center; 
      margin-bottom: 1em; 
      font-size: 2em;
    }
    h2 { 
      text-align: center; 
      margin: 1.5em 0 1em 0; 
      font-size: 1.5em;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.3em;
    }
    p { 
      text-indent: 2em; 
      margin: 0.5em 0;
    }
    .cover { 
      text-align: center; 
      margin: 2em 0; 
    }
    .cover img {
      max-width: 80%;
      height: auto;
      margin: 0 auto;
    }
    .chapter {
      page-break-before: always;
    }
  </style>
</head>
<body>
  <div id="cover">
    <h1>${escapeHtml(title)}</h1>
    <h2>${escapeHtml(author)}</h2>
    ${cover ? '<div class="cover"><img src="cover.jpg" alt="封面" /></div>' : ''}
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * 格式化文本为HTML
   */
  function formatTextForHtml(text) {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r\n/g, '\n') // 统一换行符
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '</p><p>') // 多个空行分段
      .replace(/\n/g, '<br/>')       // 单个换行
      .replace(/^<br\/>/, '')        // 去除开头的换行
      .replace(/<br\/>$/, '');      // 去除结尾的换行
  }
});