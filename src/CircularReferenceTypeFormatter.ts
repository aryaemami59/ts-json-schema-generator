import type { Definition } from "./Schema/Definition.js";
import type { SubTypeFormatter } from "./SubTypeFormatter.js";
import type { BaseType } from "./Type/BaseType.js";
import { uniqueArray } from "./Utils/uniqueArray.js";

/**
 * Wraps a {@linkcode SubTypeFormatter} to detect and handle circular type
 * definitions during schema generation. When a type that is already being
 * formatted is encountered again, an empty {@linkcode Definition} placeholder
 * is returned and populated once the actual definition resolves.
 *
 * Registered automatically by the {@linkcode createFormatter} factory.
 *
 * @see {@linkcode CircularReferenceNodeParser} for the parser equivalent.
 */
export class CircularReferenceTypeFormatter implements SubTypeFormatter {
    protected definition: Map<BaseType, Definition> = new Map();
    protected children: Map<BaseType, BaseType[]> = new Map();

    /**
     * @param childTypeFormatter - The wrapped formatter that handles actual definition generation.
     */
    public constructor(protected childTypeFormatter: SubTypeFormatter) {}

    /**
     * Returns `true` if the wrapped formatter supports {@linkcode type}.
     *
     * @param type - The type to test.
     * @returns Whether the child formatter can handle {@linkcode type}.
     */
    public supportsType(type: BaseType): boolean {
        return this.childTypeFormatter.supportsType(type);
    }

    /**
     * Returns the JSON Schema {@linkcode Definition} for {@linkcode type},
     * inserting an empty placeholder when {@linkcode type} is already being
     * defined (i.e., is part of a circular reference).
     *
     * @param type - The type to convert.
     * @returns The JSON Schema {@linkcode Definition} for {@linkcode type}.
     */
    public getDefinition(type: BaseType): Definition {
        if (this.definition.has(type)) {
            return this.definition.get(type)!;
        }

        const definition: Definition = {};
        this.definition.set(type, definition);
        Object.assign(definition, this.childTypeFormatter.getDefinition(type));
        return definition;
    }

    /**
     * Returns deduplicated child types of {@linkcode type}, inserting an empty
     * array placeholder to break cycles when {@linkcode type} is already being
     * enumerated.
     *
     * @param type - The type whose children to enumerate.
     * @returns Deduplicated child {@linkcode BaseType} instances.
     */
    public getChildren(type: BaseType): BaseType[] {
        if (this.children.has(type)) {
            return this.children.get(type)!;
        }

        const children: BaseType[] = [];
        this.children.set(type, children);
        children.push(...this.childTypeFormatter.getChildren(type));
        return uniqueArray(children);
    }
}
