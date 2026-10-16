import express from 'express';
import { getNotepad, updateNotepad, deleteNotepad } from '../controllers/notepadController.js';

const router = express.Router();

router.get('/', getNotepad);
router.post('/', updateNotepad);
router.delete('/', deleteNotepad);

export default router;
