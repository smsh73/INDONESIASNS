import pool from '../config/database.js';
import { executeWorkflow as executeWorkflowService, createWorkflow as createWorkflowService } from '../services/workflows/workflowService.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const getWorkflows = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    
    let query = 'SELECT w.*, u.username as created_by_username FROM workflows w LEFT JOIN users u ON w.created_by = u.id WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (isActive !== undefined) {
      query += ` AND w.is_active = $${paramCount}`;
      params.push(isActive === 'true');
      paramCount++;
    }

    query += ' ORDER BY w.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get workflows error:', error);
    next(error);
  }
};

export const createWorkflow = async (req, res, next) => {
  try {
    const { name, description, triggerType, triggerConditions, actions } = req.body;

    if (!name || !triggerType || !triggerConditions || !actions) {
      throw new AppError('필수 필드가 누락되었습니다', 400);
    }

    const workflowData = {
      name,
      description,
      triggerType,
      triggerConditions,
      actions,
      createdBy: req.user.id,
    };

    const workflow = await createWorkflowService(workflowData);

    logger.info(`Workflow created: ${name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    logger.error('Create workflow error:', error);
    next(error);
  }
};

export const updateWorkflow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, triggerType, triggerConditions, actions, isActive } = req.body;

    const result = await pool.query(
      `UPDATE workflows 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           trigger_type = COALESCE($3, trigger_type),
           trigger_conditions = COALESCE($4, trigger_conditions),
           actions = COALESCE($5, actions),
           is_active = COALESCE($6, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        name,
        description,
        triggerType,
        triggerConditions ? JSON.stringify(triggerConditions) : null,
        actions ? JSON.stringify(actions) : null,
        isActive,
        id,
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('워크플로우를 찾을 수 없습니다', 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update workflow error:', error);
    next(error);
  }
};

export const deleteWorkflow = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM workflows WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new AppError('워크플로우를 찾을 수 없습니다', 404);
    }

    logger.info(`Workflow deleted: ${id}`);

    res.json({
      success: true,
      message: '워크플로우가 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete workflow error:', error);
    next(error);
  }
};

export const getWorkflowExecutions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT we.*, p.content as post_content
      FROM workflow_executions we
      LEFT JOIN posts p ON we.trigger_post_id = p.id
      WHERE we.workflow_id = $1
    `;
    const params = [id];
    let paramCount = 2;

    if (status) {
      query += ` AND we.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY we.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM workflow_executions WHERE workflow_id = $1',
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalResult.rows[0].total),
      },
    });
  } catch (error) {
    logger.error('Get workflow executions error:', error);
    next(error);
  }
};

export const executeWorkflow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { triggerData } = req.body;

    const result = await executeWorkflowService(id, triggerData);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Execute workflow error:', error);
    next(error);
  }
};

