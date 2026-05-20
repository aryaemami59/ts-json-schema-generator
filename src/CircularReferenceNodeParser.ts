import type ts from "typescript";
import type { Context } from "./NodeParser.js";
import type { SubNodeParser } from "./SubNodeParser.js";
import type { BaseType } from "./Type/BaseType.js";
import { ReferenceType } from "./Type/ReferenceType.js";
import { getKey } from "./Utils/nodeKey.js";

/**
 * Wraps a {@linkcode SubNodeParser} to detect and handle circular type
 * references during AST traversal. When a node that is already being
 * processed is encountered again, a {@linkcode ReferenceType} placeholder
 * is returned immediately and filled in once the actual type resolves.
 *
 * Registered automatically by the {@linkcode createParser} factory.
 *
 * @see {@linkcode CircularReferenceTypeFormatter} for the formatter equivalent.
 * @see {@linkcode ReferenceType} for the forward-reference placeholder.
 */
export class CircularReferenceNodeParser implements SubNodeParser {
    protected circular: Map<string, BaseType> = new Map();

    /**
     * @param childNodeParser - The wrapped parser that handles actual type creation.
     */
    public constructor(protected childNodeParser: SubNodeParser) {}

    /**
     * Returns `true` if the wrapped parser supports {@linkcode node}.
     *
     * @param node - The TypeScript AST node to test.
     * @returns `true` if the child parser can handle {@linkcode node}.
     */
    public supportsNode(node: ts.Node): boolean {
        return this.childNodeParser.supportsNode(node);
    }

    /**
     * Parses {@linkcode node} to a {@linkcode BaseType}, inserting a
     * {@linkcode ReferenceType} placeholder when {@linkcode node} is already
     * on the current parse stack (i.e., is part of a recursive type
     * definition).
     *
     * @param node - The TypeScript AST node to parse.
     * @param context - The current generic type-argument context.
     * @returns The resolved {@linkcode BaseType} for {@linkcode node}.
     */
    public createType(node: ts.Node, context: Context): BaseType {
        const key = getKey(node, context);
        if (this.circular.has(key)) {
            return this.circular.get(key)!;
        }

        const reference = new ReferenceType();
        this.circular.set(key, reference);
        const type = this.childNodeParser.createType(node, context, reference);
        if (type) {
            reference.setType(type);
        }
        this.circular.delete(key);

        return type;
    }
}
