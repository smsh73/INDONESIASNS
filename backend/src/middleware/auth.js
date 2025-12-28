import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';

export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('인증 토큰이 필요합니다', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('유효하지 않은 토큰입니다', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('토큰이 만료되었습니다', 401));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('인증이 필요합니다', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('권한이 없습니다', 403));
    }

    next();
  };
};

