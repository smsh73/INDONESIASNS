import OpenAI from 'openai';
import pool from '../../config/database.js';
import logger from '../../config/logger.js';

// 지연 초기화를 위한 OpenAI 클라이언트 getter
let openaiClient = null;
const getOpenAI = () => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY is not set. Sentiment analysis will be disabled.');
      return null;
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

const SENTIMENT_CATEGORIES = ['positive', 'negative', 'neutral', 'hot', 'angry', 'concerned'];

export const analyzeSentiment = async (postId, content, language = 'id') => {
  try {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const openai = getOpenAI();
    if (!openai) {
      logger.warn('OpenAI client not available. Returning default sentiment.');
      return {
        postId,
        sentimentCategory: 'neutral',
        confidenceScore: 0.5,
        analysisDetails: { error: 'OpenAI API key not configured' },
      };
    }

    const prompt = `Analyze the sentiment of the following social media post in ${language === 'id' ? 'Indonesian' : 'English'}. 
Return ONLY a JSON object with the following structure:
{
  "category": "one of: positive, negative, neutral, hot, angry, concerned",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Post content: "${content.substring(0, 1000)}"`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a sentiment analysis expert specializing in Indonesian social media content. Analyze posts and categorize sentiment accurately.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const category = result.category?.toLowerCase();

    if (!SENTIMENT_CATEGORIES.includes(category)) {
      logger.warn(`Invalid sentiment category: ${category}, defaulting to neutral`);
      result.category = 'neutral';
    }

    const sentimentData = {
      postId,
      sentimentCategory: category || 'neutral',
      confidenceScore: parseFloat(result.confidence) || 0.5,
      analysisDetails: {
        reasoning: result.reasoning,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        language,
      },
      modelVersion: process.env.OPENAI_MODEL || 'gpt-4',
    };

    await saveSentimentAnalysis(sentimentData);

    return sentimentData;
  } catch (error) {
    logger.error('Sentiment analysis error:', error);
    
    if (error.message.includes('JSON')) {
      return {
        postId,
        sentimentCategory: 'neutral',
        confidenceScore: 0.5,
        analysisDetails: { error: 'Parsing error' },
      };
    }
    
    throw error;
  }
};

export const analyzeMentionSentiment = async (mentionId, content, language = 'id') => {
  try {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const openai = getOpenAI();
    if (!openai) {
      logger.warn('OpenAI client not available. Returning default sentiment.');
      return {
        mentionId,
        sentimentCategory: 'neutral',
        confidenceScore: 0.5,
        analysisDetails: { error: 'OpenAI API key not configured' },
      };
    }

    const prompt = `Analyze the sentiment of the following social media comment/mention in ${language === 'id' ? 'Indonesian' : 'English'}. 
Return ONLY a JSON object with the following structure:
{
  "category": "one of: positive, negative, neutral, hot, angry, concerned",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Comment content: "${content.substring(0, 1000)}"`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a sentiment analysis expert specializing in Indonesian social media content.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const category = result.category?.toLowerCase();

    if (!SENTIMENT_CATEGORIES.includes(category)) {
      result.category = 'neutral';
    }

    const sentimentData = {
      mentionId,
      sentimentCategory: category || 'neutral',
      confidenceScore: parseFloat(result.confidence) || 0.5,
      analysisDetails: {
        reasoning: result.reasoning,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        language,
      },
      modelVersion: process.env.OPENAI_MODEL || 'gpt-4',
    };

    await saveMentionSentimentAnalysis(sentimentData);

    return sentimentData;
  } catch (error) {
    logger.error('Mention sentiment analysis error:', error);
    throw error;
  }
};

const saveSentimentAnalysis = async (data) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM sentiment_analysis WHERE post_id = $1',
      [data.postId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE sentiment_analysis 
         SET sentiment_category = $1,
             confidence_score = $2,
             analysis_details = $3,
             model_version = $4
         WHERE post_id = $5`,
        [
          data.sentimentCategory,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
          data.postId,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO sentiment_analysis (
          post_id, sentiment_category, confidence_score, analysis_details, model_version
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          data.postId,
          data.sentimentCategory,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
        ]
      );
    }
  } catch (error) {
    logger.error('Save sentiment analysis error:', error);
    throw error;
  }
};

const saveMentionSentimentAnalysis = async (data) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM sentiment_analysis WHERE mention_id = $1',
      [data.mentionId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE sentiment_analysis 
         SET sentiment_category = $1,
             confidence_score = $2,
             analysis_details = $3,
             model_version = $4
         WHERE mention_id = $5`,
        [
          data.sentimentCategory,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
          data.mentionId,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO sentiment_analysis (
          mention_id, sentiment_category, confidence_score, analysis_details, model_version
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          data.mentionId,
          data.sentimentCategory,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
        ]
      );
    }
  } catch (error) {
    logger.error('Save mention sentiment analysis error:', error);
    throw error;
  }
};

