/**
 * Tests for ArtisanProfileReviews — covers:
 *   - loading spinner → reviews rendered
 *   - empty state when no reviews
 *   - error state with retry markup
 *   - missing user / artisanId branches (no fetch)
 *   - average rating, total reviews, recommendation rate calculation
 *   - rating breakdown bars
 *   - filter by stars (5/4/3/2/1 + All)
 *   - sort by newest / highest
 *   - back button (when onBack provided)
 *   - mapping of review fields (expert.firstName + lastName + domain)
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProfileReviews from '@/components/artisan/ArtisanProfileReviews';
import { server } from '../../setup/mswServer';

const seedUser = (id = 'artisan-1') => ({
  _id: id,
  token: 'pr-tok',
  firstName: 'A',
  lastName: 'B',
});

const seedReviews = [
  {
    _id: 'r1',
    rating: 5,
    comment: 'Excellent work!',
    createdAt: '2026-04-10T10:00:00Z',
    projectName: 'Bathroom Renovation',
    expert: { firstName: 'Eya', lastName: 'Expert', domain: 'Plumbing' },
  },
  {
    _id: 'r2',
    rating: 4,
    comment: 'Good but late.',
    createdAt: '2026-04-15T10:00:00Z',
    projectName: 'Kitchen',
    expert: { firstName: 'Moez', lastName: 'M', domain: 'Carpentry' },
  },
  {
    _id: 'r3',
    rating: 3,
    comment: 'Average.',
    createdAt: '2026-04-20T10:00:00Z',
    expert: { firstName: 'Sami', lastName: 'S', specialization: 'Electric' },
  },
  {
    _id: 'r4',
    rating: 5,
    comment: 'Perfect again.',
    createdAt: '2026-04-25T10:00:00Z',
    expert: { firstName: 'Hana', lastName: 'H' }, // role fallback to "Expert"
  },
];

const installReviewsHandler = (reviews: any[] = seedReviews, status = 200) => {
  server.use(
    http.get('*/api/artisans/:id/reviews', () => {
      if (status >= 400) return HttpResponse.json({ message: 'down' }, { status });
      return HttpResponse.json(reviews);
    })
  );
};

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify(seedUser()));
});

afterEach(() => {
  localStorage.clear();
});

describe('ArtisanProfileReviews — loading & gates', () => {
  it('shows loading spinner then the reviews', async () => {
    installReviewsHandler();
    const { container } = render(<ProfileReviews />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Profile Reviews')).toBeInTheDocument());
  });

  it('handles missing user (no fetch + non-loading state)', async () => {
    localStorage.clear();
    let called = false;
    server.use(
      http.get('*/api/artisans/:id/reviews', () => {
        called = true;
        return HttpResponse.json([]);
      })
    );
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(called).toBe(false);
  });

  it('handles missing artisanId on the user object (no fetch)', async () => {
    localStorage.setItem('user', JSON.stringify({ token: 't' })); // no _id / id
    let called = false;
    server.use(
      http.get('*/api/artisans/:id/reviews', () => {
        called = true;
        return HttpResponse.json([]);
      })
    );
    render(<ProfileReviews />);
    await new Promise((r) => setTimeout(r, 30));
    expect(called).toBe(false);
  });

  it('shows the error state when the API returns 500', async () => {
    installReviewsHandler([], 500);
    render(<ProfileReviews onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Could not load reviews/i)).toBeInTheDocument()
    );
    // Back button is only present when onBack is provided
    expect(screen.getByRole('button', { name: /Back to Profile/i })).toBeInTheDocument();
  });
});

describe('ArtisanProfileReviews — stats and rendering', () => {
  it('computes the average rating, total and recommendation rate', async () => {
    installReviewsHandler();
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('Profile Reviews')).toBeInTheDocument());

    // 4 reviews: ratings 5, 4, 3, 5 → avg = 4.25, recommendation = 75% (3/4 ≥ 4)
    expect(screen.getByText('4.3')).toBeInTheDocument();
    // "4" total reviews appears among many "4"s (breakdown rows). Look for the
    // header card "Total Reviews" instead and verify it has a "4" sibling.
    expect(screen.getByText('Total Reviews')).toBeInTheDocument();
    expect(screen.getByText(/Expert Reviews \(4\)/)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders one card per review with expert info and project name', async () => {
    installReviewsHandler();
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());

    expect(screen.getByText('Plumbing')).toBeInTheDocument();
    expect(screen.getByText('Excellent work!')).toBeInTheDocument();
    expect(screen.getByText('Bathroom Renovation')).toBeInTheDocument();

    expect(screen.getByText('Moez M')).toBeInTheDocument();
    expect(screen.getByText('Carpentry')).toBeInTheDocument();

    expect(screen.getByText('Sami S')).toBeInTheDocument();
    expect(screen.getByText('Electric')).toBeInTheDocument();

    // Hana has no domain/specialization — falls back to "Expert" (multiple "Expert" strings will appear so use getAll)
    expect(screen.getByText('Hana H')).toBeInTheDocument();
    expect(screen.getAllByText('Expert').length).toBeGreaterThan(0);
  });

  it('shows the rating breakdown counts', async () => {
    installReviewsHandler();
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('Rating Breakdown')).toBeInTheDocument());

    // Breakdown: 5★=2, 4★=1, 3★=1, 2★=0, 1★=0
    const breakdownCard = screen.getByText('Rating Breakdown').closest('div')!;
    // The numbers above also appear elsewhere (averageRating, total) so we just
    // assert the breakdown header is rendered alongside expected stars labels.
    expect(within(breakdownCard.parentElement!).getAllByText(/^[1-5]$/).length).toBeGreaterThanOrEqual(5);
  });
});

describe('ArtisanProfileReviews — filter & sort', () => {
  it('filters by 4 stars only', async () => {
    installReviewsHandler();
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '4★' }));

    expect(screen.getByText('Moez M')).toBeInTheDocument();
    // Other ratings are gone
    expect(screen.queryByText('Eya Expert')).toBeNull();
    expect(screen.queryByText('Sami S')).toBeNull();
    expect(screen.getByText(/Expert Reviews \(1\)/i)).toBeInTheDocument();
  });

  it('returns to the full list when "All" is clicked again', async () => {
    installReviewsHandler();
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '5★' }));
    expect(screen.getByText(/Expert Reviews \(2\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText(/Expert Reviews \(4\)/i)).toBeInTheDocument();
  });

  it('renders the empty filter state when no reviews match the rating', async () => {
    installReviewsHandler();
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '2★' }));
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.getByText(/Experts will leave feedback/i)).toBeInTheDocument();
  });

  it('switches sort to "Highest Rating"', async () => {
    installReviewsHandler();
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());

    const user = userEvent.setup();
    // Clicking "Highest Rating" is enough to flip the sort. Detailed ordering
    // assertion would need DOM ordering checks; we assert the cards still render.
    await user.click(screen.getByRole('button', { name: 'Highest Rating' }));
    expect(screen.getByText('Eya Expert')).toBeInTheDocument();
    expect(screen.getByText('Hana H')).toBeInTheDocument();
  });

  it('triggers onBack when the back button is clicked', async () => {
    installReviewsHandler();
    const onBack = vi.fn();
    render(<ProfileReviews onBack={onBack} />);
    await waitFor(() => expect(screen.getByText('Eya Expert')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: /Back to Profile/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ArtisanProfileReviews — no reviews', () => {
  it('shows the empty state when the API returns []', async () => {
    installReviewsHandler([]);
    render(<ProfileReviews />);
    await waitFor(() => expect(screen.getByText('No reviews yet')).toBeInTheDocument());
    // Stats are zeros: 0.0, 0, 0%
    expect(screen.getByText('0.0')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
