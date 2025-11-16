import { generateScheduleSlots } from '../schedulers/dailyScheduler.js';

describe('Daily Scheduler', () => {
  test('should generate 15 schedule slots by default', () => {
    const slots = generateScheduleSlots(15);
    expect(slots).toHaveLength(15);
  });
  
  test('should generate slots with correct spacing', () => {
    const slots = generateScheduleSlots(15);
    
    for (let i = 1; i < slots.length; i++) {
      const diff = slots[i].scheduledAt - slots[i-1].scheduledAt;
      const diffMinutes = diff / (60 * 1000);
      
      expect(diffMinutes).toBeGreaterThan(60);
      expect(diffMinutes).toBeLessThan(130);
    }
  });
  
  test('should generate unique time slots', () => {
    const slots = generateScheduleSlots(15);
    const times = slots.map(s => s.scheduledAt);
    const uniqueTimes = new Set(times);
    
    expect(uniqueTimes.size).toBe(15);
  });
});
