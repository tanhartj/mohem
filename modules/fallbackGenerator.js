import logger from '../utils/logger.js';

const FALLBACK_TEMPLATES = {
  Motivational: {
    short: {
      topics: [
        'The Power of Persistence',
        'Why Most People Quit Too Early',
        'One Habit That Changed Everything',
        'The Secret to Staying Motivated',
        'How to Overcome Self-Doubt'
      ],
      scripts: [
        'Did you know that most successful people failed multiple times before achieving greatness? The difference is they never gave up. Start today, keep going, and success will follow.',
        'Stop waiting for the perfect moment. The perfect moment is now. Take action, make mistakes, learn, and grow. Your future self will thank you.',
        'Success is not about being the best. It\'s about being consistent. Show up every day, put in the work, and watch your dreams become reality.'
      ],
      titles: [
        'This Will Change Your Life Forever',
        'The #1 Secret Successful People Know',
        'Why You Should Never Give Up',
        'The Truth About Success Nobody Tells You',
        'How to Stay Motivated Every Single Day'
      ],
      hashtags: ['#motivation', '#success', '#mindset', '#inspiration', '#nevergiveup']
    },
    long: {
      topics: ['Deep Dive: The Psychology of Success'],
      scripts: ['In this video, we explore the fundamental principles that separate successful people from those who struggle...'],
      titles: ['The Complete Guide to Success Mindset'],
      hashtags: ['#motivation', '#success', '#selfimprovement']
    }
  },
  'Facts & Info': {
    short: {
      topics: ['Amazing Facts You Didn\'t Know', 'Mind-Blowing Science Facts', 'Historical Mysteries'],
      scripts: ['Did you know? The human brain generates enough electricity to power a small light bulb. Our minds are truly incredible machines.'],
      titles: ['Facts That Will Blow Your Mind', 'Science Facts That Sound Fake But Are True'],
      hashtags: ['#facts', '#science', '#amazing', '#mindblowing']
    }
  },
  Finance: {
    short: {
      topics: ['Side Hustle Ideas', 'Passive Income Strategies', 'Money Mindset'],
      scripts: ['Want to make extra income? Here are 3 proven strategies that actually work. Number 2 is my personal favorite.'],
      titles: ['How to Make Money Online in 2024', 'Side Hustles That Actually Work'],
      hashtags: ['#finance', '#money', '#sidehustle', '#passiveincome']
    }
  },
  Psychology: {
    short: {
      topics: ['Psychology Tricks', 'Human Behavior Explained', 'Mental Hacks'],
      scripts: ['Want to read people like a book? This simple psychology trick will change how you understand human behavior forever.'],
      titles: ['Psychology Hacks That Actually Work', 'Read Anyone Like a Book'],
      hashtags: ['#psychology', '#mindtricks', '#humanbehavior']
    }
  }
};

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function fallbackGenerate(niche, type = 'short') {
  logger.info('Using fallback generator', { niche, type });
  
  const nicheTemplates = FALLBACK_TEMPLATES[niche] || FALLBACK_TEMPLATES['Motivational'];
  const templates = nicheTemplates[type] || nicheTemplates.short;
  
  const topic = getRandomElement(templates.topics);
  const script = getRandomElement(templates.scripts);
  const titleBase = getRandomElement(templates.titles);
  
  const titles = [
    titleBase,
    `${topic} - Must Watch!`,
    `The Truth About ${topic}`,
    `${topic} Explained`,
    `Why ${topic} Matters`,
    `${topic}: The Complete Guide`,
    `Everything You Need to Know About ${topic}`,
    `${topic} - Game Changer`,
    `How to Master ${topic}`,
    `${topic} - The Ultimate Secret`
  ].slice(0, 10);
  
  const description = `${script}\n\n🔥 ${topic}\n\nWatch this video to learn more about ${niche.toLowerCase()} and transform your mindset!\n\n✅ Subscribe for more content\n💬 Comment your thoughts below\n📢 Share with someone who needs this\n\n#${niche.replace(/\s+/g, '')} ${templates.hashtags.join(' ')}`;
  
  return {
    topic,
    script,
    titles,
    description,
    hashtags: templates.hashtags,
    niche,
    type,
    generated_by: 'fallback'
  };
}

export default fallbackGenerate;
