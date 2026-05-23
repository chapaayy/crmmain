"use client";

import { FormEvent } from "react";
import { Loader2, Save } from "lucide-react";
import type { Product, ProductCategory, ProductFormState, ProductVariant } from "@/components/products/product-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const bagTypes = [
  "POLYPROPYLENE_BAG",
  "BIG_BAG",
  "LINER_BAG",
  "TRANSPARENT_BAG",
  "HANDLED_BAG",
  "CUSTOM_BAG"
];

export const topTypes = ["", "OPEN_TOP", "VALVE", "SKIRT", "DUFFLE", "CUSTOM"];
export const bottomTypes = ["", "FLAT", "BLOCK", "DISCHARGE_SPOUT", "CLOSED", "CUSTOM"];

export function emptyProductForm(categoryId = ""): ProductFormState {
  return {
    sku: "",
    name: "",
    categoryId,
    description: "",
    size: "",
    density: "",
    color: "",
    material: "polypropylene",
    bagType: "POLYPROPYLENE_BAG",
    weight: "",
    capacity: "",
    hasLiner: false,
    hasHandles: false,
    topType: "",
    bottomType: "",
    minOrderQty: "1",
    packageQty: "",
    purchasePrice: "",
    retailPrice: "",
    wholesalePrice: "",
    isCustomOrderAvailable: false,
    isActive: true
  };
}

export function productToForm(product: Product | ProductVariant): ProductFormState {
  return {
    sku: product.sku,
    name: product.name,
    categoryId: product.categoryId,
    description: product.description ?? "",
    size: product.size ?? "",
    density: product.density ?? "",
    color: product.color ?? "",
    material: product.material,
    bagType: product.bagType,
    weight: product.weight === null || product.weight === undefined ? "" : String(product.weight),
    capacity: product.capacity ?? "",
    hasLiner: product.hasLiner,
    hasHandles: product.hasHandles,
    topType: product.topType ?? "",
    bottomType: product.bottomType ?? "",
    minOrderQty: String(product.minOrderQty),
    packageQty: product.packageQty === null || product.packageQty === undefined ? "" : String(product.packageQty),
    purchasePrice: product.purchasePrice === null || product.purchasePrice === undefined ? "" : String(product.purchasePrice),
    retailPrice: product.retailPrice === null || product.retailPrice === undefined ? "" : String(product.retailPrice),
    wholesalePrice: product.wholesalePrice === null || product.wholesalePrice === undefined ? "" : String(product.wholesalePrice),
    isCustomOrderAvailable: product.isCustomOrderAvailable,
    isActive: product.isActive
  };
}

export function formToProductPayload(form: ProductFormState) {
  return cleanPayload({
    sku: form.sku,
    name: form.name,
    categoryId: form.categoryId,
    description: form.description,
    size: form.size,
    density: form.density,
    color: form.color,
    material: form.material || "polypropylene",
    bagType: form.bagType,
    weight: numberOrUndefined(form.weight),
    capacity: form.capacity,
    hasLiner: form.hasLiner,
    hasHandles: form.hasHandles,
    topType: form.topType || undefined,
    bottomType: form.bottomType || undefined,
    minOrderQty: numberOrUndefined(form.minOrderQty) ?? 1,
    packageQty: numberOrUndefined(form.packageQty),
    purchasePrice: numberOrUndefined(form.purchasePrice),
    retailPrice: numberOrUndefined(form.retailPrice),
    wholesalePrice: numberOrUndefined(form.wholesalePrice),
    isCustomOrderAvailable: form.isCustomOrderAvailable,
    isActive: form.isActive
  });
}

export function ProductForm({
  form,
  categories,
  saving,
  submitLabel = "Save",
  onChange,
  onSubmit
}: {
  form: ProductFormState;
  categories: ProductCategory[];
  saving?: boolean;
  submitLabel?: string;
  onChange: (form: ProductFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (patch: Partial<ProductFormState>) => onChange({ ...form, ...patch });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TextField required label="SKU" value={form.sku} onChange={(sku) => update({ sku })} />
        <TextField required label="Name" value={form.name} onChange={(name) => update({ name })} />
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <select
            required
            id="categoryId"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.categoryId}
            onChange={(event) => update({ categoryId: event.target.value })}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <TextField label="Size" value={form.size} onChange={(size) => update({ size })} />
        <TextField label="Density" value={form.density} onChange={(density) => update({ density })} />
        <TextField label="Color" value={form.color} onChange={(color) => update({ color })} />
        <TextField label="Material" value={form.material} onChange={(material) => update({ material })} />
        <SelectField label="Bag type" options={bagTypes} value={form.bagType} onChange={(bagType) => update({ bagType })} />
        <TextField label="Weight" type="number" value={form.weight} onChange={(weight) => update({ weight })} />
        <TextField label="Capacity" value={form.capacity} onChange={(capacity) => update({ capacity })} />
        <SelectField label="Top type" options={topTypes} value={form.topType} onChange={(topType) => update({ topType })} />
        <SelectField label="Bottom type" options={bottomTypes} value={form.bottomType} onChange={(bottomType) => update({ bottomType })} />
        <TextField label="Min order qty" type="number" value={form.minOrderQty} onChange={(minOrderQty) => update({ minOrderQty })} />
        <TextField label="Package qty" type="number" value={form.packageQty} onChange={(packageQty) => update({ packageQty })} />
        <TextField label="Purchase price" type="number" value={form.purchasePrice} onChange={(purchasePrice) => update({ purchasePrice })} />
        <TextField label="Retail price" type="number" value={form.retailPrice} onChange={(retailPrice) => update({ retailPrice })} />
        <TextField label="Wholesale price" type="number" value={form.wholesalePrice} onChange={(wholesalePrice) => update({ wholesalePrice })} />
        <div className="space-y-2 md:col-span-2 xl:col-span-3">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CheckboxField label="Has liner" checked={form.hasLiner} onChange={(hasLiner) => update({ hasLiner })} />
        <CheckboxField label="Has handles" checked={form.hasHandles} onChange={(hasHandles) => update({ hasHandles })} />
        <CheckboxField
          label="Custom order available"
          checked={form.isCustomOrderAvailable}
          onChange={(isCustomOrderAvailable) => update({ isCustomOrderAvailable })}
        />
        <CheckboxField label="Active" checked={form.isActive} onChange={(isActive) => update({ isActive })} />
      </div>
      <Button disabled={saving} type="submit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {submitLabel}
      </Button>
    </form>
  );
}

function TextField({
  label,
  value,
  type = "text",
  required,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input required={required} id={id} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || "none"} value={option}>
            {option || "Not selected"}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function numberOrUndefined(value: string) {
  if (value.trim() === "") {
    return undefined;
  }

  return Number(value);
}

function cleanPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}
