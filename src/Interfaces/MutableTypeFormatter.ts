import type { ChainTypeFormatter } from "../ChainTypeFormatter.js";
import type { MutableParser } from "./MutableParser.js";
import type { SubTypeFormatter } from "./SubTypeFormatter.js";

/**
 * Implemented by formatters that support dynamic registration of
 * {@linkcode SubTypeFormatter} instances after construction. Enables the
 * `createFormatter` factory augmentor callback to extend the chain at
 * creation time.
 *
 * @see {@linkcode ChainTypeFormatter} for the standard implementation.
 * @see {@linkcode MutableParser} for the parser equivalent.
 */
export interface MutableTypeFormatter {
    /**
     * Appends {@linkcode formatter} to the chain and returns `this` for fluent
     * chaining.
     *
     * @param formatter - The sub-formatter to register.
     * @returns `this` for method chaining.
     */
    addTypeFormatter(formatter: SubTypeFormatter): MutableTypeFormatter;
}
