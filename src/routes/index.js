const express = require('express');
const authRoutes = require('./auth.routes');
const clientRoutes = require('./client.routes');
const vehicleRoutes = require('./vehicle.routes');
const serviceRoutes = require('./service.routes');
const partRoutes = require('./part.routes');
const orderRoutes = require('./order.routes');
const metricsRoutes = require('./metrics.routes');
const trackRoutes = require('./track.routes');

const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// `authenticate` só confere que o JWT é válido — não o `role`. O JWT emitido
// pela Lambda de CPF (repositório serverless) tem `role: "CLIENT"` e é
// assinado com o mesmo segredo do login de funcionário, então também passa em
// `authenticate` aqui. Por isso as rotas internas (uso exclusivo de
// funcionário) precisam de `authorize(['ATTENDANT', 'MECHANIC'])` explícito —
// sem isso, qualquer cliente autenticado por CPF conseguia ver/criar dados de
// todos os clientes (Broken Function Level Authorization, OWASP API #5).
// `/track` continua reservada ao cliente (`authorize(['CLIENT'])`, aplicado
// dentro de track.routes.js).
const staffOnly = authorize(['ATTENDANT', 'MECHANIC']);

router.use('/auth', authRoutes);
router.use('/track', authenticate, trackRoutes);
router.use('/clients', authenticate, staffOnly, clientRoutes);
router.use('/vehicles', authenticate, staffOnly, vehicleRoutes);
router.use('/services', authenticate, staffOnly, serviceRoutes);
router.use('/parts', authenticate, staffOnly, partRoutes);
router.use('/orders', authenticate, staffOnly, orderRoutes);
router.use('/metrics', authenticate, staffOnly, metricsRoutes);

module.exports = router;
