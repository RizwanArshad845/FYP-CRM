import express from 'express';
import { getBoard, saveBoard, deleteBoard, listBoards } from '../controllers/boardController.js';
const router = express.Router();
router.get('/', getBoard);
router.get('/list', listBoards);
router.post('/', saveBoard);
router.delete('/:id', deleteBoard);
export default router;
