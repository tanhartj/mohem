import logger from '../utils/logger.js';

export function validateScript(script, type = 'short') {
  if (!script || typeof script !== 'string') {
    return { valid: false, error: 'Script must be a non-empty string' };
  }

  const wordCount = script.split(/\s+/).length;
  
  if (type === 'short') {
    if (wordCount < 30) {
      return { valid: false, error: 'Short script too brief (min 30 words)' };
    }
    if (wordCount > 200) {
      return { valid: false, error: 'Short script too long (max 200 words)' };
    }
  } else if (type === 'long') {
    if (wordCount < 500) {
      return { valid: false, error: 'Long script too brief (min 500 words)' };
    }
    if (wordCount > 2500) {
      return { valid: false, error: 'Long script too long (max 2500 words)' };
    }
  }

  return { valid: true };
}

export function validateTitle(title) {
  if (!title || typeof title !== 'string') {
    return { valid: false, error: 'Title must be a non-empty string' };
  }
  
  if (title.length < 10) {
    return { valid: false, error: 'Title too short (min 10 chars)' };
  }
  
  if (title.length > 100) {
    return { valid: false, error: 'Title too long (max 100 chars)' };
  }
  
  return { valid: true };
}

export function checkContentOriginality(text, existingTexts = []) {
  const normalized = text.toLowerCase().trim();
  
  for (const existing of existingTexts) {
    const similarity = calculateSimilarity(normalized, existing.toLowerCase().trim());
    if (similarity > 0.8) {
      logger.warn('High similarity detected with existing content', { similarity });
      return {
        original: false,
        similarityScore: similarity,
        message: 'Content appears to be duplicate or highly similar to existing content'
      };
    }
  }
  
  return { original: true, similarityScore: 0 };
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

export function validateYouTubeMetadata(metadata) {
  const errors = [];
  
  if (!metadata.title) errors.push('Title is required');
  if (!metadata.description) errors.push('Description is required');
  if (metadata.title && metadata.title.length > 100) errors.push('Title exceeds 100 characters');
  if (metadata.description && metadata.description.length > 5000) errors.push('Description exceeds 5000 characters');
  if (metadata.tags && metadata.tags.length > 500) errors.push('Too many tags (max 500 characters total)');
  
  return {
    valid: errors.length === 0,
    errors
  };
}
