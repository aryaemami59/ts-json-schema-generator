import type { Config } from "../src/Config.js";
import { DEFAULT_CONFIG } from "../src/Config.js";
import { SchemaGenerator } from "../src/SchemaGenerator.js";
import { createFormatter } from "./formatter.js";
import { createParser } from "./parser.js";
import { createProgram } from "./program.js";

/**
 * Creates a fully configured {@linkcode SchemaGenerator} by composing
 * a TypeScript program, a parser pipeline, and a formatter pipeline
 * from the supplied {@linkcode Config}.
 *
 * This is the recommended entry point for programmatic usage.
 *
 * @example
 * <caption>Generate a schema for a single exported interface</caption>
 *
 * ```ts
 * import { createGenerator } from 'ts-json-schema-generator';
 *
 * const schema = createGenerator({
 *   path: 'src/‎**‎/*.ts',
 *   type: ['MyInterface'],
 * }).createSchema();
 *
 * console.log(JSON.stringify(schema, null, 2));
 * ```
 *
 * @param config - Generator configuration. Optional fields fall back to {@linkcode DEFAULT_CONFIG} defaults.
 * @returns A {@linkcode SchemaGenerator} ready to call {@linkcode SchemaGenerator.createSchema | createSchema()}.
 * @see {@linkcode Config}
 * @see {@linkcode DEFAULT_CONFIG}
 */
export function createGenerator(config: Config): SchemaGenerator {
    const completedConfig = { ...DEFAULT_CONFIG, ...config };
    const program = config.tsProgram || createProgram(completedConfig);
    const parser = createParser(program, completedConfig);
    const formatter = createFormatter(completedConfig);

    return new SchemaGenerator(program, parser, formatter, completedConfig);
}
