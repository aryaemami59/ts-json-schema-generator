import type { ChainNodeParser } from "../ChainNodeParser.js";
import type { MutableTypeFormatter } from "./MutableTypeFormatter.js";
import type { SubNodeParser } from "./SubNodeParser.js";

/**
 * Implemented by parsers that support dynamic registration of
 * {@linkcode SubNodeParser} instances after construction. Enables the
 * `createParser` factory augmentor callback to extend the chain at creation
 * time.
 *
 * @see {@linkcode ChainNodeParser} for the standard implementation.
 * @see {@linkcode MutableTypeFormatter} for the formatter equivalent.
 */
export interface MutableParser {
    /**
     * Appends {@linkcode parser} to the chain and returns `this` for fluent
     * chaining.
     *
     * @param parser - The sub-parser to register.
     * @returns `this` for method chaining.
     */
    addNodeParser(parser: SubNodeParser): MutableParser;
}
