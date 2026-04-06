const fs = require('fs');
const path = require('path');

// 颜色映射规则
const colorMappings = [
  // 背景色
  { regex: /#ffffff|#fff\b|white(?!-)/gi, replacement: 'var(--bg-primary)' },
  { regex: /#fafafa|#f9fafb|#f8f9fa/gi, replacement: 'var(--bg-secondary)' },
  { regex: /#f3f4f6|#f0f0f0|#f5f5f5/gi, replacement: 'var(--bg-tertiary)' },
  
  // 文字色
  { regex: /#1a1a1a|#111827|#333333|#333\b(?!\d)|#000000|#000\b(?!\d)/gi, replacement: 'var(--text-primary)' },
  { regex: /#666666|#666\b(?!\d)|#6b7280|#4a4a4a/gi, replacement: 'var(--text-secondary)' },
  { regex: /#999999|#999\b(?!\d)|#9ca3af/gi, replacement: 'var(--text-tertiary)' },
  
  // 主色调
  { regex: /#14b8a6|#2dd4bf/gi, replacement: 'var(--primary-color)' },
  { regex: /#0d9488/gi, replacement: 'var(--primary-600)' },
  { regex: /#f0fdfa/gi, replacement: 'var(--primary-50)' },
  { regex: /#ccfbf1/gi, replacement: 'var(--primary-100)' },
  
  // 功能色
  { regex: /#dc2626|#ef4444/gi, replacement: 'var(--error-color)' },
  { regex: /#f59e0b/gi, replacement: 'var(--warning-color)' },
  { regex: /#22c55e/gi, replacement: 'var(--success-color)' },
  { regex: /#3b82f6|#a855f7/gi, replacement: 'var(--info-color)' },
  
  // 边框
  { regex: /#eeeeee|#eee\b(?!\d)|#e5e5e5|#e2e8f0/gi, replacement: 'var(--border-color)' },
  
  // 其他常用色
  { regex: /#fee2e2/gi, replacement: 'rgba(239, 68, 68, 0.1)' },
  { regex: /#fecaca/gi, replacement: 'rgba(239, 68, 68, 0.2)' },
  { regex: /#ecfdf5/gi, replacement: 'var(--primary-50)' },
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
    
    colorMappings.forEach(({ regex, replacement }) => {
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

console.log('🎨 开始更新CSS变量...\n');

files.forEach(processFile);

console.log('\n✨ 完成！');
