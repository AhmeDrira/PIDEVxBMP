/**
 * migrateInvoiceTranches.js — BMP.tn
 * ─────────────────────────────────────────────────────────────────────────────
 * Fige en base la reprise des echeanciers de facture vers `paymentPlan.tranches`.
 *
 * ⚠ CE SCRIPT EST FACULTATIF. L'application n'en depend pas : la reprise se
 * fait deja a la lecture, dans `normalizePaymentPlan`. Il sert a ne plus
 * dependre de cette reprise a chaud, et a rendre les anciennes factures
 * interrogeables sur leur tableau de tranches.
 *
 * Sans risque a rejouer : une facture qui a deja son tableau est ignoree.
 *
 *   node scripts/migrateInvoiceTranches.js          # simulation, n'ecrit rien
 *   node scripts/migrateInvoiceTranches.js --write  # applique
 */

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const {
  normalizePaymentPlan,
  mirrorLegacyFields,
} = require('../utils/invoicePaymentPlan');

const ECRIRE = process.argv.includes('--write');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI absente : impossible de se connecter.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(ECRIRE ? 'Mode ECRITURE' : 'Mode SIMULATION — aucune écriture');

  // Seules les factures sans tableau, ou avec un tableau vide, sont concernees.
  const aReprendre = await Invoice.find({
    $or: [
      { 'paymentPlan.tranches': { $exists: false } },
      { 'paymentPlan.tranches': { $size: 0 } },
    ],
  });

  console.log(`${aReprendre.length} facture(s) à reprendre.`);

  let reprises = 0;
  let echecs = 0;

  for (const invoice of aReprendre) {
    try {
      const avant = {
        paidAmount: invoice.paidAmount,
        premier: invoice.paymentPlan?.firstTranchePercent,
      };

      normalizePaymentPlan(invoice);
      mirrorLegacyFields(invoice);

      const tranches = invoice.paymentPlan.tranches
        .map((t) => `${t.label} ${t.percent}% = ${t.amount}${t.paid ? ' (réglée)' : ''}`)
        .join(' | ');
      console.log(`  ${invoice.invoiceNumber} : ${tranches}`);

      // Garde-fou : la reprise ne doit rien changer au montant deja encaisse.
      if (Math.abs(Number(invoice.paidAmount || 0) - Number(avant.paidAmount || 0)) > 0.01
        && !(avant.paidAmount === undefined || avant.paidAmount === null)) {
        console.warn(`    ⚠ paidAmount modifié : ${avant.paidAmount} -> ${invoice.paidAmount}`);
      }

      if (ECRIRE) {
        invoice.markModified('paymentPlan');
        await invoice.save();
      }
      reprises += 1;
    } catch (error) {
      echecs += 1;
      console.error(`  ✗ ${invoice.invoiceNumber} : ${error.message}`);
    }
  }

  console.log(`\n${reprises} reprise(s), ${echecs} échec(s).`);
  if (!ECRIRE) console.log('Relancez avec --write pour appliquer.');

  await mongoose.disconnect();
})().catch((error) => {
  console.error('Migration interrompue :', error.message);
  process.exit(1);
});
