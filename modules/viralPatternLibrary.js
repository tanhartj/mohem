export const VIRAL_TITLE_PATTERNS = [
  {
    id: 1,
    pattern: '{Number} {Action} That Will {Benefit}',
    examples: ['7 Habits That Will Change Your Life', '5 Steps That Will Make You Rich'],
    viralScore: 95,
    category: 'list'
  },
  {
    id: 2,
    pattern: 'Why {Common Thing} Is Actually {Surprising Truth}',
    examples: ['Why Being Lazy Is Actually Good For You', 'Why Failure Is Actually Success'],
    viralScore: 92,
    category: 'curiosity'
  },
  {
    id: 3,
    pattern: 'The {Adjective} Truth About {Topic}',
    examples: ['The Shocking Truth About Success', 'The Hidden Truth About Money'],
    viralScore: 90,
    category: 'truth'
  },
  {
    id: 4,
    pattern: 'How I {Achievement} in {Timeframe}',
    examples: ['How I Made $10,000 in 30 Days', 'How I Lost 50 Pounds in 3 Months'],
    viralScore: 88,
    category: 'achievement'
  },
  {
    id: 5,
    pattern: '{Number} Signs You\'re {Condition}',
    examples: ['10 Signs You\'re Smarter Than Average', '7 Signs You\'re About To Be Rich'],
    viralScore: 87,
    category: 'list'
  },
  {
    id: 6,
    pattern: 'Never {Negative Action} Again After Watching This',
    examples: ['Never Fail Again After Watching This', 'Never Be Broke Again After Watching This'],
    viralScore: 86,
    category: 'urgency'
  },
  {
    id: 7,
    pattern: 'What {Authority Figure} Don\'t Want You To Know',
    examples: ['What Banks Don\'t Want You To Know', 'What Billionaires Don\'t Want You To Know'],
    viralScore: 85,
    category: 'conspiracy'
  },
  {
    id: 8,
    pattern: '{Timeframe} To {Goal} (Proven Method)',
    examples: ['30 Days To Financial Freedom (Proven Method)', '7 Days To Perfect Health (Proven Method)'],
    viralScore: 84,
    category: 'method'
  },
  {
    id: 9,
    pattern: 'Stop {Common Behavior} And Start {Better Behavior}',
    examples: ['Stop Working Hard And Start Working Smart', 'Stop Saving Money And Start Investing'],
    viralScore: 83,
    category: 'advice'
  },
  {
    id: 10,
    pattern: 'The {Adjective} Secret To {Desire}',
    examples: ['The Simple Secret To Success', 'The Hidden Secret To Wealth'],
    viralScore: 82,
    category: 'secret'
  }
];

export const VIRAL_HOOKS = {
  shock: [
    'You won\'t believe what happened next...',
    'This will blow your mind...',
    'WARNING: This might change everything you know...',
    'What I\'m about to reveal is shocking...'
  ],
  curiosity: [
    'Ever wondered why...',
    'The secret nobody tells you about...',
    'Here\'s what they don\'t teach in school...',
    'This one thing changes everything...'
  ],
  urgency: [
    'RIGHT NOW, this is happening...',
    'Before it\'s too late, you need to know...',
    'This won\'t last forever...',
    'Time is running out to...'
  ],
  authority: [
    'After studying 1000 millionaires, I discovered...',
    'Experts say this is the key to...',
    'Research proves that...',
    'Scientists found out that...'
  ],
  emotion: [
    'This made me cry...',
    'I couldn\'t believe my eyes when...',
    'This changed my life forever...',
    'The moment I realized this, everything changed...'
  ]
};

export const THUMBNAIL_TEMPLATES = {
  shockedFace: {
    name: 'Shocked Face',
    description: 'Person with shocked/surprised expression',
    elements: ['Large expressive face', 'Bright background', 'Big bold text', 'Arrows or circles'],
    viralScore: 95,
    bestFor: ['Facts', 'Mind-blowing', 'Shocking revelations']
  },
  beforeAfter: {
    name: 'Before/After Split',
    description: 'Split screen showing transformation',
    elements: ['Split screen', 'Dramatic difference', 'Arrows', 'Contrasting colors'],
    viralScore: 90,
    bestFor: ['Transformation', 'Progress', 'Results']
  },
  moneyStack: {
    name: 'Money/Wealth Visual',
    description: 'Dollar bills, gold, luxury items',
    elements: ['Money imagery', 'Wealth symbols', 'Bold numbers', 'Green/gold colors'],
    viralScore: 88,
    bestFor: ['Finance', 'Money', 'Success', 'Wealth']
  },
  questionMark: {
    name: 'Question Mystery',
    description: 'Big question mark with curiosity elements',
    elements: ['Huge ? symbol', 'Dark mysterious background', 'Contrasting text', 'Thought bubble'],
    viralScore: 85,
    bestFor: ['Questions', 'Mysteries', 'Unknowns']
  },
  dramaticText: {
    name: 'Dramatic Bold Text',
    description: 'Minimal with huge impactful text',
    elements: ['Very large text', 'High contrast', 'Simple background', 'One powerful word'],
    viralScore: 83,
    bestFor: ['Simple messages', 'Direct statements', 'Commands']
  }
};

export const SEO_KEYWORDS_BY_NICHE = {
  'Motivational / Success Mindset': [
    'success', 'motivation', 'mindset', 'growth', 'goals', 'habits',
    'personal development', 'self improvement', 'discipline', 'focus'
  ],
  'Facts & Mind-blowing Info': [
    'facts', 'did you know', 'amazing', 'incredible', 'science',
    'mind blowing', 'unbelievable', 'shocking', 'discovery'
  ],
  'AI-narrated Short Stories / Reddit Stories': [
    'story', 'reddit', 'true story', 'real life', 'confession',
    'dramatic', 'relationship', 'revenge', 'karma'
  ],
  'Finance / Side Hustles / Make Money': [
    'make money', 'side hustle', 'passive income', 'financial freedom',
    'wealth', 'invest', 'earn', 'business', 'entrepreneur'
  ],
  'Psychology Hacks & Human Behavior': [
    'psychology', 'human behavior', 'mind tricks', 'mental',
    'brain', 'hack', 'influence', 'persuasion', 'social skills'
  ],
  'Top 10 Lists': [
    'top 10', 'best', 'worst', 'list', 'ranking',
    'countdown', 'facts', 'things', 'ways', 'reasons'
  ]
};

export const CONTENT_ANGLES = {
  controversy: [
    'Everyone is wrong about {topic}',
    'The truth about {topic} they hide from you',
    'Why {popular opinion} is actually wrong'
  ],
  transformation: [
    'From {negative state} to {positive state}',
    'How I went from {before} to {after}',
    'The journey from {struggle} to {success}'
  ],
  challenge: [
    'I tried {thing} for {timeframe} and here\'s what happened',
    '{Number} day {activity} challenge',
    'Can you {difficult task}? I did and...'
  ],
  comparison: [
    '{Option A} vs {Option B}: Which is better?',
    'Rich vs Poor: The {comparison}',
    '{Year 1} vs {Year 2}: How things changed'
  ]
};

export function getRandomPattern(category = null) {
  const patterns = category 
    ? VIRAL_TITLE_PATTERNS.filter(p => p.category === category)
    : VIRAL_TITLE_PATTERNS;
  
  return patterns[Math.floor(Math.random() * patterns.length)];
}

export function getTopPatterns(count = 10) {
  return VIRAL_TITLE_PATTERNS
    .sort((a, b) => b.viralScore - a.viralScore)
    .slice(0, count);
}

export function getHooksByType(type, count = 3) {
  const hooks = VIRAL_HOOKS[type] || VIRAL_HOOKS.curiosity;
  return hooks.slice(0, count);
}

export default {
  VIRAL_TITLE_PATTERNS,
  VIRAL_HOOKS,
  THUMBNAIL_TEMPLATES,
  SEO_KEYWORDS_BY_NICHE,
  CONTENT_ANGLES,
  getRandomPattern,
  getTopPatterns,
  getHooksByType
};
