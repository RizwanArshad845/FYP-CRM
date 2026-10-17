import { isProduction } from '../config/env.js';

export const notFound = (req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
};

// Central error handler: log details server-side, never leak them in production.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, error: 'Malformed JSON body' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, error: 'Request body too large' });
    }
    // Postgres unique violation
    if (err.code === '23505') {
        return res.status(409).json({ success: false, error: 'A record with these details already exists' });
    }
    // Postgres bad input (e.g. "abc" for an integer id or date). Not-null violations
    // stay 500 on purpose: they mean a handler forgot a column such as tenant_id.
    if (err.code === '22P02' || err.code === '22007' || err.code === '22008') {
        return res.status(400).json({ success: false, error: 'Invalid or missing input' });
    }
    // Postgres foreign key violation: referenced row doesn't exist or is still in use
    if (err.code === '23503') {
        return res.status(409).json({ success: false, error: 'This record is linked to other data' });
    }

    // Deliberate client errors (ServiceError etc.) carry a safe message.
    if (err.status && err.status < 500) {
        return res.status(err.status).json({ success: false, error: err.message });
    }

    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({
        success: false,
        error: isProduction ? 'Internal server error' : err.message,
    });
};
