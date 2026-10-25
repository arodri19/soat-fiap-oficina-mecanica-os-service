const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const {
  createClientPF,
  listClientsPF,
  getClientPF,
  updateClientPF,
  deleteClientPF,
  createClientPJ,
  listClientsPJ,
  getClientPJ,
  updateClientPJ,
  deleteClientPJ
} = require('../controllers/client.controller');

const router = express.Router();

router.post('/pf', asyncHandler(createClientPF));
router.get('/pf', asyncHandler(listClientsPF));
router.get('/pf/:id', asyncHandler(getClientPF));
router.put('/pf/:id', asyncHandler(updateClientPF));
router.delete('/pf/:id', asyncHandler(deleteClientPF));

router.post('/pj', asyncHandler(createClientPJ));
router.get('/pj', asyncHandler(listClientsPJ));
router.get('/pj/:id', asyncHandler(getClientPJ));
router.put('/pj/:id', asyncHandler(updateClientPJ));
router.delete('/pj/:id', asyncHandler(deleteClientPJ));

module.exports = router;
