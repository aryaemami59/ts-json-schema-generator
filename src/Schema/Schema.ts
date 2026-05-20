import type { JSONSchema7 } from "json-schema";

/**
 * The root JSON Schema draft-07 document produced by
 * {@linkcode SchemaGenerator}. Always includes a `$schema` property pointing
 * to the draft-07 URI.
 *
 * @see {@link https://json-schema.org/draft-07/json-schema-core | JSON Schema draft-07}
 * @see {@linkcode Definition} for non-root schema objects.
 * @see {@linkcode SchemaGenerator.createSchema}
 */
export type Schema = JSONSchema7;
