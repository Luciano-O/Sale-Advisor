import { useEffect, useState, type FormEvent } from "react";
import { importMessageSchema } from "@sale-advisor/contracts";

import { adminRequest } from "./api.js";

const KEY_STORAGE = "sale-advisor-admin-key";
type Page =
  | "Visão geral"
  | "Nova oferta"
  | "Importar JSON"
  | "Mensagens"
  | "Ofertas"
  | "Produtos e aliases"
  | "Sources e stores"
  | "Auditoria";
const pages: Page[] = [
  "Visão geral",
  "Nova oferta",
  "Importar JSON",
  "Mensagens",
  "Ofertas",
  "Produtos e aliases",
  "Sources e stores",
  "Auditoria"
];

export function App() {
  const [key, setKey] = useState(() => sessionStorage.getItem(KEY_STORAGE) ?? "");
  const [authenticated, setAuthenticated] = useState(Boolean(key));
  const [page, setPage] = useState<Page>("Visão geral");

  if (!authenticated)
    return (
      <Login
        onLogin={(value) => {
          sessionStorage.setItem(KEY_STORAGE, value);
          setKey(value);
          setAuthenticated(true);
        }}
      />
    );

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>SA</span>
          <div>
            Sale Advisor<small>Curadoria interna</small>
          </div>
        </div>
        <nav>
          {pages.map((item) => (
            <button
              className={page === item ? "active" : ""}
              key={item}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <button
          className="logout"
          onClick={() => {
            sessionStorage.removeItem(KEY_STORAGE);
            setAuthenticated(false);
          }}
        >
          Sair
        </button>
      </aside>
      <main>
        <PageContent page={page} adminKey={key} />
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin(value: string): void }) {
  const [value, setValue] = useState("");
  return (
    <main className="login">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onLogin(value.trim());
        }}
      >
        <div className="logo">SA</div>
        <p className="eyebrow">SALE ADVISOR</p>
        <h1>Acesso administrativo</h1>
        <p>A chave permanece somente nesta sessão do navegador.</p>
        <label>
          Chave administrativa
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
        </label>
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}

function PageContent({ page, adminKey }: { page: Page; adminKey: string }) {
  if (page === "Visão geral") return <Dashboard adminKey={adminKey} />;
  if (page === "Nova oferta") return <ManualOffer adminKey={adminKey} />;
  if (page === "Importar JSON") return <ImportJson adminKey={adminKey} />;
  return <CurationPage page={page} adminKey={adminKey} />;
}

function Dashboard({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void adminRequest<Record<string, unknown>>("/v1/admin/dashboard", adminKey)
      .then(setData)
      .catch((reason) => setError(String(reason)));
  }, [adminKey]);
  return (
    <section>
      <Header title="Visão geral" subtitle="Saúde do pipeline e itens que precisam de atenção." />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="metrics">
        <Metric label="Pendentes" value={Number(data?.pending ?? 0)} tone="blue" />
        <Metric label="Parciais" value={Number(data?.partial ?? 0)} tone="amber" />
        <Metric label="Falhas" value={Number(data?.failed ?? 0)} tone="red" />
        <Metric
          label="Ofertas boas"
          value={Number((data?.offersByLabel as Record<string, number> | undefined)?.boa ?? 0)}
          tone="green"
        />
      </div>
      <div className="panel">
        <h2>Operação local</h2>
        <p>
          Importações históricas não notificam por padrão. Falhas podem ser reprocessadas sem perder
          a mensagem original.
        </p>
      </div>
    </section>
  );
}

function ManualOffer({ adminKey }: { adminKey: string }) {
  const [text, setText] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("Enviando…");
    try {
      await adminRequest("/v1/admin/messages", adminKey, {
        method: "POST",
        body: JSON.stringify({
          text,
          capturedAt: new Date().toISOString(),
          ...(domain ? { storeDomain: domain } : {})
        })
      });
      setStatus("Mensagem adicionada ao pipeline.");
      setText("");
    } catch (error) {
      setStatus(String(error));
    }
  }
  return (
    <section>
      <Header
        title="Nova oferta"
        subtitle="Cadastre uma mensagem manual com notificação habilitada."
      />
      <form className="panel form" onSubmit={submit}>
        <label>
          Texto da oferta
          <textarea
            required
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <label>
          Domínio da loja
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="loja.example"
          />
        </label>
        <button type="submit">Cadastrar oferta</button>
        {status && <Notice>{status}</Notice>}
      </form>
    </section>
  );
}

function ImportJson({ adminKey }: { adminKey: string }) {
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<{
    valid: number;
    invalid: number;
    payload: unknown;
  } | null>(null);
  const [status, setStatus] = useState("");
  function validate() {
    try {
      const payload = JSON.parse(source) as { messages?: unknown[] };
      const results = Array.isArray(payload.messages)
        ? payload.messages.map((item) => importMessageSchema.safeParse(item))
        : [];
      setPreview({
        valid: results.filter((item) => item.success).length,
        invalid: results.filter((item) => !item.success).length,
        payload
      });
      setStatus("");
    } catch {
      setPreview(null);
      setStatus("JSON inválido.");
    }
  }
  async function submit() {
    if (!preview) return;
    try {
      await adminRequest("/v1/admin/imports", adminKey, {
        method: "POST",
        body: JSON.stringify(preview.payload)
      });
      setStatus("Lote enviado para processamento.");
    } catch (error) {
      setStatus(String(error));
    }
  }
  return (
    <section>
      <Header title="Importar JSON" subtitle="Até 1.000 mensagens e 5 MB por lote." />
      <div className="panel form">
        <label>
          JSON de importação
          <textarea rows={14} value={source} onChange={(event) => setSource(event.target.value)} />
        </label>
        <div className="actions">
          <button onClick={validate}>Validar e visualizar</button>
          {preview && (
            <button
              className="secondary"
              onClick={() => void submit()}
              disabled={preview.valid === 0}
            >
              Enviar lote
            </button>
          )}
        </div>
        {preview && (
          <div className="preview">
            <strong>{preview.valid} item válido</strong>
            <span>{preview.invalid} item inválido</span>
          </div>
        )}
        {status && <Notice>{status}</Notice>}
      </div>
    </section>
  );
}

function CurationPage({
  page,
  adminKey
}: {
  page: Exclude<Page, "Visão geral" | "Nova oferta" | "Importar JSON">;
  adminKey: string;
}) {
  const endpoint: Record<typeof page, string> = {
    Mensagens: "messages",
    Ofertas: "offers",
    "Produtos e aliases": "products",
    "Sources e stores": "sources",
    Auditoria: "audit"
  };
  const [items, setItems] = useState<unknown[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    void adminRequest<{ items: unknown[] }>(`/v1/admin/${endpoint[page]}`, adminKey)
      .then((data) => setItems(data.items))
      .catch((reason) => setError(String(reason)));
  }, [adminKey, page]);
  return (
    <section>
      <Header title={page} subtitle={curationSubtitle(page)} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="panel table">
        <div className="table-head">
          <span>Registros</span>
          <span>{items.length} encontrados</span>
        </div>
        {items.length === 0 ? (
          <div className="empty">Nenhum registro nesta visão.</div>
        ) : (
          items.map((item, index) => (
            <button
              className="record"
              key={index}
              onClick={() => setSelected(item as Record<string, unknown>)}
            >
              <pre>{JSON.stringify(item, null, 2)}</pre>
            </button>
          ))
        )}
      </div>
      {page !== "Auditoria" && (
        <CurationActions page={page} adminKey={adminKey} selected={selected} />
      )}
    </section>
  );
}

function CurationActions({
  page,
  adminKey,
  selected
}: {
  page: Exclude<Page, "Visão geral" | "Nova oferta" | "Importar JSON" | "Auditoria">;
  adminKey: string;
  selected: Record<string, unknown> | null;
}) {
  const [justification, setJustification] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const id = typeof selected?.id === "string" ? selected.id : "";
  async function action(kind: "primary" | "secondary") {
    if (!id || justification.trim().length < 5) return;
    let path = "";
    let method = "POST";
    let body: Record<string, unknown> = { justification };
    if (page === "Mensagens") {
      path = `/v1/admin/messages/${id}/${kind === "primary" ? "reprocess" : "correction"}`;
      method = kind === "primary" ? "POST" : "PUT";
      if (kind === "secondary") body.changes = JSON.parse(value || "{}");
    }
    if (page === "Ofertas") {
      path = `/v1/admin/offers/${id}/${kind === "primary" ? "merge" : "split"}`;
      body[kind === "primary" ? "sourceOfferIds" : "mentionIds"] = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (page === "Produtos e aliases") {
      path = "/v1/admin/aliases";
      body = { justification, productId: id, alias: value };
    }
    if (page === "Sources e stores") {
      const type = selected?.type === "store" ? "stores" : "sources";
      path = `/v1/admin/${type}/${id}/block`;
      method = "PUT";
      body.blocked = kind === "primary";
    }
    try {
      await adminRequest(path, adminKey, { method, body: JSON.stringify(body) });
      setStatus("Ação registrada na auditoria.");
    } catch (reason) {
      setStatus(String(reason));
    }
  }
  const valueLabel =
    page === "Mensagens"
      ? "Overrides em JSON"
      : page === "Ofertas"
        ? "IDs separados por vírgula"
        : page === "Produtos e aliases"
          ? "Novo alias"
          : "Detalhe da ação";
  return (
    <div className="panel action-box">
      <h2>Ação auditável</h2>
      <p>{id ? `Selecionado: ${id}` : "Selecione um registro acima."}</p>
      <label>
        Justificativa
        <input
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          placeholder="Obrigatória para correções, merge, split ou bloqueio"
        />
      </label>
      {page !== "Sources e stores" && (
        <label>
          {valueLabel}
          <input value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      )}
      <div className="actions">
        <button disabled={!id} onClick={() => void action("primary")}>
          {page === "Mensagens"
            ? "Reprocessar"
            : page === "Ofertas"
              ? "Mesclar"
              : page === "Produtos e aliases"
                ? "Criar alias"
                : "Bloquear"}
        </button>
        {page !== "Produtos e aliases" && (
          <button className="secondary" disabled={!id} onClick={() => void action("secondary")}>
            {page === "Mensagens" ? "Corrigir" : page === "Ofertas" ? "Separar" : "Desbloquear"}
          </button>
        )}
      </div>
      {status && <Notice>{status}</Notice>}
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header>
      <p className="eyebrow">WORKSPACE</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
function Notice({ children, tone = "ok" }: { children: React.ReactNode; tone?: string }) {
  return <p className={`notice ${tone}`}>{children}</p>;
}
function curationSubtitle(page: string) {
  return (
    (
      {
        Mensagens: "Mensagens brutas, parses e replay.",
        Ofertas: "Consolidação, score, snapshots, merge e split.",
        "Produtos e aliases": "Taxonomia canônica e aliases ativos.",
        "Sources e stores": "Confiabilidade e bloqueios preservando histórico.",
        Auditoria: "Antes, depois e justificativa de cada ação."
      } as Record<string, string>
    )[page] ?? ""
  );
}
