import ts from "typescript";

/**
 * A Partial {@linkcode ts.Diagnostic} used when constructing
 * {@linkcode BaseError} subclasses. Required fields (`messageText`, `code`)
 * are always present; positioning fields are optional and may be inferred from
 * a {@linkcode ts.Node} via the {@linkcode PartialDiagnostic.node | node}
 * property.
 */
export type PartialDiagnostic = Omit<ts.Diagnostic, "category" | "file" | "start" | "length"> & {
    /**
     * Optional source file. When omitted and
     * {@linkcode PartialDiagnostic.node | node} is provided, inferred from
     * {@linkcode ts.Node.getSourceFile | node.getSourceFile()}.
     */
    file?: ts.SourceFile;

    /**
     * Character offset where the diagnostic starts in
     * {@linkcode PartialDiagnostic.file | file}.
     * When omitted and {@linkcode PartialDiagnostic.node | node} is provided, inferred from
     * {@linkcode ts.Node.getStart | node.getStart()}.
     */
    start?: number;

    /**
     * Width of the highlighted range in
     * {@linkcode PartialDiagnostic.file | file}. When omitted and
     * {@linkcode PartialDiagnostic.node | node} is provided, inferred from
     * {@linkcode ts.Node.getWidth | node.getWidth()}.
     */
    length?: number;

    /**
     * If we should populate {@linkcode PartialDiagnostic.file | file},
     * {@linkcode PartialDiagnostic.source | source},
     * {@linkcode PartialDiagnostic.start | start} and
     * {@linkcode PartialDiagnostic.length | length}
     * based on the position of this node. Useful when the error is directly
     * related to a specific node, so the error message can be associated with
     * this node information.
     */
    node?: ts.Node;

    /**
     * Diagnostic severity level. Defaults to
     * {@linkcode ts.DiagnosticCategory.Error}.
     *
     * @default ts.DiagnosticCategory.Error
     */
    category?: ts.DiagnosticCategory;
};

/**
 * Abstract base class for all ts-json-schema-generator errors. Extends the
 * native {@linkcode Error} with a structured TypeScript
 * {@linkcode ts.Diagnostic} so errors can be formatted with source locations
 * using {@linkcode BaseError.format | format()}.
 *
 * @see {@linkcode BaseError.format} for human-readable output.
 * @see {@linkcode BaseError.createDiagnostic} for diagnostic construction.
 */
export abstract class BaseError extends Error {
    readonly diagnostic: ts.Diagnostic;

    constructor(diagnostic: PartialDiagnostic) {
        super(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        this.diagnostic = BaseError.createDiagnostic(diagnostic);
    }

    /**
     * Builds a complete {@linkcode ts.Diagnostic} from a
     * {@linkcode PartialDiagnostic}. If `node` is provided and is attached to
     * a source file, the `file`, `start`, and `length` fields are derived from
     * it. The `code` property is prefixed with `J - ` to distinguish
     * ts-json-schema-generator errors from TypeScript compiler diagnostics.
     *
     * @param diagnostic - The partial diagnostic to complete.
     * @returns A fully populated {@linkcode ts.Diagnostic}.
     */
    static createDiagnostic(diagnostic: PartialDiagnostic): ts.Diagnostic {
        // Swap the node for the file, source, start and length properties
        // sourceless nodes cannot be referenced in the diagnostic
        if (diagnostic.node && diagnostic.node.pos !== -1) {
            diagnostic.file = diagnostic.node.getSourceFile();
            diagnostic.start = diagnostic.node.getStart();
            diagnostic.length = diagnostic.node.getWidth();

            diagnostic.node = undefined;
        }

        // @ts-expect-error - Differentiates from errors from the TypeScript compiler
        // error TSJ - 100: message
        diagnostic.code = `J - ${diagnostic.code}`;

        return Object.assign(
            {
                category: ts.DiagnosticCategory.Error,
                file: undefined,
                length: 0,
                start: 0,
            },
            diagnostic,
        );
    }

    /**
     * Formats the diagnostic as a human-readable string. Uses
     * {@linkcode ts.formatDiagnosticsWithColorAndContext | ts.formatDiagnosticsWithColorAndContext()}
     * when outputting to a TTY, otherwise uses plain
     * {@linkcode ts.formatDiagnostics | ts.formatDiagnostics()}.
     *
     * @param isTTY - Whether to use color/context formatting. Defaults to {@linkcode process.env.TTY} or {@linkcode process.stdout.isTTY}.
     * @returns A formatted diagnostic string.
     */
    format(isTTY = process.env.TTY || process.stdout.isTTY): string {
        const formatter = isTTY ? ts.formatDiagnosticsWithColorAndContext : ts.formatDiagnostics;

        return formatter([this.diagnostic], {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => "",
            getNewLine: () => "\n",
        });
    }
}
