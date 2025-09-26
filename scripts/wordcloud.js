const { stripHTML } = require('hexo-util');
const { Segment, useDefault } = require('segmentit');

const segmenter = useDefault(new Segment());

const ENGLISH_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has', 'have', 'had',
  'he', 'she', 'it', 'its', 'i', 'in', 'into', 'is', 'of', 'on', 'or', 'so', 'such', 'that',
  'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'to', 'was', 'we',
  'were', 'will', 'with', 'you', 'your', 'yours', 'not', 'can', 'just', 'also', 'than', 'when',
  'where', 'who', 'what', 'which', 'while', 'why', 'how', 'about', 'after', 'before', 'between',
  'through', 'over', 'under', 'again', 'further', 'once', 'because', 'during', 'without', 'each',
  'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own', 'same',
  'too', 'very', 's', 't', 'can', 'will', 'don', 'should', 'now'
]);

const CHINESE_STOPWORDS = new Set([
  '的', '了', '和', '是', '在', '也', '有', '就', '人', '都', '一个', '上', '对', '用', '为', '于', '而',
  '及', '与', '中', '或', '这', '那', '它', '他们', '我们', '你', '你们', '需要', '可能', '没有', '可以',
  '通过', '因为', '所以', '由于', '并', '如果', '那么', '比如', '这个', '一些', '然而', '以及', '其中', '其中'
]);

const MAX_WORDS = 30;
const MIN_COUNT = 2;

function addCount(map, token) {
  if (!token) return;
  const current = map.get(token) || 0;
  map.set(token, current + 1);
}

function extractEnglishTokens(content) {
  const tokens = content.toLowerCase().match(/[a-z0-9][a-z0-9'-]+/g);
  if (!tokens) return [];
  return tokens
    .map(token => token.replace(/^-+|-+$/g, ''))
    .filter(token => token.length > 1 && !ENGLISH_STOPWORDS.has(token));
}

function extractChineseTokens(content) {
  const segmented = segmenter.doSegment(content, { simple: true });
  if (!segmented) return [];
  return segmented
    .map(word => word.trim())
    .filter(word => word.length > 1 && /^[\u4E00-\u9FFF]+$/.test(word) && !CHINESE_STOPWORDS.has(word));
}

hexo.extend.generator.register('wordcloud', function wordcloudGenerator(locals) {
  const frequencies = new Map();

  locals.posts.forEach(post => {
    if (!post.content) return;
    const text = stripHTML(post.content);
    const english = extractEnglishTokens(text);
    english.forEach(token => addCount(frequencies, token));

    const chinese = extractChineseTokens(text);
    chinese.forEach(token => addCount(frequencies, token));
  });

  const payload = Array.from(frequencies.entries())
    .filter(([, count]) => count >= MIN_COUNT)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_WORDS)
    .map(([text, count]) => ({ text, count }));

  return {
    path: 'wordcloud.json',
    data: JSON.stringify({
      generated_at: new Date().toISOString(),
      total_words: frequencies.size,
      words: payload
    }, null, 2)
  };
});
