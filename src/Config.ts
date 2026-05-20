import type ts from "typescript";

/**
 * Configuration options for JSON schema generation.
 *
 * @example
 * <caption>Generate a schema for a single exported type</caption>
 *
 * ```ts
 * import { createGenerator } from 'ts-json-schema-generator';
 *
 * const schema = createGenerator({
 *   path: 'src/‎**‎/*.ts',
 *   type: ['MyInterface'],
 * }).createSchema();
 * ```
 *
 * @see {@linkcode DEFAULT_CONFIG} for the default values of each option.
 * @see {@linkcode CompletedConfig} for the resolved config type.
 * @see {@linkcode createGenerator}
 */
export interface Config {
    /**
     * Glob pattern(s) for source TypeScript files to process.
     * If not provided, falls back to files from tsconfig.
     */
    path?: string;

    /**
     * Name of the type(s)/interface(s) to generate schema for.
     * Use `"*"` to generate schemas for all exported types.
     */
    type?: string | string[];

    /**
     * Minify the output JSON schema (no whitespace).
     * When `false`, the schema is pretty-printed with 2-space indentation.
     *
     * @default false
     */
    minify?: boolean;

    /**
     * Sets the `$id` property in the root of the generated schema.
     * Used for schema identification and referencing.
     */
    schemaId?: string;

    /**
     * Path to a custom tsconfig.json file for TypeScript compilation.
     * If not provided, a built-in set of compiler options is used —
     * **not** the project's own `tsconfig.json`. The built-in defaults
     * enable `experimentalDecorators`, `emitDecoratorMetadata`,
     * `esModuleInterop`, and `skipLibCheck`, among others.
     */
    tsconfig?: string;

    /**
     * Controls which types are exposed as definitions in the schema.
     *
     * - `"all"`: Exposes all types except type literals.
     * - `"none"`: Exposes no types automatically.
     * - `"export"`: Only exposes exported types (respects `@internal` JSDoc tag).
     *
     * @default "export"
     */
    expose?: "all" | "none" | "export";

    /**
     * Wraps the root type in a `$ref` definition.
     * When `false`, inlines the root type definition directly.
     *
     * @default true
     */
    topRef?: boolean;

    /**
     * Controls how JSDoc comments are parsed and included in the
     * schema.
     *
     * - `"none"`: Ignores all JSDoc annotations.
     * - `"basic"`: Parses standard JSON Schema JSDoc tags.
     * - `"extended"`: Parses all tags plus descriptions, examples, and type overrides.
     *
     * @default "extended"
     */
    jsDoc?: "none" | "extended" | "basic";

    /**
     * Adds a `markdownDescription` field alongside `description` in the
     * schema. Preserves markdown formatting including newlines. Only works
     * with {@linkcode Config.jsDoc | jsDoc: "extended"}.
     *
     * @default false
     */
    markdownDescription?: boolean;

    /**
     * Includes the complete raw JSDoc comment as `fullDescription` in
     * the schema. Only works with {@linkcode Config.jsDoc | jsDoc: "extended"}.
     *
     * @default false
     */
    fullDescription?: boolean;

    /**
     * Sorts object properties alphabetically in the output.
     *
     * @default true
     */
    sortProps?: boolean;

    /**
     * Controls whether tuples allow additional items beyond their
     * defined length.
     *
     * @default false
     */
    strictTuples?: boolean;

    /**
     * Skips TypeScript type checking to improve performance.
     * Speeds up generation but may miss type errors.
     *
     * @default false
     */
    skipTypeCheck?: boolean;

    /**
     * URI-encodes `$ref` values (e.g., `#/definitions/Foo%3CBar%3E`). When
     * `false`, uses raw names in reference paths.
     *
     * @default true
     */
    encodeRefs?: boolean;

    /**
     * Array of additional JSDoc tag names to include in the schema.
     * Custom tags (e.g., `@customProperty`) are parsed and included in the
     * output. Values are parsed as JSON5.
     *
     * @default []
     */
    extraTags?: string[];

    /**
     * Sets the default value for `additionalProperties` on objects
     * without index signatures. When `false`, objects get
     * `additionalProperties: false` by default. When `true`, allows
     * additional properties on all objects.
     *
     * @default false
     */
    additionalProperties?: boolean;

    /**
     * Controls discriminator style for discriminated unions.
     *
     * - `"json-schema"`: Uses `if`/`then`/`allOf` with properties containing a discriminator enum.
     * - `"open-api"`: Uses OpenAPI 3.x style with `discriminator: { propertyName }` and `oneOf`.
     *
     * @default "json-schema"
     */
    discriminatorType?: "json-schema" | "open-api";

    /**
     * Controls how function types are handled in the schema.
     *
     * - `"fail"`: Throws an error when a function type is encountered.
     * - `"comment"`: Emits a `$comment` describing the function signature.
     * - `"hide"`: Treats function types as {@linkcode NeverType} (excluded from the schema).
     *
     * @default "comment"
     *
     * @see {@linkcode FunctionOptions} for the available values.
     */
    functions?: FunctionOptions;

    /**
     * Pre-compiled TypeScript Program instance to use. Bypasses the default
     * setup of a TypeScript program, so some configuration options may not be
     * applied. Useful for programmatic usage with existing TypeScript
     * compilation, or for vfs scenarios where you do not want file-system
     * representation.
     */
    tsProgram?: ts.Program;
}

/**
 * Default configuration values for JSON schema generation. These values are
 * used when corresponding options are not provided in the user configuration.
 *
 * @see {@linkcode Config} for option descriptions.
 * @see {@linkcode CompletedConfig} for the full merged type.
 */
export const DEFAULT_CONFIG: Omit<Required<Config>, "path" | "type" | "schemaId" | "tsconfig" | "tsProgram"> = {
    expose: "export",
    topRef: true,
    jsDoc: "extended",
    markdownDescription: false,
    fullDescription: false,
    sortProps: true,
    strictTuples: false,
    skipTypeCheck: false,
    encodeRefs: true,
    minify: false,
    extraTags: [],
    additionalProperties: false,
    discriminatorType: "json-schema",
    functions: "comment",
};

/**
 * A fully resolved {@linkcode Config} where all optional fields from
 * {@linkcode DEFAULT_CONFIG} are guaranteed to be present. Produced internally
 * by merging user config with {@linkcode DEFAULT_CONFIG}.
 *
 * @see {@linkcode createGenerator}
 */
export type CompletedConfig = Config & typeof DEFAULT_CONFIG;

/**
 * Controls how function types are handled during schema generation.
 *
 * - `"fail"`: Throws an error when a function type is encountered.
 * - `"comment"`: Emits a `$comment` describing the function signature.
 * - `"hide"`: Treats function types as {@linkcode NeverType} (excluded from the schema).
 *
 * @default "comment"
 *
 * @see {@linkcode Config.functions}
 */
export type FunctionOptions = "fail" | "comment" | "hide";
