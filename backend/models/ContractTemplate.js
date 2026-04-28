const mongoose = require('mongoose');

/**
 * ContractTemplate — modèle de contrat configurable par l'administrateur.
 * Le contenu utilise des variables entourées de doubles accolades :
 *   {{artisanName}}, {{expertName}}, {{description}},
 *   {{localisation}}, {{finalPrice}}, {{startDate}}, {{createdAt}}
 */
const contractTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      default: 'Default Contract Template',
    },
    content: {
      type: String,
      required: [true, 'Template content is required'],
      trim: true,
      default: `CONTRAT DE PRESTATION DE SERVICES

Entre les soussignés :

L'Expert : {{expertName}}
L'Artisan : {{artisanName}}

Il a été convenu ce qui suit :

ARTICLE 1 — OBJET
{{description}}

ARTICLE 2 — LIEU D'EXÉCUTION
{{localisation}}

ARTICLE 3 — DATE DE DÉBUT
{{startDate}}

ARTICLE 4 — RÉMUNÉRATION
Le montant convenu pour cette prestation est de {{finalPrice}} TND.

ARTICLE 5 — OBLIGATIONS DES PARTIES
L'artisan s'engage à réaliser les travaux dans les règles de l'art et dans les délais convenus.
L'expert s'engage à mettre à disposition les informations nécessaires et à régler le montant convenu.

ARTICLE 6 — SIGNATURE ÉLECTRONIQUE
Ce contrat est considéré comme valide et contraignant dès lors qu'il est signé électroniquement par l'artisan.

Fait le {{createdAt}}.`,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ContractTemplate', contractTemplateSchema);
