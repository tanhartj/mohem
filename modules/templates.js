export const NICHE_PROMPTS = {
  Motivational: {
    short: {
      system: 'You are a viral motivational content creator. Create short-form content that inspires and motivates.',
      prompt: 'Create a 30-second motivational script about: {topic}\n\nMake it powerful, emotional, and actionable.'
    },
    long: {
      system: 'You are a motivational speaker creating long-form content.',
      prompt: 'Create a 5-minute motivational script about: {topic}\n\nInclude stories, actionable advice, and inspiration.'
    }
  },
  'Facts & Info': {
    short: {
      system: 'You are a facts and trivia creator. Make content interesting and mind-blowing.',
      prompt: 'Create a 30-second script about amazing facts related to: {topic}\n\nMake it fascinating and shareable.'
    },
    long: {
      system: 'You are an educational content creator.',
      prompt: 'Create a 5-minute educational script about: {topic}\n\nMake it informative and engaging.'
    }
  },
  Finance: {
    short: {
      system: 'You are a finance educator creating short-form content about money.',
      prompt: 'Create a 30-second script about: {topic}\n\nProvide actionable financial advice.'
    },
    long: {
      system: 'You are a financial advisor creating educational content.',
      prompt: 'Create a 5-minute script about: {topic}\n\nProvide detailed financial education.'
    }
  },
  Psychology: {
    short: {
      system: 'You are a psychology expert creating short-form content about human behavior.',
      prompt: 'Create a 30-second script about: {topic}\n\nExplain fascinating psychology concepts.'
    },
    long: {
      system: 'You are a psychology educator.',
      prompt: 'Create a 5-minute script about: {topic}\n\nExplain psychology concepts in depth.'
    }
  }
};

export const TITLE_TEMPLATES = [
  'The Truth About {topic} Nobody Tells You',
  'Why {topic} Will Change Your Life',
  '{topic}: The Ultimate Guide',
  'How to Master {topic} in 2024',
  '{topic} Explained in 60 Seconds',
  'The Science Behind {topic}',
  '{topic}: What They Don\'t Want You to Know',
  'This {topic} Secret Will Blow Your Mind'
];

export const HASHTAG_SETS = {
  Motivational: ['#motivation', '#success', '#mindset', '#inspiration', '#goals'],
  'Facts & Info': ['#facts', '#knowledge', '#learning', '#interesting', '#didyouknow'],
  Finance: ['#finance', '#money', '#investing', '#wealth', '#financialfreedom'],
  Psychology: ['#psychology', '#humanbehavior', '#mindtricks', '#mentalhealth', '#selfimprovement']
};

export const CTA_TEMPLATES = [
  'Subscribe for more content like this!',
  'Follow for daily insights!',
  'Share this with someone who needs to hear it!',
  'Comment your thoughts below!',
  'Hit that like button if you found this valuable!'
];
