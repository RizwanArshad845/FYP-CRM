import express from 'express';
import { concernHandlers } from '../controllers/concernsController.js';

const router = express.Router();
const external = concernHandlers('external');
const internal = concernHandlers('internal');

// Internal (CST) concerns — declared before '/:id' so '/internal' isn't read as an id
router.get('/internal', internal.list);
router.post('/internal', internal.create);
router.put('/internal/:id', internal.update);
router.delete('/internal/:id', internal.remove);

router.get('/', external.list);
router.post('/', external.create);
router.put('/:id', external.update);
router.delete('/:id', external.remove);

export default router;
