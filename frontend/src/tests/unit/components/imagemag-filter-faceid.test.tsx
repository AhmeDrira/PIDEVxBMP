/**
 * Tests for three small reusable components:
 *   - ImageMagnifier (presentational with mouse interactions)
 *   - FilterSidebar (controlled state + parent callbacks)
 *   - FaceIdSection (loading / registered / register flow + toast)
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ImageMagnifier } from '@/components/common/ImageMagnifier';
import FilterSidebar from '@/components/common/FilterSidebar';
import FaceIdSection from '@/components/common/FaceIdSection';
import { server } from '../../setup/mswServer';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
import { toast } from 'sonner';

// FaceCaptureWidget is heavy (face-api / camera) — mock it for the FaceIdSection tests
vi.mock('@/components/auth/FaceCaptureWidget', () => ({
  default: ({ onCapture, onCancel }: any) => (
    <div data-testid="face-capture-widget">
      <button onClick={() => onCapture(new Array(128).fill(0.1))}>capture</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

// ---------- ImageMagnifier --------------------------------------------------

describe('ImageMagnifier', () => {
  it('renders the placeholder when no src is provided', () => {
    render(<ImageMagnifier alt="empty" />);
    expect(screen.getByText('Image indisponible')).toBeInTheDocument();
  });

  it('renders the image and the hint badge by default', () => {
    render(<ImageMagnifier src="/p.jpg" alt="Photo" hint="Hover to zoom" />);
    expect(screen.getByAltText('Photo')).toBeInTheDocument();
    expect(screen.getByText('Hover to zoom')).toBeInTheDocument();
  });

  it('honours showHint=false', () => {
    render(<ImageMagnifier src="/p.jpg" alt="P" showHint={false} />);
    expect(screen.queryByText(/Survolez pour zoomer/i)).toBeNull();
  });

  it('switches to the placeholder when the image fails to load', () => {
    render(<ImageMagnifier src="/missing.jpg" alt="X" />);
    fireEvent.error(screen.getByAltText('X'));
    expect(screen.getByText('Image indisponible')).toBeInTheDocument();
  });

  it('activates zoom transform on mouse enter', () => {
    const { container } = render(
      <ImageMagnifier src="/p.jpg" alt="P" zoomLevel={2.0} />
    );
    const viewer = container.querySelector('.cursor-zoom-in') as HTMLElement;
    expect(viewer).not.toBeNull();
    fireEvent.mouseEnter(viewer);
    fireEvent.mouseMove(viewer, { clientX: 50, clientY: 50 });
    const img = container.querySelector('img')!;
    expect(img.style.transform).toMatch(/scale\(2\)/);
    fireEvent.mouseLeave(viewer);
    expect(img.style.transform).toMatch(/scale\(1\)/);
  });

  it('renders the preview pane when showPreviewPane is true', () => {
    render(<ImageMagnifier src="/p.jpg" alt="P" showPreviewPane />);
    expect(screen.getByText(/Zoom live/i)).toBeInTheDocument();
  });

  it('respects imageFit="contain"', () => {
    const { container } = render(<ImageMagnifier src="/p.jpg" imageFit="contain" />);
    const img = container.querySelector('img')!;
    expect(img.className).toMatch(/object-contain/);
  });
});

// ---------- FilterSidebar ---------------------------------------------------

describe('FilterSidebar', () => {
  const baseProps = {
    categories: ['Cement', 'Tiles', 'Paint'],
    onApplyFilters: vi.fn(),
    onClearFilters: vi.fn(),
  };

  it('renders the categories and the two select boxes', () => {
    render(<FilterSidebar {...baseProps} />);
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(screen.getByText('Tiles')).toBeInTheDocument();
    expect(screen.getByText('Paint')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AllTime')).toBeInTheDocument();
    expect(screen.getByDisplayValue('default')).toBeInTheDocument();
  });

  it('toggles a category checkbox and applies filters', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FilterSidebar {...baseProps} onApplyFilters={onApply} />);

    const cementCheckbox = screen.getByLabelText('Cement') as HTMLInputElement;
    expect(cementCheckbox.checked).toBe(false);
    await user.click(cementCheckbox);
    expect(cementCheckbox.checked).toBe(true);

    // toggle off again
    await user.click(cementCheckbox);
    expect(cementCheckbox.checked).toBe(false);

    // re-toggle and apply
    await user.click(cementCheckbox);
    await user.click(screen.getByRole('button', { name: /Appliquer/i }));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['Cement'] })
    );
  });

  it('updates the date range and views sort selects', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<FilterSidebar {...baseProps} onApplyFilters={onApply} />);

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    await user.selectOptions(selects[0], 'newest');
    await user.selectOptions(selects[1], 'most_viewed');

    await user.click(screen.getByRole('button', { name: /Appliquer/i }));
    expect(onApply).toHaveBeenCalledWith({
      categories: [],
      dateRange: 'newest',
      viewsSort: 'most_viewed',
    });
  });

  it('"Réinitialiser" + "Clear All" reset state and call onClearFilters', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<FilterSidebar {...baseProps} onClearFilters={onClear} />);

    const cement = screen.getByLabelText('Cement') as HTMLInputElement;
    await user.click(cement);
    expect(cement.checked).toBe(true);

    await user.click(screen.getByRole('button', { name: /Clear All/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(cement.checked).toBe(false);

    await user.click(cement);
    await user.click(screen.getByRole('button', { name: /Réinitialiser/i }));
    expect(onClear).toHaveBeenCalledTimes(2);
    expect(cement.checked).toBe(false);
  });
});

// ---------- FaceIdSection ---------------------------------------------------

describe('FaceIdSection', () => {
  const installFaceHandlers = (initial: boolean) => {
    let registered = initial;
    server.use(
      http.get('*/api/auth/face-descriptor/status', () =>
        HttpResponse.json({ hasFaceDescriptor: registered })
      ),
      http.post('*/api/auth/face-descriptor', () => {
        registered = true;
        return HttpResponse.json({ message: 'Face registered successfully' });
      }),
      http.delete('*/api/auth/face-descriptor', () => {
        registered = false;
        return HttpResponse.json({ message: 'Face removed successfully' });
      })
    );
  };

  it('shows the loading state then transitions to the unregistered state', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 't' }));
    installFaceHandlers(false);
    render(<FaceIdSection />);
    expect(screen.getByText(/Checking face recognition status/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Add Face ID/i })).toBeInTheDocument()
    );
  });

  it('shows the registered state when the API reports a face descriptor', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 't' }));
    installFaceHandlers(true);
    render(<FaceIdSection />);
    await waitFor(() =>
      expect(screen.getByText('Registered')).toBeInTheDocument()
    );
  });

  it('opens the camera widget then captures + saves a descriptor', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 't' }));
    installFaceHandlers(false);
    const user = userEvent.setup();
    render(<FaceIdSection />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Add Face ID/i })).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: /Add Face ID/i }));
    expect(screen.getByTestId('face-capture-widget')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'capture' }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Face recognition registered successfully!'
      )
    );
    // After capture: status flips to "Registered"
    expect(screen.getByText('Registered')).toBeInTheDocument();
  });

  it('removes the face descriptor via the Remove button (confirms via window.confirm)', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 't' }));
    installFaceHandlers(true);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<FaceIdSection />);

    await waitFor(() => expect(screen.getByText('Registered')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Remove/i }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Face recognition removed.')
    );
    expect(screen.getByRole('button', { name: /Add Face ID/i })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('does not remove the descriptor when the confirm dialog is cancelled', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 't' }));
    installFaceHandlers(true);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<FaceIdSection />);
    await waitFor(() => expect(screen.getByText('Registered')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Remove/i }));
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect((toast.success as any).mock.calls.length).toBe(0);
    confirmSpy.mockRestore();
  });
});
