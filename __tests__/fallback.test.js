import { fallbackGenerate } from '../modules/fallbackGenerator.js';

describe('Fallback Generator', () => {
  test('should generate content without API key', () => {
    const content = fallbackGenerate('Motivational', 'short');
    
    expect(content).toHaveProperty('topic');
    expect(content).toHaveProperty('script');
    expect(content).toHaveProperty('titles');
    expect(content).toHaveProperty('description');
    expect(content).toHaveProperty('hashtags');
    expect(content.generated_by).toBe('fallback');
  });
  
  test('should generate non-empty titles', () => {
    const content = fallbackGenerate('Motivational', 'short');
    
    expect(content.titles.length).toBeGreaterThan(0);
    expect(content.titles[0].length).toBeGreaterThan(10);
    expect(content.titles[0].length).toBeLessThanOrEqual(100);
  });
  
  test('should generate non-empty description', () => {
    const content = fallbackGenerate('Finance', 'short');
    
    expect(content.description).toBeTruthy();
    expect(content.description.length).toBeGreaterThan(20);
  });
  
  test('should generate hashtags array', () => {
    const content = fallbackGenerate('Psychology', 'short');
    
    expect(Array.isArray(content.hashtags)).toBe(true);
    expect(content.hashtags.length).toBeGreaterThan(0);
  });
});
