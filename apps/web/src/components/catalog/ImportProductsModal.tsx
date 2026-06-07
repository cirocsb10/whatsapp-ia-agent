"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ImportProductItem, ImportResult, formatPrice } from "@/types/product";
import { useApi } from "@/lib/hooks/useApi";

interface ImportPreviewRow {
  rowNumber: number;
  name: string;
  description?: string;
  sku?: string;
  priceCents: number | null;
  stockQty: number | null;
  tags?: string[];
  errors: string[];
  isValid: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function downloadTemplate() {
  const header = ["nome*", "descricao", "sku", "preco_centavos*", "estoque*", "tags"];
  const example = ["Camiseta Preta M", "Camiseta 100% algodão", "CAM-001", 4990, 50, "roupas|masculino"];
  const ws = XLSX.utils.aoa_to_sheet([header, example]);

  ws["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "template-importacao-produtos.xlsx");
}

function previewRowToItem(row: ImportPreviewRow): ImportProductItem {
  return {
    name: row.name,
    priceCents: row.priceCents!,
    stockQty: row.stockQty!,
    ...(row.description ? { description: row.description } : {}),
    ...(row.sku ? { sku: row.sku } : {}),
    ...(row.tags ? { tags: row.tags } : {}),
  };
}

function parseSheetPreview(file: File): Promise<ImportPreviewRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) {
          reject(new Error("Planilha vazia."));
          return;
        }
        const ws = wb.Sheets[firstSheet];
        if (!ws) {
          reject(new Error("Planilha inválida."));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        const preview: ImportPreviewRow[] = [];

        rows.forEach((row, i) => {
          const rowNumber = i + 2;
          const errors: string[] = [];

          const name = String(row["nome*"] ?? row["nome"] ?? "").trim();
          const priceRaw = row["preco_centavos*"] ?? row["preco_centavos"] ?? "";
          const stockRaw = row["estoque*"] ?? row["estoque"] ?? "";
          const description = String(row["descricao"] ?? "").trim();
          const sku = String(row["sku"] ?? "").trim();

          const hasAnyData =
            name || priceRaw !== "" || stockRaw !== "" || description || sku || String(row["tags"] ?? "").trim();
          if (!hasAnyData) return;

          const priceCents = parseInt(String(priceRaw), 10);
          const stockQty = parseInt(String(stockRaw), 10);

          if (!name) errors.push('Campo "nome*" é obrigatório');
          if (priceRaw === "" || isNaN(priceCents)) errors.push('"preco_centavos*" deve ser um número');
          else if (priceCents < 0) errors.push("Preço não pode ser negativo");
          if (stockRaw === "" || isNaN(stockQty)) errors.push('"estoque*" deve ser um número');
          else if (stockQty < 0) errors.push("Estoque não pode ser negativo");

          const tagsRaw = String(row["tags"] ?? "").trim();
          const tags = tagsRaw
            ? tagsRaw.split("|").map((t) => t.trim()).filter(Boolean)
            : undefined;

          preview.push({
            rowNumber,
            name: name || "—",
            priceCents: isNaN(priceCents) ? null : priceCents,
            stockQty: isNaN(stockQty) ? null : stockQty,
            errors,
            isValid: errors.length === 0,
            ...(description ? { description } : {}),
            ...(sku ? { sku } : {}),
            ...(tags ? { tags } : {}),
          });
        });

        resolve(preview);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

export function ImportProductsModal({ open, onClose, onImported }: Props) {
  const { apiFetch } = useApi();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = previewRows.filter((row) => row.isValid);
  const invalidCount = previewRows.length - validRows.length;

  function clearFile() {
    setFile(null);
    setPreviewRows([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(f: File | null) {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError("Arquivo inválido. Use .xlsx, .xls ou .csv.");
      return;
    }

    setFile(f);
    setParseError(null);
    setResult(null);
    setPreviewRows([]);
    setParsing(true);

    try {
      const rows = await parseSheetPreview(f);
      if (rows.length === 0) {
        setParseError("Nenhum produto encontrado na planilha.");
        clearFile();
        return;
      }
      setPreviewRows(rows);
    } catch (err) {
      setParseError((err as Error).message);
      clearFile();
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setParseError(null);
    setResult(null);

    try {
      const products = validRows.map(previewRowToItem);

      const res = await apiFetch("/products/import", {
        method: "POST",
        body: JSON.stringify({ products }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Erro ao importar produtos.");
      }

      const data: ImportResult = await res.json();
      setResult(data);
      if (data.imported > 0) onImported();
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    clearFile();
    setResult(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar produtos"
      subtitle="Importe vários produtos de uma vez via planilha Excel"
      size={previewRows.length > 0 ? "xl" : "md"}
      headerLeading={<FileSpreadsheet className="w-5 h-5 text-green-400" />}
      footer={
        <>
          <button onClick={handleClose} className="btn-ghost" type="button">
            {result ? "Fechar" : "Cancelar"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={validRows.length === 0 || parsing || importing}
              className="catalog-add-btn"
              style={{ minWidth: 120 }}
              type="button"
            >
              {importing
                ? "Importando…"
                : validRows.length > 0
                  ? `Importar ${validRows.length} produto${validRows.length !== 1 ? "s" : ""}`
                  : "Importar"}
            </button>
          )}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.15)",
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Template Excel</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Baixe o modelo com as colunas corretas
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 30,
              padding: "0 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(99,102,241,0.12)",
              color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.25)",
              cursor: "pointer",
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Baixar template
          </button>
        </div>

        {!result && (
          <>
            {!file && (
              <div
                className={`import-drop-zone${dragging ? " dragging" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFileChange(e.dataTransfer.files[0] ?? null);
                }}
              >
                <div className="import-drop-zone-icon">
                  <Upload className="w-8 h-8" style={{ margin: "0 auto" }} />
                </div>
                <div className="import-drop-zone-title">
                  Arraste a planilha ou clique para selecionar
                </div>
                <div className="import-drop-zone-subtitle">
                  Formatos suportados: .xlsx, .xls, .csv
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />

            {file && (
              <div className="import-file-selected">
                <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                <span className="import-file-name">{file.name}</span>
                <button
                  onClick={clearFile}
                  disabled={parsing || importing}
                  type="button"
                  className="import-file-remove"
                  aria-label="Remover arquivo"
                >
                  ×
                </button>
              </div>
            )}

            {parsing && (
              <div className="import-preview-status">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando planilha…
              </div>
            )}

            {previewRows.length > 0 && !parsing && (
              <>
                <div className="import-preview-summary">
                  <span>
                    {previewRows.length} produto{previewRows.length !== 1 ? "s" : ""} encontrado
                    {previewRows.length !== 1 ? "s" : ""}
                  </span>
                  <span className="import-preview-summary-valid">
                    {validRows.length} válido{validRows.length !== 1 ? "s" : ""}
                  </span>
                  {invalidCount > 0 && (
                    <span className="import-preview-summary-invalid">
                      {invalidCount} com erro{invalidCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="import-preview-table-wrap">
                  <table className="import-preview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Nome</th>
                        <th>SKU</th>
                        <th>Preço</th>
                        <th>Estoque</th>
                        <th>Tags</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.rowNumber} className={row.isValid ? "" : "invalid"}>
                          <td>{row.rowNumber}</td>
                          <td title={row.name}>{row.name}</td>
                          <td>{row.sku ?? "—"}</td>
                          <td>
                            {row.priceCents !== null ? formatPrice(row.priceCents) : "—"}
                          </td>
                          <td>{row.stockQty ?? "—"}</td>
                          <td title={row.tags?.join(", ")}>
                            {row.tags?.length ? row.tags.join(" · ") : "—"}
                          </td>
                          <td>
                            {row.isValid ? (
                              <span className="import-preview-badge valid">OK</span>
                            ) : (
                              <span className="import-preview-badge invalid" title={row.errors.join(" · ")}>
                                Erro
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invalidCount > 0 && (
                  <div className="import-preview-errors">
                    {previewRows
                      .filter((row) => !row.isValid)
                      .slice(0, 5)
                      .map((row) => (
                        <div key={row.rowNumber} className="import-preview-error-item">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          Linha {row.rowNumber}: {row.errors.join(" · ")}
                        </div>
                      ))}
                    {invalidCount > 5 && (
                      <div className="import-preview-error-more">
                        + {invalidCount - 5} erro{invalidCount - 5 !== 1 ? "s" : ""} adicional
                        {invalidCount - 5 !== 1 ? "is" : ""}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {parseError && (
          <div className="import-result-row error">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {parseError}
          </div>
        )}

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="import-result-row success">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {result.imported} produto{result.imported !== 1 ? "s" : ""} importado
              {result.imported !== 1 ? "s" : ""} com sucesso!
            </div>
            {result.errors.map((e) => (
              <div key={e.row} className="import-result-row error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Linha {e.row}: {e.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
