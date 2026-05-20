import type { Definition } from "./Schema/Definition.js";
import type { BaseType } from "./Type/BaseType.js";

/**
 * Converts an internal {@linkcode BaseType} representation into a JSON Schema
 * {@linkcode Definition} and enumerates its child types. Implemented by
 * {@linkcode ChainTypeFormatter} and
 * {@linkcode CircularReferenceTypeFormatter}.
 *
 * @see {@linkcode SubTypeFormatter} for the extended interface that includes type-support queries.
 * @see {@linkcode ChainTypeFormatter} for the dispatch implementation.
 */
export interface TypeFormatter {
    /**
     * Returns the JSON Schema {@linkcode Definition} for {@linkcode type}.
     *
     * @param type - The type to convert.
     * @returns The JSON Schema {@linkcode Definition} for {@linkcode type}.
     */
    getDefinition(type: BaseType): Definition;

    /**
     * Returns all child {@linkcode BaseType} instances referenced by
     * {@linkcode type}, used to collect reachable definitions.
     *
     * @param type - The type whose children to enumerate.
     * @returns all child {@linkcode BaseType} instances referenced by {@linkcode type}, used to collect reachable definitions.
     */
    getChildren(type: BaseType): BaseType[];
}
