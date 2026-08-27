import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

export const requestId: RequestHandler = (req, res, next) => {
  const headerId = req.header('x-request-id');
  const id = headerId && headerId.trim().length > 0 ? headerId : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
