---
title: 马尔可夫链文本生成器
date: 2025-01-28 15:00:00
layout: page
comments: false
---

<div class="markov-page">
<section class="markov-hero glass-card">
<h1>🎲 Markov 链文本生成器</h1>
<p>基于站内文章语料实时生成自然语言文本，支持自定义生成长度、马尔可夫阶数与起始种子词。</p>
</section>

<section class="markov-controls glass-card">
<div class="markov-settings">
<div class="markov-field">
<label for="markov-length">生成长度</label>
<input type="number" id="markov-length" min="10" max="600" value="120" placeholder="请输入文本长度">
</div>
<div class="markov-field">
<label for="markov-order">马尔可夫阶数</label>
<select id="markov-order">
<option value="1">1 阶（基础随机）</option>
<option value="2" selected>2 阶（语感平衡）</option>
<option value="3">3 阶（更贴近原文）</option>
</select>
</div>
<div class="markov-field">
<label for="markov-seed">种子词（可选）</label>
<input type="text" id="markov-seed" placeholder="输入起始词或短语">
</div>
</div>
<div class="markov-actions">
<button class="markov-generate-btn" id="markov-generate-btn">
✨ 生成文本
</button>
</div>
</section>

<section class="markov-output glass-card">
<div class="markov-output-header">
<h3>📝 生成结果</h3>
<button class="markov-copy-btn" id="markov-copy-btn" style="display: none;">
📋 复制文本
</button>
</div>
<div class="markov-output-text" id="markov-output">点击“生成文本”即可开始。</div>
<div class="markov-stats" id="markov-stats" style="display: none;">
<div class="markov-stat">
<strong id="markov-word-count">0</strong>
<span>字数</span>
</div>
            <div class="markov-stat">
                <strong id="markov-char-count">0</strong>
                <span>字符数</span>
            </div>
            <div class="markov-stat">
<strong id="markov-gen-time">0</strong>
<span>生成耗时 (ms)</span>
</div>
</div>
</section>
</div>

<script>
(function() {
    const TOKEN_DELIMITER = '\u0001';
    let cachedSegmenter = null;

    function getSegmenter() {
        if (cachedSegmenter !== null) {
            return cachedSegmenter;
        }
        if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
            const locales = ['zh-Hans', 'zh-CN', 'zh', 'en', 'und'];
            for (const locale of locales) {
                try {
                    cachedSegmenter = new Intl.Segmenter(locale, { granularity: 'word' });
                    return cachedSegmenter;
                } catch (err) {
                    // Ignore locale errors and try next candidate
                }
            }
        }
        cachedSegmenter = null;
        return cachedSegmenter;
    }

    function tokenize(text) {
        if (!text) return [];
        const segmenter = getSegmenter();
        if (segmenter) {
            const tokens = [];
            try {
                for (const item of segmenter.segment(text)) {
                    const segment = item.segment;
                    if (!segment) continue;
                    if (item.isWordLike) {
                        tokens.push(segment);
                    } else {
                        const trimmed = segment.trim();
                        if (!trimmed) continue;
                        const extras = trimmed.match(/[\u4E00-\u9FFF]+|[A-Za-z0-9]+|[^\s]/g);
                        if (extras) tokens.push(...extras);
                    }
                }
                if (tokens.length) return tokens;
            } catch (err) {
                console.warn('Segmenter unavailable, falling back to manual tokenization:', err);
            }
        }
        const manual = text.match(/[\u4E00-\u9FFF]+|[A-Za-z0-9]+|[，。！？、；：“”‘’（）《》〈〉【】〔〕…—·.,!?;:"'()\-]/g);
        if (manual) return manual;
        return Array.from(text);
    }

    function joinTokens(tokens) {
        if (!tokens || !tokens.length) return '';
        let text = tokens.join(' ');
        text = text.replace(/\s+([，。,\.！？!?:;；])/g, '$1');
        text = text.replace(/([（《〈「『“‘])\s+/g, '$1');
        text = text.replace(/\s+([）》〉」』”’])/g, '$1');
        text = text.replace(/([\u4E00-\u9FFF])\s+([\u4E00-\u9FFF])/g, '$1$2');
        text = text.replace(/\s{2,}/g, ' ');
        return text.trim();
    }

    function estimateTokenLength(token) {
        if (!token) return 0;
        return token.replace(/\s+/g, '').length || 1;
    }

    function countMeaningfulUnits(text) {
        return tokenize(text).length;
    }

    class MarkovGenerator {
        constructor(order = 2) {
            this.order = Math.max(1, order);
            this.chain = new Map();
            this.starts = [];
            this.tokens = [];
        }

        train(text) {
            const tokens = tokenize(text);
            this.tokens = tokens;
            this.chain.clear();
            this.starts = [];
            if (!tokens.length) return;

            const effectiveOrder = Math.min(this.order, Math.max(1, tokens.length - 1));
            this.order = effectiveOrder;

            for (let i = 0; i <= tokens.length - effectiveOrder; i++) {
                const keyTokens = tokens.slice(i, i + effectiveOrder);
                const key = keyTokens.join(TOKEN_DELIMITER);
                const nextToken = tokens[i + effectiveOrder];

                if (!this.chain.has(key)) {
                    this.chain.set(key, []);
                }
                if (nextToken !== undefined) {
                    this.chain.get(key).push(nextToken);
                }
                this.starts.push(keyTokens);
            }

            if (!this.starts.length) {
                this.starts.push(tokens.slice(0, effectiveOrder));
            }
        }

        pickStart(seed) {
            if (!this.starts.length) return null;
            if (seed) {
                const normalizedSeed = seed.trim();
                if (normalizedSeed) {
                    const seedMatches = this.starts.filter(seq => {
                        const joined = seq.join('');
                        const spaced = seq.join(' ');
                        return joined.includes(normalizedSeed) || spaced.includes(normalizedSeed);
                    });
                    if (seedMatches.length) {
                        return seedMatches[Math.floor(Math.random() * seedMatches.length)].slice();
                    }
                    const tokenSeed = tokenize(normalizedSeed);
                    if (tokenSeed.length) {
                        const tail = tokenSeed.slice(-this.order);
                        const key = tail.join(TOKEN_DELIMITER);
                        const exact = this.starts.find(seq => seq.join(TOKEN_DELIMITER) === key);
                        if (exact) {
                            return exact.slice();
                        }
                    }
                }
            }
            return this.starts[Math.floor(Math.random() * this.starts.length)].slice();
        }

        generate(targetLength, seed) {
            if (!this.starts.length) return '';
            const initial = this.pickStart(seed) || this.starts[0].slice();
            const tokens = initial.slice();
            let approxLength = tokens.reduce((sum, token) => sum + estimateTokenLength(token), 0);
            const maxIterations = Math.max(32, targetLength * 4);
            let iterations = 0;

            while (approxLength < targetLength && iterations < maxIterations) {
                const key = tokens.slice(-this.order).join(TOKEN_DELIMITER);
                const options = this.chain.get(key);
                if (!options || !options.length) {
                    break;
                }
                const nextToken = options[Math.floor(Math.random() * options.length)];
                if (!nextToken) break;
                tokens.push(nextToken);
                approxLength += estimateTokenLength(nextToken);
                iterations++;
            }

            const text = joinTokens(tokens);
            return this.postprocess(text);
        }

        postprocess(text) {
            if (!text) return '';
            let normalized = text.replace(/\u00A0/g, ' ').replace(/\s{2,}/g, ' ').trim();
            if (!normalized) return '';
            const containsCJK = /[\u4E00-\u9FFF]/.test(normalized);

            if (containsCJK) {
                normalized = normalized.replace(/([^。！？]){80,140}/g, '$1，');
                normalized = normalized.replace(/([^。！？]){140,220}/g, '$1。');
                if (!/[。！？]$/.test(normalized)) {
                    normalized += '。';
                }
            } else {
                normalized = normalized.replace(/([^.!?]){120,200}/g, '$1,');
                normalized = normalized.replace(/([^.!?]){200,260}/g, '$1.');
                if (!/[.!?]$/.test(normalized)) {
                    normalized += '.';
                }
            }

            return normalized;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const postBlock = document.querySelector('.post-block');
        const postHeader = postBlock?.querySelector('.post-header');
        if (postHeader) {
            postHeader.remove();
        }

        const root = (window.CONFIG && typeof window.CONFIG.root === 'string') ? window.CONFIG.root : '/';
        const API_BASE = ((window.MARKOV_API_BASE || '').trim()).replace(/\/$/, '');

        const outputEl = document.getElementById('markov-output');
        const copyBtn = document.getElementById('markov-copy-btn');
        const statsEl = document.getElementById('markov-stats');
        const wordCountEl = document.getElementById('markov-word-count');
        const charCountEl = document.getElementById('markov-char-count');
        const genTimeEl = document.getElementById('markov-gen-time');
        const lengthInput = document.getElementById('markov-length');
        const orderSelect = document.getElementById('markov-order');
        const seedInput = document.getElementById('markov-seed');
        const generateBtn = document.getElementById('markov-generate-btn');

        let fallbackText = '';
        let fallbackGenerator = null;
        let isTrainingFallback = false;

        function joinPath(path) {
            const clean = (path || '').replace(/^\/+/, '');
            if (!root || root === '/') return `/${clean}`;
            return root.endsWith('/') ? `${root}${clean}` : `${root}/${clean}`;
        }

        function decodeEntities(text) {
            if (!text) return '';
            const parser = new DOMParser();
            const doc = parser.parseFromString(`<span>${text}</span>`, 'text/html');
            return doc.body ? (doc.body.textContent || '') : text;
        }

        function cleanMarkdownContent(raw) {
            if (!raw) return '';
            let text = raw.replace(/\r\n/g, '\n');

            text = text.replace(/```[\s\S]*?```/g, ' ');
            text = text.replace(/`[^`]*`/g, ' ');

            text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
            text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

            text = text.replace(/^\s{0,3}[>#]\s?/gm, ' ');
            text = text.replace(/^\s{0,3}[-+*]\s+/gm, ' ');
            text = text.replace(/^\s*\d+\.\s+/gm, ' ');
            text = text.replace(/^#{1,6}\s+/gm, ' ');

            text = text.replace(/\|/g, ' ');
            text = text.replace(/\*\*|__|~~/g, ' ');
            text = text.replace(/[\*_~`]/g, ' ');

            text = text.replace(/<[^>]*>/g, ' ');
            text = decodeEntities(text);

            text = text.replace(/&[#a-zA-Z0-9]+;/g, ' ');
            text = text.replace(/\{\{[^}]+\}\}/g, ' ');
            text = text.replace(/[\\\/%$#*@]/g, ' ');

            return text.replace(/\s+/g, ' ').trim();
        }

        async function loadCorpusText() {
            const buffers = [];

            try {
                const jsonResp = await fetch(joinPath('search.json'));
                if (jsonResp.ok) {
                    const data = await jsonResp.json();
                    const items = Array.isArray(data) ? data : (Array.isArray(data.posts) ? data.posts : []);
                    if (items.length) {
                        const cleaned = items
                            .map(item => `${item.title || ''} ${item.content || item.text || ''}`)
                            .map(cleanMarkdownContent)
                            .filter(Boolean)
                            .join(' ');
                        if (cleaned) {
                            buffers.push(cleaned);
                        }
                    }
                }
            } catch (err) {
                console.warn('加载 search.json 失败：', err);
            }

            if (!buffers.length) {
                try {
                    const atomResp = await fetch(joinPath('atom.xml'));
                    if (atomResp.ok) {
                        const xml = await atomResp.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(xml, 'text/xml');
                        const entries = doc.querySelectorAll('entry');
                        const texts = [];
                        entries.forEach(entry => {
                            const title = entry.querySelector('title')?.textContent || '';
                            const content = entry.querySelector('content')?.textContent || entry.querySelector('summary')?.textContent || '';
                            const cleaned = cleanMarkdownContent(`${title} ${content}`);
                            if (cleaned) {
                                texts.push(cleaned);
                            }
                        });
                        if (texts.length) {
                            buffers.push(texts.join(' '));
                        }
                    }
                } catch (err) {
                    console.warn('加载 atom.xml 失败：', err);
                }
            }

            if (!buffers.length) {
                buffers.push(`
                    人工智能技术持续演进，为数据分析和知识创造提供了全新的可能性。
                    机器学习模型擅长发现模式，深度学习网络擅长刻画复杂关联。
                    自然语言处理让计算机理解人类语言的结构与语义。编程不仅是技术实践，更是一门精致的创作。
                    区块链维护数据可信，零知识证明保障隐私安全。大语言模型展示出惊人的语言理解与生成能力。
                    敏捷开发强调反馈循环与快速迭代，开源社区汇聚全球开发者协同进步。
                    云计算提供弹性资源，物联网连接现实世界与数字空间。持续学习和交流，是技术工作者的共同信念。
                `);
            }

            return buffers
                .map(cleanMarkdownContent)
                .filter(Boolean)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        async function trainFallback(order) {
            if (isTrainingFallback) return;
            isTrainingFallback = true;
            try {
                if (!fallbackText) {
                    fallbackText = await loadCorpusText();
                }
                fallbackGenerator = new MarkovGenerator(order);
                fallbackGenerator.train(fallbackText);
            } catch (err) {
                console.error('本地训练失败：', err);
                throw err;
            } finally {
                isTrainingFallback = false;
            }
        }

        async function ensureFallback(order) {
            if (!fallbackGenerator) {
                await trainFallback(order);
                return;
            }
            if (fallbackGenerator.order !== order) {
                await trainFallback(order);
            }
        }

        async function requestBackend(length, order, seed) {
            if (!API_BASE) return null;
            const payload = { length, order, seed: seed || null };
            const endpoint = `${API_BASE}/generate`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`服务端返回异常：${response.status} ${text}`);
            }
            return response.json();
        }

        function updateStats(stats) {
            if (!stats) {
                statsEl.style.display = 'none';
                return;
            }
            statsEl.style.display = 'flex';
            wordCountEl.textContent = stats.word_count ?? 0;
            charCountEl.textContent = stats.char_count ?? 0;
            genTimeEl.textContent = stats.generation_time_ms ?? 0;
        }

        function setLoading(isLoading) {
            if (isLoading) {
                outputEl.innerHTML = '<span class="markov-loading">🎲 正在生成文本...</span>';
                generateBtn.disabled = true;
                copyBtn.style.display = 'none';
                statsEl.style.display = 'none';
            } else {
                generateBtn.disabled = false;
            }
        }

        function showError(message) {
            outputEl.innerHTML = `<div class="markov-error">❌ ${message}</div>`;
            copyBtn.style.display = 'none';
            statsEl.style.display = 'none';
        }

        async function handleGenerate() {
            const length = Math.max(10, Math.min(parseInt(lengthInput.value || '120', 10), 600));
            const order = Math.max(1, Math.min(parseInt(orderSelect.value || '2', 10), 5));
            const seed = seedInput.value.trim();

            setLoading(true);

            try {
                let result = null;
                if (API_BASE) {
                    try {
                        result = await requestBackend(length, order, seed);
                    } catch (err) {
                        console.warn('远端服务不可用，启用本地生成：', err);
                    }
                }

                if (!result) {
                    await ensureFallback(order);
                    const start = performance.now();
                    const text = fallbackGenerator.generate(length, seed);
                    const duration = Math.max(1, Math.round(performance.now() - start));
                    result = {
                        text,
                        stats: {
                            word_count: countMeaningfulUnits(text),
                            char_count: text.replace(/\s+/g, '').length,
                            generation_time_ms: duration
                        }
                    };
                }

                outputEl.textContent = result.text || '';
                copyBtn.style.display = 'inline-flex';
                updateStats(result.stats);
            } catch (err) {
                console.error(err);
                showError(err.message || '生成失败，请稍后重试。');
            } finally {
                setLoading(false);
            }
        }

        async function handleCopy() {
            try {
                await navigator.clipboard.writeText(outputEl.textContent || '');
                const original = copyBtn.textContent;
                copyBtn.textContent = '✅ 已复制';
                copyBtn.style.background = '#27ae60';
                copyBtn.style.color = '#fff';
                setTimeout(() => {
                    copyBtn.textContent = original;
                    copyBtn.style.background = 'transparent';
                    copyBtn.style.color = '';
                }, 1800);
            } catch (err) {
                console.error('复制失败：', err);
                copyBtn.textContent = '❌ 复制失败';
            }
        }

        generateBtn.addEventListener('click', handleGenerate);
        copyBtn.addEventListener('click', handleCopy);

        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                handleGenerate();
            }
        });

        trainFallback(2).catch(err => console.warn('本地生成器初始化失败：', err));
    });
})();
</script>