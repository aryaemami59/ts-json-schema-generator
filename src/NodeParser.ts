import stringify from "safe-stable-stringify";
import type ts from "typescript";
import type { BaseType } from "./Type/BaseType.js";
import type { ReferenceType } from "./Type/ReferenceType.js";
import { getKey } from "./Utils/nodeKey.js";

/**
 * Holds generic type argument bindings and a reference node during
 * recursive parsing. Passed through every
 * {@linkcode NodeParser.createType | createType()} call so that parsers
 * can resolve type parameters to their concrete arguments and generate
 * stable cache keys.
 *
 * @example
 * <caption>Creating a root context (no generic arguments)</caption>
 *
 * ```ts
 * import { Context } from 'ts-json-schema-generator';
 *
 * const type = nodeParser.createType(node, new Context());
 * ```
 *
 * @see {@linkcode NodeParser}
 * @see {@linkcode ChainNodeParser}
 */
export class Context {
    private cacheKey: string | null = null;
    private arguments: BaseType[] = [];
    private parameters: string[] = [];
    private reference?: ts.Node;
    private defaultArgument = new Map<string, BaseType>();

    /**
     * @param reference - Optional TypeScript node that caused this context to be created; used in cache-key generation.
     */
    public constructor(reference?: ts.Node) {
        this.reference = reference;
    }

    /**
     * Appends a resolved generic type argument and invalidates the
     * cached key.
     *
     * @param argumentType - The concrete type to bind.
     */
    public pushArgument(argumentType: BaseType): void {
        this.arguments.push(argumentType);
        this.cacheKey = null;
    }

    /**
     * Registers a generic parameter name in positional order.
     *
     * @param parameterName - The type parameter name (e.g. `'T'`).
     */
    public pushParameter(parameterName: string): void {
        this.parameters.push(parameterName);
    }

    /**
     * Sets a fallback type used when no argument is supplied for a
     * given parameter.
     *
     * @param parameterName - The type parameter name.
     * @param argumentType - The default type to use.
     */
    public setDefault(parameterName: string, argumentType: BaseType): void {
        this.defaultArgument.set(parameterName, argumentType);
    }

    /**
     * Returns a stable JSON cache key combining the reference node key
     * and all bound argument IDs. The result is memoized after the
     * first computation and invalidated by {@linkcode pushArgument}.
     *
     * @returns A stable string cache key for this context.
     */
    public getCacheKey(): string {
        if (this.cacheKey == null) {
            this.cacheKey = stringify([
                this.reference ? getKey(this.reference, this) : "",
                this.arguments.map((argument) => argument?.getId()),
            ]);
        }
        return this.cacheKey;
    }

    /**
     * Returns the bound argument for `parameterName`, falling back to
     * the registered default when no argument has been pushed for that
     * position.
     *
     * @param parameterName - The type parameter name to look up.
     * @returns The bound {@linkcode BaseType} argument or its default.
     */
    public getArgument(parameterName: string): BaseType {
        const index: number = this.parameters.indexOf(parameterName);

        if ((index < 0 || !this.arguments[index]) && this.defaultArgument.has(parameterName)) {
            return this.defaultArgument.get(parameterName)!;
        }

        return this.arguments[index];
    }

    /**
     * @returns A read-only ordered array of registered parameter names.
     */
    public getParameters(): readonly string[] {
        return this.parameters;
    }

    /**
     * @returns A read-only array of bound type arguments in registration order.
     */
    public getArguments(): readonly BaseType[] {
        return this.arguments;
    }

    /**
     * @returns The reference {@linkcode ts.Node} if one was supplied, otherwise `undefined`.
     */
    public getReference(): ts.Node | undefined {
        return this.reference;
    }
}

/**
 * Core parsing interface that converts a TypeScript AST {@linkcode ts.Node}
 * into an internal {@linkcode BaseType} representation.
 *
 * Implementations include {@linkcode ChainNodeParser} (dispatch to registered
 * sub-parsers) and {@linkcode CircularReferenceNodeParser} (cycle detection).
 *
 * @see {@linkcode SubNodeParser} for the extended interface.
 * @see {@linkcode Context} for generic argument bindings.
 */
export interface NodeParser {
    /**
     * Parses a TypeScript AST node into an internal type.
     *
     * @param node - The TypeScript AST node to parse.
     * @param context - The current generic type-argument context.
     * @param reference - An optional pre-allocated {@linkcode ReferenceType} for handling forward references in recursive types.
     * @returns The internal {@linkcode BaseType} representation of `node`.
     */
    createType(node: ts.Node, context: Context, reference?: ReferenceType): BaseType;
}
