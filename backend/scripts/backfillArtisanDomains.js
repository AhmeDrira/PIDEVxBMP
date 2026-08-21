/**
 * backfillArtisanDomains.js — BMP.tn
 * ──────────────────────────────────
 * Crée le mini site (ArtisanDomain) des artisans inscrits AVANT la mise en place
 * de la génération automatique de slug.
 *
 * Idempotent : s'appuie sur DomainService.ensureDomainForArtisan(), qui ne touche
 * à rien si le mini site existe déjà. Le script peut donc être relancé sans risque.
 *
 *   node scripts/backfillArtisanDomains.js            # applique
 *   node scripts/backfillArtisanDomains.js --dry-run  # simule, n'écrit rien
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Artisan } = require('../models/User');
const ArtisanDomain = require('../models/ArtisanDomain');
const DomainService = require('../services/DomainService');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set — check your .env file');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB${dryRun ? ' (DRY RUN — nothing will be written)' : ''}`);

  const artisans = await Artisan.find({ role: 'artisan' })
    .select('_id firstName lastName domain location role')
    .lean();

  // Un seul aller-retour pour savoir qui possède déjà un mini site.
  const existing = await ArtisanDomain.find({
    artisanId: { $in: artisans.map((a) => a._id) },
  })
    .select('artisanId slug')
    .lean();
  const alreadyDone = new Map(existing.map((d) => [String(d.artisanId), d.slug]));

  const stats = { total: artisans.length, skipped: 0, created: 0, failed: 0 };

  for (const artisan of artisans) {
    const id = String(artisan._id);
    const name = `${artisan.firstName || ''} ${artisan.lastName || ''}`.trim() || id;

    if (alreadyDone.has(id)) {
      stats.skipped += 1;
      console.log(`  =  ${name} → ${alreadyDone.get(id)} (déjà présent)`);
      continue;
    }

    if (dryRun) {
      const preview = artisan.domain || artisan.location
        ? DomainService.generateSlug(artisan.firstName, artisan.domain, artisan.location)
        : DomainService.generateSlug(artisan.firstName, artisan.lastName);
      stats.created += 1;
      console.log(`  + ${name} → ${preview} (simulation, collisions non résolues)`);
      continue;
    }

    try {
      const domain = await DomainService.ensureDomainForArtisan(artisan);
      if (domain) {
        stats.created += 1;
        console.log(`  + ${name} → ${domain.slug}`);
      } else {
        stats.failed += 1;
        console.warn(`  ! ${name} → aucun slug libre trouvé`);
      }
    } catch (error) {
      stats.failed += 1;
      console.error(`  ! ${name} → ${error.message}`);
    }
  }

  console.log(
    `\nArtisans: ${stats.total} | créés: ${stats.created} | déjà présents: ${stats.skipped} | échecs: ${stats.failed}`
  );

  return stats.failed === 0;
}

main()
  .then(async (ok) => {
    await mongoose.disconnect();
    process.exit(ok ? 0 : 1);
  })
  .catch(async (error) => {
    console.error('Backfill failed:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
