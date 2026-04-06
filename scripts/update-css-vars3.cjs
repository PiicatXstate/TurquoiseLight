const fs = require('fs');
const path = require('path');

// 第三轮颜色映射规则
const additionalMappings = [
  { regex: /#0284c7/gi, replacement: 'var(--info-color)' },
  { regex: /#fffbeb/gi, replacement: 'rgba(245, 158, 11, 0.1)' },
  { regex: /#f1f1f1/gi, replacement: 'var(--bg-tertiary)' },
  { regex: /#c1c1c1/gi, replacement: 'var(--gray-400)' },
  { regex: /#a8a8a8/gi, replacement: 'var(--gray-400)' },
  { regex: /#e0f2f1/gi, replacement: 'var(--primary-100)' },
  { regex: /#f3f3f3/gi, replacement: 'var(--bg-tertiary)' },
  { regex: /#f0f2f5/gi, replacement: 'var(--bg-secondary)' },
  { regex: /#e0f2fe/gi, replacement: 'rgba(6, 182, 212, 0.2)' },
];

// 文件列表
const files = [
  'src/components/ArticleList.vue',
  'src/components/Reader.vue',
  'src/components/Settings.vue',
  'src/components/AIChat.vue',
  'src/components/ArticleSquare.vue',
  'src/components/AuthModal.vue',
  'src/components/Dictionary.vue',
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;
  
  // 只在<style>标签内替换
  const styleRegex = /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi;
  
  content = content.replace(styleRegex, (match, openTag, styleContent, closeTag) => {
    let newStyleContent = styleContent;
    
    additionalMappings.forEach(({ regex, replacement }) => {
      if (regex.test(newStyleContent)) {
        newStyleContent = newStyleContent.replace(regex, replacement);
        modified = true;
      }
    });
    
    return openTag + newStyleContent + closeTag;
  });
  
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ 已更新: ${filePath}`);
  } else {
    console.log(`⏭️  无变化: ${filePath}`);
  }
}

console.log('🎨 开始更新第三轮CSS变量...\n');

files.forEach(processFile);

console.log('\n✨ 完成！');
