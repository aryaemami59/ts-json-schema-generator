import type { JSONSchema7 } from "json-schema";
import ts from "typescript";
import type { BaseType } from "../Type/BaseType.js";
import type { PartialDiagnostic } from "./BaseError.js";
import { BaseError } from "./BaseError.js";

/**
 * Thrown when the parser encounters a TypeScript AST node kind that no
 * registered {@linkcode SubNodeParser} can handle. Extends
 * {@linkcode BaseError} with diagnostic code `100`.
 *
 * @see {@linkcode ChainNodeParser}
 */
export class UnknownNodeError extends BaseError {
    constructor(readonly node: ts.Node) {
        super({
            code: 100,
            node,
            messageText: `Unknown node of kind "${ts.SyntaxKind[node.kind]}"`,
        });
    }
}

/**
 * Thrown when the formatter encounters a {@linkcode BaseType} instance that
 * no registered {@linkcode SubTypeFormatter} supports. Extends
 * {@linkcode BaseError} with diagnostic code `101`.
 *
 * @see {@linkcode ChainTypeFormatter}
 */
export class UnknownTypeError extends BaseError {
    constructor(readonly type: BaseType) {
        super({
            code: 101,
            messageText: `Unknown type "${type?.getId()}"`,
        });
    }
}

/**
 * Thrown when {@linkcode SchemaGenerator} cannot locate a named type in any
 * source file. Typically caused by a typo in the `type` config option or a
 * type that is not exported. Extends {@linkcode BaseError} with diagnostic
 * code `102`.
 *
 * @see {@linkcode Config.type}
 */
export class RootlessError extends BaseError {
    constructor(readonly fullName: string) {
        super({
            code: 102,
            messageText: `No root type "${fullName}" found`,
        });
    }
}

/**
 * Thrown when two distinct types share the same definition name, causing a
 * collision in the generated `definitions` object. Extends
 * {@linkcode BaseError} with diagnostic code `103`.
 *
 * @see {@linkcode SchemaGenerator}
 */
export class MultipleDefinitionsError extends BaseError {
    constructor(
        readonly name: string,
        readonly defA: BaseType,
        readonly defB?: BaseType,
    ) {
        super({
            code: 103,
            messageText: `Type "${name}" has multiple definitions.`,
        });
    }
}

/**
 * Thrown when an internal invariant is violated during parsing. For example,
 * when AST structure does not match the expected shape. Extends
 * {@linkcode BaseError} with diagnostic code `104`.
 */
export class LogicError extends BaseError {
    constructor(
        readonly node: ts.Node,
        messageText: string,
    ) {
        super({
            code: 104,
            messageText,
            node,
        });
    }
}

/**
 * Thrown when a parser or formatter encounters a state it does not expect but
 * that is not necessarily a logic error in the generator. Extends
 * {@linkcode BaseError} with diagnostic code `105`.
 */
export class ExpectationFailedError extends BaseError {
    constructor(
        messageText: string,
        readonly node?: ts.Node,
    ) {
        super({
            code: 105,
            messageText,
            node,
        });
    }
}

/**
 * Thrown when a {@linkcode BaseType} is used in a context incompatible with
 * JSON Schema (e.g., accessing a {@linkcode ReferenceType} property before it
 * has been set). Extends {@linkcode BaseError} with diagnostic code `106`.
 */
export class JsonTypeError extends BaseError {
    constructor(
        messageText: string,
        readonly type: BaseType,
    ) {
        super({
            code: 106,
            messageText,
        });
    }
}

/**
 * Thrown when a generated {@linkcode Definition} object is structurally
 * invalid or in a state that cannot be serialized correctly. Extends
 * {@linkcode BaseError} with diagnostic code `107`.
 */
export class DefinitionError extends BaseError {
    constructor(
        messageText: string,
        readonly definition: JSONSchema7,
    ) {
        super({
            code: 107,
            messageText,
        });
    }
}

/**
 * Thrown during TypeScript program construction when the source files cannot
 * be resolved, parsed, or type-checked successfully. Extends
 * {@linkcode BaseError} with diagnostic code `108`.
 *
 * @see {@linkcode createProgram}
 */
export class BuildError extends BaseError {
    constructor(diag: Omit<PartialDiagnostic, "code">) {
        super({
            code: 108,
            ...diag,
        });
    }
}

/**
 * Wraps any unexpected error thrown deep inside the parser or formatter
 * pipeline, preserving the original cause. The static factory method
 * {@linkcode UnhandledError.from | from()} prevents double-wrapping when the
 * cause is already a {@linkcode BaseError}. Extends {@linkcode BaseError} with
 * diagnostic code `109`.
 */
export class UnhandledError extends BaseError {
    private constructor(
        messageText: string,
        node?: ts.Node,
        readonly cause?: unknown,
    ) {
        super({ code: 109, messageText, node });
    }

    /**
     * Creates a new {@linkcode UnhandledError} with an optional cause and
     * node, guarding against redundant wrapping. If `cause` is already a
     * {@linkcode BaseError}, it is returned as-is so that
     * `error.cause.cause.cause` chains do not form.
     *
     * @param message - A human-readable description of where the error occurred.
     * @param node - The TypeScript AST node associated with the error, if available.
     * @param cause - The original error that triggered this handler.
     * @returns The `cause` unchanged when it is a {@linkcode BaseError}; otherwise a new {@linkcode UnhandledError}.
     */
    static from(message: string, node?: ts.Node, cause?: unknown) {
        // This might be called deeply inside the parser chain
        // this ensures it doesn't end up with error.cause.cause.cause...
        return cause instanceof BaseError ? cause : new UnhandledError(message, node, cause);
    }
}
