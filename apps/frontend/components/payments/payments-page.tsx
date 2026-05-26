"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useAuth } from "@/components/auth/auth-provider";
import type { PaginatedResponse, Payment, PaymentMethod, PaymentStatus } from "@/components/orders/order-types";
import { useToast } from "@/components/toast/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const paymentStatuses: Array<PaymentStatus | ""> = ["", "UNPAID", "PARTIALLY_PAID", "PAID", "OVERPAID", "REFUNDED"];
const paymentMethods: Array<PaymentMethod | ""> = ["", "BANK_TRANSFER", "CASH", "CARD", "ONLINE", "OTHER"];

export function PaymentsPage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<Payment>["meta"]>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    method: ""
  });
  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "20"
    });

    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }

    return params.toString();
  }, [filters, page]);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") {
      return;
    }

    setLoading(true);

    try {
      const response = await auth.api.request<PaginatedResponse<Payment>>(`/payments?${query}`);
      setPayments(response.data);
      setMeta(response.meta);
    } catch (error) {
      toast({ title: "Unable to load payments", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [auth.api, auth.status, query, toast]);

  useEffect(() => {
    if (auth.status === "authenticated") {
      void load();
    }
  }, [auth.status, load]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PermissionGate permission="payments.read">
      <main className="p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-normal">Payments</h2>
          <p className="text-sm text-muted-foreground">Incoming payments and order payment status.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Payment list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by order, customer, note"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                />
              </div>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                {paymentStatuses.map((status) => (
                  <option key={status || "all"} value={status}>
                    {status || "All statuses"}
                  </option>
                ))}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filters.method} onChange={(event) => updateFilter("method", event.target.value)}>
                {paymentMethods.map((method) => (
                  <option key={method || "all"} value={method}>
                    {method || "All methods"}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Paid at</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                        Loading payments
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3">
                          <Link className="font-medium text-primary hover:underline" href={`/orders/${payment.orderId}`}>
                            {payment.order?.number ?? payment.orderId}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{payment.order?.customer?.companyName || payment.order?.customer?.name || "-"}</td>
                        <td className="px-4 py-3">{payment.method}</td>
                        <td className="px-4 py-3">
                          <Badge variant={payment.status === "PAID" || payment.status === "OVERPAID" ? "success" : "secondary"}>{payment.status}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{formatMoney(payment.amount, payment.currency)}</td>
                        <td className="px-4 py-3">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <PaginationControls meta={meta} onPageChange={setPage} />
            </div>
          </CardContent>
        </Card>
      </main>
    </PermissionGate>
  );
}

function formatMoney(value: string | number, currency: string) {
  return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}
