import React, { useLayoutEffect, useRef } from 'react';
import { cn } from '../ui/utils';

/**
 * Champ de saisie qui passe a la ligne et grandit avec son contenu.
 *
 * Un `<input>` ne sait pas revenir a la ligne : quelle que soit la CSS, son
 * texte reste sur une seule ligne et deborde. C'est pour ca qu'une designation
 * longue se retrouvait coupee dans le tableau des lignes de devis.
 *
 * On ne fait donc pas confiance a `field-sizing: content`, encore absent de
 * Firefox et Safari : la hauteur est recalculee a chaque changement de valeur,
 * y compris quand elle vient du code — une ligne ajoutee depuis un modele
 * metier ou depuis le marketplace doit s'afficher entiere sans que personne
 * n'ait tape dedans.
 *
 * Ni troncature, ni ellipse, ni defilement : le contenu est toujours visible
 * en entier. Une infobulle ne conviendrait pas non plus, elle ne s'ouvre pas
 * au doigt sur mobile.
 */

type AutoGrowTextareaProps = React.ComponentProps<'textarea'>;

export default function AutoGrowTextarea({ className, value, ...props }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Remise a zero avant mesure : sans ca, la hauteur ne redescend jamais
    // quand l'artisan raccourcit son texte.
    element.style.height = 'auto';
    // `scrollHeight` vaut 0 hors d'un vrai moteur de rendu (jsdom) : on
    // laisse alors la hauteur naturelle plutot que d'ecraser le champ.
    if (element.scrollHeight > 0) {
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn(
        'block w-full resize-none overflow-hidden rounded-lg border border-border bg-card',
        'px-3 py-2 text-sm leading-snug shadow-sm transition',
        'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500',
        className
      )}
      {...props}
    />
  );
}
