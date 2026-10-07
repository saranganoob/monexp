import { Router } from 'express';
import { loadSetup, computeMonths } from '../services/monthService.js';
import { computeYear, listInstallments } from '../services/compute.js';
import { restoreUndo } from '../services/undo.js';
import { toInt, toYm, toId } from '../lib/validate.js';
import { currentYm } from '../lib/ym.js';

const router = Router();

// GET /api/years/2026 – budget vs spent per month + where the money went
router.get('/years/:year', async (req, res) => {
  const year = toInt(req.params.year, 'year', { min: 2000, max: 2100 });
  const yms = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  res.json(computeYear(year, await computeMonths(yms)));
});

// GET /api/installments?at=2026-10 – card EMIs and plans, closing soonest first
router.get('/installments', async (req, res) => {
  const ym = req.query.at ? toYm(req.query.at, 'at') : currentYm();
  res.json(listInstallments({ ym, ...(await loadSetup()) }));
});

// POST /api/undo/:token – reverses the latest change
router.post('/undo/:token', async (req, res) => {
  res.json(await restoreUndo(toId(req.params.token, 'undo token')));
});

export default router;
