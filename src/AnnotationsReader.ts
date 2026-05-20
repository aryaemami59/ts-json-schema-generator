import type ts from "typescript";
import type { Annotations } from "./Type/AnnotatedType.js";

/**
 * Extracts JSDoc annotation data from a TypeScript AST node. Used by
 * `AnnotatedNodeParser` to attach schema annotations (descriptions,
 * examples, defaults, etc.) to parsed types.
 *
 * @see {@linkcode BasicAnnotationsReader} for the standard implementation.
 * @see {@linkcode ExtendedAnnotationsReader} for the full-featured implementation.
 */
export interface AnnotationsReader {
    /**
     * Reads JSDoc annotations from `node` and returns them as an
     * {@linkcode Annotations} map, or `undefined` when no relevant
     * annotations are present.
     *
     * @param node - The TypeScript AST node to inspect.
     * @returns An {@linkcode Annotations} object, or `undefined`.
     */
    getAnnotations(node: ts.Node): Annotations | undefined;
}
