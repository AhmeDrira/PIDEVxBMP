import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManufacturerProducts from '@/components/manufacturer/ManufacturerProducts';
import { server } from '../../setup/mswServer';

vi.mock('@/components/common/ImageMagnifier', () => ({
  ImageMagnifier: ({ alt }: { alt: string }) => <div data-testid="image-magnifier-mock">{alt}</div>,
}));

const productsFixture = [
  {
    _id: 'prod-00000001',
    name: 'Cement Pro 42.5',
    category: 'Maconnerie',
    price: 22.5,
    stock: 120,
    status: 'active',
    description: 'High resistance cement for structural concrete.',
    documentUrl: '',
    techSheetUrl: '',
  },
  {
    _id: 'prod-00000002',
    name: 'Copper Cable 2.5mm',
    category: 'Electricite',
    price: 3.4,
    stock: 30,
    status: 'low-stock',
    description: 'Flexible cable for interior electrical lines.',
    documentUrl: '',
    techSheetUrl: '',
  },
];

describe('ManufacturerProducts', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'manufacturer-token');
    localStorage.setItem('user', JSON.stringify({ _id: 'manufacturer-1', role: 'manufacturer', token: 'manufacturer-token' }));

    server.use(
      http.get('*/api/products', () => HttpResponse.json(productsFixture))
    );
  });

  it('should render inventory items after loading', async () => {
    // Act
    render(<ManufacturerProducts />);

    // Assert
    expect(screen.getByText(/loading inventory/i)).toBeInTheDocument();
    expect(await screen.findByText('Cement Pro 42.5')).toBeInTheDocument();
    expect(screen.getByText('Copper Cable 2.5mm')).toBeInTheDocument();
  });

  it('should filter inventory by search input', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<ManufacturerProducts />);

    const searchInput = await screen.findByRole('textbox');
    await user.clear(searchInput);
    await user.type(searchInput, 'copper');

    // Assert
    expect(screen.getByText('Copper Cable 2.5mm')).toBeInTheDocument();
    expect(screen.queryByText('Cement Pro 42.5')).not.toBeInTheDocument();
  });

  it('should open detail view from the product card', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<ManufacturerProducts />);

    await screen.findByText('Cement Pro 42.5');
    await user.click(screen.getAllByRole('button', { name: /view details/i })[0]);

    // Assert
    expect(await screen.findByText(/technical description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to inventory/i })).toBeInTheDocument();
  });

  it('should open add material form from list view', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<ManufacturerProducts />);

    await screen.findByText('Cement Pro 42.5');
    await user.click(screen.getByRole('button', { name: /addnewmaterial|add new material|ajouter/i }));

    // Assert
    expect(await screen.findByRole('heading', { name: /addnewmaterial|add new material|new material|edit material/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter product specifications/i)).toBeInTheDocument();
  });

  it('should show alert when generating description without product name', async () => {
    // Arrange
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Act
    render(<ManufacturerProducts />);

    await screen.findByText('Cement Pro 42.5');
    await user.click(screen.getByRole('button', { name: /addnewmaterial|add new material|ajouter/i }));
    await user.click(await screen.findByRole('button', { name: /generate|generer/i }));

    // Assert
    expect(alertSpy).toHaveBeenCalled();
    expect(String(alertSpy.mock.calls[0][0] || '')).toMatch(/product name|nom de produit/i);

    alertSpy.mockRestore();
  });

  it('should generate and inject description when API returns generated content', async () => {
    // Arrange
    const user = userEvent.setup();

    server.use(
      http.post('*/api/products/generate-description', async ({ request }) => {
        const body = (await request.json()) as { name?: string };
        return HttpResponse.json({
          description: `Generated description for ${body.name}`,
        });
      })
    );

    // Act
    render(<ManufacturerProducts />);

    await screen.findByText('Cement Pro 42.5');
    await user.click(screen.getByRole('button', { name: /addnewmaterial|add new material|ajouter/i }));

    await user.type(screen.getAllByRole('textbox')[0], 'Premium Tile Glue');
    await user.click(screen.getByRole('button', { name: /generate|generer/i }));

    // Assert
    expect(await screen.findByDisplayValue(/generated description for premium tile glue/i)).toBeInTheDocument();
  });
});