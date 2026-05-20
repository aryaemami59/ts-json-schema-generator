import type { ChainTypeFormatter } from "../ChainTypeFormatter.js";
import type { BaseType } from "../Type/BaseType.js";
import type { MutableTypeFormatter } from "./MutableTypeFormatter.js";
import type { TypeFormatter } from "./TypeFormatter.js";

/**
 * Extends {@linkcode TypeFormatter} with a type-support predicate. Used by
 * {@linkcode ChainTypeFormatter} to dispatch
 * {@linkcode TypeFormatter.getDefinition | getDefinition()} and
 * {@linkcode TypeFormatter.getChildren | getChildren()} calls to the first
 * registered formatter whose
 * {@linkcode SubTypeFormatter.supportsType | supportsType()} returns `true`.
 *
 * @see {@linkcode TypeFormatter} for the base interface.
 * @see {@linkcode ChainTypeFormatter} for the dispatch implementation.
 * @see {@linkcode MutableTypeFormatter} for the fluent-registration interface.
 */
export interface SubTypeFormatter extends TypeFormatter {
    /**
     * Returns `true` if this formatter can handle {@linkcode type}.
     *
     * @param type - The type to test.
     * @returns `true` if this formatter can handle {@linkcode type}.
     */
    supportsType(type: BaseType): boolean;
}
