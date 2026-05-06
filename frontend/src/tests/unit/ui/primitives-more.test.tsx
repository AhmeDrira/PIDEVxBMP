/**
 * Smoke + interaction tests for additional UI primitives.
 * Each component is rendered through its open path so the data-slot wrappers
 * and the variants/utility-class branches all execute.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// ---------- Dialog -----------------------------------------------------------

describe('Dialog', () => {
  it('opens on trigger click and shows title/description', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>The title</DialogTitle>
            <DialogDescription>The description</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    expect(screen.queryByText('The title')).toBeNull();
    await user.click(screen.getByText('open'));
    expect(screen.getByText('The title')).toBeInTheDocument();
    expect(screen.getByText('The description')).toBeInTheDocument();

    await user.click(screen.getByText('close'));
    // Radix removes the content from the DOM after close
    expect(screen.queryByText('The title')).toBeNull();
  });
});

// ---------- AlertDialog ------------------------------------------------------

describe('AlertDialog', () => {
  it('opens, shows action + cancel buttons, and closes via cancel', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger>delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm</AlertDialogTitle>
            <AlertDialogDescription>This is permanent.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>cancel</AlertDialogCancel>
            <AlertDialogAction>confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    await user.click(screen.getByText('delete'));
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('This is permanent.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'confirm' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByText('Confirm')).toBeNull();
  });
});

// ---------- DropdownMenu -----------------------------------------------------

describe('DropdownMenu', () => {
  it('renders the menu and triggers the item click', async () => {
    const user = userEvent.setup();
    let clicked = '';
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Section</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => { clicked = 'edit'; }}>Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { clicked = 'delete'; }} variant="destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>Show grid</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="r1">
            <DropdownMenuRadioItem value="r1">R1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="r2">R2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await user.click(screen.getByText('open menu'));
    expect(screen.getByText('Section')).toBeInTheDocument();
    await user.click(screen.getByText('Edit'));
    expect(clicked).toBe('edit');
  });
});

// ---------- Select -----------------------------------------------------------

describe('Select', () => {
  // Radix Select uses Pointer Events (hasPointerCapture) which jsdom doesn't
  // implement, so the open/select interaction can't run reliably. We assert the
  // closed-state rendering — that's enough to execute the wrapper code paths.
  it('renders the trigger with placeholder when no value is selected', () => {
    render(
      <Select>
        <SelectTrigger data-testid="trigger">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group</SelectLabel>
            <SelectItem value="a">A</SelectItem>
            <SelectSeparator />
            <SelectItem value="b">B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('renders with a default value visible inside the trigger', () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger data-testid="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Apple</SelectItem>
          <SelectItem value="b">Banana</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId('trigger').textContent).toContain('Apple');
  });
});

// ---------- Drawer -----------------------------------------------------------

describe('Drawer', () => {
  it('opens drawer content from the trigger', async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <DrawerTrigger>open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer title</DrawerTitle>
            <DrawerDescription>Drawer description</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose>close</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );

    await user.click(screen.getByText('open drawer'));
    expect(screen.getByText('Drawer title')).toBeInTheDocument();
    expect(screen.getByText('Drawer description')).toBeInTheDocument();
  });
});

// ---------- Table ------------------------------------------------------------

describe('Table', () => {
  it('renders a complete table with caption, header, body, footer', () => {
    const { container } = render(
      <Table>
        <TableCaption>my caption</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>3</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>3</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );

    expect(screen.getByText('my caption')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(container.querySelector('table')).toBeInTheDocument();
  });
});

// ---------- Card subparts ----------------------------------------------------

describe('Card extras (header/title/description/content/footer)', () => {
  it('renders all sub-parts together', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>card title</CardTitle>
          <CardDescription>card description</CardDescription>
        </CardHeader>
        <CardContent>card body</CardContent>
        <CardFooter>card footer</CardFooter>
      </Card>
    );
    expect(screen.getByText('card title')).toBeInTheDocument();
    expect(screen.getByText('card description')).toBeInTheDocument();
    expect(screen.getByText('card body')).toBeInTheDocument();
    expect(screen.getByText('card footer')).toBeInTheDocument();
  });
});
