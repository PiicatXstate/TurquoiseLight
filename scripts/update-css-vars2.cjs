const fs = require('fs');
const path = require('path');

// 额外的颜色映射规则
const additionalMappings = [
  { regex: /#e5e7eb/gi, replacement: 'var(--gray-200)' },
  { regex: /#d1d5db/gi, replacement: 'var(--gray-300)' },
  { regex: /#9ca3af/gi, replacement: 'var(--gray-400)' },
  { regex: /#6b7280/gi, replacement: 'var(--gray-500)' },
  { regex: /#4b5563/gi, replacement: 'var(--gray-600)' },
  { regex: /#374151/gi, replacement: 'var(--gray-700)' },
  { regex: /#1f2937/gi, replacement: 'var(--gray-800)' },
  { regex: /#111827/gi, replacement: 'var(--gray-900)' },
  { regex: /#fef2f2/gi, replacement: 'rgba(239, 68, 68, 0.05)' },
  { regex: /#fee2e2/gi, replacement: 'rgba(239, 68, 68, 0.1)' },
  { regex: /#fecaca/gi, replacement: 'rgba(239, 68, 68, 0.2)' },
  { regex: /#e9ecef/gi, replacement: 'var(--bg-tertiary)' },
  { regex: /#e3f2fd/gi, replacement: 'rgba(59, 130, 246, 0.1)' },
  { regex: /#1565c0/gi, replacement: 'var(--info-color)' },
  { regex: /#f0f9ff/gi, replacement: 'rgba(6, 182, 212, 0.1)' },
  { regex: /#e0f2fe/gi, replacement: 'rgba(6, 182, 212, 0.2)' },
  { regex: /#ccc(?!c)/gi, replacement: 'var(--gray-300)' },
  { regex: /#ddd(?!d)/gi, replacement: 'var(--gray-300)' },
  { regex: /#bbb(?!b)/gi, replacement: 'var(--gray-400)' },
  { regex: /#aaa(?!a)/gi, replacement: 'var(--gray-400)' },
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

console.log('🎨 开始更新额外CSS变量...\n');

files.forEach(processFile);

console.log('\n✨ 完成！');
