import { AppError } from '../utils/AppError.js';

export const validate = (schemas) => (req, _res, next) => {
  const valid = {};
  const details = [];

  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part] ?? {});
    if (result.success) {
      valid[part] = result.data;
    } else {
      details.push(...result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })));
    }
  }

  if (details.length > 0) return next(AppError.validation(details));

  req.valid = valid;
  return next();
};
