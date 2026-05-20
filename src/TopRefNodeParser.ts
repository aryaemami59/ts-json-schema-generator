import type ts from "typescript";
import type { Config } from "./Config.js";
import type { Context, NodeParser } from "./NodeParser.js";
import type { BaseType } from "./Type/BaseType.js";
import { DefinitionType } from "./Type/DefinitionType.js";

/**
 * Wraps a {@linkcode NodeParser} to apply the
 * {@linkcode Config.topRef | topRef} configuration option to the root type.
 *
 * - When {@linkcode Config.topRef | topRef} is `true` and the resolved type is not already a {@linkcode DefinitionType}, it is wrapped in one using {@linkcode fullName}.
 * - When {@linkcode Config.topRef | topRef} is `false` and the resolved type is a {@linkcode DefinitionType}, it is unwrapped to inline the definition.
 *
 * Registered automatically by the `createParser` factory.
 *
 * @see {@linkcode Config.topRef} for the configuration option.
 * @see {@linkcode DefinitionType} for the named type wrapper.
 */
export class TopRefNodeParser implements NodeParser {
    /**
     * @param childNodeParser - The wrapped parser that resolves the base type.
     * @param fullName - Type name used when wrapping the root in a {@linkcode DefinitionType}; may be `undefined` for anonymous roots.
     * @param topRef - When `true`, ensures the root type is a {@linkcode DefinitionType}.
     */
    public constructor(
        protected childNodeParser: NodeParser,
        protected fullName: string | undefined,
        protected topRef: boolean,
    ) {}

    /**
     * Resolves the root type and applies {@linkcode topRef} wrapping or
     * unwrapping.
     *
     * @param node - The TypeScript AST node to parse.
     * @param context - The current generic type-argument context.
     * @returns A {@linkcode DefinitionType} when {@linkcode topRef} is `true`; the unwrapped {@linkcode BaseType} when {@linkcode topRef} is `false`.
     */
    public createType(node: ts.Node, context: Context): BaseType {
        const baseType = this.childNodeParser.createType(node, context);

        if (this.topRef && !(baseType instanceof DefinitionType)) {
            return new DefinitionType(this.fullName, baseType);
        } else if (!this.topRef && baseType instanceof DefinitionType) {
            return baseType.getType();
        } else {
            return baseType;
        }
    }
}
