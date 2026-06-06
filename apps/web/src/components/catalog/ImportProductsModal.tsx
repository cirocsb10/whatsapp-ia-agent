"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ImportProductItem, ImportResult } from "@/types/product";
import { useApi } from "@/lib/hooks/useApi";

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

function parseSheet(file: File): Promise<ImportProductItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const items: ImportProductItem[] = rows.map((row, i) => {
          const name = String(row["nome*"] ?? row["nome"] ?? "").trim();
          const priceCents = parseInt(String(row["preco_centavos*"] ?? row["preco_centavos"] ?? "0"), 10);
          const stockQty = parseInt(String(row["estoque*"] ?? row["estoque"] ?? "0"), 10);

          if (!name) throw new Error(`Linha ${i + 2}: campo "nome*" é obrigatório.`);
          if (isNaN(priceCents)) throw new Error(`Linha ${i + 2}: "preco_centavos*" deve ser um número.`);
          if (isNaN(stockQty)) throw new Error(`Linha ${i + 2}: "estoque*" deve ser um número.`);

          const tagsRaw = String(row["tags"] ?? "").trim();
          const tags = tagsRaw
            ? tagsRaw.split("|").map((t) => t.trim()).filter(Boolean)
            : undefined;

          return {
            name,
            description: String(row["descricao"] ?? "").trim() || undefined,
            sku: String(row["sku"] ?? "").trim() || undefined,
            priceCents,
            stockQty,
            tags,
          };
        });

        resolve(items);
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
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFileChange(f: File | null) {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError("Arquivo inválido. Use .xlsx, .xls ou .csv.");
      return;
    }
    setFile(f);
    setParseError(null);
    setResult(null);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setParseError(null);
    setResult(null);

    try {
      const products = await parseSheet(file);
      if (products.length === 0) {
        setParseError("Nenhum produto encontrado na planilha.");
        return;
      }

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
    setFile(null);
    setParseError(null);
    setResult(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar produtos"
      subtitle="Importe vários produtos de uma vez via planilha Excel"
      size="md"
      headerLeading={<FileSpreadsheet className="w-5 h-5 text-green-400" />}
      footer={
        <>
          <button onClick={handleClose} className="btn-ghost" type="button">
            {result ? "Fechar" : "Cancelar"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="catalog-add-btn"
              style={{ minWidth: 120 }}
              type="button"
            >
              {importing ? "Importando…" : "Importar"}
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>

            {file && !parseError && (
              <div className="import-file-selected">
                <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.name}
                </span>
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
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
