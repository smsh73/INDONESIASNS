import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import ExcelJS from 'exceljs';
import { generateDailyReport, generateWeeklyReport } from '../services/reports/reportService.js';

export const exportDashboardDetail = async (req, res, next) => {
  try {
    const { type, value } = req.params;
    const { days = 7, format = 'excel' } = req.query;

    let data;
    let filename;

    if (type === 'sentiment') {
      const response = await pool.query(`
        SELECT 
          p.*,
          sa.sentiment_category,
          sa.confidence_score,
          a.username as account_username,
          a.platform,
          l.province,
          l.city
        FROM posts p
        INNER JOIN sentiment_analysis sa ON p.id = sa.post_id
        LEFT JOIN accounts a ON p.account_id = a.id
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE sa.sentiment_category = $1
          AND p.created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY p.created_at DESC
      `, [value]);

      data = response.rows;
      filename = `sentiment_${value}_${days}days`;
    } else if (type === 'risk') {
      const response = await pool.query(`
        SELECT 
          p.*,
          rc.risk_category,
          rc.risk_level,
          rc.confidence_score,
          a.username as account_username,
          a.platform,
          l.province,
          l.city
        FROM posts p
        INNER JOIN risk_classification rc ON p.id = rc.post_id
        LEFT JOIN accounts a ON p.account_id = a.id
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE rc.risk_category = $1
          AND p.created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY rc.risk_level DESC, p.created_at DESC
      `, [value]);

      data = response.rows;
      filename = `risk_${value}_${days}days`;
    } else {
      throw new AppError('지원하지 않는 타입입니다', 400);
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data');

      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        worksheet.addRow(headers);

        data.forEach((row) => {
          worksheet.addRow(headers.map((h) => row[h]));
        });

        worksheet.columns.forEach((column) => {
          column.width = 15;
        });
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.xlsx"`
      );

      await workbook.xlsx.write(res);
      res.end();
    } else {
      throw new AppError('지원하지 않는 형식입니다', 400);
    }
  } catch (error) {
    logger.error('Export dashboard detail error:', error);
    next(error);
  }
};

export const exportReport = async (req, res, next) => {
  try {
    const { type, format = 'excel' } = req.query;
    const { date, weekStart } = req.query;

    let report;
    let filename;

    if (type === 'daily') {
      report = await generateDailyReport(date);
      filename = `daily_report_${report.date}`;
    } else if (type === 'weekly') {
      report = await generateWeeklyReport(weekStart ? new Date(weekStart) : null);
      filename = `weekly_report_${report.period.start}_${report.period.end}`;
    } else {
      throw new AppError('지원하지 않는 보고서 타입입니다', 400);
    }

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['항목', '값']);
      summarySheet.addRow(['총 포스팅', report.summary?.totalPosts || 0]);
      summarySheet.addRow(['총 멘션', report.summary?.totalMentions || 0]);

      if (report.sentiment) {
        const sentimentSheet = workbook.addWorksheet('Sentiment');
        sentimentSheet.addRow(['감정 카테고리', '수량']);
        Object.entries(report.sentiment).forEach(([key, value]) => {
          sentimentSheet.addRow([key, value]);
        });
      }

      if (report.risk) {
        const riskSheet = workbook.addWorksheet('Risk');
        riskSheet.addRow(['위험 카테고리', '수량']);
        Object.entries(report.risk).forEach(([key, value]) => {
          riskSheet.addRow([key, value]);
        });
      }

      if (report.topRegions) {
        const regionsSheet = workbook.addWorksheet('Top Regions');
        regionsSheet.addRow(['지역', '포스팅 수']);
        report.topRegions.forEach((row) => {
          regionsSheet.addRow([row.province, row.post_count]);
        });
      }

      if (report.topPlatforms) {
        const platformsSheet = workbook.addWorksheet('Top Platforms');
        platformsSheet.addRow(['플랫폼', '수량']);
        report.topPlatforms.forEach((row) => {
          platformsSheet.addRow([row.platform, row.count]);
        });
      }

      if (report.trends) {
        const trendsSheet = workbook.addWorksheet('Trends');
        trendsSheet.addRow(['날짜', '포스팅 수']);
        report.trends.posts?.forEach((row) => {
          trendsSheet.addRow([row.date, row.count]);
        });
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}.xlsx"`
      );

      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      res.json({
        success: true,
        message: 'PDF 내보내기는 준비 중입니다',
        data: report,
      });
    } else {
      throw new AppError('지원하지 않는 형식입니다', 400);
    }
  } catch (error) {
    logger.error('Export report error:', error);
    next(error);
  }
};

