// Validate req[source] against a zod schema; replaces it with the parsed value.
export const validate = (schema, source = 'body') => (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join('.');
        return res.status(400).json({
            success: false,
            error: field ? `${field}: ${issue.message}` : issue.message,
        });
    }
    if (source === 'query') {
        // Express 5 exposes req.query as a getter; shadow it with the parsed copy.
        Object.defineProperty(req, 'query', { value: result.data, writable: true });
    } else {
        req[source] = result.data;
    }
    next();
};
