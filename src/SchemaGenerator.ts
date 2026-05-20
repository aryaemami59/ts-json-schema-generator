import ts from "typescript";
import type { Config } from "./Config.js";
import { MultipleDefinitionsError, RootlessError, UnhandledError } from "./Error/Errors.js";
import type { NodeParser } from "./NodeParser.js";
import { Context } from "./NodeParser.js";
import type { Definition } from "./Schema/Definition.js";
import type { Schema } from "./Schema/Schema.js";
import { AnnotatedType } from "./Type/AnnotatedType.js";
import type { BaseType } from "./Type/BaseType.js";
import { DefinitionType } from "./Type/DefinitionType.js";
import type { TypeFormatter } from "./TypeFormatter.js";
import { castArray } from "./Utils/castArray.js";
import { hasJsDocTag } from "./Utils/hasJsDocTag.js";
import { removeUnreachable } from "./Utils/removeUnreachable.js";
import type { StringMap } from "./Utils/StringMap.js";
import { symbolAtNode } from "./Utils/symbolAtNode.js";

/**
 * Orchestrates schema generation by combining a TypeScript
 * {@linkcode ts.Program}, a {@linkcode NodeParser} pipeline, and a
 * {@linkcode TypeFormatter} pipeline into a single entry point.
 *
 * Use {@linkcode createGenerator} from the factory module to construct a fully
 * configured instance rather than calling this constructor directly.
 *
 * @example
 * <caption>Generate a schema for a named exported type</caption>
 *
 * ```ts
 * import { createGenerator } from 'ts-json-schema-generator';
 *
 * const generator = createGenerator({ path: 'src/‎**‎/*.ts' });
 * const schema = generator.createSchema('MyInterface');
 * console.log(JSON.stringify(schema, null, 2));
 * ```
 *
 * @example
 * <caption>Generate schemas for all exported types at once</caption>
 * ```ts
 * import { createGenerator } from 'ts-json-schema-generator';
 *
 * const schema = createGenerator({
 *   path: 'src/‎**‎/*.ts',
 *   type: ['*'],
 * }).createSchema();
 * ```
 *
 * @see {@linkcode createGenerator}
 * @see {@linkcode Config}
 */
export class SchemaGenerator {
    /**
     * @param program - A compiled TypeScript program providing source file and type-checker access.
     * @param nodeParser - The parser pipeline that converts AST nodes to internal {@linkcode BaseType} representations.
     * @param typeFormatter - The formatter pipeline that converts internal types to JSON Schema {@linkcode Definition} objects.
     * @param config - Optional generator configuration. When omitted, {@linkcode DEFAULT_CONFIG} values are assumed to already be applied.
     */
    public constructor(
        protected readonly program: ts.Program,
        protected readonly nodeParser: NodeParser,
        protected readonly typeFormatter: TypeFormatter,
        protected readonly config?: Config,
    ) {}

    /**
     * Generates a complete JSON Schema document for the given type
     * name(s). Pass `'*'` (or omit) to include all exported types.
     *
     * @param fullNames - One or more fully-qualified type names to use as schema roots. Omit or pass `'*'` to generate for all exported types.
     * @returns A {@linkcode Schema} object with a `$schema` property and a `definitions` map of reachable types.
     * @throws An {@linkcode Error} if `'*'` is mixed with specific names.
     * @throws A {@linkcode RootlessError} if a named type cannot be found.
     * @throws An {@linkcode UnhandledError} if parsing or formatting fails unexpectedly.
     */
    public createSchema(fullNames?: string | string[]): Schema {
        const rootNodes = this.getRootNodes(castArray(fullNames));
        return this.createSchemaFromNodes(rootNodes);
    }

    /**
     * Generates a JSON Schema document from pre-resolved TypeScript AST nodes.
     * Useful when the caller already has node references and wants to bypass
     * name resolution.
     *
     * @param rootNodes - TypeScript AST nodes to use as schema roots.
     * @returns A {@linkcode Schema} object with a `$schema` property and a `definitions` map of reachable types.
     * @throws An {@linkcode UnhandledError} if parsing or formatting fails unexpectedly.
     * @throws A {@linkcode MultipleDefinitionsError} if two types share the same definition name.
     */
    public createSchemaFromNodes(rootNodes: ts.Node[]): Schema {
        const roots = rootNodes.map((rootNode) => ({
            rootNode: rootNode,
            rootType: this.nodeParser.createType(rootNode, new Context()),
        }));

        const rootTypeDefinitions = roots.map((root) => this.getRootTypeDefinition(root.rootType, root.rootNode));
        const rootTypeDefinition = rootTypeDefinitions.length === 1 ? rootTypeDefinitions[0] : undefined;
        const definitions: StringMap<Definition> = {};

        for (const root of roots) {
            try {
                this.appendRootChildDefinitions(root.rootType, definitions);
            } catch (error) {
                throw UnhandledError.from(
                    "Unhandled error while appending Child Type Definition.",
                    root.rootNode,
                    error,
                );
            }
        }

        const reachableDefinitions = rootTypeDefinitions.reduce<StringMap<Definition>>(
            (acc, def) => Object.assign(acc, removeUnreachable(def, definitions)),
            {},
        );

        return {
            ...(this.config?.schemaId ? { $id: this.config.schemaId } : {}),
            $schema: "http://json-schema.org/draft-07/schema#",
            ...(rootTypeDefinition ?? {}),
            definitions: reachableDefinitions,
        };
    }

    /**
     * Resolves TypeScript AST nodes for the requested type names. Passing
     * `'*'` (or omitting) generates nodes for all exported types from the root
     * source files.
     *
     * @param fullNames - The requested type names, or `undefined` / `['*']` to generate all.
     * @returns An array of TypeScript nodes for the requested types.
     * @throws An {@linkcode Error} if `'*'` is mixed with specific names.
     * @throws A {@linkcode RootlessError} if a name cannot be found.
     */
    protected getRootNodes(fullNames: string[] | undefined): ts.Node[] {
        // ["*"] means generate everything.
        if (fullNames && fullNames.includes("*") && fullNames.length > 1) {
            throw new Error("Cannot mix '*' with specific type names");
        }

        const generateAll = !fullNames || fullNames.length === 0 || (fullNames.length === 1 && fullNames[0] === "*");
        if (!generateAll) {
            return fullNames.map((name) => this.findNamedNode(name));
        }

        const rootFileNames = this.program.getRootFileNames();
        const rootSourceFiles = this.program
            .getSourceFiles()
            .filter((sourceFile) => rootFileNames.includes(sourceFile.fileName));
        const rootNodes = new Map<string, ts.Node>();
        this.appendTypes(rootSourceFiles, this.program.getTypeChecker(), rootNodes);
        return [...rootNodes.values()];
    }

    /**
     * Locates the AST node for a single fully-qualified type name, searching
     * project files first and then external files.
     *
     * @param fullName - The fully-qualified type name to find.
     * @returns The TypeScript AST node for {@linkcode fullName}.
     * @throws A {@linkcode RootlessError} if {@linkcode fullName} is not found.
     */
    protected findNamedNode(fullName: string): ts.Node {
        const typeChecker = this.program.getTypeChecker();
        const allTypes = new Map<string, ts.Node>();
        const { projectFiles, externalFiles } = this.partitionFiles();

        this.appendTypes(projectFiles, typeChecker, allTypes);

        if (allTypes.has(fullName)) {
            return allTypes.get(fullName)!;
        }

        this.appendTypes(externalFiles, typeChecker, allTypes);

        if (allTypes.has(fullName)) {
            return allTypes.get(fullName)!;
        }

        throw new RootlessError(fullName);
    }

    /**
     * Converts the root {@linkcode BaseType} to a JSON Schema
     * {@linkcode Definition} via the formatter pipeline.
     *
     * @param rootType - The internal type to convert.
     * @param rootNode - The TypeScript node associated with the type, used for error reporting.
     * @returns The root {@linkcode Definition} for {@linkcode rootType}.
     * @throws An {@linkcode UnhandledError} on formatter failure.
     */
    protected getRootTypeDefinition(rootType: BaseType, rootNode: ts.Node): Definition {
        try {
            return this.typeFormatter.getDefinition(rootType);
        } catch (error) {
            throw UnhandledError.from("Unhandled error while creating Root Type Definition.", rootNode, error);
        }
    }

    /**
     * Collects all reachable {@linkcode DefinitionType} children of
     * {@linkcode rootType} into {@linkcode childDefinitions}, deduplicating by
     * name.
     *
     * @param rootType - The root type whose children to collect.
     * @param childDefinitions - The map to populate with definitions.
     * @throws A {@linkcode MultipleDefinitionsError} if two structurally distinct types share the same definition name.
     */
    protected appendRootChildDefinitions(rootType: BaseType, childDefinitions: StringMap<Definition>): void {
        const seen = new Set<string>();

        const children = this.typeFormatter
            .getChildren(rootType)
            .filter((child): child is DefinitionType => child instanceof DefinitionType)
            .filter((child) => {
                if (!seen.has(child.getId())) {
                    seen.add(child.getId());
                    return true;
                }
                return false;
            });

        const ids = new Map<string, string>();
        const baseIds = new Map<string, string>();
        for (const child of children) {
            const name = child.getName();
            const previousId = ids.get(name);
            // Strip def- prefixes from IDs. DefinitionType.getId() returns "def-{innerType.getId()}"
            // and for generic types, nested DefinitionTypes also add def- prefixes. Stripping all
            // of them normalizes the comparison for types that may be wrapped differently.
            const childId = child.getId().replace(/def-/g, "");
            // Also track the base type ID (without AnnotatedType wrapper) to handle cases where
            // the same type appears with different annotations (e.g., a discriminated union type
            // referenced directly vs from a property - one has @discriminator annotation, one doesn't)
            const innerType = child.getType();
            const baseChildId = (innerType instanceof AnnotatedType ? innerType.getType() : innerType).getId();
            const previousBaseId = baseIds.get(name);

            if (previousId && childId !== previousId) {
                // Check if the base type (without annotations) matches - if so, it's just
                // annotation differences, not truly different types
                if (previousBaseId === baseChildId) {
                    continue;
                }
                throw new MultipleDefinitionsError(
                    name,
                    child,
                    children.find((c) => c.getId().replace(/def-/g, "") === previousId),
                );
            }
            ids.set(name, childId);
            baseIds.set(name, baseChildId);
        }

        children.reduce((definitions, child) => {
            const name = child.getName();
            if (!(name in definitions)) {
                definitions[name] = this.typeFormatter.getDefinition(child.getType());
            }
            return definitions;
        }, childDefinitions);
    }

    /**
     * Splits all source files in the program into project files and
     * external files (those under `node_modules`).
     *
     * @returns `{ projectFiles, externalFiles }`.
     */
    protected partitionFiles(): {
        /**
         * Source files that are part of the user's project
         * (not under `node_modules`).
         */
        projectFiles: ts.SourceFile[];

        /**
         * Source files that are external dependencies (under `node_modules`).
         */
        externalFiles: ts.SourceFile[];
    } {
        const projectFiles = new Array<ts.SourceFile>();
        const externalFiles = new Array<ts.SourceFile>();

        for (const sourceFile of this.program.getSourceFiles()) {
            const destination = sourceFile.fileName.includes("/node_modules/") ? externalFiles : projectFiles;
            destination.push(sourceFile);
        }

        return { projectFiles, externalFiles };
    }

    /**
     * Walks each source file and populates `types` by calling
     * {@linkcode SchemaGenerator.inspectNode | inspectNode()}.
     *
     * @param sourceFiles - The source files to inspect.
     * @param typeChecker - The TypeScript type-checker.
     * @param types - The map to populate with discovered types.
     */
    protected appendTypes(
        sourceFiles: readonly ts.SourceFile[],
        typeChecker: ts.TypeChecker,
        types: Map<string, ts.Node>,
    ): void {
        for (const sourceFile of sourceFiles) {
            this.inspectNode(sourceFile, typeChecker, types);
        }
    }

    /**
     * Recursively inspects a TypeScript AST node, adding named and exported
     * type declarations to {@linkcode allTypes}.
     *
     * @param node - The node to inspect.
     * @param typeChecker - The TypeScript type-checker.
     * @param allTypes - The map to populate with discovered types.
     */
    protected inspectNode(node: ts.Node, typeChecker: ts.TypeChecker, allTypes: Map<string, ts.Node>): void {
        if (ts.isVariableDeclaration(node)) {
            if (
                node.initializer?.kind === ts.SyntaxKind.ArrowFunction ||
                node.initializer?.kind === ts.SyntaxKind.FunctionExpression
            ) {
                this.inspectNode(node.initializer, typeChecker, allTypes);
            }

            return;
        }

        if (
            ts.isInterfaceDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isEnumDeclaration(node) ||
            ts.isTypeAliasDeclaration(node)
        ) {
            if (
                (this.config?.expose === "all" || this.isExportType(node)) &&
                !this.isGenericType(node as ts.TypeAliasDeclaration)
            ) {
                allTypes.set(this.getFullName(node, typeChecker), node);
                return;
            }
            return;
        }

        if (
            ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) ||
            ts.isConstructorTypeNode(node)
        ) {
            allTypes.set(this.getFullName(node, typeChecker), node);
            return;
        }

        if (ts.isExportSpecifier(node)) {
            const symbol = typeChecker.getExportSpecifierLocalTargetSymbol(node);

            if (symbol?.declarations?.length === 1) {
                const declaration = symbol.declarations[0];

                if (ts.isImportSpecifier(declaration)) {
                    // Handling the `Foo` in `import { Foo } from "./lib"; export { Foo };`
                    const type = typeChecker.getTypeAtLocation(declaration);

                    if (type.symbol?.declarations?.length === 1) {
                        this.inspectNode(type.symbol.declarations[0], typeChecker, allTypes);
                    }
                } else {
                    // Handling the `Bar` in `export { Bar } from './lib';`
                    this.inspectNode(declaration, typeChecker, allTypes);
                }
            }

            return;
        }

        if (ts.isExportDeclaration(node)) {
            if (!ts.isExportDeclaration(node)) {
                return;
            }

            if (node.exportClause) {
                // export { Foo } from './lib' or export { Foo };
                // export * as Foo from './lib' should not import all exports
                ts.forEachChild(node.exportClause, (subnode) => this.inspectNode(subnode, typeChecker, allTypes));
                return;
            }

            if (!node.moduleSpecifier) {
                return;
            }

            // export * from './lib'
            const symbol = typeChecker.getSymbolAtLocation(node.moduleSpecifier);

            // should never hit this (maybe type error in user's code)
            if (!symbol || !symbol.declarations) {
                return;
            }

            // module augmentation can result in more than one source file
            for (const source of symbol.declarations) {
                const sourceSymbol = typeChecker.getSymbolAtLocation(source);

                if (!sourceSymbol) {
                    return;
                }

                const moduleExports = typeChecker.getExportsOfModule(sourceSymbol);

                for (const moduleExport of moduleExports) {
                    const nodes =
                        moduleExport.declarations ||
                        (!!moduleExport.valueDeclaration && [moduleExport.valueDeclaration]);

                    // should never hit this (maybe type error in user's code)
                    if (!nodes) {
                        return;
                    }

                    for (const subnodes of nodes) {
                        this.inspectNode(subnodes, typeChecker, allTypes);
                    }
                }
            }

            return;
        }

        ts.forEachChild(node, (subnode) => this.inspectNode(subnode, typeChecker, allTypes));
    }

    /**
     * Returns `true` when the node is exported and not tagged `@internal`
     * (when JSDoc parsing is enabled).
     *
     * @param node - The declaration node to test.
     * @returns Whether the node should be treated as an exported type.
     */
    protected isExportType(
        node: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.EnumDeclaration | ts.TypeAliasDeclaration,
    ): boolean {
        if (this.config?.jsDoc !== "none" && hasJsDocTag(node, "internal")) {
            return false;
        }

        //@ts-expect-error - internal typescript API
        return !!node.localSymbol?.exportSymbol;
    }

    /**
     * Returns `true` when the type alias declaration has type parameters
     * (i.e. is a generic type).
     *
     * @param node - The type alias declaration to test.
     * @returns `true` when the type alias declaration has type parameters (i.e. is a generic type).
     */
    protected isGenericType(node: ts.TypeAliasDeclaration): boolean {
        return !!(node.typeParameters && node.typeParameters.length > 0);
    }

    /**
     * Returns the fully-qualified name of the node's symbol, with any module
     * path prefix stripped.
     *
     * @param node - The declaration node to name.
     * @param typeChecker - The TypeScript type-checker.
     * @returns The fully-qualified name of the node's symbol, with any module path prefix stripped.
     */
    protected getFullName(node: ts.Declaration, typeChecker: ts.TypeChecker): string {
        return typeChecker.getFullyQualifiedName(symbolAtNode(node)!).replace(/".*"\./, "");
    }
}
