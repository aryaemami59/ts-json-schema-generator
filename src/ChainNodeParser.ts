import type ts from "typescript";
import { UnhandledError, UnknownNodeError } from "./Error/Errors.js";
import type { MutableParser } from "./MutableParser.js";
import type { Context } from "./NodeParser.js";
import type { SubNodeParser } from "./SubNodeParser.js";
import type { BaseType } from "./Type/BaseType.js";
import { ReferenceType } from "./Type/ReferenceType.js";

/**
 * Dispatches {@linkcode NodeParser.createType | createType()} calls to the
 * first registered {@linkcode SubNodeParser} that reports
 * {@linkcode SubNodeParser.supportsNode | supportsNode()} as `true`. Results
 * are memoized per-node and per-context cache key to avoid redundant work.
 *
 * Implements {@linkcode MutableParser} so parsers can be appended after
 * construction via the fluent
 * {@linkcode ChainNodeParser.addNodeParser | addNodeParser()} API.
 *
 * @example
 * <caption>Building a parser chain with a custom sub-parser</caption>
 *
 * ```ts
 * import { ChainNodeParser } from 'ts-json-schema-generator';
 *
 * const chain = new ChainNodeParser(typeChecker, []);
 * chain.addNodeParser(myCustomParser);
 * ```
 *
 * @see {@linkcode ChainTypeFormatter} for the formatter equivalent.
 */
export class ChainNodeParser implements SubNodeParser, MutableParser {
    protected readonly typeCaches = new WeakMap<ts.Node, Map<string, BaseType>>();

    /**
     * @param typeChecker - The TypeScript type-checker used by some sub-parsers for symbol resolution.
     * @param nodeParsers - Initial list of {@linkcode SubNodeParser} instances, evaluated in order.
     */
    public constructor(
        protected typeChecker: ts.TypeChecker,
        protected nodeParsers: SubNodeParser[],
    ) {}

    /**
     * Appends a {@linkcode SubNodeParser} to the end of the chain and returns
     * `this` for fluent chaining.
     *
     * @param nodeParser - The sub-parser to register.
     * @returns `this`, enabling fluent method chaining.
     */
    public addNodeParser(nodeParser: SubNodeParser): this {
        this.nodeParsers.push(nodeParser);
        return this;
    }

    /**
     * Returns `true` if at least one registered sub-parser supports `node`.
     *
     * @param node - The TypeScript AST node to test.
     * @returns Whether any sub-parser can handle `node`.
     */
    public supportsNode(node: ts.Node): boolean {
        return this.nodeParsers.some((nodeParser) => nodeParser.supportsNode(node));
    }

    /**
     * Resolves the responsible sub-parser and delegates type creation. Caches
     * the result per-node and per-context; results that are not
     * {@linkcode ReferenceType} instances are stored for reuse.
     *
     * @param node - The TypeScript AST node to parse.
     * @param context - The current generic type-argument context.
     * @param reference - An optional forward-reference placeholder.
     * @returns The internal {@linkcode BaseType} for `node`.
     * @throws An {@linkcode UnhandledError} if the sub-parser throws an unexpected error.
     * @throws An {@linkcode UnknownNodeError} if no sub-parser supports `node`.
     */
    public createType(node: ts.Node, context: Context, reference?: ReferenceType): BaseType {
        let typeCache = this.typeCaches.get(node);
        if (typeCache == null) {
            typeCache = new Map<string, BaseType>();
            this.typeCaches.set(node, typeCache);
        }
        const contextCacheKey = context.getCacheKey();
        let type = typeCache.get(contextCacheKey);

        if (!type) {
            try {
                type = this.getNodeParser(node).createType(node, context, reference);
            } catch (error) {
                throw UnhandledError.from("Unhandled error while creating Base Type.", node, error);
            }
            if (!(type instanceof ReferenceType)) {
                typeCache.set(contextCacheKey, type);
            }
        }

        if (!type) {
            throw new UnknownNodeError(node);
        }

        return type;
    }

    /**
     * Finds and returns the first sub-parser that supports `node`.
     *
     * @param node - The TypeScript AST node to match.
     * @returns The matching {@linkcode SubNodeParser}.
     * @throws An {@linkcode UnknownNodeError} if no sub-parser supports `node`.
     */
    protected getNodeParser(node: ts.Node): SubNodeParser {
        for (const nodeParser of this.nodeParsers) {
            if (nodeParser.supportsNode(node)) {
                return nodeParser;
            }
        }

        throw new UnknownNodeError(node);
    }
}
