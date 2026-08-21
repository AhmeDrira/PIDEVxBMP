const mongoose = require('mongoose');
require('dotenv').config();

const { User } = require('../models/User');
const Product = require('../models/Product');
const KnowledgeArticle = require('../models/KnowledgeArticle');

const MONGO_URI = process.env.MONGO_URI;

const manufacturerSeed = {
  firstName: 'BMP',
  lastName: 'Marketplace',
  email: 'demo.manufacturer@bmp.tn',
  phone: '20000000',
  password: 'Demo12345!',
  role: 'manufacturer',
  companyName: 'BMP Demo Supplier',
  description: 'Compte technique de démonstration pour le seed local.',
  verificationStatus: 'approved',
  status: 'active',
  isVerified: true,
};

const productSeeds = [
  {
    name: 'Bloc à bancher 20 cm',
    category: 'Maçonnerie',
    price: 4.8,
    stock: 1200,
    description: 'Bloc à bancher pour murs porteurs et soutènement léger.',
    status: 'active',
    image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Ciment Portland CPJ 45',
    category: 'Liants',
    price: 18.5,
    stock: 380,
    description: 'Ciment polyvalent pour béton, mortier et scellement.',
    status: 'active',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Fer à béton HA 12 mm',
    category: 'Armatures',
    price: 29.9,
    stock: 240,
    description: 'Barres d’armature pour fondations et chaînages.',
    status: 'active',
    image: 'https://images.unsplash.com/photo-1605152276897-4f618f831adf?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Gravier 10/20',
    category: 'Granulats',
    price: 75,
    stock: 150,
    description: 'Granulat pour béton, drainage et assise technique.',
    status: 'active',
    image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Géotextile de drainage',
    category: 'Étanchéité & drainage',
    price: 120,
    stock: 75,
    description: 'Feutre de séparation et filtration pour drainage périphérique.',
    status: 'active',
    image: 'https://images.unsplash.com/photo-1590518758793-7f1d0f4f6c3a?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Mortier de montage',
    category: 'Mortiers',
    price: 14.5,
    stock: 310,
    description: 'Mortier prêt à l’emploi pour montage et petites réparations.',
    status: 'active',
    image: 'https://images.unsplash.com/photo-1582560475093-ba66accbc40b?auto=format&fit=crop&w=800&q=80',
  },
];

const knowledgeSeeds = [
  {
    title: 'Fondations de mur de soutènement: bonnes pratiques',
    category: 'Maçonnerie',
    summary: 'Principes essentiels pour une fondation durable sur terrain en pente et argileux.',
    content: 'Prévoir une semelle en béton armé dimensionnée selon la poussée des terres, un ferraillage continu, un drainage arrière complet avec gravier et géotextile, ainsi que des barbacanes pour évacuer l’eau. Contrôler la compacité du sol et protéger la face en contact avec la terre par une étanchéité adaptée.',
    authorName: 'BMP Editorial Team',
    status: 'published',
    tags: ['mur de soutènement', 'fondation', 'drainage', 'béton armé'],
  },
  {
    title: 'Choisir le bon drainage derrière un mur',
    category: 'Drainage',
    summary: 'Pourquoi le drain perforé, le gravier et le géotextile doivent fonctionner ensemble.',
    content: 'Un drainage efficace réduit la pression hydrostatique et limite les fissures. Le drain perforé doit rester accessible, le gravier doit permettre la circulation de l’eau et le géotextile évite le colmatage par les fines du sol. La pente du drain vers l’exutoire est indispensable.',
    authorName: 'BMP Editorial Team',
    status: 'published',
    tags: ['drain perforé', 'géotextile', 'gravier', 'barbacane'],
  },
  {
    title: 'Installer un lavabo sans gros travaux',
    category: 'Plomberie',
    summary: 'Liste rapide des éléments nécessaires pour une pose simple et propre.',
    content: 'Pour une pose de lavabo en rénovation légère, prévoir le lavabo, la robinetterie, le siphon, les flexibles, l’évacuation PVC, les joints, la fixation murale et un mastic d’étanchéité. Vérifier les hauteurs d’alimentation et l’alignement avant la pose définitive.',
    authorName: 'BMP Editorial Team',
    status: 'published',
    tags: ['lavabo', 'robinetterie', 'siphon', 'raccordement'],
  },
  {
    title: 'Béton armé: contrôles avant coulage',
    category: 'Structure',
    summary: 'Les vérifications utiles avant de couler une semelle ou un chaînage.',
    content: 'Avant coulage, contrôler le coffrage, les enrobages, la continuité des armatures, le positionnement des attentes et la propreté du fond de fouille. Une vibration correcte et une cure adaptée améliorent la résistance finale et limitent les défauts de surface.',
    authorName: 'BMP Editorial Team',
    status: 'published',
    tags: ['béton armé', 'coffrage', 'armatures', 'cure'],
  },
];

async function connectDatabase() {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
}

async function seedManufacturer() {
  const existing = await User.findOne({ email: manufacturerSeed.email });
  if (existing) {
    await User.updateOne(
      { _id: existing._id },
      {
        $set: {
          firstName: manufacturerSeed.firstName,
          lastName: manufacturerSeed.lastName,
          phone: manufacturerSeed.phone,
          role: manufacturerSeed.role,
          companyName: manufacturerSeed.companyName,
          description: manufacturerSeed.description,
          verificationStatus: manufacturerSeed.verificationStatus,
          status: manufacturerSeed.status,
          isVerified: manufacturerSeed.isVerified,
        },
      }
    );
    return existing;
  }

  return User.create(manufacturerSeed);
}

async function seedProducts(manufacturerId) {
  for (const seed of productSeeds) {
    await Product.updateOne(
      { name: seed.name, category: seed.category },
      {
        $set: {
          ...seed,
          manufacturer: manufacturerId,
          isStaticProduct: false,
        },
      },
      { upsert: true }
    );
  }
}

async function seedKnowledgeArticles() {
  for (const seed of knowledgeSeeds) {
    await KnowledgeArticle.updateOne(
      { title: seed.title },
      {
        $set: seed,
      },
      { upsert: true }
    );
  }
}

async function main() {
  await connectDatabase();

  const manufacturer = await seedManufacturer();
  await seedProducts(manufacturer._id);
  await seedKnowledgeArticles();

  const productCount = await Product.countDocuments({ manufacturer: manufacturer._id });
  const articleCount = await KnowledgeArticle.countDocuments({});

  console.log('Seed completed successfully');
  console.log(`Manufacturer: ${manufacturer.email}`);
  console.log(`Products seeded: ${productCount}`);
  console.log(`Knowledge articles seeded: ${articleCount}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});