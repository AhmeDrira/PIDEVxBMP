import * as React from "react";

import { cn } from "./utils";

/**
 * Retire un zero de tete qui n'apporte rien : « 055 » -> « 55 ».
 *
 * Un champ numerique initialise a 0 affiche « 0 ». Si la frappe s'insere au
 * lieu de remplacer, l'artisan obtient « 055 » et le prix du devis devient
 * faux sans que rien ne le signale.
 *
 * Ce qui est volontairement PRESERVE :
 *   - « 0 » seul, qui est une valeur legitime ;
 *   - « 0.5 » et « 0,5 », ou le zero precede un separateur decimal et non un
 *     chiffre — c'est la saisie normale d'une decimale, la casser rendrait
 *     tout champ sous l'unite impossible a remplir ;
 *   - le signe, qui reste devant : « -055 » -> « -55 ».
 */
export const stripLeadingZeros = (valeur: string) =>
  String(valeur).replace(/^(-?)0+(?=\d)/, "$1");

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onChange, ...props }, ref) => {
    const isNumber = type === "number";

    /**
     * Selectionne le contenu a la prise de focus, sur les champs numeriques
     * seulement.
     *
     * Sans ca, le curseur se pose la ou l'artisan a clique et la frappe
     * s'insere : cliquer a droite du « 0 » puis taper « 55 » donnait « 055 »,
     * cliquer a gauche donnait « 550 ». Selectionner tout fait que la premiere
     * touche remplace, ce que tout le monde attend d'un champ a zero.
     *
     * Limite au type `number` a dessein : selectionner tout le nom d'un client
     * a chaque clic empecherait de le corriger d'un caractere.
     */
    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      if (isNumber) {
        // `select()` ne s'applique pas a tous les types selon les moteurs, et
        // `setSelectionRange` leve carrement sur un input numerique : on ne
        // laisse pas une exception casser la prise de focus.
        try {
          event.target.select();
        } catch {
          /* Le champ reste utilisable, seule la selection automatique manque. */
        }
      }
      onFocus?.(event);
    };

    /**
     * Filet de securite : la selection au focus ne couvre pas tout — collage,
     * saisie vocale, ou navigateur qui refuse `select()` sur un champ
     * numerique. On normalise donc aussi la valeur au passage.
     */
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumber) {
        const normalise = stripLeadingZeros(event.target.value);
        if (normalise !== event.target.value) {
          event.target.value = normalise;
        }
      }
      onChange?.(event);
    };

    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        onFocus={handleFocus}
        onChange={handleChange}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground placeholder:opacity-60 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-input-background px-3 py-1 text-base transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
