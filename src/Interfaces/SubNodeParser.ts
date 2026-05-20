import type ts from "typescript";
import type { ChainNodeParser } from "../ChainNodeParser.js";
import type { NodeParser } from "../NodeParser.js";
import type { MutableParser } from "./MutableParser.js";

/**
 * Extends {@linkcode NodeParser} with a type-support predicate. Used by
 * {@linkcode ChainNodeParser} to dispatch
 * {@linkcode NodeParser.createType | createType()} calls to the first
 * registered parser whose
 * {@linkcode SubNodeParser.supportsNode | supportsNode()} returns `true`.
 *
 * @see {@linkcode NodeParser} for the base interface.
 * @see {@linkcode ChainNodeParser} for the dispatch implementation.
 * @see {@linkcode MutableParser} for the fluent-registration interface.
 */
export interface SubNodeParser extends NodeParser {
    /**
     * Returns `true` if this parser can handle {@linkcode node}.
     *
     * @param node - The TypeScript AST node to test.
     * @returns `true` if this parser can handle {@linkcode node}.
     */
    supportsNode(node: ts.Node): boolean;
}
