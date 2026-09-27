"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, Upload, Search, Trash2, Eye, MessageSquareText, Layers, CloudUpload, FileWarning, FolderOpen } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, Segmented, Textarea } from "@/components/ui/fields";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/app/common";
import { actions, useStore } from "@/lib/store";
import { chunkDoc } from "@/lib/knowledge";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { KnowledgeDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

const categories = ["Policy", "Vendors", "Visa", "FAQ", "Insurance", "Other"];

function size(n: number) {
  return n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

export default function DocumentsPage() {
  const s = useStore();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [picked, setPicked] = useState<KnowledgeDoc | null>(null);
  const [dismissedParam, setDismissedParam] = useState<string | null>(null);
  const docParam = params.get("doc");
  const viewing = picked ?? (docParam && docParam !== dismissedParam ? s.docs.find((d) => d.id === docParam) ?? null : null);
  const setViewing = (d: KnowledgeDoc | null) => {
    setPicked(d);
    if (!d) setDismissedParam(docParam);
  };
  const [uploadOpen, setUploadOpen] = useState(params.get("upload") === "1");
  const [deleting, setDeleting] = useState<KnowledgeDoc | null>(null);

  const list = useMemo(
    () => s.docs.filter((d) => (!cat || d.category === cat) && `${d.title} ${d.content}`.toLowerCase().includes(q.toLowerCase())),
    [s.docs, q, cat]
  );
  const totalChunks = s.docs.reduce((a, d) => a + chunkDoc(d).length, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Documents"
        description="The knowledge base behind the assistant. Uploaded documents are split into chunks and indexed for cited retrieval."
        actions={
          <Button size="lg" onClick={() => setUploadOpen(true)} className="shadow-md shadow-primary/20">
            <Upload />
            Upload document
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Documents", value: s.docs.length, icon: FileText },
          { label: "Indexed chunks", value: totalChunks, icon: Layers },
          { label: "Categories", value: new Set(s.docs.map((d) => d.category)).size, icon: FolderOpen },
        ].map(({ icon: Icon, ...x }) => (
          <Card key={x.label} className="py-4">
            <CardContent className="flex items-center gap-3 px-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{x.label}</p>
                <p className="text-xl font-semibold tabular-nums">{x.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and contents…" className="h-9 pl-9" />
        </div>
        <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-48" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </NativeSelect>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="No documents found" description="Upload a policy, visa guide or FAQ to give the assistant something to cite." action={<Button onClick={() => setUploadOpen(true)}><Upload />Upload</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => {
            const chunks = chunkDoc(d);
            const preview = d.content.replace(/^#.*$/gm, "").replace(/\s+/g, " ").trim().slice(0, 150);
            return (
              <Card key={d.id} className="group gap-3 py-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 px-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-cyan-500/15 text-primary">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.uploadedBy} · {formatDate(d.uploadedAt)}
                      </p>
                    </div>
                    <Badge variant="secondary">{d.category}</Badge>
                  </div>
                  <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{preview}…</p>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      {chunks.length} chunks · {size(d.sizeBytes)}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="View" onClick={() => setViewing(d)}>
                        <Eye />
                      </Button>
                      <Link href={`/assistant?q=${encodeURIComponent(`What does ${d.title} say?`)}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Ask about this">
                        <MessageSquareText />
                      </Link>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(d)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.title}</DialogTitle>
                <DialogDescription>
                  {viewing.category} · uploaded by {viewing.uploadedBy} on {formatDate(viewing.uploadedAt)} · {chunkDoc(viewing).length} indexed chunks
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {chunkDoc(viewing).map((c) => (
                  <div key={c.index} className="rounded-xl border p-3">
                    <p className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Chunk {c.index}</span>
                      {c.heading}
                    </p>
                    <p className="text-sm leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove “{deleting?.title}”?</DialogTitle>
            <DialogDescription>The assistant will no longer cite it. Past answers keep their citations in chat history.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</DialogClose>
            <Button
              size="lg"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                actions.deleteDoc(deleting!.id);
                toast("Document removed");
                setDeleting(null);
              }}
            >
              <Trash2 />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [method, setMethod] = useState<"file" | "paste">("file");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Policy");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setContent("");
    setFileName("");
    setError(null);
  }

  async function readFile(f: File) {
    setError(null);
    if (!/\.(txt|md|markdown|csv)$/i.test(f.name) && !f.type.startsWith("text/")) {
      setError(f.name.toLowerCase().endsWith(".pdf") ? "PDF extraction runs in the backend ingestion service. For now, upload .txt/.md or paste the text." : "Unsupported file type. Use .txt or .md.");
      return;
    }
    if (f.size > 1024 * 1024) {
      setError("File is larger than 1 MB.");
      return;
    }
    const text = await f.text();
    setContent(text);
    setFileName(f.name);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  }

  function submit() {
    if (!title.trim()) return setError("Add a title.");
    if (content.trim().length < 40) return setError("The document needs at least a few sentences of text to be useful.");
    const d = actions.addDoc({ title: title.trim(), category, content });
    toast("Document indexed", { description: `${d.title} · ${chunkDoc(d).length} chunks ready for the assistant.` });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>Text is split into chunks by heading and paragraph, then indexed for retrieval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Segmented value={method} onChange={setMethod} options={[{ value: "file", label: "Upload file" }, { value: "paste", label: "Paste text" }]} />
          {method === "file" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) void readFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                drag ? "border-primary bg-primary/5" : "hover:border-foreground/30"
              )}
            >
              <CloudUpload className="size-8 text-primary" />
              <p className="text-sm font-medium">{fileName || "Drop a file here or click to browse"}</p>
              <p className="text-xs text-muted-foreground">.txt or .md · up to 1 MB</p>
              <input ref={inputRef} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" className="hidden" onChange={(e) => e.target.files?.[0] && void readFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="doc-content">Content</Label>
              <Textarea id="doc-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder={"# Heading\n\nParagraphs of policy text…"} />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Travel Insurance Summary" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-cat">Category</Label>
              <NativeSelect id="doc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {content && !error && <p className="text-xs text-muted-foreground">Preview: {chunkDoc({ id: "x", title: title || "Untitled", content }).length} chunks will be indexed.</p>}
          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-sm text-destructive">
              <FileWarning className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</DialogClose>
          <Button size="lg" onClick={submit}>
            <Upload />
            Upload & index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
