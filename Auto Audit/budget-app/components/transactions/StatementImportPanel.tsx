"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";

import { useBudget } from "@/lib/BudgetContext";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { activeCategoriesForMonth } from "@/lib/categorySchedule";
import type { Category, MonthKey } from "@/types";
import {
  type CsvField,
  type CsvParseError,
  type ParsedCsvRow,
  type CsvCategorization,
  categorizeRow,
  detectMapping,
  isProbableDuplicate,
  normalizeRows,
  parseCsvFile,
} from "@/lib/csvImport";
import { parseStatementPdf } from "@/lib/pdfImport";
import { merchantFamilyKey } from "@/lib/fuzzyMatch";

// Each table row pairs a parsed transaction with its proposed categorization
// plus per-row UI state (selected, remember-future, etc).
interface ReviewRow {
  parsed: ParsedCsvRow;
  merchantKey: string;
  categoryId: string;
  matchType: CsvCategorization["matchType"];
  matchedDisplayName?: string;
  remember: boolean;
  confirmed: boolean;
  selected: boolean;
  isDuplicate: boolean;
}

type Stage = "idle" | "parsing" | "mapping" | "review";
type Source = "csv" | "pdf";

export function StatementImportPanel() {
  const {
    categories,
    transactions,
    merchantMemory,
    otherCategoryId,
    addTransaction,
    rememberMerchant,
  } = useBudget();
  const toast = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [source, setSource] = useState<Source | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [pdfMeta, setPdfMeta] = useState<{ cycleLabel?: string } | null>(null);

  // CSV-only state
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<CsvField, string>>>({});
  const [creditCol, setCreditCol] = useState<string | undefined>();

  // Shared review state
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<CsvParseError[]>([]);
  const [topLevelError, setTopLevelError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const headerOptions = useMemo(
    () => [
      { value: "", label: "— Not in file —" },
      ...headers.map((h) => ({ value: h, label: h })),
    ],
    [headers],
  );

  const activeCatsByMonth = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const row of reviewRows) {
      const mk = row.parsed.date.slice(0, 7);
      if (!map.has(mk)) {
        map.set(
          mk,
          activeCategoriesForMonth(categories, mk as MonthKey, [otherCategoryId]),
        );
      }
    }
    return map;
  }, [categories, reviewRows, otherCategoryId]);

  const reset = useCallback(() => {
    setStage("idle");
    setSource(null);
    setFileName("");
    setPdfMeta(null);
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setCreditCol(undefined);
    setReviewRows([]);
    setParseErrors([]);
    setTopLevelError(null);
    setShowErrors(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ---------------------------------------------------------------------------
  // Build the review table from already-normalized ParsedCsvRow[]. Used by
  // BOTH the CSV path (after manual or auto mapping) and the PDF path.
  // ---------------------------------------------------------------------------
  const buildReviewFromRows = useCallback(
    (rows: ParsedCsvRow[]) => {
      const review: ReviewRow[] = rows.map((p) => {
        const cat = categorizeRow(p, merchantMemory, categories, otherCategoryId);
        return {
          parsed: p,
          merchantKey: merchantFamilyKey(p.merchant),
          categoryId: cat.categoryId,
          matchType: cat.matchType,
          matchedDisplayName: cat.matchedDisplayName,
          // Default: only auto-toggle "remember" for new merchants — they're
          // the ones that benefit most from being persisted to memory.
          remember: cat.matchType !== "exact",
          confirmed: cat.matchType === "exact",
          selected: true,
          isDuplicate: isProbableDuplicate(p, transactions),
        };
      });
      setReviewRows(review);
      setStage("review");
    },
    [merchantMemory, categories, otherCategoryId, transactions],
  );

  // ---------------------------------------------------------------------------
  // CSV path — auto-map then build review (or show mapping UI if needed).
  // ---------------------------------------------------------------------------
  const buildCsvReview = useCallback(
    (
      rows: Record<string, string>[],
      currentMapping: Partial<Record<CsvField, string>>,
      currentCreditCol: string | undefined,
    ) => {
      const required: CsvField[] = ["date", "merchant", "amount"];
      const missing = required.filter((f) => !currentMapping[f]);
      if (missing.length > 0) {
        setTopLevelError(`Pick a column for: ${missing.join(", ")}.`);
        setStage("mapping");
        return;
      }
      setTopLevelError(null);

      const { rows: parsed, errors } = normalizeRows(rows, {
        mapping: currentMapping,
        creditCol: currentCreditCol,
        amountSignForExpense: "auto",
      });
      setParseErrors(errors);

      if (parsed.length === 0) {
        setReviewRows([]);
        setStage("review");
        return;
      }
      buildReviewFromRows(parsed);
    },
    [buildReviewFromRows],
  );

  // ---------------------------------------------------------------------------
  // File handler — routes by extension.
  // ---------------------------------------------------------------------------
  const handleFile = useCallback(
    async (file: File) => {
      setTopLevelError(null);
      const lower = file.name.toLowerCase();
      const isCsv = lower.endsWith(".csv");
      const isPdf = lower.endsWith(".pdf");
      if (!isCsv && !isPdf) {
        setTopLevelError("Please choose a .csv or .pdf file.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setTopLevelError("File is too large (max 20 MB). Export a shorter date range or use CSV.");
        return;
      }
      setFileName(file.name);
      setSource(isCsv ? "csv" : "pdf");
      setStage("parsing");

      try {
        if (isCsv) {
          const { headers: hdrs, rawRows: rows } = await parseCsvFile(file);
          if (rows.length === 0) {
            setTopLevelError("The file is empty.");
            setStage("idle");
            return;
          }
          const detected = detectMapping(hdrs);
          setHeaders(hdrs);
          setRawRows(rows);
          setMapping(detected.mapping);
          setCreditCol(detected.creditCol);

          const required: CsvField[] = ["date", "merchant", "amount"];
          const missing = required.filter((f) => !detected.mapping[f]);
          if (missing.length > 0) {
            setStage("mapping");
          } else {
            buildCsvReview(rows, detected.mapping, detected.creditCol);
          }
        } else {
          // PDF
          const result = await parseStatementPdf(file);
          if (!result.recognized) {
            setTopLevelError(
              "We couldn't find a transaction table in this PDF. PDF import currently supports Capital One Quicksilver statements; for other banks, export a CSV instead.",
            );
            setStage("idle");
            return;
          }
          setPdfMeta({ cycleLabel: result.cycleLabel });
          buildReviewFromRows(result.rows);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[StatementImportPanel] parse failed:", err);
        setTopLevelError(
          err instanceof Error ? err.message : "Couldn't read that file.",
        );
        setStage("idle");
      }
    },
    [buildCsvReview, buildReviewFromRows],
  );

  // ---------------------------------------------------------------------------
  // Mapping UI handlers (CSV only)
  // ---------------------------------------------------------------------------
  const onMappingChange = (field: CsvField, value: string) => {
    setMapping((m) => ({ ...m, [field]: value || undefined }));
  };
  const handleApplyMapping = () => {
    buildCsvReview(rawRows, mapping, creditCol);
  };

  // ---------------------------------------------------------------------------
  // Review row helpers
  // ---------------------------------------------------------------------------
  const setRow = (id: string, patch: Partial<ReviewRow>) => {
    setReviewRows((rows) =>
      rows.map((r) => (r.parsed.id === id ? { ...r, ...patch } : r)),
    );
  };
  const confirmMerchantCategory = (merchantKey: string, categoryId: string) => {
    setReviewRows((rows) =>
      rows.map((r) =>
        r.merchantKey === merchantKey
          ? { ...r, categoryId, confirmed: true, remember: true }
          : r,
      ),
    );
  };
  const removeRow = (id: string) => {
    setReviewRows((rows) => rows.filter((r) => r.parsed.id !== id));
  };

  const selectedCount = reviewRows.filter((r) => r.selected).length;
  const unconfirmedRows = reviewRows.filter((r) => r.selected && !r.confirmed);
  const confirmationGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        merchantKey: string;
        merchant: string;
        categoryId: string;
        matchType: CsvCategorization["matchType"];
        matchedDisplayName?: string;
        count: number;
      }
    >();

    for (const row of unconfirmedRows) {
      const existing = groups.get(row.merchantKey);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(row.merchantKey, {
          merchantKey: row.merchantKey,
          merchant: row.parsed.merchant,
          categoryId: row.categoryId,
          matchType: row.matchType,
          matchedDisplayName: row.matchedDisplayName,
          count: 1,
        });
      }
    }

    return Array.from(groups.values());
  }, [unconfirmedRows]);
  const canImport = selectedCount > 0 && confirmationGroups.length === 0;

  function handleImport() {
    const toImport = reviewRows.filter((r) => r.selected);
    if (toImport.length === 0) {
      toast.warn("Nothing to import", "Select at least one row to add.");
      return;
    }
    if (confirmationGroups.length > 0) {
      toast.warn(
        "Confirm categories first",
        `${confirmationGroups.length} merchant${confirmationGroups.length === 1 ? "" : "s"} still need a category.`,
      );
      return;
    }
    for (const r of toImport) {
      addTransaction({
        amount: r.parsed.amount,
        merchant: r.parsed.merchant,
        date: new Date(r.parsed.date + "T12:00:00").toISOString(),
        categoryId: r.categoryId,
        note: r.parsed.note,
      });
      if (r.remember) {
        rememberMerchant(r.parsed.merchant, r.categoryId, true);
      }
    }
    toast.success(
      `${toImport.length} transaction${toImport.length === 1 ? "" : "s"} imported`,
      `From ${fileName}`,
    );
    reset();
  }

  // ---------------------------------------------------------------------------
  // Drag & drop
  // ---------------------------------------------------------------------------
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleFile(f);
  };

  const sourceIcon =
    source === "pdf" ? (
      <FileText className="w-4 h-4" />
    ) : (
      <FileSpreadsheet className="w-4 h-4" />
    );

  return (
    <Card>
      <CardHeader
        title="Import statement"
        subtitle="Drop a CSV export or a PDF credit-card statement to add a whole month at once."
      />

      {topLevelError && (
        <Alert level="danger" className="mb-4">
          {topLevelError}
        </Alert>
      )}

      {stage === "idle" && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center text-center px-6 py-10 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
            dragActive
              ? "border-brand-400 bg-brand-50 dark:bg-brand-700/10"
              : "border-gray-300 dark:border-neutral-700 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-neutral-900"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 grid place-items-center mb-3">
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Drop a CSV or PDF here, or click to choose a file
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-md">
            CSV: standard bank/credit-card exports.
            <br />
            PDF: Capital One Quicksilver statements (other banks coming soon).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,.pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      )}

      {stage === "parsing" && (
        <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
          Parsing {fileName}…
          {source === "pdf" && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              PDFs can take a few seconds on the first run while the parser loads.
            </p>
          )}
        </div>
      )}

      {stage === "mapping" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700 dark:text-gray-300 inline-flex items-center gap-2">
              {sourceIcon}
              <span className="font-medium">{fileName}</span>
              <span className="text-gray-500 dark:text-gray-400">
                · {rawRows.length} rows
              </span>
            </p>
            <button
              onClick={reset}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 inline-flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
          <Alert level="info">
            We couldn't auto-detect every column. Match yours below, then continue.
          </Alert>
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Date column"
              options={headerOptions}
              value={mapping.date ?? ""}
              onChange={(e) => onMappingChange("date", e.target.value)}
            />
            <Select
              label="Merchant / description column"
              options={headerOptions}
              value={mapping.merchant ?? ""}
              onChange={(e) => onMappingChange("merchant", e.target.value)}
            />
            <Select
              label="Amount column"
              options={headerOptions}
              value={mapping.amount ?? ""}
              onChange={(e) => onMappingChange("amount", e.target.value)}
            />
            <Select
              label="Category column (optional)"
              options={headerOptions}
              value={mapping.category ?? ""}
              onChange={(e) => onMappingChange("category", e.target.value)}
            />
            <Select
              label="Note column (optional)"
              options={headerOptions}
              value={mapping.note ?? ""}
              onChange={(e) => onMappingChange("note", e.target.value)}
            />
            <Select
              label="Credit / income column (optional)"
              hint="If your bank uses a separate column for refunds/income, pick it so we skip those rows."
              options={headerOptions}
              value={creditCol ?? ""}
              onChange={(e) => setCreditCol(e.target.value || undefined)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={handleApplyMapping}>Continue</Button>
          </div>
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-300 inline-flex items-center gap-2">
              {sourceIcon}
              <span className="font-medium">{fileName}</span>
              <span className="text-gray-500 dark:text-gray-400">
                · {reviewRows.length} ready to import
                {parseErrors.length > 0 && `, ${parseErrors.length} skipped`}
              </span>
              {pdfMeta?.cycleLabel && (
                <span className="text-gray-500 dark:text-gray-400">
                  · {pdfMeta.cycleLabel}
                </span>
              )}
            </p>
            <button
              onClick={reset}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 inline-flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-xl border border-warn-200 dark:border-warn-700/40 bg-warn-50 dark:bg-warn-700/10 p-3 text-sm text-warn-800 dark:text-warn-200">
              <button
                onClick={() => setShowErrors((s) => !s)}
                className="inline-flex items-center gap-1 font-medium"
              >
                {showErrors ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {parseErrors.length} row
                {parseErrors.length === 1 ? "" : "s"} couldn't be imported
              </button>
              {showErrors && (
                <ul className="mt-2 space-y-1 text-xs text-warn-800 dark:text-warn-200/90">
                  {parseErrors.slice(0, 25).map((e) => (
                    <li key={`${e.row}-${e.message}`}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                  {parseErrors.length > 25 && (
                    <li className="italic">
                      …and {parseErrors.length - 25} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          {confirmationGroups.length > 0 && (
            <div className="rounded-2xl border border-brand-200 dark:border-brand-700/40 bg-brand-50 dark:bg-brand-700/10 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Confirm new merchant categories
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Pick once per merchant. Auto Audit will apply it to every matching
                  transaction in this import and remember it for next time.
                </p>
              </div>
              <div className="space-y-2">
                {confirmationGroups.map((group) => (
                  <div
                    key={group.merchantKey}
                    className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] items-center rounded-xl border border-white/70 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {group.merchant}
                        </p>
                        <Badge tone="neutral">
                          {group.count} transaction{group.count === 1 ? "" : "s"}
                        </Badge>
                        {group.matchType === "fuzzy" && (
                          <Badge tone="warn">Suggested</Badge>
                        )}
                        {group.matchType === "heuristic" && (
                          <Badge tone="info">Guess</Badge>
                        )}
                        {group.matchType === "uncategorized" && (
                          <Badge tone="neutral">New</Badge>
                        )}
                      </div>
                      {group.matchedDisplayName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Suggested from {group.matchedDisplayName}
                        </p>
                      )}
                    </div>
                    <select
                      value={group.categoryId}
                      onChange={(e) =>
                        confirmMerchantCategory(group.merchantKey, e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {categoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        confirmMerchantCategory(group.merchantKey, group.categoryId)
                      }
                    >
                      Confirm
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewRows.length === 0 ? (
            <Alert level="info">
              No spending rows were found in this file.
            </Alert>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-neutral-800">
                    <th className="py-2 pr-3 font-medium w-8">
                      <input
                        type="checkbox"
                        checked={
                          reviewRows.length > 0 &&
                          reviewRows.every((r) => r.selected)
                        }
                        onChange={(e) =>
                          setReviewRows((rows) =>
                            rows.map((r) => ({ ...r, selected: e.target.checked })),
                          )
                        }
                        aria-label="Select all"
                        className="accent-brand-600"
                      />
                    </th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Merchant</th>
                    <th className="py-2 pr-3 font-medium text-right">Amount</th>
                    <th className="py-2 pr-3 font-medium">Category</th>
                    <th className="py-2 pr-3 font-medium">Match</th>
                    <th className="py-2 pr-3 font-medium">Remember?</th>
                    <th className="py-2 pr-2 font-medium text-right w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((r) => (
                    <tr
                      key={r.parsed.id}
                      className={`border-b border-gray-100 dark:border-neutral-800/70 ${
                        r.isDuplicate
                          ? "bg-warn-50/40 dark:bg-warn-700/10"
                          : "hover:bg-gray-50/50 dark:hover:bg-neutral-900/40"
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={(e) =>
                            setRow(r.parsed.id, { selected: e.target.checked })
                          }
                          aria-label={`Include ${r.parsed.merchant}`}
                          className="accent-brand-600"
                        />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                        {formatDate(r.parsed.date + "T12:00:00")}
                      </td>
                      <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate max-w-[220px]">
                            {r.parsed.merchant}
                          </span>
                          {r.isDuplicate && (
                            <span title="Looks like a transaction you already have">
                              <Badge tone="warn">Duplicate?</Badge>
                            </span>
                          )}
                        </div>
                        {r.parsed.note && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[260px]">
                            {r.parsed.note}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                        {formatCurrency(r.parsed.amount)}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={r.categoryId}
                          onChange={(e) =>
                            setRow(r.parsed.id, { categoryId: e.target.value, confirmed: true })
                          }
                          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {(activeCatsByMonth.get(r.parsed.date.slice(0, 7)) ?? []).map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        {r.matchType === "exact" ? (
                          <Badge tone="brand">
                            <CheckCircle2 className="w-3 h-3" /> Auto
                          </Badge>
                        ) : r.matchType === "fuzzy" ? (
                          <span title={`Looks like ${r.matchedDisplayName}`}>
                            <Badge tone="warn">
                              <AlertTriangle className="w-3 h-3" /> Review
                            </Badge>
                          </span>
                        ) : r.matchType === "heuristic" ? (
                          <span
                            title={`Guessed ${r.matchedDisplayName} from the merchant name`}
                          >
                            <Badge tone="info">
                              <Lightbulb className="w-3 h-3" /> Guess
                            </Badge>
                          </span>
                        ) : (
                          <Badge tone="neutral">New</Badge>
                        )}
                        {!r.confirmed && r.selected && (
                          <p className="text-[11px] text-brand-700 dark:text-brand-300 mt-1">
                            Needs confirmation
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={r.remember}
                          onChange={(e) =>
                            setRow(r.parsed.id, { remember: e.target.checked })
                          }
                          aria-label="Remember category for this merchant"
                          className="accent-brand-600"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <button
                          onClick={() => removeRow(r.parsed.id)}
                          aria-label={`Remove ${r.parsed.merchant}`}
                          className="p-1 text-gray-400 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-700/20 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedCount} of {reviewRows.length} selected.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!canImport}>
                Import {selectedCount > 0 ? selectedCount : ""} Transaction
                {selectedCount === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
