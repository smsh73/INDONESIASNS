import pool from '../../config/database.js';
import { io } from '../../server.js';
import logger from '../../config/logger.js';

export const createAlert = async (alertData) => {
  try {
    const {
      title,
      message,
      severity = 'medium',
      postId = null,
      riskId = null,
    } = alertData;

    const result = await pool.query(
      `INSERT INTO alerts (title, message, severity, post_id, risk_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, message, severity, postId, riskId]
    );

    const alert = result.rows[0];

    io.to('alerts').emit('new_alert', alert);
    io.to('dashboard').emit('dashboard:update', {
      type: 'alert',
      data: alert,
    });

    logger.info(`Alert created: ${title} (${severity})`);

    return alert;
  } catch (error) {
    logger.error('Create alert error:', error);
    throw error;
  }
};

export const checkRiskThresholds = async () => {
  try {
    const highRiskPosts = await pool.query(`
      SELECT p.*, rc.risk_level, rc.risk_category
      FROM posts p
      INNER JOIN risk_classification rc ON p.id = rc.post_id
      WHERE rc.risk_level IN ('high', 'critical')
        AND NOT EXISTS (
          SELECT 1 FROM alerts WHERE alerts.post_id = p.id AND alerts.resolved = FALSE
        )
      LIMIT 10
    `);

    for (const post of highRiskPosts.rows) {
      await createAlert({
        title: `High Risk Post Detected: ${post.risk_category}`,
        message: `A ${post.risk_level} risk post has been detected. Content: ${post.content?.substring(0, 100)}...`,
        severity: post.risk_level,
        postId: post.id,
      });
    }
  } catch (error) {
    logger.error('Check risk thresholds error:', error);
  }
};

setInterval(checkRiskThresholds, 5 * 60 * 1000);

