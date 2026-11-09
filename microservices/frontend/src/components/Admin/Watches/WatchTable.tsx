"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ProductModel } from "@/database/types";
import { deleteProduct, setProductVisibility } from "@/services/productService";
import { toast } from "sonner";

export type ProductRow = ProductModel;

const createColumns = (
  onVisibleChange: (productId: string, visible: boolean) => Promise<void>,
  onDeleteProduct: (productId: string) => Promise<void>
): ColumnDef<ProductRow>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const product = row.original as ProductRow;
      const brand = product.watch?.brand?.name ?? "";
      const model = product.watch?.model ?? "";
      return (
        <div className="flex flex-col">
          <div className="font-medium">
            {brand} {model}
          </div>
          <div className="text-xs text-muted-foreground">
            ref. {product.watch?.reference}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "priceDkk",
    header: () => <div className="text-right">Price (DKK)</div>,
    cell: ({ row }) => {
      const vatRate = 1.25; // Apply a fixed VAT rate of 25%
      const priceCents = Number(row.getValue("priceDkk")) * vatRate || 0;
      const priceUnits = priceCents / 100;
      const formatted = new Intl.NumberFormat("da-DK", {
        style: "currency",
        currency: "DKK",
      }).format(priceUnits);
      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  // Hidden concatenated search column — used for filtering across name/brand/model/reference
  {
    id: "search",
    accessorFn: (row) =>
      `${row.name} ${row.watch?.brand?.name ?? ""} ${row.watch?.model ?? ""} ${
        row.watch?.reference ?? ""
      }`,
    header: () => null,
    enableHiding: false,
  },
  {
    accessorKey: "stock",
    header: () => <div className="text-right">Stock</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.getValue("stock")}</div>
    ),
  },
  {
    accessorFn: (row) => !!row.visible,
    id: "visible",
    header: () => <div className="text-center">Visible</div>,
    cell: ({ row }) => (
      <div className="text-center">
        <Checkbox
          id={`visible-${row.id}`}
          defaultChecked={Boolean(row.original.visible)}
          onCheckedChange={() =>
            setProductVisibility(row.original.id, !row.original.visible)
          }
        />
      </div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const product = row.original as ProductRow;
      console.log("Rendering actions for product", product.id);

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(product.id)}
            >
              Copy product ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link
                href={`/admin/watches/${product.id}/edit`}
                className="block w-full h-full"
              >
                Edit watch
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDeleteProduct(product.id)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function WatchTable({
  initialProducts,
}: {
  initialProducts?: ProductModel[];
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({ search: false });
  const [rowSelection, setRowSelection] = React.useState({});

  const [data, setData] = React.useState<ProductRow[]>(initialProducts ?? []);

  async function onVisibleChange(productId: string, visible: boolean) {
    await setProductVisibility(productId, visible);
    console.log(`Visibility for product ${productId} set to ${visible}`);
    setData((prevData) =>
      prevData.map((product) =>
        product.id === productId ? { ...product, visible } : product
      )
    );
  }

  async function handleDeleteProduct(productId: string) {
    await deleteProduct(productId);
    setData((prevData) =>
      prevData.filter((product) => product.id !== productId)
    );
    toast.success("Product deleted successfully");
  }

  const columns = createColumns(onVisibleChange, handleDeleteProduct);

  const table = useReactTable({
    data: data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter by name or reference..."
          value={(table.getColumn("search")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("search")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
