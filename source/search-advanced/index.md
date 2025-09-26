---
title: 全站搜索
date: 2025-09-26 00:00:00
layout: page
comments: false
---
  
  <div class="search-input-section">
    <div class="search-box-wrapper">
      <input type="text" id="advanced-search-input" placeholder="输入关键词搜索全站内容..." autocomplete="off">
      <button id="advanced-search-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
      </button>
    </div>
    <div class="search-suggestions" id="search-suggestions"></div>
  </div>

  <div class="search-filters">
    <label><input type="checkbox" id="filter-title" checked> 标题</label>
    <label><input type="checkbox" id="filter-content" checked> 内容</label>
    <label><input type="checkbox" id="filter-tags" checked> 标签</label>
    <label><input type="checkbox" id="filter-categories" checked> 分类</label>
  </div>

  <div class="search-stats" id="search-stats" style="display: none;">
    找到 <span id="results-count">0</span> 个结果，用时 <span id="search-time">0</span>ms
  </div>

  <div class="search-results" id="search-results"></div>
  
  <div class="search-tips">
    <h5>💡 搜索技巧</h5>
    <ul>
      <li><strong>精确搜索：</strong>使用引号 "词组" 搜索完整词组</li>
      <li><strong>排除词汇：</strong>使用减号 -词汇 排除特定内容</li>
      <li><strong>通配符：</strong>使用星号 * 进行模糊匹配</li>
      <li><strong>多词搜索：</strong>空格分隔多个关键词</li>
    </ul>
  </div>
</div>

<script>
(function() {
  let searchData = [];
  let searchIndex = null;
  const root = (window.CONFIG && window.CONFIG.root) || '/';
  
  // 搜索结果限制
  const MAX_RESULTS = 50;
  const SNIPPET_LENGTH = 150;
  
  // DOM 元素
  const searchInput = document.getElementById('advanced-search-input');
  const searchBtn = document.getElementById('advanced-search-btn');
  const searchResults = document.getElementById('search-results');
  const searchStats = document.getElementById('search-stats');
  const resultsCount = document.getElementById('results-count');
  const searchTime = document.getElementById('search-time');
  const suggestions = document.getElementById('search-suggestions');
  
  // 过滤器
  const filterTitle = document.getElementById('filter-title');
  const filterContent = document.getElementById('filter-content');
  const filterTags = document.getElementById('filter-tags');
  const filterCategories = document.getElementById('filter-categories');

  // 加载搜索数据
  async function loadSearchData() {
    try {
      const response = await fetch(root + 'search.json');
      if (!response.ok) throw new Error('搜索数据加载失败');
      searchData = await response.json();
      buildSearchIndex();
      console.log('搜索数据加载完成，共', searchData.length, '篇文章');
    } catch (error) {
      console.error('搜索数据加载错误:', error);
      showError('搜索功能初始化失败，请刷新页面重试');
    }
  }

  // 构建搜索索引
  function buildSearchIndex() {
    searchIndex = searchData.map((item, index) => ({
      index,
      title: (item.title || '').toLowerCase(),
      content: (item.content || '').toLowerCase(),
      tags: (item.tags || []).map(tag => tag.toLowerCase()),
      categories: (item.categories || []).map(cat => cat.toLowerCase()),
      url: item.url || ''
    }));
  }

  // 执行搜索
  function performSearch(query) {
    if (!query.trim() || !searchIndex) return [];
    
    const startTime = performance.now();
    const normalizedQuery = query.toLowerCase().trim();
    const results = [];
    
    // 解析搜索查询
    const { include, exclude, exact } = parseQuery(normalizedQuery);
    
    searchIndex.forEach(item => {
      const original = searchData[item.index];
      let score = 0;
      let matchedFields = [];
      
      // 检查各个字段
      const checks = [
        { field: 'title', weight: 10, enabled: filterTitle.checked, content: item.title, original: original.title },
        { field: 'content', weight: 1, enabled: filterContent.checked, content: item.content, original: original.content },
        { field: 'tags', weight: 5, enabled: filterTags.checked, content: item.tags.join(' '), original: (original.tags || []).join(', ') },
        { field: 'categories', weight: 3, enabled: filterCategories.checked, content: item.categories.join(' '), original: (original.categories || []).join(', ') }
      ];
      
      for (const check of checks) {
        if (!check.enabled) continue;
        
        const fieldScore = calculateFieldScore(check.content, include, exclude, exact);
        if (fieldScore > 0) {
          score += fieldScore * check.weight;
          matchedFields.push({
            field: check.field,
            content: check.original,
            score: fieldScore
          });
        }
      }
      
      if (score > 0) {
        results.push({
          ...original,
          score,
          matchedFields,
          snippet: generateSnippet(original.content, include)
        });
      }
    });
    
    const endTime = performance.now();
    const sortedResults = results.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
    
    displayResults(sortedResults, query, endTime - startTime);
    return sortedResults;
  }

  // 解析搜索查询
  function parseQuery(query) {
    const include = [];
    const exclude = [];
    const exact = [];
    
    // 提取精确短语 "..."
    query = query.replace(/"([^"]+)"/g, (match, phrase) => {
      exact.push(phrase.toLowerCase());
      return '';
    });
    
    // 提取排除词 -word
    query = query.replace(/-(\S+)/g, (match, word) => {
      exclude.push(word.toLowerCase());
      return '';
    });
    
    // 剩余的词作为包含词
    const words = query.split(/\s+/).filter(word => word.trim());
    include.push(...words);
    
    return { include, exclude, exact };
  }

  // 计算字段匹配分数
  function calculateFieldScore(content, include, exclude, exact) {
    let score = 0;
    
    // 检查排除词
    for (const excludeWord of exclude) {
      if (content.includes(excludeWord)) return 0;
    }
    
    // 检查精确短语
    for (const phrase of exact) {
      if (content.includes(phrase)) {
        score += phrase.length * 2; // 精确匹配高分
      }
    }
    
    // 检查包含词
    for (const word of include) {
      if (content.includes(word)) {
        score += word.length;
        // 额外加分：完整词匹配
        if (new RegExp(`\\b${word}\\b`).test(content)) {
          score += word.length * 0.5;
        }
      }
    }
    
    return score;
  }

  // 生成摘要
  function generateSnippet(content, keywords) {
    if (!content) return '';
    
    let bestStart = 0;
    let maxMatches = 0;
    
    // 寻找包含最多关键词的片段
    for (let i = 0; i < content.length - SNIPPET_LENGTH; i += 50) {
      const snippet = content.substring(i, i + SNIPPET_LENGTH).toLowerCase();
      const matches = keywords.filter(kw => snippet.includes(kw)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestStart = i;
      }
    }
    
    let snippet = content.substring(bestStart, bestStart + SNIPPET_LENGTH);
    
    // 高亮关键词
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      snippet = snippet.replace(regex, '<mark>$1</mark>');
    });
    
    return snippet + (bestStart + SNIPPET_LENGTH < content.length ? '...' : '');
  }

  // 显示搜索结果
  function displayResults(results, query, time) {
    resultsCount.textContent = results.length;
    searchTime.textContent = Math.round(time);
    searchStats.style.display = 'block';
    
    if (results.length === 0) {
      searchResults.innerHTML = `
        <div class="no-results">
          <h3>😔 没有找到相关内容</h3>
          <p>尝试使用不同的关键词或检查拼写</p>
        </div>
      `;
      return;
    }
    
    const html = results.map(result => `
      <article class="search-result-item">
        <h3><a href="${result.url}" class="result-title">${highlightText(result.title, query)}</a></h3>
        <div class="result-meta">
          <span class="result-date">${formatDate(result.date)}</span>
          ${result.categories ? `<span class="result-categories">${result.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}</span>` : ''}
          ${result.tags ? `<span class="result-tags">${result.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}</span>` : ''}
        </div>
        <div class="result-snippet">${result.snippet}</div>
        <div class="result-score">匹配度: ${Math.round(result.score)}</div>
      </article>
    `).join('');
    
    searchResults.innerHTML = html;
  }

  // 高亮文本
  function highlightText(text, query) {
    if (!text || !query) return text;
    const keywords = query.toLowerCase().split(/\s+/);
    let highlighted = text;
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });
    
    return highlighted;
  }

  // 格式化日期
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  }

  // 显示错误
  function showError(message) {
    searchResults.innerHTML = `
      <div class="search-error">
        <h3>⚠️ ${message}</h3>
      </div>
    `;
  }

  // 搜索建议
  function showSuggestions(query) {
    if (!query || query.length < 2) {
      suggestions.innerHTML = '';
      return;
    }
    
    const words = Array.from(new Set(
      searchData.flatMap(item => 
        (item.title + ' ' + item.content).toLowerCase().split(/\W+/)
      )
    )).filter(word => 
      word.length > 2 && word.includes(query.toLowerCase())
    ).slice(0, 8);
    
    if (words.length > 0) {
      suggestions.innerHTML = words.map(word => 
        `<div class="suggestion-item" data-word="${word}">${highlightText(word, query)}</div>`
      ).join('');
    } else {
      suggestions.innerHTML = '';
    }
  }

  // 事件监听
  searchBtn.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    }
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        performSearch(query);
        suggestions.innerHTML = '';
      }
    }
  });

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length > 1) {
      showSuggestions(query);
    } else {
      suggestions.innerHTML = '';
    }
  });

  // 点击建议
  document.addEventListener('click', (e) => {
    if (e.target.matches('.suggestion-item')) {
      const word = e.target.dataset.word;
      searchInput.value = word;
      suggestions.innerHTML = '';
      performSearch(word);
    }
  });

  // 过滤器变化时重新搜索
  [filterTitle, filterContent, filterTags, filterCategories].forEach(filter => {
    filter.addEventListener('change', () => {
      const query = searchInput.value.trim();
      if (query) {
        performSearch(query);
      }
    });
  });

  // URL参数自动搜索
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q');
  if (initialQuery) {
    searchInput.value = initialQuery;
    loadSearchData().then(() => {
      performSearch(initialQuery);
    });
  } else {
    loadSearchData();
  }

  // 焦点到搜索框
  searchInput.focus();
})();
</script>