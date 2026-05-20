import { UnknownTypeError } from "./Error/Errors.js";
import type { MutableTypeFormatter } from "./MutableTypeFormatter.js";
import type { Definition } from "./Schema/Definition.js";
import type { SubTypeFormatter } from "./SubTypeFormatter.js";
import type { BaseType } from "./Type/BaseType.js";

/**
 * Dispatches {@linkcode TypeFormatter.getDefinition | getDefinition()} and
 * {@linkcode TypeFormatter.getChildren | getChildren()} calls to the first
 * registered {@linkcode SubTypeFormatter} that reports
 * {@linkcode SubTypeFormatter.supportsType | supportsType()} as `true`.
 *
 * Implements {@linkcode MutableTypeFormatter} so formatters can be appended
 * after construction via the fluent
 * {@linkcode ChainTypeFormatter.addTypeFormatter | addTypeFormatter()} API.
 *
 * @example
 * <caption>Building a formatter chain with a custom sub-formatter</caption>
 *
 * ```ts
 * import { ChainTypeFormatter } from 'ts-json-schema-generator';
 *
 * const chain = new ChainTypeFormatter([]);
 * chain.addTypeFormatter(myCustomFormatter);
 * ```
 *
 * @see {@linkcode ChainNodeParser} for the parser equivalent.
 */
export class ChainTypeFormatter implements SubTypeFormatter, MutableTypeFormatter {
    /**
     * @param typeFormatters - Initial list of {@linkcode SubTypeFormatter} instances, evaluated in order.
     */
    public constructor(protected typeFormatters: SubTypeFormatter[]) {}

    /**
     * Appends a {@linkcode SubTypeFormatter} to the end of the chain and
     * returns `this` for fluent chaining.
     *
     * @param typeFormatter - The sub-formatter to register.
     * @returns `this`, enabling fluent method chaining.
     */
    public addTypeFormatter(typeFormatter: SubTypeFormatter): this {
        this.typeFormatters.push(typeFormatter);
        return this;
    }

    /**
     * Returns `true` if at least one registered sub-formatter supports `type`.
     *
     * @param type - The {@linkcode BaseType} to test.
     * @returns Whether any sub-formatter can handle `type`.
     */
    public supportsType(type: BaseType): boolean {
        return this.typeFormatters.some((typeFormatter) => typeFormatter.supportsType(type));
    }

    /**
     * Delegates to the first sub-formatter that supports `type`.
     *
     * @param type - The type to convert.
     * @returns A {@linkcode Definition} for `type`.
     * @throws An {@linkcode UnknownTypeError} if no sub-formatter supports `type`.
     */
    public getDefinition(type: BaseType): Definition {
        return this.getTypeFormatter(type).getDefinition(type);
    }

    /**
     * Delegates to the first sub-formatter that supports `type`.
     *
     * @param type - The type whose children to enumerate.
     * @returns An array of child {@linkcode BaseType} instances.
     * @throws An {@linkcode UnknownTypeError} if no sub-formatter supports `type`.
     */
    public getChildren(type: BaseType): BaseType[] {
        return this.getTypeFormatter(type).getChildren(type);
    }

    /**
     * Finds and returns the first sub-formatter that supports `type`.
     *
     * @param type - The {@linkcode BaseType} to match.
     * @returns The matching {@linkcode SubTypeFormatter}.
     * @throws An {@linkcode UnknownTypeError} if no sub-formatter supports `type`.
     */
    protected getTypeFormatter(type: BaseType): SubTypeFormatter {
        for (const typeFormatter of this.typeFormatters) {
            if (typeFormatter.supportsType(type)) {
                return typeFormatter;
            }
        }

        throw new UnknownTypeError(type);
    }
}
