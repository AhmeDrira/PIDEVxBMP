import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ExternalLink, Loader2, Search, ShoppingCart, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Selecteur de materiaux du Marketplace, pour alimenter les lignes d'un devis.
 *
 * Rendu en surcouche plutot qu'en page : le formulaire de devis reste monte
 * derriere, donc les lignes deja saisies survivent. C'est la difference avec le
 * parcours d'ArtisanProjects, qui quitte la page (`window.location.href`) — ce
 * qui perdrait ici un devis en cours de redaction.
 *
 * ⚠ Le catalogue est charge en entier et filtre dans le navigateur, faute de
 * recherche cote serveur sur GET /api/products/marketplace. C'est tenable au
 * volume actuel et assume comme dette : au-dela de quelques milliers de
 * produits, il faudra paginer cote serveur.
 */

export interface MarketplaceProduct {
  _id: string;
  name: string;
  category: string;
  price: number;
  stock?: number;
  status?: string;
  image?: string;
  manufacturer?: { companyName?: string; firstName?: string; lastName?: string } | string;
}

interface MarketplaceMaterialPickerProps {
  /**
   * Produits deja presents dans le devis. Ils sont signales, mais restent
   * selectionnables : l'artisan a pu supprimer la ligne entre-temps, et un
   * bouton grise sans explication le laisserait sans recours.
   */
  alreadyAddedIds?: string[];
  onAdd: (produits: MarketplaceProduct[]) => void;
  onClose: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => {
  const direct = localStorage.getItem('token');
  if (direct) return direct;
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').token || null;
  } catch {
    return null;
  }
};

const nomFabricant = (produit: MarketplaceProduct) => {
  const fabricant = produit.manufacturer;
  if (!fabricant || typeof fabricant === 'string') return '';
  return fabricant.companyName || fabricant.firstName || '';
};

/** Un produit epuise reste devisable : on le commandera. */
const estEnRupture = (produit: MarketplaceProduct) =>
  String(produit.status || '') === 'out-of-stock' || Number(produit.stock) <= 0;

export default function MarketplaceMaterialPicker({
  alreadyAddedIds = [],
  onAdd,
  onClose,
}: MarketplaceMaterialPickerProps) {
  const { language } = useLanguage();
  const tr = (en: string, fr: string, ar: string = en) =>
    (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const [produits, setProduits] = useState<MarketplaceProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('all');
  const [selection, setSelection] = useState<string[]>([]);

  useEffect(() => {
    let annule = false;

    const charger = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/products/marketplace`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!annule) setProduits(Array.isArray(data) ? data : []);
      } catch {
        if (!annule) {
          setError(tr(
            'The marketplace could not be loaded.',
            "Le marketplace n'a pas pu être chargé.",
            'تعذر تحميل السوق.'
          ));
        }
      } finally {
        if (!annule) setIsLoading(false);
      }
    };

    charger();
    return () => { annule = true; };
  }, []);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(produits.map((p) => p.category).filter(Boolean)))],
    [produits]
  );

  // Meme logique de filtrage que la marketplace : nom ou categorie.
  const produitsFiltres = useMemo(() => {
    const terme = recherche.toLowerCase();
    return produits.filter((produit) => {
      const correspondRecherche = String(produit.name || '').toLowerCase().includes(terme)
        || String(produit.category || '').toLowerCase().includes(terme);
      const correspondCategorie = categorie === 'all' || produit.category === categorie;
      return correspondRecherche && correspondCategorie;
    });
  }, [produits, recherche, categorie]);

  const bascule = (id: string) => {
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const valider = () => {
    // L'ordre du catalogue est conserve, pas celui des clics.
    const retenus = produits.filter((p) => selection.includes(String(p._id)));
    if (retenus.length === 0) return;
    onAdd(retenus);
  };

  return (
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={tr('Add from marketplace', 'Ajouter depuis le marketplace', 'إضافة من السوق')}
      data-testid="marketplace-picker"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {tr('Add from marketplace', 'Ajouter depuis le marketplace', 'إضافة من السوق')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tr(
                'Pick the materials to add as quote lines.',
                'Choisissez les matériaux à ajouter comme lignes de devis.',
                'اختر المواد لإضافتها كسطور.'
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={tr('Close', 'Fermer', 'إغلاق')}
          >
            <X size={18} />
          </Button>
        </header>

        <div className="grid gap-3 border-b border-border px-6 py-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="marketplaceSearch" className="text-xs font-semibold text-muted-foreground">
              {tr('Search', 'Rechercher', 'بحث')}
            </Label>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="marketplaceSearch"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={tr('Name or category', 'Nom ou catégorie', 'الاسم أو الفئة')}
                className="h-10 rounded-lg pl-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="marketplaceCategory" className="text-xs font-semibold text-muted-foreground">
              {tr('Category', 'Catégorie', 'الفئة')}
            </Label>
            <select
              id="marketplaceCategory"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? tr('All categories', 'Toutes les catégories', 'كل الفئات') : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              {tr('Loading the catalogue...', 'Chargement du catalogue...', 'جاري التحميل...')}
            </p>
          )}

          {!isLoading && error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {!isLoading && !error && produitsFiltres.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {tr('No product matches.', 'Aucun produit ne correspond.', 'لا يوجد منتج مطابق.')}
            </p>
          )}

          {!isLoading && !error && produitsFiltres.length > 0 && (
            <ul className="space-y-2">
              {produitsFiltres.map((produit) => {
                const id = String(produit._id);
                const inputId = `marketplace-produit-${id}`;
                const dejaAjoute = alreadyAddedIds.includes(id);
                const fabricant = nomFabricant(produit);

                return (
                  <li key={id}>
                    <label
                      htmlFor={inputId}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm transition hover:border-secondary"
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={selection.includes(id)}
                        onChange={() => bascule(id)}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{produit.name}</span>
                          {estEnRupture(produit) && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                              {tr('Out of stock', 'Rupture de stock', 'نفد المخزون')}
                            </span>
                          )}
                          {dejaAjoute && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                              {tr('Already added', 'Déjà ajouté', 'مضاف بالفعل')}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {produit.category}
                          {fabricant ? ` — ${fabricant}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-foreground">
                        {Number(produit.price || 0).toFixed(2)} TND
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {tr(
                'Quantity starts at 1 and stays editable on the line.',
                'La quantité démarre à 1 et reste modifiable sur la ligne.',
                'تبدأ الكمية من 1 وتظل قابلة للتعديل.'
              )}
            </p>
            {/*
              Consultation en parallele : fiches completes, avis, photos et
              filtres que cette fenetre ne reprend pas. Un nouvel onglet plutot
              qu'une navigation : le devis en cours reste monte derriere, et
              rien de son etat n'a besoin de transiter.
            */}
            <a
              href="/?artisanView=marketplace"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-secondary underline-offset-4 hover:underline"
            >
              {tr(
                'See the full listing on the Marketplace',
                'Voir la fiche complète sur le Marketplace',
                'عرض البطاقة الكاملة في السوق'
              )}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-lg" onClick={onClose}>
              {tr('Cancel', 'Annuler', 'إلغاء')}
            </Button>
            <Button
              type="button"
              className="rounded-lg bg-secondary text-white hover:bg-secondary/90"
              disabled={selection.length === 0}
              onClick={valider}
            >
              <ShoppingCart size={15} className="mr-2" />
              {tr(
                `Add ${selection.length} product(s)`,
                `Ajouter les ${selection.length} produits`,
                `أضف ${selection.length} منتجات`
              )}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
