/**
 * setupTests.ts
 *
 * Ce fichier est exécuté automatiquement avant chaque suite de tests.
 * Il étend les matchers de Vitest avec les matchers DOM de jest-dom,
 * ce qui permet d'écrire des assertions lisibles comme :
 *   - expect(element).toBeInTheDocument()
 *   - expect(element).toHaveTextContent('...')
 *   - expect(element).toBeVisible()
 */
import '@testing-library/jest-dom';
