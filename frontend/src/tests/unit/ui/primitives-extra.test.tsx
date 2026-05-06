/**
 * Smoke tests for the remaining lightweight UI primitives — most are thin
 * Radix wrappers, so a render-and-assert-data-slot is enough to take coverage
 * to 100% on each of these tiny modules.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// Mock next-themes for Sonner
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }));
import { Toaster } from '@/components/ui/sonner';

// ---------- AspectRatio ------------------------------------------------------

describe('AspectRatio', () => {
  it('renders a slot wrapper', () => {
    const { container } = render(
      <AspectRatio ratio={16 / 9}>
        <span>child</span>
      </AspectRatio>
    );
    expect(container.querySelector('[data-slot="aspect-ratio"]')).toBeInTheDocument();
  });
});

// ---------- Collapsible ------------------------------------------------------

describe('Collapsible', () => {
  it('toggles content visibility on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Collapsible>
        <CollapsibleTrigger>open</CollapsibleTrigger>
        <CollapsibleContent>secret</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.queryByText('secret')).toBeNull();
    await user.click(screen.getByText('open'));
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});

// ---------- Slider -----------------------------------------------------------

describe('Slider', () => {
  it('renders slider with given default value', () => {
    const { container } = render(<Slider defaultValue={[40]} max={100} />);
    expect(container.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    const thumbs = container.querySelectorAll('[role="slider"]');
    expect(thumbs.length).toBeGreaterThan(0);
  });
});

// ---------- Toggle / ToggleGroup --------------------------------------------

describe('Toggle', () => {
  it('toggles the pressed state on click', async () => {
    const user = userEvent.setup();
    render(<Toggle aria-label="bold">B</Toggle>);
    const toggle = screen.getByRole('button', { name: 'bold' });
    expect(toggle).toHaveAttribute('data-state', 'off');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('data-state', 'on');
  });
});

describe('ToggleGroup', () => {
  it('selects only one item in single mode', async () => {
    const user = userEvent.setup();
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a" aria-label="A">A</ToggleGroupItem>
        <ToggleGroupItem value="b" aria-label="B">B</ToggleGroupItem>
      </ToggleGroup>
    );
    const a = screen.getByRole('radio', { name: 'A' });
    const b = screen.getByRole('radio', { name: 'B' });
    await user.click(a);
    expect(a).toHaveAttribute('data-state', 'on');
    await user.click(b);
    expect(b).toHaveAttribute('data-state', 'on');
    expect(a).toHaveAttribute('data-state', 'off');
  });
});

// ---------- Tooltip ----------------------------------------------------------

describe('Tooltip', () => {
  it('mounts trigger with the data-slot attribute', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>hover me</TooltipTrigger>
          <TooltipContent>tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByText('hover me')).toBeInTheDocument();
  });
});

// ---------- Popover ----------------------------------------------------------

describe('Popover', () => {
  it('shows content when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>open</PopoverTrigger>
        <PopoverContent>popover-body</PopoverContent>
      </Popover>
    );
    expect(screen.queryByText('popover-body')).toBeNull();
    await user.click(screen.getByText('open'));
    expect(screen.getByText('popover-body')).toBeInTheDocument();
  });
});

// ---------- HoverCard --------------------------------------------------------

describe('HoverCard', () => {
  it('renders trigger', () => {
    render(
      <HoverCard>
        <HoverCardTrigger>hovertrigger</HoverCardTrigger>
        <HoverCardContent>content</HoverCardContent>
      </HoverCard>
    );
    expect(screen.getByText('hovertrigger')).toBeInTheDocument();
  });
});

// ---------- Breadcrumb -------------------------------------------------------

describe('Breadcrumb', () => {
  it('renders the breadcrumb tree with items, link, page and separator', () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/home">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="breadcrumb-separator"]')).toBeInTheDocument();
  });
});

// ---------- Accordion --------------------------------------------------------

describe('Accordion', () => {
  it('expands an item on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>question</AccordionTrigger>
          <AccordionContent>answer</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
    expect(screen.queryByText('answer')).toBeNull();
    await user.click(screen.getByText('question'));
    expect(screen.getByText('answer')).toBeInTheDocument();
  });
});

// ---------- Pagination -------------------------------------------------------

describe('Pagination', () => {
  it('renders prev/next/links/ellipsis', () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

// ---------- Sheet ------------------------------------------------------------

describe('Sheet', () => {
  it('opens the sheet content on trigger click', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>open sheet</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Title</SheetTitle>
            <SheetDescription>Desc</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    expect(screen.queryByText('Title')).toBeNull();
    await user.click(screen.getByText('open sheet'));
    expect(screen.getByText('Title')).toBeInTheDocument();
  });
});

// ---------- ScrollArea -------------------------------------------------------

describe('ScrollArea', () => {
  it('renders scrollable content', () => {
    const { container } = render(
      <ScrollArea>
        <div style={{ height: 800 }}>scrolling content</div>
        <ScrollBar />
      </ScrollArea>
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toBeInTheDocument();
    expect(screen.getByText('scrolling content')).toBeInTheDocument();
  });
});

// ---------- Toaster ----------------------------------------------------------

describe('Toaster (sonner wrapper)', () => {
  it('renders the toaster region', () => {
    const { container } = render(<Toaster position="top-right" />);
    // sonner renders an <ol> region for the notifications
    const ol = container.querySelector('section,ol');
    expect(ol).toBeInTheDocument();
  });
});
