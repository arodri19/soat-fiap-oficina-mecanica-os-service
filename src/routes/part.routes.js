const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  createPart,
  listParts,
  getPart,
  updatePart,
  deletePart
} = require('../controllers/part.controller');

const router = express.Router();

router.post('/', asyncHandler(createPart));
router.get('/', asyncHandler(listParts));
router.get('/:id', asyncHandler(getPart));
router.put('/:id', asyncHandler(updatePart));
router.delete('/:id', asyncHandler(deletePart));

module.exports = router;
