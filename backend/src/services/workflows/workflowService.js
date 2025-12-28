import pool from '../../config/database.js';
import { createAlert } from '../alert/alertService.js';
import logger from '../../config/logger.js';

export const executeWorkflow = async (workflowId, triggerData) => {
  try {
    const workflow = await pool.query('SELECT * FROM workflows WHERE id = $1 AND is_active = TRUE', [workflowId]);

    if (workflow.rows.length === 0) {
      throw new Error('Workflow not found or inactive');
    }

    const workflowData = workflow.rows[0];
    
    // trigger_conditions와 actions가 JSON 문자열인 경우 파싱
    let conditions = workflowData.trigger_conditions;
    let actions = workflowData.actions;
    
    if (typeof conditions === 'string') {
      try {
        conditions = JSON.parse(conditions);
      } catch (error) {
        logger.error('Failed to parse trigger_conditions:', error);
        conditions = {};
      }
    }
    
    if (typeof actions === 'string') {
      try {
        actions = JSON.parse(actions);
      } catch (error) {
        logger.error('Failed to parse actions:', error);
        actions = [];
      }
    }
    
    // trigger_config가 있는 경우 사용 (새로운 형식)
    if (workflowData.trigger_config) {
      try {
        const triggerConfig = typeof workflowData.trigger_config === 'string' 
          ? JSON.parse(workflowData.trigger_config) 
          : workflowData.trigger_config;
        conditions = triggerConfig;
      } catch (error) {
        logger.error('Failed to parse trigger_config:', error);
      }
    }

    if (!checkConditions(conditions, triggerData)) {
      return { executed: false, reason: 'Conditions not met' };
    }

    const executedActions = [];

    for (const action of actions) {
      try {
        const result = await executeAction(action, triggerData);
        executedActions.push({ action, result });
      } catch (error) {
        logger.error(`Workflow action execution error: ${action.type}`, error);
        executedActions.push({ action, error: error.message });
      }
    }

    await logWorkflowExecution(workflowId, triggerData, executedActions);

    return { executed: true, actions: executedActions };
  } catch (error) {
    logger.error('Execute workflow error:', error);
    throw error;
  }
};

const checkConditions = (conditions, triggerData) => {
  if (conditions.type === 'risk_level') {
    return triggerData.riskLevel && conditions.values.includes(triggerData.riskLevel);
  }
  if (conditions.type === 'sentiment') {
    return triggerData.sentiment && conditions.values.includes(triggerData.sentiment);
  }
  if (conditions.type === 'keyword') {
    const content = triggerData.content?.toLowerCase() || '';
    return conditions.keywords.some(keyword => content.includes(keyword.toLowerCase()));
  }
  if (conditions.type === 'region') {
    return triggerData.regionId && conditions.regionIds.includes(triggerData.regionId);
  }
  return false;
};

const executeAction = async (action, triggerData) => {
  switch (action.type) {
    case 'create_alert':
      return await createAlert({
        title: action.title || 'Workflow Alert',
        message: action.message || 'Workflow triggered alert',
        severity: action.severity || 'medium',
        postId: triggerData.postId,
        riskId: triggerData.riskId,
      });

    case 'send_notification':
      logger.info(`Notification sent: ${action.message}`);
      return { success: true, message: 'Notification sent' };

    case 'escalate':
      logger.info(`Escalation triggered for post: ${triggerData.postId}`);
      return { success: true, message: 'Escalated' };

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
};

const logWorkflowExecution = async (workflowId, triggerData, executedActions) => {
  try {
    await pool.query(
      `INSERT INTO workflow_executions (
        workflow_id, trigger_post_id, trigger_risk_id,
        status, actions_executed
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        workflowId,
        triggerData.postId || null,
        triggerData.riskId || null,
        'completed',
        JSON.stringify(executedActions),
      ]
    );
  } catch (error) {
    logger.error('Log workflow execution error:', error);
  }
};

export const createWorkflow = async (workflowData) => {
  try {
    const {
      name,
      description,
      triggerType,
      triggerConditions,
      actions,
      createdBy,
    } = workflowData;

    const result = await pool.query(
      `INSERT INTO workflows (
        name, description, trigger_type, trigger_conditions, actions, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        name,
        description,
        triggerType,
        JSON.stringify(triggerConditions),
        JSON.stringify(actions),
        createdBy,
      ]
    );

    return result.rows[0];
  } catch (error) {
    logger.error('Create workflow error:', error);
    throw error;
  }
};

