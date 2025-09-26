---
title: 词云分析
date: 2025-09-26 00:00:00
layout: page
comments: false
---

<div class="wordcloud-intro">
  <h3>🌍 博客词汇可视化</h3>
  <p>以下是基于所有博客文章内容的高频词汇分析，点击词汇可以搜索相关内容。</p>
  <p><a href="/search-advanced/" class="search-link">🔍 进入高级搜索</a></p>
</div>

<div class="wordcloud-wrap">
  <div id="wordcloud-empty" class="wordcloud-empty">正在加载词云数据…</div>
</div>

<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script>
(function() {
  const container = document.querySelector('.wordcloud-wrap');
  const emptyEl = document.getElementById('wordcloud-empty');
  const root = (window.CONFIG && window.CONFIG.root) || '/';
  const dataEndpoint = (root.endsWith('/') ? root.slice(0, -1) : root) + '/wordcloud.json';

  let currentWords = [];
  let hasLoaded = false;
  let svg = null;
  let simulation = null;

  function showStatus(message) {
    emptyEl.textContent = message;
    emptyEl.style.display = 'flex';
    if (svg) svg.style('display', 'none');
  }

  function hideStatus() {
    emptyEl.style.display = 'none';
    if (svg) svg.style('display', 'block');
  }

  function initWordCloud() {
    if (typeof d3 === 'undefined') {
      setTimeout(initWordCloud, 100);
      return;
    }
    loadWordCloud();
  }

  function performSearch(word) {
    const query = encodeURIComponent(word);
    
    // 检查是否有本地搜索功能
    if (window.LOCAL_SEARCH && typeof window.LOCAL_SEARCH.search === 'function') {
      // 使用本地搜索API直接搜索
      try {
        window.LOCAL_SEARCH.search(word);
        // 跳转到搜索页面并预填充查询
        const searchUrl = root + (root.endsWith('/') ? '' : '/') + 'search/';
        window.location.href = searchUrl + '?q=' + query;
      } catch (e) {
        // 备用方案：直接跳转搜索页面
        const searchUrl = root + (root.endsWith('/') ? '' : '/') + 'search/?q=' + query;
        window.open(searchUrl, '_blank');
      }
    } else {
      // 备用方案：使用搜索页面
      const searchUrl = root + (root.endsWith('/') ? '' : '/') + 'search/?q=' + query;
      window.open(searchUrl, '_blank');
    }
  }

  function renderWordCloud(words) {
    if (!Array.isArray(words) || words.length === 0) {
      showStatus('词云数据仍然较少，暂时无法生成可视化，请写点新内容吧。');
      return;
    }

    if (typeof d3 === 'undefined') {
      showStatus('词云组件加载失败，请刷新页面重试。');
      return;
    }

    hideStatus();

    // 清理现有的SVG
    d3.select(container).select('svg').remove();
    d3.select(container).select('canvas').remove();

    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width - 32; // 减去padding
    const height = Math.max(600, window.innerHeight * 0.8); // 增大词云高度

    // 创建SVG
    svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('background', 'transparent')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif');

    // 计算字体大小和圆形半径范围
    const counts = words.map(d => d.count);
    const maxCount = d3.max(counts);
    const minCount = d3.min(counts);
    const isMobile = window.innerWidth < 768;

    const logistic = (x) => 1 / (1 + Math.exp(-x));
    const applySigmoidRange = (value) => {
      const scaled = Math.max(0, Math.min(1.5, value * 1.5));
      const center = 0.75;
      const steepness = 4.2;
      const minSig = logistic(-steepness * center);
      const maxSig = logistic(steepness * (1.5 - center));
      return (logistic(steepness * (scaled - center)) - minSig) / (maxSig - minSig);
    };
    const normalizeCount = (count) => {
      if (!isFinite(maxCount) || !isFinite(minCount) || maxCount === minCount) {
        return applySigmoidRange(0.5);
      }
      const linear = (count - minCount) / (maxCount - minCount);
      return applySigmoidRange(linear);
    };

    const fontScale = (count) => {
      const normalized = normalizeCount(count);
      const minFont = isMobile ? 10 : 12;
      const maxFont = isMobile ? 18 : 22;
      return minFont + (maxFont - minFont) * normalized;
    };

    const radiusScale = (count) => {
      const normalized = normalizeCount(count);
      const minRadius = isMobile ? 20 : 25;
      const maxRadius = isMobile ? 50 : 65;
      return minRadius + (maxRadius - minRadius) * normalized;
    };

    // 准备数据
    const nodes = words.map((d, i) => ({
      id: d.text,
      text: d.text,
      count: d.count,
      fontSize: fontScale(d.count),
      radius: radiusScale(d.count),
      x: Math.random() * width,
      y: Math.random() * height,
      index: i
    }));

    // 生成连接关系 - 基于词频相似性和语义关联
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length && j < i + 3; j++) { // 每个节点最多连接3个邻近节点
        const source = nodes[i];
        const target = nodes[j];
        // 基于词频差异决定连接强度
        const strengthDiff = Math.abs(source.count - target.count) / maxCount;
        if (strengthDiff < 0.3 || Math.random() < 0.2) { // 词频相似或随机连接
          links.push({
            source: source,
            target: target,
            strength: 1 - strengthDiff
          });
        }
      }
    }

    // 创建力导向布局
    simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-80)) // 增强排斥力
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 5)) // 使用圆形半径
      .force('link', d3.forceLink(links).id(d => d.id).strength(d => d.strength * 0.1))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    // 绘制连线
    const linkElements = svg.selectAll('.link')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'link')
            .style('stroke', 'rgba(139, 157, 195, 0.4)')
      .style('stroke-width', d => Math.max(0.5, d.strength * 2))
      .style('stroke-opacity', 0.5);

    // 创建节点组容器
    const nodeGroups = svg.selectAll('.node-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        performSearch(d.text);
      })
      .on('mouseover', function(event, d) {
        d3.select(this).select('circle')
          .style('transform', 'scale(1.1)')
          .style('filter', 'drop-shadow(0 6px 16px rgba(0,0,0,0.2))');
        
        d3.select(this).select('text')
          .style('font-weight', '700')
          .style('text-shadow', '0 2px 4px rgba(0,0,0,0.4)');
        
        // 显示工具提示
        const tooltip = d3.select('body').selectAll('.word-tooltip').data([0]);
        const tooltipEnter = tooltip.enter().append('div')
          .attr('class', 'word-tooltip')
          .style('position', 'absolute')
          .style('background', 'linear-gradient(135deg, #667eea, #764ba2)')
          .style('color', 'white')
          .style('padding', '12px 18px')
          .style('border-radius', '12px')
          .style('font-size', '14px')
          .style('font-weight', '500')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .style('opacity', 0)
          .style('box-shadow', '0 8px 24px rgba(0,0,0,0.2)')
          .style('backdrop-filter', 'blur(8px)')
          .style('border', '1px solid rgba(255,255,255,0.1)');
        
        tooltip.merge(tooltipEnter)
          .html(`<span style="font-size: 16px; font-weight: 600;">「${d.text}」</span><br><span style="opacity: 0.9; font-size: 12px;">出现 ${d.count} 次 • 点击搜索相关内容</span>`)
          .style('left', (event.pageX + 15) + 'px')
          .style('top', (event.pageY - 60) + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);
      })
      .on('mouseout', function(event, d) {
        d3.select(this).select('circle')
          .style('transform', 'scale(1)')
          .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))');
        
        d3.select(this).select('text')
          .style('font-weight', '600')
          .style('text-shadow', '0 1px 2px rgba(0,0,0,0.3)');
        
        d3.select('body').selectAll('.word-tooltip')
          .transition()
          .duration(200)
          .style('opacity', 0)
          .remove();
      })
      .call(d3.drag()
        .on('start', function(event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', function(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', function(event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // 为每个节点添加圆形背景
    nodeGroups.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => d.radius)
      .style('fill', (d, i) => {
        // 低饱和度蓝灰色系
        const colors = [
          '#8b9dc3', '#a8b5c8', '#7a8fa8', '#9eb3c7',
          '#6b7fa8', '#98adc7', '#8596b8', '#a3b8cc'
        ];
        return colors[i % colors.length];
      })
      .style('stroke', 'rgba(139, 157, 195, 0.3)')
      .style('stroke-width', 1.5)
      .style('opacity', 0.85)
      .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))');

    // 创建文本元素
    nodeGroups.append('text')
      .attr('class', 'node-text')
      .text(d => d.text)
      .attr('font-size', d => d.fontSize + 'px')
      .attr('font-weight', '600')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('fill', '#ffffff')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.3)')
      .style('user-select', 'none')
      .style('pointer-events', 'none')
      .style('font-family', 'inherit'); // 继承父元素的清新字体

    // 更新位置
    simulation.on('tick', () => {
      // 更新连线位置
      linkElements
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      // 更新节点组位置（限制在画布范围内）
      nodeGroups.attr('transform', d => {
        const padding = Math.max(d.fontSize/2 + 10, 30);
        const x = Math.max(padding, Math.min(width - padding, d.x));
        const y = Math.max(padding, Math.min(height - padding, d.y));
        d.x = x; // 更新实际坐标
        d.y = y;
        return `translate(${x},${y})`;
      });
    });

    // 添加说明文字
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#666')
      .style('pointer-events', 'none')
      .text('🔍 点击词汇搜索 • ✋ 拖拽重新排列 • 🔗 连线显示词汇关联');
    
    // 添加统计信息
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#999')
      .style('pointer-events', 'none')
      .text(`共分析 ${words.length} 个高频词汇，基于全部博客文章内容`);
  }

  function loadWordCloud() {
    showStatus('正在加载词云数据…');

    fetch(dataEndpoint + '?_=' + Date.now(), { cache: 'no-store' })
      .then(resp => {
        if (!resp.ok) {
          throw new Error('Network response was not ok');
        }
        return resp.json();
      })
      .then(data => {
        currentWords = Array.isArray(data.words) ? data.words.slice(0, 30) : [];
        hasLoaded = true;
        renderWordCloud(currentWords);
      })
      .catch(error => {
        console.error('Word cloud data loading error:', error);
        hasLoaded = false;
        showStatus('词云数据加载失败，请稍后刷新重试。');
      });
  }

  function handleResize() {
    if (hasLoaded && currentWords.length > 0) {
      // 重新渲染词云以适应新尺寸
      renderWordCloud(currentWords);
    }
  }

  // 防抖处理窗口大小变化
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleResize, 300);
  });

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWordCloud);
  } else {
    initWordCloud();
  }
})();
</script>
