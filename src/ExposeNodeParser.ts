import ts from "typescript";
import type { Config } from "./Config.js";
import type { Context } from "./NodeParser.js";
import type { SubNodeParser } from "./SubNodeParser.js";
import type { BaseType } from "./Type/BaseType.js";
import { DefinitionType } from "./Type/DefinitionType.js";
import type { ReferenceType } from "./Type/ReferenceType.js";
import { hasJsDocTag } from "./Utils/hasJsDocTag.js";
import { symbolAtNode } from "./Utils/symbolAtNode.js";

/**
 * Wraps a {@linkcode SubNodeParser} and conditionally promotes parsed types
 * into named {@linkcode DefinitionType} instances based on the
 * {@linkcode Config.expose | expose} configuration setting.
 *
 * - `"all"`: Wraps every node except type literals.
 * - `"none"`: Never wraps nodes.
 * - `"export"`: Wraps only exported nodes, honouring `@internal` JSDoc tags.
 *
 * Registered automatically by the `createParser` factory.
 *
 * @see {@linkcode DefinitionType} for the named type wrapper.
 * @see {@linkcode Config.expose} for the configuration option.
 */
export class ExposeNodeParser implements SubNodeParser {
    /**
     * @param typeChecker - TypeScript type-checker used for symbol resolution.
     * @param subNodeParser - The wrapped parser that creates the base type.
     * @param expose - Controls which nodes are promoted to named definitions.
     * @param jsDoc - Parser mode; when not `"none"`, the `@internal` tag suppresses exposure.
     */
    public constructor(
        protected typeChecker: ts.TypeChecker,
        protected subNodeParser: SubNodeParser,
        protected expose: "all" | "none" | "export",
        protected jsDoc: "none" | "extended" | "basic",
    ) {}

    /**
     * Returns `true` if the wrapped parser supports {@linkcode node}.
     *
     * @param node - The TypeScript AST node to test.
     * @returns Whether the child parser can handle {@linkcode node}.
     */
    public supportsNode(node: ts.Node): boolean {
        return this.subNodeParser.supportsNode(node);
    }

    /**
     * Parses {@linkcode node} and wraps the result in a
     * {@linkcode DefinitionType} when the node qualifies for exposure under
     * the current {@linkcode Config.expose | expose} setting.
     *
     * @param node - The TypeScript AST node to parse.
     * @param context - The current generic type-argument context.
     * @param reference - An optional forward-reference placeholder.
     * @returns A {@linkcode DefinitionType} wrapping the base type when the node is exposed; otherwise the raw {@linkcode BaseType}.
     */
    public createType(node: ts.Node, context: Context, reference?: ReferenceType): BaseType {
        const baseType = this.subNodeParser.createType(node, context, reference);

        if (!this.isExportNode(node)) {
            return baseType;
        }

        return new DefinitionType(this.getDefinitionName(node, context), baseType);
    }

    /**
     * Determines whether {@linkcode node} should be promoted to a named
     * definition based on the configured {@linkcode Config.expose | expose}
     * mode. In `"export"` mode, nodes tagged `@internal` are excluded when
     * JSDoc parsing is active.
     *
     * @param node - The TypeScript AST node to evaluate.
     * @returns `true` if the node should be wrapped in a {@linkcode DefinitionType}.
     */
    protected isExportNode(node: ts.Node): boolean {
        if (this.expose === "all") {
            return node.kind !== ts.SyntaxKind.TypeLiteral;
        } else if (this.expose === "none") {
            return false;
        } else if (this.jsDoc !== "none" && hasJsDocTag(node, "internal")) {
            return false;
        }

        const localSymbol: ts.Symbol = (node as any).localSymbol;
        return localSymbol ? "exportSymbol" in localSymbol : false;
    }

    /**
     * Builds the definition name for {@linkcode node} by combining its
     * fully-qualified TypeScript symbol name with any bound generic
     * type arguments.
     *
     * @param node - The TypeScript AST node to name.
     * @param context - The current generic type-argument context.
     * @returns The definition name, including generic arguments when present (e.g. `MyType<string,number>`).
     */
    protected getDefinitionName(node: ts.Node, context: Context): string {
        const symbol = symbolAtNode(node)!;
        const fullName = this.typeChecker.getFullyQualifiedName(symbol).replace(/^".*"\./, "");
        const argumentIds = context.getArguments().map((arg) => arg?.getName());

        return argumentIds.length ? `${fullName}<${argumentIds.join(",")}>` : fullName;
    }
}
