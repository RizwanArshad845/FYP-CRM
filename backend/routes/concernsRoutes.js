import express from 'express';
import { getConcerns, createConcern, updateConcern, deleteConcern } from '../controllers/concernsController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();
router.use(protect);
router.get('/internal', (req, res) => {
    req.query.is_internal = 'true';
    return getConcerns(req, res);
});
router.get('/', getConcerns);
router.post('/', createConcern);
router.post('/internal', (req, res) => {
    req.body.is_internal = true;
    return createConcern(req, res);
});
router.put('/:id', updateConcern);
router.put('/internal/:id', (req, res) => {
    req.body.is_internal = true;
    return updateConcern(req, res);
});
router.delete('/:id', deleteConcern);
router.delete('/internal/:id', (req, res) => {
    req.query.is_internal = 'true';
    return deleteConcern(req, res);
});
export default router;
