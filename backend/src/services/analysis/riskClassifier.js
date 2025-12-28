import OpenAI from 'openai';
import pool from '../../config/database.js';
import logger from '../../config/logger.js';
import { io } from '../../server.js';
import { executeWorkflow } from '../workflows/workflowService.js';

// 지연 초기화를 위한 OpenAI 클라이언트 getter
let openaiClient = null;
const getOpenAI = () => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY is not set. Risk classification will be disabled.');
      return null;
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

const RISK_CATEGORIES = {
  official: ['terrorism', 'crime', 'protest', 'accident', 'emergency'],
  public: ['action_risk', 'protest', 'incident', 'riot', 'accident', 'reaction'],
};

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export const classifyRisk = async (postId, content, isOfficial = false, language = 'id') => {
  try {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const openai = getOpenAI();
    if (!openai) {
      logger.warn('OpenAI client not available. Returning default risk classification.');
      const categories = isOfficial ? RISK_CATEGORIES.official : RISK_CATEGORIES.public;
      return {
        postId,
        riskCategory: categories[0],
        riskLevel: 'low',
        confidenceScore: 0.5,
        analysisDetails: { error: 'OpenAI API key not configured' },
      };
    }

    const categories = isOfficial ? RISK_CATEGORIES.official : RISK_CATEGORIES.public;
    const categoryList = categories.join(', ');

    const prompt = `Analyze the following social media post in ${language === 'id' ? 'Indonesian' : 'English'} for potential risks.
${isOfficial ? 'This is from an official police account. Focus on threats, crimes, protests, accidents, and emergencies.' : 'This is from a public account. Focus on actionable risks, protests, incidents, riots, accidents, and reactions.'}

Return ONLY a JSON object with the following structure:
{
  "category": "one of: ${categoryList}",
  "level": "one of: low, medium, high, critical",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "urgency": "low/medium/high"
}

Post content: "${content.substring(0, 1000)}"`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a risk classification expert specializing in Indonesian social media content analysis for police monitoring. 
          ${isOfficial ? 'Analyze posts from official police accounts for threats and emergencies.' : 'Analyze posts from public accounts for actionable risks and incidents.'}
          Be accurate and conservative in risk assessment.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const category = result.category?.toLowerCase().replace(/\s+/g, '_');

    if (!categories.includes(category)) {
      logger.warn(`Invalid risk category: ${category}, defaulting to low risk`);
      result.category = categories[0];
      result.level = 'low';
    }

    if (!RISK_LEVELS.includes(result.level?.toLowerCase())) {
      result.level = 'low';
    }

    const riskData = {
      postId,
      riskCategory: category,
      riskLevel: result.level?.toLowerCase() || 'low',
      confidenceScore: parseFloat(result.confidence) || 0.5,
      analysisDetails: {
        reasoning: result.reasoning,
        urgency: result.urgency || 'low',
        model: process.env.OPENAI_MODEL || 'gpt-4',
        language,
        isOfficial,
      },
      modelVersion: process.env.OPENAI_MODEL || 'gpt-4',
    };

    await saveRiskClassification(riskData);

    if (riskData.riskLevel === 'high' || riskData.riskLevel === 'critical') {
      await createAlert(riskData);
    }

    await triggerWorkflows(riskData, postId);

    return riskData;
  } catch (error) {
    logger.error('Risk classification error:', error);
    
    if (error.message.includes('JSON')) {
      return {
        postId,
        riskCategory: 'reaction',
        riskLevel: 'low',
        confidenceScore: 0.5,
        analysisDetails: { error: 'Parsing error' },
      };
    }
    
    throw error;
  }
};

export const classifyMentionRisk = async (mentionId, content, isOfficial = false, language = 'id') => {
  try {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const openai = getOpenAI();
    if (!openai) {
      logger.warn('OpenAI client not available. Returning default risk classification.');
      const categories = isOfficial ? RISK_CATEGORIES.official : RISK_CATEGORIES.public;
      return {
        mentionId,
        riskCategory: categories[0],
        riskLevel: 'low',
        confidenceScore: 0.5,
        analysisDetails: { error: 'OpenAI API key not configured' },
      };
    }

    const categories = isOfficial ? RISK_CATEGORIES.official : RISK_CATEGORIES.public;
    const categoryList = categories.join(', ');

    const prompt = `Analyze the following social media comment/mention in ${language === 'id' ? 'Indonesian' : 'English'} for potential risks.
Return ONLY a JSON object with the following structure:
{
  "category": "one of: ${categoryList}",
  "level": "one of: low, medium, high, critical",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Comment content: "${content.substring(0, 1000)}"`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a risk classification expert for Indonesian social media content.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const result = JSON.parse(response.choices[0].message.content);
    const category = result.category?.toLowerCase().replace(/\s+/g, '_');

    if (!categories.includes(category)) {
      result.category = categories[0];
      result.level = 'low';
    }

    if (!RISK_LEVELS.includes(result.level?.toLowerCase())) {
      result.level = 'low';
    }

    const riskData = {
      mentionId,
      riskCategory: category,
      riskLevel: result.level?.toLowerCase() || 'low',
      confidenceScore: parseFloat(result.confidence) || 0.5,
      analysisDetails: {
        reasoning: result.reasoning,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        language,
      },
      modelVersion: process.env.OPENAI_MODEL || 'gpt-4',
    };

    await saveMentionRiskClassification(riskData);

    if (riskData.riskLevel === 'high' || riskData.riskLevel === 'critical') {
      await createAlert(riskData, mentionId);
    }

    const mention = await pool.query('SELECT post_id FROM mentions WHERE id = $1', [mentionId]);
    if (mention.rows.length > 0) {
      await triggerWorkflows(riskData, mention.rows[0].post_id, mentionId);
    }

    return riskData;
  } catch (error) {
    logger.error('Mention risk classification error:', error);
    throw error;
  }
};

const saveRiskClassification = async (data) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM risk_classification WHERE post_id = $1',
      [data.postId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE risk_classification 
         SET risk_category = $1,
             risk_level = $2,
             confidence_score = $3,
             analysis_details = $4,
             model_version = $5
         WHERE post_id = $6`,
        [
          data.riskCategory,
          data.riskLevel,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
          data.postId,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO risk_classification (
          post_id, risk_category, risk_level, confidence_score, analysis_details, model_version
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          data.postId,
          data.riskCategory,
          data.riskLevel,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
        ]
      );
    }
  } catch (error) {
    logger.error('Save risk classification error:', error);
    throw error;
  }
};

const saveMentionRiskClassification = async (data) => {
  try {
    const existing = await pool.query(
      'SELECT id FROM risk_classification WHERE mention_id = $1',
      [data.mentionId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE risk_classification 
         SET risk_category = $1,
             risk_level = $2,
             confidence_score = $3,
             analysis_details = $4,
             model_version = $5
         WHERE mention_id = $6`,
        [
          data.riskCategory,
          data.riskLevel,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
          data.mentionId,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO risk_classification (
          mention_id, risk_category, risk_level, confidence_score, analysis_details, model_version
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          data.mentionId,
          data.riskCategory,
          data.riskLevel,
          data.confidenceScore,
          JSON.stringify(data.analysisDetails),
          data.modelVersion,
        ]
      );
    }
  } catch (error) {
    logger.error('Save mention risk classification error:', error);
    throw error;
  }
};

const createAlert = async (riskData, mentionId = null) => {
  try {
    const postId = riskData.postId;
    const post = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    
    if (post.rows.length === 0) {
      return;
    }

    const postData = post.rows[0];
    const title = `High Risk Alert: ${riskData.riskCategory}`;
    const message = `A ${riskData.riskLevel} risk post detected: ${postData.content?.substring(0, 100)}...`;

    const riskIdResult = await pool.query(
      'SELECT id FROM risk_classification WHERE post_id = $1 OR mention_id = $2 LIMIT 1',
      [postId, mentionId]
    );

    const alertResult = await pool.query(
      `INSERT INTO alerts (title, message, severity, post_id, risk_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, message, riskData.riskLevel, postId, riskIdResult.rows[0]?.id || null]
    );

    if (alertResult.rows.length > 0) {
      io.to('alerts').emit('new_alert', alertResult.rows[0]);
      logger.info(`Alert created for high risk post: ${postId}`);
    }
  } catch (error) {
    logger.error('Create alert error:', error);
  }
};

const triggerWorkflows = async (riskData, postId, mentionId = null) => {
  try {
    const workflows = await pool.query(
      `SELECT * FROM workflows 
       WHERE is_active = TRUE 
         AND trigger_type IN ('risk_level', 'sentiment')
       ORDER BY created_at DESC`
    );

    for (const workflow of workflows.rows) {
      try {
        const postContent = postId ? await pool.query(
          'SELECT content FROM posts WHERE id = $1',
          [postId]
        ).then(r => r.rows[0]?.content || '') : '';

        const riskIdResult = await pool.query(
          'SELECT id FROM risk_classification WHERE post_id = $1 OR mention_id = $2 LIMIT 1',
          [postId, mentionId]
        );

        const triggerData = {
          postId,
          mentionId,
          riskId: riskIdResult.rows[0]?.id || null,
          riskLevel: riskData.riskLevel,
          riskCategory: riskData.riskCategory,
          content: postContent,
        };

        await executeWorkflow(workflow.id, triggerData);
      } catch (error) {
        logger.error(`Workflow trigger error for workflow ${workflow.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Trigger workflows error:', error);
  }
};

