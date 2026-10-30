/**
 * roslyn-lsp — мост к Roslyn Language Server (C# LSP) для pi.
 *
 * Поднимает `dnx roslyn-language-server --stdio` (NuGet-пакет roslyn-language-server,
 * докачивается при первом запуске) и проксирует LSP-запросы через model-callable
 * инструмент `csharp_lsp`. Сессионный процесс: стартует лениво при первом вызове,
 * гасится в session_shutdown.
 *
 * Проверки окружения (перед стартом сервера):
 *  1. .NET SDK (`dotnet --version`)
 *  2. Раннер инструментов NuGet (`dnx`, ищется через where.exe)
 *  3. Доступность пакета roslyn-language-server (кэш NuGet; иначе первый запуск скачает)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const SERVER_PACKAGE = "roslyn-language-server";

const Params = Type.Object({
	operation: Type.String({
		description:
			"LSP operation: initialize | hover | definition | references | completion | diagnostics | document_symbols | workspace_symbols | shutdown",
	}),
	file: Type.Optional(
		Type.String({
			description:
				"Absolute path to a .cs file (hover/definition/references/completion/diagnostics/document_symbols)",
		}),
	),
	line: Type.Optional(Type.Number({ description: "0-based line (hover/definition/references/completion)" })),
	character: Type.Optional(Type.Number({ description: "0-based character (hover/definition/references/completion)" })),
	query: Type.Optional(Type.String({ description: "Search query (workspace_symbols)" })),
});

type Json = Record<string, unknown>;

class LspClient {
	private proc: ChildProcess | null = null;
	private buffer = Buffer.alloc(0);
	private nextId = 1;
	private pending = new Map<number, { resolve: (v: Json) => void; reject: (e: Error) => void }>();
	private diagnostics = new Map<string, Json[]>();
	private stderrTail = "";
	private initialized = false;
	private starting: Promise<void> | null = null;

	constructor(readonly cwd: string) {}

	private runnerCommand(): { cmd: string; args: string[]; shell: boolean } {
		// dnx на Windows — только .cmd-shim; Node >= 20.12 блокирует spawn .cmd
		// без shell (EINVAL). Аргументы здесь константные — shell безопасен.
		const args = [SERVER_PACKAGE, "--yes", "--prerelease", "--", "--stdio", "--autoLoadProjects"];
		try {
			const { execFileSync } = require("node:child_process");
			const hits = execFileSync("where.exe", ["dnx"], { encoding: "utf-8" }).split(/\r?\n/).filter(Boolean);
			const cmdHit = hits.find((h: string) => h.toLowerCase().endsWith(".cmd")) ?? hits[0];
			return { cmd: cmdHit, args, shell: true };
		} catch {
			return { cmd: "dnx", args, shell: true };
		}
	}

	private ensureSdk(): void {
		try {
			const { execFileSync } = require("node:child_process");
			const v = execFileSync("dotnet", ["--version"], { encoding: "utf-8" }).trim();
			if (!/^\d+\./.test(v)) throw new Error(`unexpected version output: ${v}`);
		} catch (e: any) {
			throw new Error(
				`.NET SDK не найден. Установите SDK (https://dotnet.microsoft.com/download) — требование для ${SERVER_PACKAGE}. (${e?.message ?? e})`,
			);
		}
	}

	private packageCached(): boolean {
		// dnx кэширует NuGet-пакеты в ~/.nuget/packages
		return existsSync(join(homedir(), ".nuget", "packages", SERVER_PACKAGE));
	}

	private spawnServer(): void {
		const { cmd, args, shell } = this.runnerCommand();
		// shell:true не квотит путь сам — пути с пробелами (C:\Program Files\...) квотим вручную
		this.proc = spawn(`"${cmd}"`, args, { cwd: this.cwd, stdio: ["pipe", "pipe", "pipe"], shell });
		this.proc.stderr?.on("data", (d: Buffer) => {
			this.stderrTail = (this.stderrTail + d.toString()).slice(-4000);
		});
		// spawn error (ENOENT и т.п.) не должна ронять процесс pi
		this.proc.on("error", (err) => {
			const msg = `Не удалось запустить раннер dnx (${err.message}). Установите .NET SDK 10+ (включает dotnet x / dnx).`;
			for (const p of this.pending.values()) p.reject(new Error(msg));
			this.pending.clear();
			this.proc = null;
			this.initialized = false;
			this.starting = null;
		});
		this.proc.stdout?.on("data", (d: Buffer) => this.onData(d));
		this.proc.on("exit", (code) => {
			console.error(`[roslyn-lsp] сервер завершился code=${code}. stderr: ${this.stderrTail.slice(-800)}`);
			const err = new Error(
				`${SERVER_PACKAGE} завершился (code ${code}). stderr: ${this.stderrTail.slice(-500) || "(пусто)"}. Пакет докачивается с NuGet при первом запуске — проверьте сеть.`,
			);
			for (const p of this.pending.values()) p.reject(err);
			this.pending.clear();
			this.proc = null;
			this.initialized = false;
			this.starting = null;
		});
	}

	private async ensureStarted(): Promise<void> {
		if (this.proc && this.initialized) return;
		if (this.starting) return this.starting;
		this.starting = (async () => {
			this.ensureSdk();
			if (!this.packageCached()) {
				console.error(
					`[roslyn-lsp] пакет ${SERVER_PACKAGE} не в кэше NuGet — первый запуск скачает его (до нескольких минут).`,
				);
			}
			this.spawnServer();
			await this.request("initialize", {
				processId: process.pid,
				rootUri: `file:///${this.cwd.replace(/\\/g, "/")}`,
				capabilities: {
					textDocument: {
						hover: { contentFormat: ["markdown", "plaintext"] },
						definition: {},
						references: {},
						completion: { completionItem: { snippetSupport: false } },
						documentSymbol: {},
						publishDiagnostics: {},
					},
					workspace: { symbol: {} },
				},
				workspaceFolders: [{ uri: `file:///${this.cwd.replace(/\\/g, "/")}`, name: "workspace" }],
			});
			this.notify("initialized", {});
			this.initialized = true;
		})();
		return this.starting;
	}

	private onData(chunk: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		for (;;) {
			const headerEnd = this.buffer.indexOf("\r\n\r\n");
			if (headerEnd === -1) return;
			const header = this.buffer.slice(0, headerEnd).toString("utf-8");
			const m = /Content-Length:\s*(\d+)/i.exec(header);
			if (!m) {
				this.buffer = this.buffer.slice(headerEnd + 4);
				continue;
			}
			const len = Number(m[1]);
			const start = headerEnd + 4;
			if (this.buffer.length < start + len) return;
			const body = this.buffer.slice(start, start + len).toString("utf-8");
			this.buffer = this.buffer.slice(start + len);
			let msg: Json;
			try {
				msg = JSON.parse(body);
			} catch {
				continue;
			}
			if (msg.method === "textDocument/publishDiagnostics") {
				const uri = String((msg.params as Json).uri ?? "");
				this.diagnostics.set(uri, (msg.params as Json).diagnostics as Json[]);
			} else if (msg.id !== undefined && this.pending.has(Number(msg.id))) {
				const p = this.pending.get(Number(msg.id))!;
				this.pending.delete(Number(msg.id));
				if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
				else p.resolve((msg.result as Json) ?? {});
			}
		}
	}

	private request(method: string, params: Json, timeoutMs = 120_000): Promise<Json> {
		if (!this.proc?.stdin) return Promise.reject(new Error("LSP-сервер не запущен"));
		const id = this.nextId++;
		return new Promise<Json>((res, rej) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				rej(new Error(`LSP timeout: ${method}`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve: (v) => {
					clearTimeout(timer);
					res(v);
				},
				reject: (e) => {
					clearTimeout(timer);
					rej(e);
				},
			});
			const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
			this.proc!.stdin!.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
		});
	}

	private notify(method: string, params: Json): void {
		if (!this.proc?.stdin) return;
		const payload = JSON.stringify({ jsonrpc: "2.0", method, params });
		this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
	}

	private openDocument(file: string): string {
		const abs = resolve(this.cwd, file);
		const text = readFileSync(abs, "utf-8");
		const uri = `file:///${abs.replace(/\\/g, "/")}`;
		this.notify("textDocument/didOpen", { textDocument: { uri, languageId: "csharp", version: 1, text } });
		return uri;
	}

	private static summarize(value: unknown, depth = 0): string {
		if (value === null || value === undefined) return String(value);
		if (typeof value === "string") return value;
		if (Array.isArray(value)) {
			const items = value.slice(0, 50).map((v) => LspClient.summarize(v, depth + 1));
			return items.join("\n") + (value.length > 50 ? `\n... ещё ${value.length - 50}` : "");
		}
		if (typeof value === "object") {
			const o = value as Record<string, unknown>;
			if (typeof o.value === "string") return o.value; // MarkupContent / string literal
			if (o.contents !== undefined) return LspClient.summarize(o.contents, depth + 1);
			if (o.range && o.uri) return `${o.uri}:${JSON.stringify(o.range)}`;
			if (o.location !== undefined) return LspClient.summarize(o.location, depth + 1);
			if (o.name && o.kind !== undefined) return `${o.name} (kind ${o.kind})`;
			return JSON.stringify(o).slice(0, 2000);
		}
		return String(value);
	}

	// Сервер при первом открытии проекта долго индексирует и отменяет запросы
	// (-32800) — обёртка с одной повторной попыткой.
	private async requestResilient(method: string, params: Json): Promise<Json> {
		try {
			return await this.request(method, params);
		} catch (e: any) {
			if (!String(e?.message).includes("-32800")) throw e;
			await new Promise((r) => setTimeout(r, 5000));
			return this.request(method, params);
		}
	}

	async call(params: {
		operation: string;
		file?: string;
		line?: number;
		character?: number;
		query?: string;
	}): Promise<string> {
		// Сервер мог упасть между вызовами — сбрасываем состояние, ensureStarted перезапустит.
		if (!this.proc) {
			this.initialized = false;
			this.starting = null;
		}
		await this.ensureStarted();
		const op = params.operation;
		switch (op) {
			case "initialize": {
				if (this.initialized) return `Сервер уже инициализирован для ${this.cwd} (повторный initialize запрещён протоколом LSP).`;
				const result = await this.request("initialize", {
					processId: process.pid,
					rootUri: `file:///${this.cwd.replace(/\\/g, "/")}`,
					capabilities: {},
				});
				return `Сервер инициализирован: ${JSON.stringify(result.serverInfo ?? result)}`;
			}
			case "shutdown": {
				await this.request("shutdown", {}, 10_000).catch(() => ({}));
				this.notify("exit", {});
				this.dispose();
				return "Сервер остановлен.";
			}
			case "hover":
			case "definition":
			case "references":
			case "completion":
			case "diagnostics":
			case "document_symbols": {
				if (!params.file) throw new Error("для этой операции нужен параметр file");
				const uri = this.openDocument(params.file);
				if (op === "diagnostics") {
					// Ждём publishDiagnostics до 15с; если сервер не пушит — пробуем pull (LSP 3.17).
					this.diagnostics.delete(uri);
					const deadline = Date.now() + 15_000;
					while (Date.now() < deadline && !this.diagnostics.has(uri)) {
						await new Promise((r) => setTimeout(r, 500));
					}
					let diags = this.diagnostics.get(uri);
					if (!diags) {
						const pulled = await this.requestResilient("textDocument/diagnostic", {
							textDocument: { uri },
							identifier: "roslyn",
						}).catch(() => null);
						const items = (pulled?.items ?? pulled?.relatedDocuments) as Json[] | undefined;
						if (Array.isArray(items)) diags = items;
					}
					if (!diags || !diags.length) {
						return "Диагностик нет (проект большой? сервер мог не успеть — повторите вызов).";
					}
					return diags
						.map(
							(d: Json) =>
								`[${d.severity === 1 ? "Error" : d.severity === 2 ? "Warning" : "Info"}] ` +
								`${JSON.stringify((d.range as Json)?.start ?? "?")}: ${d.message}`,
						)
						.join("\n");
				}
				if (op === "document_symbols") {
					const result = await this.requestResilient("textDocument/documentSymbol", { textDocument: { uri } });
					return LspClient.summarize(result) || "Символы не найдены.";
				}
				const pos = {
					textDocument: { uri },
					position: { line: params.line ?? 0, character: params.character ?? 0 },
				};
				const method =
					op === "hover"
						? "textDocument/hover"
						: op === "definition"
							? "textDocument/definition"
							: op === "references"
								? "textDocument/references"
								: "textDocument/completion";
				const extra = op === "references" ? { context: { includeDeclaration: true } } : {};
				const result = await this.requestResilient(method, { ...pos, ...extra });
				return LspClient.summarize(result) || "(пустой результат)";
			}
			case "workspace_symbols": {
				if (!params.query) throw new Error("для workspace_symbols нужен параметр query");
				const result = await this.requestResilient("workspace/symbol", { query: params.query });
				return LspClient.summarize(result) || "Символы не найдены.";
			}
			default:
				throw new Error(`Неизвестная операция: ${op}`);
		}
	}

	dispose(): void {
		this.proc?.kill();
		this.proc = null;
		this.initialized = false;
		this.starting = null;
	}
}

export default function (pi: ExtensionAPI) {
	let client: LspClient | null = null;

	const getClient = (cwd: string): LspClient => {
		if (!client || client.cwd !== cwd) {
			client?.dispose();
			client = new LspClient(cwd);
		}
		return client;
	};

	pi.registerTool({
		name: "csharp_lsp",
		label: "C# LSP",
		description:
			"C# semantic operations via Roslyn Language Server (hover, definition, references, completion, diagnostics, symbols). " +
			"Requires .NET SDK and `dnx` tool runner; the roslyn-language-server NuGet package downloads on first use. " +
			"First call in a session is slow (server startup + project load).",
		parameters: Params,
		annotations: { readOnlyHint: true, openWorldHint: false },

		async execute(_id, params, signal, _onUpdate, ctx) {
			signal?.throwIfAborted();
			const run = () => getClient(ctx.cwd).call(params);
			try {
				const text = await run().catch(async (e: any) => {
					// Сервер мог упасть прямо во время вызова — один полный рестарт.
					if (!String(e?.message).includes("не запущен")) throw e;
					client?.dispose();
					client = null;
					return run();
				});
				return { content: [{ type: "text", text }], details: { operation: params.operation } };
			} catch (e: any) {
				// fail-closed: без SDK/раннера сообщаем требования, не падая всей сессией
				return {
					content: [{ type: "text", text: `csharp_lsp недоступен: ${e?.message ?? e}` }],
					details: { operation: params.operation, error: String(e?.message ?? e) },
					isError: true,
				};
			}
		},
	});

	pi.on("session_shutdown", () => {
		client?.dispose();
		client = null;
	});
}
